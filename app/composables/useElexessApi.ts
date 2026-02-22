/**
 * Elexess API integration composable.
 *
 * Provides rate-limited, cached search for component pricing/availability
 * via the Elexess REST API. Credentials are stored per-team in the teams table.
 */

import type { BomLine, BomPricingCache, BomPricingEntry } from '~/utils/bom-types'

/** Default cache TTL: 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const EXCHANGE_RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FALLBACK_USD_EUR_RATE = 0.844238

/** Suppliers to exclude from all Elexess results */
const BLOCKED_SUPPLIERS = new Set(['Winsource', 'ChipCart', 'Unikeyic', 'CoreStaff'])

/** Remove blocked suppliers from an Elexess response object (mutates in place). */
function stripBlockedSuppliers(data: any): any {
  if (data?.results && Array.isArray(data.results)) {
    data.results = data.results.filter(
      (r: any) => !BLOCKED_SUPPLIERS.has(r.supplier),
    )
  }
  return data
}

/** Delay between sequential API calls (ms) */
const RATE_LIMIT_DELAY_MS = 500

/** Delay before clearing the queue after all items are processed */
const QUEUE_CLEAR_DELAY_MS = 3000

// Simple sequential queue: only one request in-flight at a time
let queuePromise = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queuePromise.then(fn, fn)
  queuePromise = result.then(
    () => new Promise<void>(r => setTimeout(r, RATE_LIMIT_DELAY_MS)),
    () => new Promise<void>(r => setTimeout(r, RATE_LIMIT_DELAY_MS)),
  )
  return result
}

export interface PricingQueueItem {
  partNumber: string
  status: 'pending' | 'fetching' | 'done' | 'error'
}

export interface ExchangeRateSnapshot {
  sourceCurrency: 'USD' | 'EUR'
  targetCurrency: 'USD' | 'EUR'
  rate: number
  /** Date provided by Elexess, format YYYY-MM-DD */
  date: string
  /** Local fetch timestamp */
  fetchedAt: string
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function exchangeRateStorageKey(teamId: string): string {
  return `gerbtrace-exchange-rate-${teamId}`
}

function normalizeCurrencyCode(raw: string | null | undefined): 'USD' | 'EUR' | null {
  const v = String(raw ?? '').trim().toUpperCase()
  if (!v) return null
  if (v === 'USD' || v === 'US$' || v === '$' || v.includes('USD') || v.includes('$')) return 'USD'
  if (v === 'EUR' || v === 'EURO' || v === '€' || v.includes('EUR') || v.includes('EURO') || v.includes('€')) return 'EUR'
  return null
}

function buildFallbackExchangeRateSnapshot(): ExchangeRateSnapshot {
  return {
    sourceCurrency: 'USD',
    targetCurrency: 'EUR',
    rate: FALLBACK_USD_EUR_RATE,
    date: getTodayIsoDate(),
    fetchedAt: new Date().toISOString(),
  }
}

function extractJsonObjectFromText(raw: string): any | null {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

function looksLikeExchangeRatePayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false
  return !!payload.source_currency && !!payload.target_currency && payload.rate != null && !!payload.date
}

function extractExchangeRatePayloadFromText(raw: string): any | null {
  const source = raw.match(/"source_currency"\s*:\s*"([^"]+)"/i)?.[1]
  const target = raw.match(/"target_currency"\s*:\s*"([^"]+)"/i)?.[1]
  const rateRaw = raw.match(/"rate"\s*:\s*"?(\d+(?:\.\d+)?)"?/i)?.[1]
  const date = raw.match(/"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1]
  if (!source || !target || !rateRaw || !date) return null
  return {
    source_currency: source,
    target_currency: target,
    rate: rateRaw,
    date,
  }
}

export function useElexessApi() {
  const config = useRuntimeConfig()
  const supabase = useSupabase()
  const { currentTeam } = useTeam()
  const { canUseElexess, isAtElexessLimit, elexessSearchesRemaining, logUsageEvent, maxElexessSearches, elexessSearchesUsed } = useTeamPlan()

  const isEnabled = computed(() => {
    if (!canUseElexess.value) return false
    const team = currentTeam.value
    if (!team) return false
    return team.elexess_enabled !== false
  })

  const hasCredentials = computed(() => isEnabled.value)

  // ── Reactive queue state ──
  const isFetching = ref(false)
  const pricingQueue = ref<PricingQueueItem[]>([])
  const exchangeRate = ref<ExchangeRateSnapshot | null>(null)
  let clearTimer: ReturnType<typeof setTimeout> | null = null
  let cancelRequested = false

  async function getAuthToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Not authenticated')
    return token
  }

  function setQueueItemStatus(partNumber: string, status: PricingQueueItem['status']) {
    pricingQueue.value = pricingQueue.value.map(item =>
      item.partNumber === partNumber ? { ...item, status } : item,
    )
  }

  function scheduleClearQueue() {
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      pricingQueue.value = []
      clearTimer = null
    }, QUEUE_CLEAR_DELAY_MS)
  }

  function isFreshExchangeRate(snapshot: ExchangeRateSnapshot): boolean {
    const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime()
    return ageMs < EXCHANGE_RATE_CACHE_TTL_MS && snapshot.date === getTodayIsoDate()
  }

  function readExchangeRateFromStorage(teamId: string): ExchangeRateSnapshot | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(exchangeRateStorageKey(teamId))
      if (!raw) return null
      const parsed = JSON.parse(raw) as ExchangeRateSnapshot
      const sourceCurrency = normalizeCurrencyCode(parsed?.sourceCurrency)
      const targetCurrency = normalizeCurrencyCode(parsed?.targetCurrency)
      if (!sourceCurrency || !targetCurrency || typeof parsed.rate !== 'number') return null
      if (!Number.isFinite(parsed.rate) || parsed.rate <= 0) return null
      return {
        ...parsed,
        sourceCurrency,
        targetCurrency,
      }
    } catch {
      return null
    }
  }

  function writeExchangeRateToStorage(teamId: string, snapshot: ExchangeRateSnapshot) {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(exchangeRateStorageKey(teamId), JSON.stringify(snapshot))
    } catch {
      // Ignore storage failures.
    }
  }

  async function fetchExchangeRateFromApi(): Promise<ExchangeRateSnapshot | null> {
    const elexessBaseUrl = (config.public as any).elexessUrl as string || 'https://api.dev.elexess.com/api'
    const endpointUrls = [
      `${elexessBaseUrl}/exchange-rate`,
      'https://r.jina.ai/http://api.dev.elexess.com/api/exchange-rate',
    ]
    try {
      let payload: any = null
      let lastError: string | null = null

      // Prefer Supabase Edge Function proxy to avoid browser CORS issues.
      try {
        const { data, error } = await supabase.functions.invoke('elexess-exchange-rate', {
          body: {},
        })
        if (error) {
          lastError = error.message ?? 'Edge function error'
        } else if (looksLikeExchangeRatePayload(data)) {
          payload = data
        } else if (looksLikeExchangeRatePayload((data as any)?.data)) {
          payload = (data as any).data
        } else if (data) {
          lastError = 'Edge function returned non-rate payload'
        }
      } catch (err: any) {
        lastError = err?.message ?? 'Edge function network error'
      }

      // Fallback to direct API call (works when CORS is allowed).
      if (!payload) {
        for (const url of endpointUrls) {
          try {
            const response = await fetch(url, {
              headers: { Accept: 'application/json' },
            })
            if (!response.ok) {
              lastError = `${response.status} ${response.statusText}`
              continue
            }
            const body = await response.text()
            let parsedBody: any = null
            try {
              parsedBody = JSON.parse(body)
            } catch {
              parsedBody = null
            }

            if (looksLikeExchangeRatePayload(parsedBody)) {
              payload = parsedBody
            } else if (looksLikeExchangeRatePayload(parsedBody?.data)) {
              payload = parsedBody.data
            } else {
              const regexExtracted = extractExchangeRatePayloadFromText(body)
              if (looksLikeExchangeRatePayload(regexExtracted)) {
                payload = regexExtracted
              }
            }

            if (!payload) {
              const extracted = extractJsonObjectFromText(body)
              if (looksLikeExchangeRatePayload(extracted)) {
                payload = extracted
              } else if (looksLikeExchangeRatePayload((extracted as any)?.data)) {
                payload = (extracted as any).data
              } else {
                payload = null
              }
            }

            if (!payload) {
              lastError = 'Invalid exchange-rate payload'
              continue
            }
            break
          } catch (err: any) {
            lastError = err?.message ?? 'Network error'
          }
        }
      }

      if (!payload) {
        console.warn(`[Elexess] Exchange-rate request failed: ${lastError ?? 'unknown error'}`)
        return null
      }

      const sourceCurrency = normalizeCurrencyCode(payload?.source_currency)
      const targetCurrency = normalizeCurrencyCode(payload?.target_currency)
      const rate = Number(payload?.rate)
      const date = String(payload?.date ?? '')
      if (
        !sourceCurrency
        || !targetCurrency
        || !Number.isFinite(rate)
        || rate <= 0
        || !date
      ) {
        console.warn('[Elexess] Exchange-rate payload invalid:', JSON.stringify(payload))
        return null
      }
      return {
        sourceCurrency,
        targetCurrency,
        rate,
        date,
        fetchedAt: new Date().toISOString(),
      }
    } catch (err) {
      console.warn('[Elexess] Exchange-rate request error:', err)
      return null
    }
  }

  async function ensureExchangeRateForToday(): Promise<ExchangeRateSnapshot | null> {
    const teamId = currentTeam.value?.id
    if (!teamId) {
      // Keep last known rate when team context is temporarily unavailable.
      return exchangeRate.value
    }

    if (exchangeRate.value && isFreshExchangeRate(exchangeRate.value)) {
      return exchangeRate.value
    }

    const cached = readExchangeRateFromStorage(teamId)
    if (cached && isFreshExchangeRate(cached)) {
      exchangeRate.value = cached
      return cached
    }

    const latest = await fetchExchangeRateFromApi()
    if (!latest) {
      const fallback = buildFallbackExchangeRateSnapshot()
      exchangeRate.value = fallback
      writeExchangeRateToStorage(teamId, fallback)
      console.warn('[Elexess] Using fallback USD/EUR exchange rate due upstream fetch failure')
      return fallback
    }

    if (latest.date !== getTodayIsoDate()) {
      console.warn(`[Elexess] Exchange-rate date is not today: ${latest.date}`)
      const fallback = buildFallbackExchangeRateSnapshot()
      exchangeRate.value = fallback
      writeExchangeRateToStorage(teamId, fallback)
      console.warn('[Elexess] Using fallback USD/EUR exchange rate due stale upstream date')
      return fallback
    }

    exchangeRate.value = latest
    writeExchangeRateToStorage(teamId, latest)
    return latest
  }

  /**
   * Search Elexess for a manufacturer part number.
   * Rate-limited: enqueued to run sequentially with delay.
   */
  async function searchPart(partNumber: string): Promise<any | null> {
    if (!hasCredentials.value) return null

    return enqueue(async () => {
      const allowed = await logUsageEvent('elexess_search', { mpn: partNumber })
      if (!allowed) {
        console.warn(`[Elexess] Monthly search limit reached (${elexessSearchesUsed.value}/${maxElexessSearches.value})`)
        return null
      }

      try {
        const token = await getAuthToken()
        const teamId = currentTeam.value?.id
        if (!teamId) {
          console.warn('[Elexess] No team context available')
          return null
        }
        const result = await $fetch<any>('/api/elexess/search', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: {
            teamId,
            searchTerm: partNumber,
          },
        })
        return result
      } catch (err: any) {
        console.warn(`[Elexess] Search failed for "${partNumber}":`, err?.data?.statusMessage ?? err?.message)
        return null
      }
    })
  }

  /**
   * Fetch pricing for all manufacturer parts in a BOM that are missing
   * or have stale cache entries. Returns an updated pricing cache.
   */
  async function fetchAllPricing(
    bomLines: BomLine[],
    existingCache: BomPricingCache,
  ): Promise<BomPricingCache> {
    await ensureExchangeRateForToday()
    const cache = { ...existingCache }
    const now = Date.now()

    // Cancel any pending clear timer from a previous run
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }

    // Collect unique parts that need fetching
    const partsToFetch: string[] = []
    for (const line of bomLines) {
      for (const mfr of line.manufacturers) {
        if (!mfr.manufacturerPart) continue
        const existing = cache[mfr.manufacturerPart]
        if (existing && (now - new Date(existing.fetchedAt).getTime()) < CACHE_TTL_MS) continue
        if (!partsToFetch.includes(mfr.manufacturerPart)) {
          partsToFetch.push(mfr.manufacturerPart)
        }
      }
    }

    if (partsToFetch.length === 0) return cache

    // Build the queue with all items as pending
    pricingQueue.value = partsToFetch.map(partNumber => ({ partNumber, status: 'pending' as const }))
    isFetching.value = true
    cancelRequested = false

    for (const part of partsToFetch) {
      if (cancelRequested) break
      setQueueItemStatus(part, 'fetching')
      const data = await searchPart(part)
      if (cancelRequested) break
      if (data !== null) {
        cache[part] = { data, fetchedAt: new Date().toISOString() }
        setQueueItemStatus(part, 'done')
      } else {
        setQueueItemStatus(part, 'error')
      }
    }

    isFetching.value = false
    cancelRequested = false
    scheduleClearQueue()

    return cache
  }

  function cancelFetching() {
    cancelRequested = true
    isFetching.value = false
    pricingQueue.value = []
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }
  }

  /**
   * Fetch pricing for a single manufacturer part number.
   * Returns the updated cache entry, or null on failure.
   */
  async function fetchSinglePricing(partNumber: string): Promise<BomPricingEntry | null> {
    if (cancelRequested) {
      cancelRequested = false
      return null
    }
    await ensureExchangeRateForToday()
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }

    const existing = pricingQueue.value.find(i => i.partNumber === partNumber)
    if (existing) {
      setQueueItemStatus(partNumber, 'fetching')
    } else {
      pricingQueue.value = [...pricingQueue.value, { partNumber, status: 'fetching' }]
    }
    isFetching.value = true

    const data = await searchPart(partNumber)

    if (cancelRequested) {
      cancelRequested = false
      return null
    }

    if (data !== null) {
      setQueueItemStatus(partNumber, 'done')
    } else {
      setQueueItemStatus(partNumber, 'error')
    }

    // Check if all items are done
    const allDone = pricingQueue.value.every(i => i.status === 'done' || i.status === 'error')
    if (allDone) {
      isFetching.value = false
      scheduleClearQueue()
    }

    if (data === null) return null
    return { data, fetchedAt: new Date().toISOString() }
  }

  /**
   * Strip blocked suppliers from every entry in an existing pricing cache.
   * Returns a new cache object without mutating the original cache.
   */
  function cleanPricingCache(cache: BomPricingCache): BomPricingCache {
    const next: BomPricingCache = { ...cache }
    for (const key of Object.keys(next)) {
      const entry = next[key]
      if (!entry) continue
      const data = entry.data
      if (!data) continue
      let clonedData: any
      try {
        clonedData = structuredClone(data)
      } catch {
        clonedData = JSON.parse(JSON.stringify(data))
      }
      next[key] = { ...entry, data: stripBlockedSuppliers(clonedData) }
    }
    return next
  }

  watch(() => currentTeam.value?.id, (teamId) => {
    if (!teamId) {
      // Keep last known rate during transient team-context gaps.
      return
    }
    exchangeRate.value = readExchangeRateFromStorage(teamId)
    // Ensure we have a fresh conversion rate even when pricing was loaded from persisted cache.
    ensureExchangeRateForToday().catch((err) => {
      console.warn('[Elexess] Failed to refresh exchange rate:', err)
    })
  }, { immediate: true })

  return {
    isEnabled,
    hasCredentials,
    isFetching: readonly(isFetching),
    pricingQueue: readonly(pricingQueue),
    exchangeRate: readonly(exchangeRate),
    isAtElexessLimit,
    elexessSearchesRemaining,
    searchPart,
    fetchAllPricing,
    fetchSinglePricing,
    cancelFetching,
    ensureExchangeRateForToday,
    cleanPricingCache,
  }
}

/**
 * Elexess API integration composable.
 *
 * Provides rate-limited, cached search for component pricing/availability
 * via the Elexess REST API. Credentials are stored per-team in the teams table.
 */

import type { BomLine, BomPricingCache, BomPricingEntry } from '~/utils/bom-types'

/** Default cache TTL: 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

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

export function useElexessApi() {
  const config = useRuntimeConfig()
  const { currentTeam } = useTeam()

  const baseUrl = computed(() => (config.public as any).elexessUrl as string || 'https://api.dev.elexess.com/api')

  const hasCredentials = computed(() => {
    return !!(currentTeam.value?.elexess_username && currentTeam.value?.elexess_password)
  })

  // ── Reactive queue state ──
  const isFetching = ref(false)
  const pricingQueue = ref<PricingQueueItem[]>([])
  let clearTimer: ReturnType<typeof setTimeout> | null = null

  function authHeaders(): HeadersInit {
    if (!currentTeam.value?.elexess_username || !currentTeam.value?.elexess_password) return {}
    const encoded = btoa(`${currentTeam.value.elexess_username}:${currentTeam.value.elexess_password}`)
    return { Authorization: `Basic ${encoded}` }
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

  /**
   * Search Elexess for a manufacturer part number.
   * Rate-limited: enqueued to run sequentially with delay.
   */
  async function searchPart(partNumber: string): Promise<any | null> {
    if (!hasCredentials.value) return null

    return enqueue(async () => {
      try {
        const url = `${baseUrl.value}/search?searchterm=${encodeURIComponent(partNumber)}`
        const response = await fetch(url, {
          headers: {
            ...authHeaders(),
            Accept: 'application/json',
          },
        })
        if (!response.ok) {
          console.warn(`[Elexess] Search failed for "${partNumber}": ${response.status} ${response.statusText}`)
          return null
        }
        const json = await response.json()
        return stripBlockedSuppliers(json)
      } catch (err) {
        console.error(`[Elexess] Search error for "${partNumber}":`, err)
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

    for (const part of partsToFetch) {
      setQueueItemStatus(part, 'fetching')
      const data = await searchPart(part)
      if (data !== null) {
        cache[part] = { data, fetchedAt: new Date().toISOString() }
        setQueueItemStatus(part, 'done')
      } else {
        setQueueItemStatus(part, 'error')
      }
    }

    isFetching.value = false
    scheduleClearQueue()

    return cache
  }

  /**
   * Fetch pricing for a single manufacturer part number.
   * Returns the updated cache entry, or null on failure.
   */
  async function fetchSinglePricing(partNumber: string): Promise<BomPricingEntry | null> {
    // Cancel any pending clear timer
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }

    // Add to queue (or update existing entry)
    const existing = pricingQueue.value.find(i => i.partNumber === partNumber)
    if (existing) {
      setQueueItemStatus(partNumber, 'fetching')
    } else {
      pricingQueue.value = [...pricingQueue.value, { partNumber, status: 'fetching' }]
    }
    isFetching.value = true

    const data = await searchPart(partNumber)

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
      const clonedData = typeof structuredClone === 'function'
        ? structuredClone(data)
        : JSON.parse(JSON.stringify(data))
      next[key] = { ...entry, data: stripBlockedSuppliers(clonedData) }
    }
    return next
  }

  return {
    hasCredentials,
    isFetching: readonly(isFetching),
    pricingQueue: readonly(pricingQueue),
    searchPart,
    fetchAllPricing,
    fetchSinglePricing,
    cleanPricingCache,
  }
}

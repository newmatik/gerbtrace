/**
 * BOM (Bill of Materials) state management composable.
 *
 * Watches layers for BOM files, parses them, and exposes reactive BOM
 * line data for the BomPanel. Follows the same pattern as usePickAndPlace.
 */

import type { LayerInfo } from '~/utils/gerber-helpers'
import { isBomLayer, isBomFile } from '~/utils/gerber-helpers'
import { parseBomFile, buildBomLines } from '~/utils/bom-parser'
import type { BomParseResult } from '~/utils/bom-parser'
import type { BomLine, BomManufacturer, BomColumnMapping, BomPricingCache, BomLineType, BomGroup } from '~/utils/bom-types'

interface BomFileImportOptions {
  skipRows?: number
  skipBottomRows?: number
  mapping?: BomColumnMapping
  fixedColumns?: readonly number[]
  delimiter?: ',' | ';' | '\t' | 'fixed'
  decimal?: '.' | ','
  extraColumns?: readonly string[]
}

function normalizeImportKey(name: string): string {
  return name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '')
}

export function useBom(layers: Ref<LayerInfo[]>) {
  interface CachedLayerParse {
    signature: string
    result: BomParseResult
  }

  // ── Core state ──
  /** The current (editable) BOM lines (may be persisted / modified). */
  const bomLines = shallowRef<BomLine[]>([])
  /** Parsed BOM lines from customer-provided BOM files (baseline for diff-highlighting). */
  const customerBomLines = shallowRef<BomLine[]>([])
  const pricingCache = ref<BomPricingCache>({})
  const boardQuantity = ref(1)

  // ── Field mapping state (for when auto-detect fails) ──
  const needsFieldMapping = ref(false)
  const pendingParseResult = ref<BomParseResult | null>(null)
  const hasPersistedBomLines = ref(false)
  const fileImportOptions = ref<Record<string, BomFileImportOptions>>({})
  const parsedLayerCache = new Map<string, CachedLayerParse>()

  // ── Derived state ──
  const hasBom = computed(() => {
    return (bomLines.value.length > 0 || customerBomLines.value.length > 0)
      || layers.value.some(l => isBomLayer(l.type) || isBomFile(l.file.fileName))
  })

  const bomLayers = computed(() =>
    layers.value.filter(l => isBomLayer(l.type) || isBomFile(l.file.fileName)),
  )

  // ── Search / filter ──
  const searchQuery = ref('')
  const debouncedSearchQuery = ref('')
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, (query) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery.value = query
    }, 120)
  }, { immediate: true })
  onScopeDispose(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  })

  const filteredLines = computed(() => {
    if (!debouncedSearchQuery.value.trim()) return bomLines.value
    const q = debouncedSearchQuery.value.toLowerCase()
    return bomLines.value.filter(line =>
      line.description.toLowerCase().includes(q)
      || line.references.toLowerCase().includes(q)
      || line.package.toLowerCase().includes(q)
      || line.customerItemNo.toLowerCase().includes(q)
      || line.comment.toLowerCase().includes(q)
      || line.manufacturers.some(m =>
        m.manufacturer.toLowerCase().includes(q)
        || m.manufacturerPart.toLowerCase().includes(q),
      ),
    )
  })

  // ── Watch layers for BOM files and auto-parse ──
  function parseAllBomLayers() {
    const activeLayerKeys = new Set<string>()
    const parsedCustomer: BomLine[] = []
    let unresolvedParse: BomParseResult | null = null
    const previousParsedSnapshot = customerBomLines.value

    for (const layer of bomLayers.value) {
      const opts = resolveFileImportOptions(layer.file.fileName)
      const cacheKey = layerCacheKey(layer)
      activeLayerKeys.add(cacheKey)
      const signature = layerParseSignature(layer, opts)
      const cached = parsedLayerCache.get(cacheKey)
      const result = (cached && cached.signature === signature)
        ? cached.result
        : parseBomFile(layer.file.fileName, layer.file.content, opts)
      if (!cached || cached.signature !== signature) {
        parsedLayerCache.set(cacheKey, { signature, result })
      }

      if (result.lines) {
        parsedCustomer.push(...result.lines)
      } else if (!unresolvedParse && result.headers.length > 0 && result.rows.length > 0) {
        unresolvedParse = result
      }
    }

    // Prune cache entries for removed layers.
    for (const key of parsedLayerCache.keys()) {
      if (!activeLayerKeys.has(key)) parsedLayerCache.delete(key)
    }

    const dedupedParsed = dedupeParsedLines(parsedCustomer)
    customerBomLines.value = dedupedParsed
    needsFieldMapping.value = unresolvedParse != null
    pendingParseResult.value = unresolvedParse

    if (!hasPersistedBomLines.value) {
      // Initial import path: editable BOM is the parsed snapshot.
      bomLines.value = dedupedParsed.map(line => ({ ...line }))
      return
    }

    // First parse after restoring a persisted project has no parsed baseline
    // because customerBomLines is not persisted. In that case, stale imported
    // rows from older import settings can remain in bomLines forever.
    // If the restored editable BOM is larger than the freshly parsed source,
    // prefer the parsed snapshot as authoritative to clean up stale rows.
    if (previousParsedSnapshot.length === 0 && dedupedParsed.length > 0 && bomLines.value.length > dedupedParsed.length) {
      bomLines.value = dedupedParsed.map(line => ({ ...line }))
      return
    }

    // Persisted/manual BOM path: reconcile existing BOM against latest parsed snapshot.
    mergeParsedLines(dedupedParsed, previousParsedSnapshot)
  }

  const bomLayerSignature = computed(() =>
    bomLayers.value
      .map((layer) => {
        const text = layer.file.content
        const head = text.slice(0, 160)
        const tail = text.slice(Math.max(0, text.length - 160))
        return `${layer.file.fileName}:${text.length}:${layer.type}:${head}:${tail}`
      })
      .join('|'),
  )
  const bomImportOptionSignature = computed(() =>
    JSON.stringify(fileImportOptions.value),
  )
  watch([bomLayerSignature, bomImportOptionSignature], () => {
    parseAllBomLayers()
  }, { immediate: true })

  function normalizeKeyPart(value: string | number | null | undefined): string {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  }

  function manufacturerSignature(manufacturers: readonly BomManufacturer[] | undefined): string {
    return (manufacturers ?? [])
      .map(m => `${normalizeKeyPart(m.manufacturer)}|${normalizeKeyPart(m.manufacturerPart)}`)
      .filter(s => s !== '|')
      .sort()
      .join('||')
  }

  function lineMergeKey(line: BomLine): string {
    const refs = normalizeKeyPart(line.references)
    if (refs) return `ref:${refs}`
    return [
      'sig',
      normalizeKeyPart(line.description),
      normalizeKeyPart(line.package),
      normalizeKeyPart(line.customerItemNo),
      normalizeKeyPart(line.comment),
      normalizeKeyPart(line.quantity),
      normalizeKeyPart(line.type),
      manufacturerSignature(line.manufacturers),
    ].join('|')
  }

  function lineMatchKey(line: BomLine): string {
    const refs = normalizeKeyPart(line.references)
    if (refs) return `ref:${refs}`
    return [
      'soft',
      normalizeKeyPart(line.description),
      normalizeKeyPart(line.package),
      normalizeKeyPart(line.customerItemNo),
      normalizeKeyPart(line.comment),
      normalizeKeyPart(line.quantity),
      normalizeKeyPart(line.type),
    ].join('|')
  }

  function mergeParsedCustomerLines(newLines: BomLine[]) {
    const existingKeys = new Set(customerBomLines.value.map(lineMergeKey))
    const merged = [...customerBomLines.value]
    for (const line of newLines) {
      const key = lineMergeKey(line)
      if (existingKeys.has(key)) continue
      merged.push(line)
      existingKeys.add(key)
    }
    customerBomLines.value = merged
  }

  function dedupeParsedLines(lines: BomLine[]): BomLine[] {
    const seen = new Set<string>()
    const out: BomLine[] = []
    for (const line of lines) {
      const key = lineMergeKey(line)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(line)
    }
    return out
  }

  function buildLineIndex(lines: readonly BomLine[]): Map<string, number> {
    const index = new Map<string, number>()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      index.set(lineMergeKey(line), i)
      index.set(lineMatchKey(line), i)
    }
    return index
  }

  function hasLineInIndex(index: ReadonlyMap<string, number>, line: BomLine): boolean {
    return index.has(lineMergeKey(line)) || index.has(lineMatchKey(line))
  }

  function mergeParsedLines(newLines: BomLine[], previousParsedLines: readonly BomLine[] = []) {
    const previousParsedIndex = buildLineIndex(previousParsedLines)
    const newParsedIndex = buildLineIndex(newLines)

    // Drop stale imported lines that disappeared from source after re-parse
    // (e.g. when skip/header import options are corrected). Keep manual-only lines.
    const merged = bomLines.value.filter((line) => {
      const existedInPreviousImport = hasLineInIndex(previousParsedIndex, line)
      if (!existedInPreviousImport) return true
      const stillInParsedSource = hasLineInIndex(newParsedIndex, line)
      return stillInParsedSource
    })

    const byLineKey = new Map<string, number>()
    for (let i = 0; i < merged.length; i++) {
      const strictKey = lineMergeKey(merged[i]!)
      const matchKey = lineMatchKey(merged[i]!)
      byLineKey.set(strictKey, i)
      byLineKey.set(matchKey, i)
    }

    for (const parsed of newLines) {
      const strictKey = lineMergeKey(parsed)
      const matchKey = lineMatchKey(parsed)
      const existingIdx = byLineKey.get(strictKey) ?? byLineKey.get(matchKey)
      if (existingIdx == null) {
        merged.push(parsed)
        byLineKey.set(strictKey, merged.length - 1)
        byLineKey.set(matchKey, merged.length - 1)
        continue
      }

      const existing = merged[existingIdx]!
      merged[existingIdx] = {
        ...existing,
        description: existing.description || parsed.description,
        package: existing.package || parsed.package,
        customerItemNo: existing.customerItemNo || parsed.customerItemNo,
        comment: existing.comment || parsed.comment,
        quantity: existing.quantity > 0 ? existing.quantity : parsed.quantity,
        type: existing.type || parsed.type,
        manufacturers: mergeManufacturers(existing.manufacturers, parsed.manufacturers),
        ...(parsed.extra ? { extra: parsed.extra } : {}),
      }
      const updated = merged[existingIdx]!
      byLineKey.set(lineMergeKey(updated), existingIdx)
      byLineKey.set(lineMatchKey(updated), existingIdx)
    }

    bomLines.value = merged
  }

  function mergeManufacturers(
    existing: readonly BomManufacturer[] | undefined,
    parsed: readonly BomManufacturer[] | undefined,
  ): BomManufacturer[] {
    const out: BomManufacturer[] = []
    const seen = new Set<string>()
    const pushUnique = (m: BomManufacturer) => {
      const key = `${String(m.manufacturer ?? '').trim().toLowerCase()}|${String(m.manufacturerPart ?? '').trim().toLowerCase()}`
      if (!key || key === '|') return
      if (seen.has(key)) return
      seen.add(key)
      out.push({
        manufacturer: String(m.manufacturer ?? ''),
        manufacturerPart: String(m.manufacturerPart ?? ''),
      })
    }
    for (const m of existing ?? []) pushUnique(m)
    for (const m of parsed ?? []) pushUnique(m)
    return out
  }

  // ── Field mapping resolution ──
  function applyFieldMapping(mapping: BomColumnMapping) {
    if (!pendingParseResult.value) return
    const pr = pendingParseResult.value
    const lines = buildBomLines(pr.rows, mapping, { headers: pr.headers })
    const deduped = dedupeParsedLines(lines)
    const previousParsedSnapshot = customerBomLines.value
    mergeParsedCustomerLines(deduped)
    mergeParsedLines(deduped, previousParsedSnapshot)
    pendingParseResult.value = null
    needsFieldMapping.value = false
  }

  function setFileImportOptions(fileName: string, options: BomFileImportOptions) {
    fileImportOptions.value = {
      ...fileImportOptions.value,
      [fileName]: { ...options },
    }
    // Config changed; next parse should rebuild this layer result.
    for (const key of parsedLayerCache.keys()) {
      if (key.endsWith(`::${fileName}`)) parsedLayerCache.delete(key)
    }
  }

  function setFileImportOptionsMap(optionsMap: Record<string, BomFileImportOptions> | null | undefined) {
    fileImportOptions.value = optionsMap ? { ...optionsMap } : {}
    parsedLayerCache.clear()
  }

  function resolveFileImportOptions(fileName: string): BomFileImportOptions | undefined {
    const map = fileImportOptions.value
    const exact = map[fileName]
    if (exact) return exact

    const entries = Object.entries(map)
    if (entries.length === 0) return undefined

    const caseInsensitive = entries.find(([key]) => key.toLowerCase() === fileName.toLowerCase())
    if (caseInsensitive) return caseInsensitive[1]

    const target = normalizeImportKey(fileName)
    const normalizedMatches = entries.filter(([key]) => normalizeImportKey(key) === target)
    if (normalizedMatches.length === 1) return normalizedMatches[0]![1]

    // Last-resort fallback: preserve settings when only one BOM file exists.
    if (entries.length === 1) return entries[0]![1]
    return undefined
  }

  function cancelFieldMapping() {
    pendingParseResult.value = null
    needsFieldMapping.value = false
  }

  // ── CRUD operations ──

  function addLine(line?: Partial<BomLine>) {
    hasPersistedBomLines.value = true
    const newLine: BomLine = {
      id: crypto.randomUUID(),
      description: line?.description ?? '',
      type: line?.type ?? 'SMD',
      customerProvided: line?.customerProvided ?? false,
      customerItemNo: line?.customerItemNo ?? '',
      quantity: line?.quantity ?? 1,
      package: line?.package ?? '',
      references: line?.references ?? '',
      comment: line?.comment ?? '',
      dnp: line?.dnp ?? false,
      manufacturers: line?.manufacturers ?? [],
    }
    bomLines.value = [...bomLines.value, newLine]
    return newLine
  }

  function updateLine(id: string, updates: Partial<BomLine>) {
    const idx = bomLines.value.findIndex(l => l.id === id)
    if (idx < 0) return
    hasPersistedBomLines.value = true
    bomLines.value = bomLines.value.map((l, i) =>
      i === idx ? { ...l, ...updates, id: l.id } : l,
    )
  }

  function removeLine(id: string) {
    hasPersistedBomLines.value = true
    bomLines.value = bomLines.value.filter(l => l.id !== id)
  }

  function addManufacturer(lineId: string, mfr: BomManufacturer) {
    const line = bomLines.value.find(l => l.id === lineId)
    if (!line) return
    hasPersistedBomLines.value = true
    const isDup = line.manufacturers.some(
      m => m.manufacturer === mfr.manufacturer && m.manufacturerPart === mfr.manufacturerPart,
    )
    if (isDup) return
    updateLine(lineId, { manufacturers: [...line.manufacturers, mfr] })
  }

  function removeManufacturer(lineId: string, index: number) {
    const line = bomLines.value.find(l => l.id === lineId)
    if (!line) return
    hasPersistedBomLines.value = true
    const mfrs = [...line.manufacturers]
    mfrs.splice(index, 1)
    updateLine(lineId, { manufacturers: mfrs })
  }

  // ── Groups ──

  const bomGroups = ref<BomGroup[]>([])

  function addGroup(name: string): BomGroup {
    const existing = bomGroups.value.find(g => g.name === name)
    if (existing) return existing
    const group: BomGroup = { id: crypto.randomUUID(), name, comment: '', collapsed: false }
    bomGroups.value = [...bomGroups.value, group]
    return group
  }

  function removeGroup(groupId: string) {
    bomGroups.value = bomGroups.value.filter(g => g.id !== groupId)
    bomLines.value = bomLines.value.map(l =>
      l.groupId === groupId ? { ...l, groupId: null } : l,
    )
  }

  function updateGroup(groupId: string, updates: Partial<Omit<BomGroup, 'id'>>) {
    bomGroups.value = bomGroups.value.map(g =>
      g.id === groupId ? { ...g, ...updates } : g,
    )
  }

  function reorderGroups(orderedIds: string[]) {
    const byId = new Map(bomGroups.value.map(g => [g.id, g]))
    const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean) as BomGroup[]
    bomGroups.value = reordered
  }

  function assignGroup(lineId: string, groupId: string | null) {
    updateLine(lineId, { groupId: groupId ?? null })
  }

  function moveLineBefore(draggedId: string, targetId: string) {
    const list = [...bomLines.value]
    const dragIdx = list.findIndex(l => l.id === draggedId)
    if (dragIdx < 0) return
    const [dragged] = list.splice(dragIdx, 1)
    const targetIdx = list.findIndex(l => l.id === targetId)
    if (targetIdx < 0) list.push(dragged!)
    else list.splice(targetIdx, 0, dragged!)
    hasPersistedBomLines.value = true
    bomLines.value = list
  }

  function moveLineToEnd(draggedId: string) {
    const list = [...bomLines.value]
    const dragIdx = list.findIndex(l => l.id === draggedId)
    if (dragIdx < 0) return
    const [dragged] = list.splice(dragIdx, 1)
    list.push(dragged!)
    hasPersistedBomLines.value = true
    bomLines.value = list
  }

  function setBomGroups(groups: BomGroup[] | null | undefined) {
    bomGroups.value = groups ? [...groups] : []
  }

  const bomGroupsRecord = computed<BomGroup[]>(() => bomGroups.value.map(g => ({ ...g })))

  // ── Pricing cache ──

  function updatePricingCache(cache: BomPricingCache) {
    pricingCache.value = { ...cache }
  }

  function updateSinglePricing(partNumber: string, data: any) {
    pricingCache.value = {
      ...pricingCache.value,
      [partNumber]: { data, fetchedAt: new Date().toISOString() },
    }
  }

  // ── Persistence helpers (plain records for watcher serialization) ──

  const bomLinesRecord = computed<BomLine[]>(() => bomLines.value.map(l => ({ ...l })))
  const customerBomLinesRecord = computed<BomLine[]>(() => customerBomLines.value.map(l => ({ ...l })))
  const pricingCacheRecord = computed<BomPricingCache>(() => ({ ...pricingCache.value }))
  const fileImportOptionsRecord = computed<Record<string, BomFileImportOptions>>(() => ({ ...fileImportOptions.value }))

  // ── Restore from persisted data ──

  function setBomLines(lines: BomLine[] | null | undefined) {
    if (!lines || lines.length === 0) {
      // No persisted data — leave bomLines empty so the watcher can parse from file content.
      // Do NOT mark files as parsed here; the watcher callback is still queued and needs to run.
      return
    }
    hasPersistedBomLines.value = true
    bomLines.value = [...lines]
  }

  function setPricingCache(cache: BomPricingCache | null | undefined) {
    pricingCache.value = cache ? { ...cache } : {}
  }

  function setBoardQuantity(qty: number | null | undefined) {
    boardQuantity.value = qty && qty > 0 ? qty : 1
  }

  /** Total pieces for a line: boardQuantity * line.quantity */
  function totalPieces(line: BomLine): number {
    return boardQuantity.value * line.quantity
  }

  // ── Reset ──

  function resetBom() {
    bomLines.value = []
    customerBomLines.value = []
    bomGroups.value = []
    pricingCache.value = {}
    fileImportOptions.value = {}
    parsedLayerCache.clear()
    needsFieldMapping.value = false
    pendingParseResult.value = null
    searchQuery.value = ''
    hasPersistedBomLines.value = false
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
  }

  function layerCacheKey(layer: LayerInfo): string {
    return `${layer.type}::${layer.file.fileName}`
  }

  function layerParseSignature(layer: LayerInfo, opts?: BomFileImportOptions): string {
    const text = layer.file.content
    const head = text.slice(0, 200)
    const tail = text.slice(Math.max(0, text.length - 200))
    return `${text.length}|${head}|${tail}|${JSON.stringify(opts ?? {})}`
  }

  return {
    // State
    bomLines: readonly(bomLines),
    customerBomLines: readonly(customerBomLines),
    pricingCache: readonly(pricingCache),
    boardQuantity,
    hasBom,
    filteredLines,
    searchQuery,

    // Field mapping
    needsFieldMapping: readonly(needsFieldMapping),
    pendingParseResult: readonly(pendingParseResult),
    applyFieldMapping,
    cancelFieldMapping,
    setFileImportOptions,
    setFileImportOptionsMap,
    resolveFileImportOptions,
    fileImportOptions: readonly(fileImportOptions),

    // CRUD
    addLine,
    updateLine,
    removeLine,
    addManufacturer,
    removeManufacturer,

    // Groups
    bomGroups: readonly(bomGroups),
    addGroup,
    removeGroup,
    updateGroup,
    reorderGroups,
    assignGroup,
    moveLineBefore,
    moveLineToEnd,

    // Pricing
    updatePricingCache,
    updateSinglePricing,

    // Persistence
    bomLinesRecord,
    customerBomLinesRecord,
    bomGroupsRecord,
    pricingCacheRecord,
    fileImportOptionsRecord,
    setBomLines,
    setBomGroups,
    setPricingCache,
    setBoardQuantity,
    totalPieces,

    // Reset
    resetBom,
  }
}

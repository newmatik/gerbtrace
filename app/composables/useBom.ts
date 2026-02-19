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
import type { BomLine, BomManufacturer, BomColumnMapping, BomPricingCache, BomLineType } from '~/utils/bom-types'

interface BomFileImportOptions {
  skipRows?: number
  mapping?: BomColumnMapping
}

export function useBom(layers: Ref<LayerInfo[]>) {
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
    customerBomLines.value = []
    needsFieldMapping.value = false
    pendingParseResult.value = null
    if (!hasPersistedBomLines.value) {
      bomLines.value = []
    }

    for (const layer of bomLayers.value) {
      const opts = fileImportOptions.value[layer.file.fileName]
      const result = parseBomFile(layer.file.fileName, layer.file.content, opts)

      if (result.lines) {
        // Auto/Manual mapping succeeded — merge into baseline, and into editable BOM only if not restored from persistence yet.
        mergeParsedCustomerLines(result.lines)
        if (!hasPersistedBomLines.value) {
          mergeParsedLines(result.lines)
        }
      } else if (result.headers.length > 0 && result.rows.length > 0) {
        // Auto-mapping failed — prompt for field mapping
        pendingParseResult.value = result
        needsFieldMapping.value = true
      }
    }
  }

  const bomLayerSignature = computed(() =>
    bomLayers.value
      .map(layer => `${layer.file.fileName}:${layer.file.content.length}:${layer.type}`)
      .join('|'),
  )
  const bomImportOptionSignature = computed(() =>
    JSON.stringify(fileImportOptions.value),
  )
  watch([bomLayerSignature, bomImportOptionSignature], () => {
    parseAllBomLayers()
  }, { immediate: true })

  function mergeParsedCustomerLines(newLines: BomLine[]) {
    const existingKeys = new Set(customerBomLines.value.map(l => l.references))
    const merged = [...customerBomLines.value]
    for (const line of newLines) {
      if (line.references && existingKeys.has(line.references)) continue
      merged.push(line)
    }
    customerBomLines.value = merged
  }

  function mergeParsedLines(newLines: BomLine[]) {
    const existingRefs = new Set(bomLines.value.map(l => l.references))
    const merged = [...bomLines.value]
    for (const line of newLines) {
      if (line.references && existingRefs.has(line.references)) continue
      merged.push(line)
    }
    bomLines.value = merged
  }

  // ── Field mapping resolution ──
  function applyFieldMapping(mapping: BomColumnMapping) {
    if (!pendingParseResult.value) return
    const lines = buildBomLines(pendingParseResult.value.rows, mapping)
    mergeParsedCustomerLines(lines)
    if (!hasPersistedBomLines.value) {
      mergeParsedLines(lines)
    }
    pendingParseResult.value = null
    needsFieldMapping.value = false
  }

  function setFileImportOptions(fileName: string, options: BomFileImportOptions) {
    fileImportOptions.value = {
      ...fileImportOptions.value,
      [fileName]: { ...options },
    }
  }

  function setFileImportOptionsMap(optionsMap: Record<string, BomFileImportOptions> | null | undefined) {
    fileImportOptions.value = optionsMap ? { ...optionsMap } : {}
  }

  function cancelFieldMapping() {
    pendingParseResult.value = null
    needsFieldMapping.value = false
  }

  // ── CRUD operations ──

  function addLine(line?: Partial<BomLine>) {
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
    bomLines.value = bomLines.value.map((l, i) =>
      i === idx ? { ...l, ...updates, id: l.id } : l,
    )
  }

  function removeLine(id: string) {
    bomLines.value = bomLines.value.filter(l => l.id !== id)
  }

  function addManufacturer(lineId: string, mfr: BomManufacturer) {
    const line = bomLines.value.find(l => l.id === lineId)
    if (!line) return
    const isDup = line.manufacturers.some(
      m => m.manufacturer === mfr.manufacturer && m.manufacturerPart === mfr.manufacturerPart,
    )
    if (isDup) return
    updateLine(lineId, { manufacturers: [...line.manufacturers, mfr] })
  }

  function removeManufacturer(lineId: string, index: number) {
    const line = bomLines.value.find(l => l.id === lineId)
    if (!line) return
    const mfrs = [...line.manufacturers]
    mfrs.splice(index, 1)
    updateLine(lineId, { manufacturers: mfrs })
  }

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
    pricingCache.value = {}
    fileImportOptions.value = {}
    needsFieldMapping.value = false
    pendingParseResult.value = null
    searchQuery.value = ''
    hasPersistedBomLines.value = false
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
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
    fileImportOptions: readonly(fileImportOptions),

    // CRUD
    addLine,
    updateLine,
    removeLine,
    addManufacturer,
    removeManufacturer,

    // Pricing
    updatePricingCache,
    updateSinglePricing,

    // Persistence
    bomLinesRecord,
    customerBomLinesRecord,
    pricingCacheRecord,
    fileImportOptionsRecord,
    setBomLines,
    setPricingCache,
    setBoardQuantity,
    totalPieces,

    // Reset
    resetBom,
  }
}

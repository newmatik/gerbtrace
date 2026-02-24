/**
 * AI BOM enrichment composable (Spark).
 *
 * Manages AI-suggested improvements for BOM lines.
 * Suggestions are stored separately from BOM data and can be accepted or dismissed per field.
 */

import type { BomLine, BomManufacturer, AiSuggestion, BomAiSuggestions } from '~/utils/bom-types'

/**
 * Returns only the suggestion fields that actually differ from the current
 * BOM line, or null if nothing actionable remains.
 */
function mfrKey(m: BomManufacturer): string {
  return `${(m.manufacturer ?? '').trim().toLowerCase()}|${(m.manufacturerPart ?? '').trim().toLowerCase()}`
}

function diffSuggestion(suggestion: AiSuggestion, line: BomLine, groupNameById?: Map<string, string>): AiSuggestion | null {
  const next: AiSuggestion = {}
  if (suggestion.description && suggestion.description !== line.description) next.description = suggestion.description
  if (suggestion.type && suggestion.type !== line.type) next.type = suggestion.type
  if (suggestion.pinCount != null && suggestion.pinCount !== line.pinCount) next.pinCount = suggestion.pinCount
  if (suggestion.smdClassification && suggestion.smdClassification !== line.smdClassification) next.smdClassification = suggestion.smdClassification
  if (suggestion.group) {
    const currentGroupName = line.groupId && groupNameById ? groupNameById.get(line.groupId) : undefined
    if (suggestion.group !== currentGroupName) next.group = suggestion.group
  }
  if (suggestion.manufacturers && suggestion.manufacturers.length > 0) {
    const existing = new Set(line.manufacturers.map(mfrKey))
    const novel = suggestion.manufacturers.filter(m => !existing.has(mfrKey(m)))
    if (novel.length > 0) next.manufacturers = novel
  }
  return Object.keys(next).length > 0 ? next : null
}

export function useAiEnrichment() {
  const aiSuggestions = useState<BomAiSuggestions>('spark-ai-suggestions', () => ({}))
  const isEnriching = useState<boolean>('spark-is-enriching', () => false)
  const enrichError = useState<string | null>('spark-enrich-error', () => null)
  const { currentTeam } = useTeam()

  const { canUseSparkAi, logUsageEvent, isAtSparkAiLimit } = useTeamPlan()

  const isAiEnabled = computed(() => {
    return !!(canUseSparkAi.value && currentTeam.value?.ai_enabled && !isAtSparkAiLimit.value)
  })

  async function enrichBom(
    bomLines: BomLine[],
    smdPnpComponents: any[],
    thtPnpComponents: any[],
    existingGroups?: { id: string; name: string }[],
  ): Promise<BomAiSuggestions> {
    if (!currentTeam.value?.ai_enabled) {
      throw new Error('Spark AI is not enabled for this team')
    }

    isEnriching.value = true
    enrichError.value = null

    const activeLines = bomLines.filter(l => !l.dnp)

    if (!canUseSparkAi.value) {
      throw new Error('Spark AI requires a Pro plan or higher')
    }

    const supabase = useSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Not authenticated')

    try {
      // #region agent log
      fetch('http://127.0.0.1:7453/ingest/5870fb78-28fc-4f6a-a0a8-cbd461ff0af2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40e20a' }, body: JSON.stringify({ sessionId: '40e20a', runId: `run-${Date.now()}`, hypothesisId: 'H2', location: 'useAiEnrichment.ts:73', message: 'enrichBom invoke start', data: { teamId: currentTeam.value?.id ?? null, activeLinesCount: activeLines.length, endpoint: 'main/ai-enrich-bom' }, timestamp: Date.now() }) }).catch(() => {})
      // #endregion
      const { data: result, error } = await supabase.functions.invoke<{ suggestions: BomAiSuggestions }>('main/ai-enrich-bom', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          teamId: currentTeam.value.id,
          bomLines: activeLines,
          smdPnpComponents,
          thtPnpComponents,
          existingGroups: existingGroups ?? [],
        },
      })
      if (error) throw error
      if (!result) throw new Error('AI enrichment failed')

      const raw = result.suggestions ?? {}
      const lineMap = new Map(bomLines.map(l => [l.id, l]))
      const groupNameById = new Map((existingGroups ?? []).map(g => [g.id, g.name]))
      const cleaned: BomAiSuggestions = {}
      for (const [id, s] of Object.entries(raw)) {
        const line = lineMap.get(id)
        if (!line) continue
        const diff = diffSuggestion(s, line, groupNameById)
        if (diff) cleaned[id] = diff
      }

      aiSuggestions.value = cleaned

      logUsageEvent('spark_ai_run', { bom_line_count: activeLines.length }).catch(() => {})

      return cleaned
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7453/ingest/5870fb78-28fc-4f6a-a0a8-cbd461ff0af2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40e20a' }, body: JSON.stringify({ sessionId: '40e20a', runId: `run-${Date.now()}`, hypothesisId: 'H2', location: 'useAiEnrichment.ts:103', message: 'enrichBom invoke failed', data: { status: err?.status ?? err?.statusCode ?? null, message: err?.message ?? null, statusMessage: err?.data?.statusMessage ?? null }, timestamp: Date.now() }) }).catch(() => {})
      // #endregion
      enrichError.value = err?.data?.data?.message ?? err?.data?.statusMessage ?? err?.message ?? 'AI enrichment failed'
      throw err
    } finally {
      isEnriching.value = false
    }
  }

  /**
   * Remove suggestion fields that now match the current BOM data.
   * Call after any BOM line update so the count stays accurate.
   */
  function cleanMatchingSuggestions(bomLines: BomLine[]) {
    const current = aiSuggestions.value
    if (Object.keys(current).length === 0) return

    const lineMap = new Map(bomLines.map(l => [l.id, l]))
    const cleaned: BomAiSuggestions = {}
    let changed = false

    for (const [id, s] of Object.entries(current)) {
      const line = lineMap.get(id)
      if (!line) { changed = true; continue }
      const diff = diffSuggestion(s, line)
      if (diff) {
        cleaned[id] = diff
        if (diff !== s) changed = true
      } else {
        changed = true
      }
    }

    if (changed) aiSuggestions.value = cleaned
  }

  function getSuggestion(lineId: string): AiSuggestion | null {
    return aiSuggestions.value[lineId] ?? null
  }

  type SuggestionField = 'description' | 'type' | 'pinCount' | 'smdClassification' | 'manufacturers' | 'group'

  function acceptSuggestion(
    lineId: string,
    field: SuggestionField,
    applyToLine: (lineId: string, updates: Partial<BomLine>) => void,
  ) {
    const suggestion = aiSuggestions.value[lineId]
    if (!suggestion) return

    if (field === 'description' && suggestion.description != null) {
      applyToLine(lineId, { description: suggestion.description })
    } else if (field === 'type' && suggestion.type != null) {
      applyToLine(lineId, { type: suggestion.type })
    } else if (field === 'pinCount' && suggestion.pinCount != null) {
      applyToLine(lineId, { pinCount: suggestion.pinCount })
    } else if (field === 'smdClassification' && suggestion.smdClassification != null) {
      applyToLine(lineId, { smdClassification: suggestion.smdClassification })
    }

    dismissSuggestion(lineId, field)
  }

  function dismissSuggestion(lineId: string, field: SuggestionField) {
    const suggestion = aiSuggestions.value[lineId]
    if (!suggestion) return

    const next = { ...suggestion }
    delete next[field]

    if (Object.keys(next).length > 0) {
      aiSuggestions.value = { ...aiSuggestions.value, [lineId]: next }
    } else {
      const copy = { ...aiSuggestions.value }
      delete copy[lineId]
      aiSuggestions.value = copy
    }
  }

  function acceptAll(
    lineId: string,
    applyToLine: (lineId: string, updates: Partial<BomLine>) => void,
    addManufacturer: (lineId: string, mfr: BomManufacturer) => void,
    assignGroup?: (lineId: string, groupName: string) => void,
  ) {
    const suggestion = aiSuggestions.value[lineId]
    if (!suggestion) return

    const updates: Partial<BomLine> = {}
    if (suggestion.description != null) updates.description = suggestion.description
    if (suggestion.type != null) updates.type = suggestion.type
    if (suggestion.pinCount != null) updates.pinCount = suggestion.pinCount
    if (suggestion.smdClassification != null) updates.smdClassification = suggestion.smdClassification

    if (Object.keys(updates).length > 0) {
      applyToLine(lineId, updates)
    }

    if (suggestion.manufacturers) {
      for (const mfr of suggestion.manufacturers) {
        addManufacturer(lineId, mfr)
      }
    }

    if (suggestion.group && assignGroup) {
      assignGroup(lineId, suggestion.group)
    }

    const copy = { ...aiSuggestions.value }
    delete copy[lineId]
    aiSuggestions.value = copy
  }

  function removeSuggestedManufacturer(lineId: string, mfr: BomManufacturer) {
    const suggestion = aiSuggestions.value[lineId]
    if (!suggestion?.manufacturers) return

    const remaining = suggestion.manufacturers.filter(
      m => m.manufacturer !== mfr.manufacturer || m.manufacturerPart !== mfr.manufacturerPart,
    )

    if (remaining.length === 0) {
      dismissSuggestion(lineId, 'manufacturers')
    } else {
      aiSuggestions.value = {
        ...aiSuggestions.value,
        [lineId]: { ...suggestion, manufacturers: remaining },
      }
    }
  }

  function dismissAll(lineId: string) {
    const copy = { ...aiSuggestions.value }
    delete copy[lineId]
    aiSuggestions.value = copy
  }

  function setSuggestions(suggestions: BomAiSuggestions) {
    aiSuggestions.value = suggestions
  }

  function clearAllSuggestions() {
    aiSuggestions.value = {}
  }

  const pendingLineIds = computed(() => Object.keys(aiSuggestions.value))

  const pendingSuggestionCount = computed(() => pendingLineIds.value.length)

  return {
    isAiEnabled,
    isEnriching: readonly(isEnriching),
    enrichError: readonly(enrichError),
    aiSuggestions: readonly(aiSuggestions),
    pendingLineIds,
    pendingSuggestionCount,
    enrichBom,
    getSuggestion,
    cleanMatchingSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    removeSuggestedManufacturer,
    acceptAll,
    dismissAll,
    setSuggestions,
    clearAllSuggestions,
  }
}

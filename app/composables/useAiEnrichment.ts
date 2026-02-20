/**
 * AI BOM enrichment composable (Spark).
 *
 * Manages AI-suggested improvements for BOM lines.
 * Suggestions are stored separately from BOM data and can be accepted or dismissed per field.
 */

import type { BomLine, BomManufacturer, AiSuggestion, BomAiSuggestions } from '~/utils/bom-types'

export function useAiEnrichment() {
  const aiSuggestions = useState<BomAiSuggestions>('spark-ai-suggestions', () => ({}))
  const isEnriching = useState<boolean>('spark-is-enriching', () => false)
  const enrichError = useState<string | null>('spark-enrich-error', () => null)
  const { currentTeam } = useTeam()

  const isAiEnabled = computed(() => {
    return !!(currentTeam.value?.ai_enabled && currentTeam.value?.ai_api_key && currentTeam.value?.ai_model)
  })

  async function enrichBom(
    bomLines: BomLine[],
    smdPnpComponents: any[],
    thtPnpComponents: any[],
  ): Promise<BomAiSuggestions> {
    if (!currentTeam.value?.ai_api_key || !currentTeam.value?.ai_model) {
      throw new Error('AI not configured')
    }

    isEnriching.value = true
    enrichError.value = null

    try {
      const result = await $fetch<{ suggestions: BomAiSuggestions }>('/api/ai/enrich-bom', {
        method: 'POST',
        body: {
          apiKey: currentTeam.value.ai_api_key,
          model: currentTeam.value.ai_model,
          bomLines,
          smdPnpComponents,
          thtPnpComponents,
        },
      })

      aiSuggestions.value = result.suggestions ?? {}
      return aiSuggestions.value
    } catch (err: any) {
      enrichError.value = err?.data?.data?.message ?? err?.data?.statusMessage ?? err?.message ?? 'AI enrichment failed'
      throw err
    } finally {
      isEnriching.value = false
    }
  }

  function getSuggestion(lineId: string): AiSuggestion | null {
    return aiSuggestions.value[lineId] ?? null
  }

  function hasSuggestions(lineId: string): boolean {
    const s = aiSuggestions.value[lineId]
    if (!s) return false
    return !!(
      s.description
      || s.type
      || s.pinCount != null
      || s.smdClassification
      || (s.manufacturers && s.manufacturers.length > 0)
    )
  }

  type SuggestionField = keyof AiSuggestion

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
    } else if (field === 'manufacturers' && suggestion.manufacturers) {
      // Manufacturers are handled externally (added one by one)
    }

    dismissSuggestion(lineId, field)
  }

  function dismissSuggestion(lineId: string, field: SuggestionField) {
    const suggestion = aiSuggestions.value[lineId]
    if (!suggestion) return

    const next = { ...suggestion }
    delete next[field]

    const hasRemaining = !!(
      next.description
      || next.type
      || next.pinCount != null
      || next.smdClassification
      || (next.manufacturers && next.manufacturers.length > 0)
    )

    if (hasRemaining) {
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

    const copy = { ...aiSuggestions.value }
    delete copy[lineId]
    aiSuggestions.value = copy
  }

  function dismissAll(lineId: string) {
    const copy = { ...aiSuggestions.value }
    delete copy[lineId]
    aiSuggestions.value = copy
  }

  function setSuggestions(suggestions: BomAiSuggestions) {
    aiSuggestions.value = suggestions
  }

  const pendingSuggestionCount = computed(() => {
    return Object.keys(aiSuggestions.value).length
  })

  return {
    isAiEnabled,
    isEnriching: readonly(isEnriching),
    enrichError: readonly(enrichError),
    aiSuggestions: readonly(aiSuggestions),
    pendingSuggestionCount,
    enrichBom,
    getSuggestion,
    hasSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    acceptAll,
    dismissAll,
    setSuggestions,
  }
}

import { computePanelLayout } from './panel-geometry'
import { DEFAULT_PANEL_CONFIG, evenTabPositions, type PanelConfig, PANEL_MAX_HEIGHT, PANEL_MAX_WIDTH } from './panel-types'

export interface PanelSuggestionLimits {
  preferredWidthMm?: number | null
  preferredHeightMm?: number | null
  maxWidthMm?: number | null
  maxHeightMm?: number | null
}

type PanelEdgeName = 'top' | 'bottom' | 'left' | 'right'

export interface EdgeRangeMm {
  startMm: number
  endMm: number
}

export interface PanelSuggestionEdgeConstraints {
  prohibitScoredEdges?: Partial<Record<PanelEdgeName, boolean>>
  tabKeepoutsMm?: Partial<Record<PanelEdgeName, EdgeRangeMm[]>>
  forceSupportBetweenPcbs?: {
    x?: boolean
    y?: boolean
  }
  smdProtrudingEdges?: Partial<Record<PanelEdgeName, boolean>>
}

export interface PanelSuggestionInput {
  boardWidthMm: number
  boardHeightMm: number
  thicknessMm?: number | null
  limits?: PanelSuggestionLimits | null
  edgeConstraints?: PanelSuggestionEdgeConstraints | null
  maxSuggestions?: number
}

export interface PanelSuggestion {
  id: string
  title: string
  panelWidthMm: number
  panelHeightMm: number
  score: number
  config: PanelConfig
  reasons: string[]
  warnings: string[]
  exceedsPreferredEnvelope: boolean
  exceedsMaximumEnvelope: boolean
}

interface CandidateDefinition {
  separationType: PanelConfig['separationType']
  edges: PanelConfig['edges']
  label: string
}

const DEFAULT_PREFERRED_WIDTH_MM = 300
const DEFAULT_PREFERRED_HEIGHT_MM = 250

function normalizeThickness(thicknessMm?: number | null): number {
  if (!thicknessMm || !Number.isFinite(thicknessMm) || thicknessMm <= 0) return 1.6
  return thicknessMm
}

function stabilitySpanLimitMm(thicknessMm: number): number {
  if (thicknessMm <= 0.8) return 120
  if (thicknessMm <= 1.0) return 150
  if (thicknessMm <= 1.2) return 180
  if (thicknessMm <= 1.6) return 220
  return 260
}

function axisPenalty(value: number, target: number): number {
  return Math.abs(value - target) / Math.max(1, target)
}

function envelopePenalty(width: number, height: number, targetWidth: number, targetHeight: number): number {
  const normal = axisPenalty(width, targetWidth) + axisPenalty(height, targetHeight)
  const rotated = axisPenalty(height, targetWidth) + axisPenalty(width, targetHeight)
  return Math.min(normal, rotated)
}

function fitsEnvelope(width: number, height: number, envelopeWidth: number, envelopeHeight: number): boolean {
  return (width <= envelopeWidth && height <= envelopeHeight)
    || (height <= envelopeWidth && width <= envelopeHeight)
}

function getMaxedLimits(limits?: PanelSuggestionLimits | null) {
  const preferredWidth = limits?.preferredWidthMm ?? DEFAULT_PREFERRED_WIDTH_MM
  const preferredHeight = limits?.preferredHeightMm ?? DEFAULT_PREFERRED_HEIGHT_MM
  const maxWidth = limits?.maxWidthMm ?? PANEL_MAX_WIDTH
  const maxHeight = limits?.maxHeightMm ?? PANEL_MAX_HEIGHT
  return { preferredWidth, preferredHeight, maxWidth, maxHeight }
}

function pickCenteredGapIndices(gapCount: number, supportCount: number): number[] {
  if (gapCount <= 0 || supportCount <= 0) return []
  if (supportCount >= gapCount) return Array.from({ length: gapCount }, (_, i) => i)

  const out = new Set<number>()
  for (let i = 1; i <= supportCount; i++) {
    const ratio = i / (supportCount + 1)
    const idx = Math.round(ratio * (gapCount - 1))
    out.add(Math.max(0, Math.min(gapCount - 1, idx)))
  }
  return Array.from(out).sort((a, b) => a - b)
}

function separationCandidates(): CandidateDefinition[] {
  return [
    {
      separationType: 'mixed',
      label: 'Mixed (TB V-Cut, LR routed)',
      edges: {
        top: { type: 'scored' },
        bottom: { type: 'scored' },
        left: { type: 'routed' },
        right: { type: 'routed' },
      },
    },
    {
      separationType: 'routed',
      label: 'Routed',
      edges: {
        top: { type: 'routed' },
        bottom: { type: 'routed' },
        left: { type: 'routed' },
        right: { type: 'routed' },
      },
    },
    {
      separationType: 'mixed',
      label: 'Mixed (TB routed, LR V-Cut)',
      edges: {
        top: { type: 'routed' },
        bottom: { type: 'routed' },
        left: { type: 'scored' },
        right: { type: 'scored' },
      },
    },
    {
      separationType: 'scored',
      label: 'V-Cut',
      edges: {
        top: { type: 'scored' },
        bottom: { type: 'scored' },
        left: { type: 'scored' },
        right: { type: 'scored' },
      },
    },
  ]
}

function isScoreAllowedForCandidate(
  candidate: CandidateDefinition,
  prohibited: Partial<Record<PanelEdgeName, boolean>>,
): boolean {
  const edgeIsScored = (edge: PanelEdgeName): boolean =>
    candidate.separationType === 'scored'
      || (candidate.separationType === 'mixed' && candidate.edges[edge].type === 'scored')
  for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
    if (prohibited[edge] && edgeIsScored(edge)) return false
  }
  return true
}

function edgeLengthFor(
  edge: PanelEdgeName,
  boardWidthMm: number,
  boardHeightMm: number,
  rotation: number,
): number {
  const rot = ((rotation % 360) + 360) % 360
  const rotated = rot === 90 || rot === 270
  const width = rotated ? boardHeightMm : boardWidthMm
  const height = rotated ? boardWidthMm : boardHeightMm
  return (edge === 'top' || edge === 'bottom') ? width : height
}

function rangesContain(ranges: EdgeRangeMm[], positionMm: number): boolean {
  for (const r of ranges) {
    if (positionMm >= r.startMm && positionMm <= r.endMm) return true
  }
  return false
}

function mergeRanges(ranges: EdgeRangeMm[]): EdgeRangeMm[] {
  if (!ranges.length) return []
  const sorted = [...ranges]
    .map(r => ({ startMm: Math.min(r.startMm, r.endMm), endMm: Math.max(r.startMm, r.endMm) }))
    .sort((a, b) => a.startMm - b.startMm)
  const out: EdgeRangeMm[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.startMm <= last.endMm) {
      last.endMm = Math.max(last.endMm, cur.endMm)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

function computeAllowedSegments(edgeLengthMm: number, blockedRanges: EdgeRangeMm[]): Array<{ start: number, end: number }> {
  const blocked = mergeRanges(blockedRanges)
    .map(r => ({
      start: Math.max(0, Math.min(edgeLengthMm, r.startMm)),
      end: Math.max(0, Math.min(edgeLengthMm, r.endMm)),
    }))
    .filter(r => r.end > r.start)
  if (!blocked.length) return [{ start: 0, end: edgeLengthMm }]
  const allowed: Array<{ start: number, end: number }> = []
  let cursor = 0
  for (const b of blocked) {
    if (b.start > cursor) allowed.push({ start: cursor, end: b.start })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < edgeLengthMm) allowed.push({ start: cursor, end: edgeLengthMm })
  return allowed.filter(s => s.end > s.start)
}

function pickTabPositionsWithinAllowed(
  edgeLengthMm: number,
  desiredCount: number,
  blockedRanges: EdgeRangeMm[],
): number[] {
  const allowed = computeAllowedSegments(edgeLengthMm, blockedRanges)
  if (!allowed.length || edgeLengthMm <= 0 || desiredCount <= 0) return []

  const totalAllowed = allowed.reduce((sum, s) => sum + (s.end - s.start), 0)
  if (totalAllowed <= 0) return []

  const positions: number[] = []
  for (let i = 1; i <= desiredCount; i++) {
    const targetDist = (i / (desiredCount + 1)) * totalAllowed
    let rem = targetDist
    let mm = allowed[allowed.length - 1]!.end
    for (const seg of allowed) {
      const len = seg.end - seg.start
      if (rem <= len) {
        mm = seg.start + rem
        break
      }
      rem -= len
    }
    const normalized = Math.max(0, Math.min(1, mm / edgeLengthMm))
    positions.push(Math.round(normalized * 10000) / 10000)
  }
  return positions
}

function applyTabKeepoutsToConfig(
  cfg: PanelConfig,
  boardWidthMm: number,
  boardHeightMm: number,
  constraints?: PanelSuggestionEdgeConstraints | null,
): { config: PanelConfig, blockedTabCount: number } {
  const keepouts = constraints?.tabKeepoutsMm
  if (!keepouts) return { config: cfg, blockedTabCount: 0 }
  const seamKeepouts: Record<PanelEdgeName, EdgeRangeMm[]> = {
    top: mergeRanges([...(keepouts.top ?? []), ...(keepouts.bottom ?? [])]),
    bottom: mergeRanges([...(keepouts.bottom ?? []), ...(keepouts.top ?? [])]),
    left: mergeRanges([...(keepouts.left ?? []), ...(keepouts.right ?? [])]),
    right: mergeRanges([...(keepouts.right ?? []), ...(keepouts.left ?? [])]),
  }

  const out: PanelConfig = {
    ...cfg,
    tabs: {
      ...cfg.tabs,
      edgeOverrides: { ...cfg.tabs.edgeOverrides },
    },
  }
  let blockedTabCount = 0

  type TabCountField = 'defaultCountTop' | 'defaultCountBottom' | 'defaultCountLeft' | 'defaultCountRight'
  const edgeToField: Record<PanelEdgeName, TabCountField> = {
    top: 'defaultCountTop',
    bottom: 'defaultCountBottom',
    left: 'defaultCountLeft',
    right: 'defaultCountRight',
  }

  for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
    const ranges = keepouts[edge] ?? []
    if (!ranges.length) continue
    const keyMain = `sync-${edge}-main`
    const keyNear = `sync-${edge}-pcb-side`
    const keyFar = `sync-${edge}-opposite-side`
    const field = edgeToField[edge]
    const currentCount = Number(out.tabs[field] ?? out.tabs.defaultCountPerEdge ?? 0)
    if (currentCount <= 0) {
      out.tabs.edgeOverrides[keyMain] = []
      out.tabs.edgeOverrides[keyNear] = []
      out.tabs.edgeOverrides[keyFar] = []
      continue
    }

    const edgeLength = edgeLengthFor(edge, boardWidthMm, boardHeightMm, out.pcbRotation)
    const filtered = pickTabPositionsWithinAllowed(edgeLength, currentCount, seamKeepouts[edge] ?? ranges)
    blockedTabCount += Math.max(0, currentCount - filtered.length)
    out.tabs[field] = filtered.length
    out.tabs.edgeOverrides[keyMain] = filtered
    out.tabs.edgeOverrides[keyNear] = filtered
    out.tabs.edgeOverrides[keyFar] = filtered
  }

  return { config: out, blockedTabCount }
}

function ensureMinimumRoutedTabs(cfg: PanelConfig): PanelConfig {
  const out: PanelConfig = {
    ...cfg,
    tabs: {
      ...cfg.tabs,
      edgeOverrides: { ...cfg.tabs.edgeOverrides },
    },
  }
  type TabCountField = 'defaultCountTop' | 'defaultCountBottom' | 'defaultCountLeft' | 'defaultCountRight'
  const edgeField: Record<PanelEdgeName, TabCountField> = {
    top: 'defaultCountTop',
    bottom: 'defaultCountBottom',
    left: 'defaultCountLeft',
    right: 'defaultCountRight',
  }
  const isRouted = (edge: PanelEdgeName) => {
    if (out.separationType === 'routed') return true
    if (out.separationType === 'scored') return false
    return out.edges[edge].type === 'routed'
  }
  for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
    if (!isRouted(edge)) continue
    const field = edgeField[edge]
    const current = Number(out.tabs[field] ?? 0)
    if (current >= 1) continue
    out.tabs[field] = 1
    const base = evenTabPositions(1)
    out.tabs.edgeOverrides[`sync-${edge}-main`] = base
    out.tabs.edgeOverrides[`sync-${edge}-pcb-side`] = base
    out.tabs.edgeOverrides[`sync-${edge}-opposite-side`] = base
  }
  return out
}

function applySideProtrusionStrategy(cfg: PanelConfig, countY: number): { config: PanelConfig, active: boolean } {
  const isTargetMixed = cfg.separationType === 'mixed'
    && cfg.edges.top.type === 'scored'
    && cfg.edges.bottom.type === 'scored'
    && cfg.edges.left.type === 'routed'
    && cfg.edges.right.type === 'routed'
  if (!isTargetMixed) return { config: cfg, active: false }

  const out: PanelConfig = {
    ...cfg,
    supports: {
      ...cfg.supports,
      enabled: true,
      xGaps: [],
      yGaps: countY > 1 ? Array.from({ length: countY - 1 }, (_, i) => i) : [],
    },
    tabs: {
      ...cfg.tabs,
      defaultCountLeft: 0,
      defaultCountRight: 0,
      edgeOverrides: {
        ...cfg.tabs.edgeOverrides,
        'sync-left-main': [],
        'sync-left-pcb-side': [],
        'sync-left-opposite-side': [],
        'sync-right-main': [],
        'sync-right-pcb-side': [],
        'sync-right-opposite-side': [],
      },
    },
  }
  return { config: out, active: true }
}

function withCandidateSupports(
  cfg: PanelConfig,
  boardWidthMm: number,
  boardHeightMm: number,
  spanLimitMm: number,
  constraints?: PanelSuggestionEdgeConstraints | null,
): PanelConfig {
  const out: PanelConfig = {
    ...cfg,
    supports: {
      ...cfg.supports,
      enabled: true,
      xGaps: [],
      yGaps: [],
    },
  }
  const verticalRouted = cfg.separationType === 'routed'
    || (cfg.separationType === 'mixed' && (cfg.edges.left.type === 'routed' || cfg.edges.right.type === 'routed'))
  const horizontalRouted = cfg.separationType === 'routed'
    || (cfg.separationType === 'mixed' && (cfg.edges.top.type === 'routed' || cfg.edges.bottom.type === 'routed'))

  if (verticalRouted && cfg.countX > 1) {
    const rawSpan = boardWidthMm * cfg.countX
    const segmentCount = Math.max(1, Math.ceil(rawSpan / spanLimitMm))
    const supportCount = Math.max(0, segmentCount - 1)
    out.supports.xGaps = pickCenteredGapIndices(cfg.countX - 1, supportCount)
    if (constraints?.forceSupportBetweenPcbs?.x) {
      out.supports.xGaps = Array.from({ length: cfg.countX - 1 }, (_, i) => i)
    }
  }
  if (horizontalRouted && cfg.countY > 1) {
    const rawSpan = boardHeightMm * cfg.countY
    const segmentCount = Math.max(1, Math.ceil(rawSpan / spanLimitMm))
    const supportCount = Math.max(0, segmentCount - 1)
    out.supports.yGaps = pickCenteredGapIndices(cfg.countY - 1, supportCount)
    if (constraints?.forceSupportBetweenPcbs?.y) {
      out.supports.yGaps = Array.from({ length: cfg.countY - 1 }, (_, i) => i)
    }
  }
  return out
}

export function generatePanelSuggestions(input: PanelSuggestionInput): PanelSuggestion[] {
  const boardWidthMm = input.boardWidthMm
  const boardHeightMm = input.boardHeightMm
  if (!(boardWidthMm > 0) || !(boardHeightMm > 0)) return []

  const maxSuggestions = Math.max(1, Math.min(3, input.maxSuggestions ?? 3))
  const thicknessMm = normalizeThickness(input.thicknessMm)
  const spanLimit = stabilitySpanLimitMm(thicknessMm)
  const { preferredWidth, preferredHeight, maxWidth, maxHeight } = getMaxedLimits(input.limits)
  const prohibitedScoredEdges = input.edgeConstraints?.prohibitScoredEdges ?? {}
  const prohibitedEdgeList = (['top', 'bottom', 'left', 'right'] as const).filter(e => prohibitedScoredEdges[e])
  const sideProtrusionOnly = (prohibitedScoredEdges.left || prohibitedScoredEdges.right)
    && !prohibitedScoredEdges.top
    && !prohibitedScoredEdges.bottom

  const roughMaxX = Math.max(1, Math.min(10, Math.ceil(maxWidth / Math.max(1, boardWidthMm)) + 2))
  const roughMaxY = Math.max(1, Math.min(10, Math.ceil(maxHeight / Math.max(1, boardHeightMm)) + 2))

  const candidates: PanelSuggestion[] = []

  for (const def of separationCandidates()) {
    if (!isScoreAllowedForCandidate(def, prohibitedScoredEdges)) continue
    for (const pcbRotation of [0] as const) {
      for (let countX = 1; countX <= roughMaxX; countX++) {
        for (let countY = 1; countY <= roughMaxY; countY++) {
          const base = DEFAULT_PANEL_CONFIG()
          let candidate: PanelConfig = {
            ...base,
            countX,
            countY,
            pcbRotation,
            separationType: def.separationType,
            edges: def.edges,
          }
          candidate = withCandidateSupports(candidate, boardWidthMm, boardHeightMm, spanLimit, input.edgeConstraints)
          let sideStrategyApplied = false
          if (sideProtrusionOnly) {
            const applied = applySideProtrusionStrategy(candidate, countY)
            candidate = applied.config
            sideStrategyApplied = applied.active
          }
          if (!sideStrategyApplied) {
            candidate = ensureMinimumRoutedTabs(candidate)
          }
          const keepoutApplied = applyTabKeepoutsToConfig(candidate, boardWidthMm, boardHeightMm, input.edgeConstraints)
          candidate = keepoutApplied.config
          const layout = computePanelLayout(candidate, boardWidthMm, boardHeightMm)
          const panelWidth = layout.totalWidth
          const panelHeight = layout.totalHeight
          if (!Number.isFinite(panelWidth) || !Number.isFinite(panelHeight)) continue
          if (panelWidth <= 0 || panelHeight <= 0) continue

          const units = countX * countY
          const targetPenalty = envelopePenalty(panelWidth, panelHeight, preferredWidth, preferredHeight)
          const exceedsMax = !fitsEnvelope(panelWidth, panelHeight, maxWidth, maxHeight)
          const exceedsPreferred = !fitsEnvelope(panelWidth, panelHeight, preferredWidth, preferredHeight)
          const isPortraitPanel = panelHeight > panelWidth

          let stabilityPenalty = 0
          const longSide = Math.max(panelWidth, panelHeight)
          if (longSide > spanLimit) {
            stabilityPenalty += ((longSide - spanLimit) / spanLimit) * 35
          }
          if (thicknessMm <= 1.0 && units >= 8) stabilityPenalty += 8
          if (candidate.separationType === 'scored' && thicknessMm <= 1.0 && longSide > spanLimit * 0.9) {
            stabilityPenalty += 10
          }

          const manufacturingPenalty = candidate.separationType === 'scored'
            ? -6
            : candidate.separationType === 'mixed'
              ? -3
              : 4
          const sideStrategyBonus = sideStrategyApplied ? -18 : 0
          const sideRoutedTabs = (candidate.tabs.defaultCountLeft ?? 0) + (candidate.tabs.defaultCountRight ?? 0)
          const sideTabPenalty = sideProtrusionOnly && sideRoutedTabs > 0 ? sideRoutedTabs * 8 : 0
          const xSupportPenalty = sideProtrusionOnly && candidate.supports.xGaps.length > 0 ? candidate.supports.xGaps.length * 12 : 0
          const oversizePenalty = exceedsMax ? 120 : 0
          const preferredOverflowPenalty = exceedsPreferred ? 20 : 0
          // Conveyor flow prefers landscape panel orientation.
          const landscapePenalty = isPortraitPanel ? 25 + ((panelHeight - panelWidth) / Math.max(1, panelWidth)) * 20 : 0
          const throughputBonus = Math.min(10, units * 0.9)
          const score = targetPenalty * 55
            + stabilityPenalty
            + manufacturingPenalty
            + sideStrategyBonus
            + sideTabPenalty
            + xSupportPenalty
            + oversizePenalty
            + preferredOverflowPenalty
            + landscapePenalty
            + keepoutApplied.blockedTabCount * 4
            - throughputBonus

          const reasons: string[] = []
          const warnings: string[] = []

          reasons.push(`${countX}x${countY} layout (${units} boards per panel), ${def.label} separation.`)
          if (candidate.supports.xGaps.length || candidate.supports.yGaps.length) {
            reasons.push(`Support bars added for stiffness (X: ${candidate.supports.xGaps.length}, Y: ${candidate.supports.yGaps.length}).`)
          }
          if (prohibitedEdgeList.length > 0) {
            reasons.push(`Forced routed edges (no V-Cut) due to protruding components: ${prohibitedEdgeList.join(', ')}.`)
          }
          if (keepoutApplied.blockedTabCount > 0) {
            reasons.push(`Removed ${keepoutApplied.blockedTabCount} tab positions due to protruding-component keepouts.`)
          }
          if (sideStrategyApplied) {
            reasons.push('Applied side-protrusion strategy: V-Cut top/bottom, routed left/right, row supports only, no side tabs.')
          }
          if (thicknessMm <= 1.0) {
            reasons.push(`Thin board (${thicknessMm.toFixed(1)} mm): favors lower unsupported spans.`)
          }
          if (exceedsPreferred) {
            warnings.push(`Exceeds preferred envelope ${preferredWidth} x ${preferredHeight} mm.`)
          }
          if (exceedsMax) {
            warnings.push(`Exceeds maximum envelope ${maxWidth} x ${maxHeight} mm.`)
          }
          if (isPortraitPanel) {
            warnings.push('Portrait panel shape is penalized for conveyor handling.')
          }
          if (candidate.separationType === 'scored' && thicknessMm <= 1.0) {
            warnings.push('V-Cut with thin boards can reduce panel rigidity on long spans.')
          }

          candidates.push({
            id: `${def.separationType}-${pcbRotation}-${countX}x${countY}-${candidate.supports.xGaps.join(',')}-${candidate.supports.yGaps.join(',')}`,
            title: `${countX}x${countY} · ${def.label}`,
            panelWidthMm: Math.round(panelWidth * 100) / 100,
            panelHeightMm: Math.round(panelHeight * 100) / 100,
            score,
            config: candidate,
            reasons,
            warnings,
            exceedsPreferredEnvelope: exceedsPreferred,
            exceedsMaximumEnvelope: exceedsMax,
          })
        }
      }
    }
  }

  const dedup = new Map<string, PanelSuggestion>()
  for (const suggestion of candidates) {
    const key = `${suggestion.config.countX}-${suggestion.config.countY}-${suggestion.config.separationType}-${suggestion.config.pcbRotation}`
    const existing = dedup.get(key)
    if (!existing || suggestion.score < existing.score) dedup.set(key, suggestion)
  }

  return Array.from(dedup.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, maxSuggestions)
}

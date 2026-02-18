/**
 * Panel configuration types for PCB panelization.
 */

export interface PanelEdge {
  type: 'routed' | 'scored'
}

export type FiducialPosition = 'top-left' | 'bottom-left' | 'bottom-right'

export interface PanelFiducial {
  enabled: boolean
  /** Fiducial copper pad diameter in mm. Solder mask opening is 2x this value. */
  diameter: number
  positions: FiducialPosition[]
}

export type ToolingHolePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface ToolingHoleConfig {
  enabled: boolean
  /** Tooling hole diameter in mm (default 3.2, typical M3 mounting hole) */
  diameter: number
  /** Positions on the panel frame corners */
  positions: ToolingHolePosition[]
  /** Offset from the corner in mm (to avoid overlapping fiducials) */
  offsetMm: number
}

/** Where mouse bite perforation holes are placed on a tab */
export type TabPerforationMode = 'none' | 'pcb-side' | 'both-sides'

export interface TabConfig {
  /** Tab width in mm (default 3) */
  width: number
  /** Default number of tabs per PCB edge (default 2). Used as fallback when per-side counts are absent. */
  defaultCountPerEdge: number
  /** Per-side default tab count (overrides defaultCountPerEdge when set) */
  defaultCountTop: number
  defaultCountBottom: number
  defaultCountLeft: number
  defaultCountRight: number
  /**
   * Per-edge tab position overrides.
   * Key format:
   *  - synchronized: "sync-edge-channel" (e.g. "sync-right-main")
   *  - per-PCB: "col-row-edge-channel" (e.g. "1-0-right-main")
   *  - legacy fallback: "col-row-edge"
   * Value: array of normalized positions (0–1) along the edge length.
   *   Array length = number of tabs on that edge.
   *   0.0 = start of the PCB edge, 1.0 = end of the PCB edge.
   * Absent key = use defaultCountPerEdge evenly distributed.
   *
   * For PCB-to-PCB edges (no support bar), tabs are shared/symmetrical.
   * Stored on the "right" key of the left PCB, or the "bottom" key of the top PCB.
   */
  edgeOverrides: Record<string, number[]>
  /** If true, tab edits on one PCB edge apply to all matching PCB edges (default: true). */
  syncAcrossPanel: boolean
  /** Mouse bite perforation mode (default: 'pcb-side') */
  perforation: TabPerforationMode
  /** Mouse bite hole diameter in mm (default 0.5) */
  perforationHoleDiameter: number
  /** Mouse bite hole center-to-center spacing in mm (default 0.8) */
  perforationHoleSpacing: number
}

export interface SupportBarConfig {
  /** Enable/disable support bars entirely */
  enabled: boolean
  /** Support bar rail width in mm (default 5) */
  width: number
  /** Which column gaps (0-indexed) have a support bar */
  xGaps: number[]
  /** Which row gaps (0-indexed) have a support bar */
  yGaps: number[]
}

export interface DangerZoneConfig {
  enabled: boolean
  /** Distance from outline inward in mm (default 2) */
  insetMm: number
}

export interface AddedRoutingPath {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PanelConfig {
  /** Number of PCBs along X axis */
  countX: number
  /** Number of PCBs along Y axis */
  countY: number
  /** How PCBs are separated */
  separationType: 'routed' | 'scored' | 'mixed'
  /** Routing tool diameter in mm (used for routed separations) */
  routingToolDiameter: number
  /** Per-edge separation type */
  edges: {
    top: PanelEdge
    bottom: PanelEdge
    left: PanelEdge
    right: PanelEdge
  }
  /** Panel frame settings */
  frame: {
    enabled: boolean
    /** Frame rail width in mm */
    width: number
    /** Corner rounding radius in mm */
    cornerRadius: number
  }
  /** Fiducial marker settings */
  fiducials: PanelFiducial
  /** Tooling hole settings */
  toolingHoles: ToolingHoleConfig
  /** Tab bridge settings for routed connections */
  tabs: TabConfig
  /** Support bar intermediate frame rails */
  supports: SupportBarConfig
  /** User-added milling paths on frame/support bars only */
  addedRoutings: AddedRoutingPath[]
  /** Rotation of individual PCBs within the panel (degrees) */
  pcbRotation: number
  /** Whether to show component overlay on panel view */
  showComponents: boolean
}

/** Manufacturing panel size limits in mm */
export const PANEL_MAX_WIDTH = 400
export const PANEL_MAX_HEIGHT = 450

/**
 * Generate evenly distributed tab positions for a given count.
 * Returns normalized positions (0-1).
 */
export function evenTabPositions(count: number): number[] {
  if (count <= 0) return []
  const positions: number[] = []
  for (let i = 1; i <= count; i++) {
    positions.push(i / (count + 1))
  }
  return positions
}

export function DEFAULT_PANEL_CONFIG(): PanelConfig {
  return {
    countX: 1,
    countY: 1,
    separationType: 'routed',
    routingToolDiameter: 2.0,
    edges: {
      top: { type: 'routed' },
      bottom: { type: 'routed' },
      left: { type: 'routed' },
      right: { type: 'routed' },
    },
    frame: {
      enabled: true,
      width: 10,
      cornerRadius: 3,
    },
    fiducials: {
      enabled: true,
      diameter: 2,
      positions: ['top-left', 'bottom-left', 'bottom-right'],
    },
    toolingHoles: {
      enabled: true,
      diameter: 3.2,
      positions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      offsetMm: 5,
    },
    tabs: {
      width: 5,
      defaultCountPerEdge: 2,
      defaultCountTop: 2,
      defaultCountBottom: 2,
      defaultCountLeft: 2,
      defaultCountRight: 2,
      edgeOverrides: {},
      syncAcrossPanel: true,
      perforation: 'pcb-side',
      perforationHoleDiameter: 0.3,
      perforationHoleSpacing: 0.6,
    },
    supports: {
      enabled: true,
      width: 10,
      xGaps: [],
      yGaps: [],
    },
    addedRoutings: [],
    pcbRotation: 0,
    showComponents: false,
  }
}

/**
 * Migrate old PanelConfig shapes to the current format.
 * Handles missing fields from older persisted data.
 */
export function migratePanelConfig(raw: Record<string, any>): PanelConfig {
  const defaults = DEFAULT_PANEL_CONFIG()

  // Migrate old supports shape { enabled, width } -> { width, xGaps, yGaps }
  let supports = defaults.supports
  if (raw.supports) {
    if ('xGaps' in raw.supports || 'yGaps' in raw.supports) {
      supports = {
        enabled: raw.supports.enabled ?? defaults.supports.enabled,
        width: raw.supports.width ?? defaults.supports.width,
        xGaps: raw.supports.xGaps ?? [],
        yGaps: raw.supports.yGaps ?? [],
      }
    } else {
      supports = {
        enabled: raw.supports.enabled ?? defaults.supports.enabled,
        width: raw.supports.width ?? defaults.supports.width,
        xGaps: [],
        yGaps: [],
      }
    }
  }

  // Migrate old tabs: edgeOverrides used to be Record<string, number> (count only)
  // Now it's Record<string, number[]> (positions). Convert counts → even positions.
  let tabs = defaults.tabs
  if (raw.tabs) {
    const migratedOverrides: Record<string, number[]> = {}
    if (raw.tabs.edgeOverrides) {
      for (const [key, val] of Object.entries(raw.tabs.edgeOverrides)) {
        if (typeof val === 'number') {
          migratedOverrides[key] = evenTabPositions(val)
        } else if (Array.isArray(val)) {
          migratedOverrides[key] = val
        }
      }
    }
    const defCount = raw.tabs.defaultCountPerEdge ?? defaults.tabs.defaultCountPerEdge
    const hasLegacyOverrides = Object.keys(migratedOverrides).length > 0
    tabs = {
      width: raw.tabs.width ?? defaults.tabs.width,
      defaultCountPerEdge: defCount,
      defaultCountTop: raw.tabs.defaultCountTop ?? defCount,
      defaultCountBottom: raw.tabs.defaultCountBottom ?? defCount,
      defaultCountLeft: raw.tabs.defaultCountLeft ?? defCount,
      defaultCountRight: raw.tabs.defaultCountRight ?? defCount,
      edgeOverrides: migratedOverrides,
      // Preserve behavior for existing projects with explicit per-edge overrides.
      syncAcrossPanel: raw.tabs.syncAcrossPanel ?? (hasLegacyOverrides ? false : defaults.tabs.syncAcrossPanel),
      perforation: raw.tabs.perforation ?? defaults.tabs.perforation,
      perforationHoleDiameter: raw.tabs.perforationHoleDiameter ?? defaults.tabs.perforationHoleDiameter,
      perforationHoleSpacing: raw.tabs.perforationHoleSpacing ?? defaults.tabs.perforationHoleSpacing,
    }
  }

  return {
    countX: raw.countX ?? defaults.countX,
    countY: raw.countY ?? defaults.countY,
    separationType: raw.separationType ?? defaults.separationType,
    routingToolDiameter: raw.routingToolDiameter ?? defaults.routingToolDiameter,
    edges: raw.edges ?? defaults.edges,
    frame: raw.frame ?? defaults.frame,
    fiducials: raw.fiducials ?? defaults.fiducials,
    toolingHoles: raw.toolingHoles ?? defaults.toolingHoles,
    tabs,
    supports,
    addedRoutings: raw.addedRoutings ?? [],
    pcbRotation: raw.pcbRotation ?? defaults.pcbRotation,
    showComponents: raw.showComponents ?? defaults.showComponents,
  }
}

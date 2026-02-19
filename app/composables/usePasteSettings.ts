/**
 * Paste application settings for the Paste tab.
 *
 * Controls how solder paste is visualised:
 *   - Stencil: solid paste deposits (traditional steel stencil)
 *   - Jetprint: individual dots filling each pad area (MY600-style jet printing)
 */

export type PasteMode = 'stencil' | 'jetprint'
export type DotPattern = 'grid' | 'hex'

export interface PasteSettings {
  mode: PasteMode
  dotDiameter: number  // mm (0.33 – 0.52)
  dotSpacing: number   // mm center-to-center (0.35 – 1.00)
  pattern: DotPattern
  highlightDots: boolean
  dynamicDots: boolean
}

export const PASTE_DEFAULTS: Readonly<PasteSettings> = {
  mode: 'stencil',
  dotDiameter: 0.40,
  dotSpacing: 0.40,
  pattern: 'grid',
  highlightDots: false,
  dynamicDots: false,
}

export const DOT_DIAMETER_MIN = 0.33
export const DOT_DIAMETER_MAX = 0.52
export const DOT_SPACING_MIN = 0.35
export const DOT_SPACING_MAX = 1.00

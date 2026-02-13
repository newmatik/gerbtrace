// File types
export const GERBER = 'gerber' as const
export const DRILL = 'drill' as const

// Units
export const MM = 'mm' as const
export const IN = 'in' as const

// Zero suppression
export const LEADING = 'leading' as const
export const TRAILING = 'trailing' as const

// Coordinate mode
export const ABSOLUTE = 'absolute' as const
export const INCREMENTAL = 'incremental' as const

// Standard aperture shapes
export const CIRCLE = 'circle' as const
export const RECTANGLE = 'rectangle' as const
export const OBROUND = 'obround' as const
export const POLYGON = 'polygon' as const
export const MACRO_SHAPE = 'macroShape' as const

// Macro primitive codes
export const MACRO_CIRCLE = '1'
export const MACRO_VECTOR_LINE_DEPRECATED = '2'
export const MACRO_VECTOR_LINE = '20'
export const MACRO_CENTER_LINE = '21'
export const MACRO_LOWER_LEFT_LINE_DEPRECATED = '22'
export const MACRO_OUTLINE = '4'
export const MACRO_POLYGON = '5'
export const MACRO_MOIRE_DEPRECATED = '6'
export const MACRO_THERMAL = '7'

// Graphic types
export const SHAPE = 'shape' as const
export const MOVE = 'move' as const
export const SEGMENT = 'segment' as const
export const SLOT = 'slot' as const

// Interpolation modes
export const LINE = 'line' as const
export const CW_ARC = 'cwArc' as const
export const CCW_ARC = 'ccwArc' as const

// Quadrant modes
export const SINGLE = 'single' as const
export const MULTI = 'multi' as const

// Polarity
export const DARK = 'dark' as const
export const CLEAR = 'clear' as const

// G-code mapping
export const G_CODES: Record<string, string> = {
  '01': 'interpolateLinear',
  '02': 'interpolateCW',
  '03': 'interpolateCCW',
  '04': 'comment',
  '36': 'regionOn',
  '37': 'regionOff',
  '54': 'toolSelect', // deprecated
  '70': 'unitsInch', // deprecated
  '71': 'unitsMM', // deprecated
  '74': 'quadrantSingle',
  '75': 'quadrantMulti',
  '90': 'modeAbsolute', // deprecated
  '91': 'modeIncremental', // deprecated
}

// D-code operations
export const D_INTERPOLATE = 1
export const D_MOVE = 2
export const D_FLASH = 3

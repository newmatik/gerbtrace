// ============================================================
// Source position tracking
// ============================================================

/** Character offset range [start, end) in the original source string */
export type SourceRange = [start: number, end: number]

// ============================================================
// AST Types (Parser output)
// ============================================================

export type Filetype = 'gerber' | 'drill'
export type UnitsType = 'mm' | 'in'
export type ZeroSuppression = 'leading' | 'trailing'
export type CoordMode = 'absolute' | 'incremental'
export type Format = [integerPlaces: number, decimalPlaces: number]
export type Polarity = 'dark' | 'clear'
export type QuadrantMode = 'single' | 'multi'
export type InterpolateMode = 'line' | 'cwArc' | 'ccwArc'
export type GraphicType = 'shape' | 'move' | 'segment' | 'slot'

export interface ToolShape {
  type: 'circle' | 'rectangle' | 'obround' | 'polygon' | 'macroShape'
  params: number[]
  /** For macroShape, the macro name */
  macroName?: string
}

export interface HoleShape {
  type: 'circle' | 'rectangle'
  params: number[]
}

// AST Nodes
export interface GerberAST {
  type: 'root'
  filetype: Filetype
  children: ASTNode[]
}

export type ASTNode =
  | UnitsNode
  | FormatNode
  | ToolDefNode
  | ToolMacroNode
  | ToolChangeNode
  | PolarityNode
  | StepRepeatNode
  | InterpolateModeNode
  | RegionModeNode
  | QuadrantModeNode
  | GraphicNode
  | CommentNode
  | DoneNode
  | UnimplementedNode

export interface UnitsNode {
  type: 'units'
  units: UnitsType
  sourceStart?: number
  sourceEnd?: number
}

export interface FormatNode {
  type: 'format'
  format?: Format
  zeroSuppression?: ZeroSuppression
  mode?: CoordMode
  sourceStart?: number
  sourceEnd?: number
}

export interface ToolDefNode {
  type: 'toolDef'
  code: string
  shape: ToolShape
  hole?: HoleShape
  sourceStart?: number
  sourceEnd?: number
}

export interface MacroPrimitive {
  code: string
  params: MacroValue[]
}

export interface MacroVariable {
  name: string
  value: MacroValue
}

export type MacroBlock =
  | { type: 'comment'; text: string }
  | { type: 'variable'; name: string; value: MacroValue }
  | { type: 'primitive'; code: string; params: MacroValue[] }

export interface ToolMacroNode {
  type: 'toolMacro'
  name: string
  blocks: MacroBlock[]
  sourceStart?: number
  sourceEnd?: number
}

export interface ToolChangeNode {
  type: 'toolChange'
  code: string
  sourceStart?: number
  sourceEnd?: number
}

export interface PolarityNode {
  type: 'polarity'
  polarity: Polarity
  sourceStart?: number
  sourceEnd?: number
}

export interface StepRepeatNode {
  type: 'stepRepeat'
  x: number
  y: number
  i: number
  j: number
  sourceStart?: number
  sourceEnd?: number
}

export interface InterpolateModeNode {
  type: 'interpolateMode'
  mode: InterpolateMode
  sourceStart?: number
  sourceEnd?: number
}

export interface RegionModeNode {
  type: 'regionMode'
  region: boolean
  sourceStart?: number
  sourceEnd?: number
}

export interface QuadrantModeNode {
  type: 'quadrantMode'
  quadrant: QuadrantMode
  sourceStart?: number
  sourceEnd?: number
}

export interface GraphicNode {
  type: 'graphic'
  graphic?: GraphicType
  coordinates: Record<string, string>
  sourceStart?: number
  sourceEnd?: number
}

export interface CommentNode {
  type: 'comment'
  text: string
  sourceStart?: number
  sourceEnd?: number
}

export interface DoneNode {
  type: 'done'
  sourceStart?: number
  sourceEnd?: number
}

export interface UnimplementedNode {
  type: 'unimplemented'
  value: string
  sourceStart?: number
  sourceEnd?: number
}

// Macro expression types
export interface MacroExpression {
  op: '+' | '-' | 'x' | '/'
  left: MacroValue
  right: MacroValue
}

export type MacroValue = number | string | MacroExpression

// ============================================================
// ImageTree Types (Plotter output)
// ============================================================

export type BoundingBox = [x1: number, y1: number, x2: number, y2: number]

export interface ImageTree {
  units: UnitsType
  bounds: BoundingBox
  children: ImageGraphic[]
}

export type ImageGraphic = ImageShape | ImagePath | ImageRegion

export interface ImageShape {
  type: 'shape'
  shape: Shape
  erase?: boolean
  /** Character ranges in the original source text that produced this graphic */
  sourceRanges?: SourceRange[]
}

export interface ImagePath {
  type: 'path'
  width: number
  segments: PathSegment[]
  erase?: boolean
  /** Character ranges in the original source text that produced this graphic */
  sourceRanges?: SourceRange[]
}

export interface ImageRegion {
  type: 'region'
  segments: PathSegment[]
  erase?: boolean
  /** Character ranges in the original source text that produced this graphic */
  sourceRanges?: SourceRange[]
}

export type Shape =
  | CircleShape
  | RectShape
  | PolygonShape
  | OutlineShape
  | LayeredShape

export interface CircleShape {
  type: 'circle'
  cx: number
  cy: number
  r: number
}

export interface RectShape {
  type: 'rect'
  x: number
  y: number
  w: number
  h: number
  r?: number
}

export interface PolygonShape {
  type: 'polygon'
  points: [number, number][]
}

export interface OutlineShape {
  type: 'outline'
  segments: PathSegment[]
}

export interface LayeredShape {
  type: 'layered'
  shapes: ErasableShape[]
}

export type ErasableShape = (CircleShape | RectShape | PolygonShape | OutlineShape) & {
  erase?: boolean
}

export type PathSegment = LineSegment | ArcSegment

export interface LineSegment {
  type: 'line'
  start: [number, number]
  end: [number, number]
}

export interface ArcSegment {
  type: 'arc'
  start: [number, number]
  end: [number, number]
  center: [number, number]
  radius: number
  startAngle: number
  endAngle: number
  counterclockwise: boolean
}

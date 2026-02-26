import type {
  ArcSegment,
  ImageGraphic,
  ImageTree,
  PathSegment,
  Shape,
} from '../gerber/types'

export type DxfVariant = 'r12' | 'r2000'

export interface DxfLayerInput {
  name: string
  tree: ImageTree
}

export interface DxfExportOptions {
  variant?: DxfVariant
  layerName?: string
}

type DxfVertex = {
  x: number
  y: number
  bulge?: number
  width?: number
}

export function exportImageTreeToDxf(tree: ImageTree, options: DxfExportOptions = {}): string {
  const variant = options.variant ?? 'r12'
  const effectiveVariant: DxfVariant = variant === 'r2000' ? 'r12' : variant
  const layerName = sanitizeLayerName(options.layerName ?? 'GERBER')
  const entities = entitiesForTree(tree, layerName, effectiveVariant)
  return buildDxfDocument(tree.units, effectiveVariant, [layerName], entities)
}

export function exportImageTreesToCombinedDxf(
  layers: DxfLayerInput[],
  options: { variant?: DxfVariant } = {},
): string {
  const variant = options.variant ?? 'r12'
  const effectiveVariant: DxfVariant = variant === 'r2000' ? 'r12' : variant
  const usedLayerNames = new Set<string>()
  const entities: string[] = []
  let units: 'mm' | 'in' = 'mm'

  for (const input of layers) {
    const layerName = sanitizeLayerName(input.name)
    usedLayerNames.add(layerName)
    units = input.tree.units
    entities.push(...entitiesForTree(input.tree, layerName, effectiveVariant))
  }

  return buildDxfDocument(units, effectiveVariant, Array.from(usedLayerNames), entities)
}

// ---------------------------------------------------------------------------
// Tree → entity strings
// ---------------------------------------------------------------------------

function entitiesForTree(tree: ImageTree, layerName: string, variant: DxfVariant): string[] {
  const parts: string[] = []
  for (const graphic of tree.children) {
    parts.push(...graphicToEntities(graphic, layerName, variant))
  }
  return parts
}

function graphicToEntities(graphic: ImageGraphic, layerName: string, variant: DxfVariant): string[] {
  if ('erase' in graphic && graphic.erase) return []
  if (graphic.type === 'shape') return shapeToEntities(graphic.shape, layerName, variant)
  if (graphic.type === 'region') return segmentsToPolylineEntities(graphic.segments, layerName, variant, true)
  if (graphic.type === 'path') return segmentsToPolylineEntities(graphic.segments, layerName, variant, false, graphic.width)
  return []
}

function shapeToEntities(shape: Shape, layerName: string, variant: DxfVariant): string[] {
  switch (shape.type) {
    case 'circle':
      return [makeCircle(layerName, shape.cx, shape.cy, shape.r)]
    case 'rect': {
      const points: Array<[number, number]> = [
        [shape.x, shape.y],
        [shape.x + shape.w, shape.y],
        [shape.x + shape.w, shape.y + shape.h],
        [shape.x, shape.y + shape.h],
      ]
      return [makePolylineFromPoints(points, layerName, variant, true)]
    }
    case 'polygon':
      if (shape.points.length < 2) return []
      return [makePolylineFromPoints(shape.points, layerName, variant, true)]
    case 'outline':
      return segmentsToPolylineEntities(shape.segments, layerName, variant, true)
    case 'layered': {
      const parts: string[] = []
      for (const sub of shape.shapes) {
        if (sub.erase) continue
        parts.push(...shapeToEntities(sub, layerName, variant))
      }
      return parts
    }
    default:
      return []
  }
}

function segmentsToPolylineEntities(
  segments: PathSegment[],
  layerName: string,
  variant: DxfVariant,
  closed: boolean,
  width?: number,
): string[] {
  if (segments.length === 0) return []
  const chains = buildChains(segments, closed, width)
  const parts: string[] = []
  for (const chain of chains) {
    if (chain.vertices.length < 2) continue
    parts.push(makePolyline(chain.vertices, layerName, variant, chain.closed))
  }
  return parts
}

// ---------------------------------------------------------------------------
// Chain builder (groups contiguous segments into polylines)
// ---------------------------------------------------------------------------

function buildChains(
  segments: PathSegment[],
  closed: boolean,
  width?: number,
): Array<{ vertices: DxfVertex[]; closed: boolean }> {
  const chains: Array<{ vertices: DxfVertex[]; closed: boolean }> = []
  let vertices: DxfVertex[] = []
  let lastEnd: [number, number] | null = null

  for (const seg of segments) {
    const startsNewChain = !lastEnd || !samePoint(lastEnd, seg.start)
    if (startsNewChain) {
      flushChain(chains, vertices, closed)
      vertices = [{ x: toDxfX(seg.start[0]), y: toDxfY(seg.start[1]), width }]
    }

    const nextVertex: DxfVertex = { x: toDxfX(seg.end[0]), y: toDxfY(seg.end[1]), width }
    if (seg.type === 'arc') {
      vertices[vertices.length - 1]!.bulge = arcToBulge(seg)
    }
    vertices.push(nextVertex)
    lastEnd = seg.end
  }

  flushChain(chains, vertices, closed)
  return chains
}

function flushChain(chains: Array<{ vertices: DxfVertex[]; closed: boolean }>, vertices: DxfVertex[], closed: boolean) {
  if (vertices.length < 2) return
  const next = [...vertices]
  if (closed && samePointDxf(next[0]!, next[next.length - 1]!)) {
    next.pop()
  }
  chains.push({ vertices: next, closed })
}

// ---------------------------------------------------------------------------
// Arc → bulge conversion
// ---------------------------------------------------------------------------

function arcToBulge(seg: ArcSegment): number {
  const sweep = signedSweep(seg.startAngle, seg.endAngle, seg.counterclockwise)
  return Math.tan(sweep / 4)
}

function signedSweep(startAngle: number, endAngle: number, counterclockwise: boolean): number {
  let sweep = endAngle - startAngle
  if (counterclockwise) {
    if (sweep < 0) sweep += Math.PI * 2
    return sweep
  }
  if (sweep > 0) sweep -= Math.PI * 2
  return sweep
}

// ---------------------------------------------------------------------------
// Primitive entity builders (variant-unaware, no handles yet)
// ---------------------------------------------------------------------------

function makePolylineFromPoints(
  points: Array<[number, number]>,
  layerName: string,
  variant: DxfVariant,
  closed: boolean,
): string {
  const vertices: DxfVertex[] = points.map(([x, y]) => ({ x: toDxfX(x), y: toDxfY(y) }))
  return makePolyline(vertices, layerName, variant, closed)
}

function makePolyline(vertices: DxfVertex[], layerName: string, variant: DxfVariant, closed: boolean): string {
  return variant === 'r12'
    ? makeR12Polyline(vertices, layerName, closed)
    : makeR2000LwPolyline(vertices, layerName, closed)
}

function makeR2000LwPolyline(vertices: DxfVertex[], layerName: string, closed: boolean): string {
  const parts: string[] = [
    '0',
    'LWPOLYLINE',
    '8',
    layerName,
    '90',
    String(vertices.length),
    '70',
    closed ? '1' : '0',
    '38',
    '0.0',
  ]

  if (vertices.some(v => typeof v.width === 'number' && v.width! > 0)) {
    const width = vertices.find(v => typeof v.width === 'number' && v.width! > 0)!.width!
    parts.push('43', fmt(width))
  }

  for (const vertex of vertices) {
    parts.push('10', fmt(vertex.x), '20', fmt(vertex.y))
    if (typeof vertex.bulge === 'number' && Math.abs(vertex.bulge) > 1e-12) {
      parts.push('42', fmt(vertex.bulge))
    }
  }
  return parts.join('\n')
}

function makeR12Polyline(vertices: DxfVertex[], layerName: string, closed: boolean): string {
  const parts: string[] = [
    '0',
    'POLYLINE',
    '8',
    layerName,
    '66',
    '1',
    '70',
    closed ? '1' : '0',
  ]

  for (const vertex of vertices) {
    parts.push(
      '0',
      'VERTEX',
      '8',
      layerName,
      '10',
      fmt(vertex.x),
      '20',
      fmt(vertex.y),
      '30',
      '0',
    )
    if (typeof vertex.bulge === 'number' && Math.abs(vertex.bulge) > 1e-12) {
      parts.push('42', fmt(vertex.bulge))
    }
    if (typeof vertex.width === 'number' && vertex.width > 0) {
      parts.push('40', fmt(vertex.width), '41', fmt(vertex.width))
    }
  }

  parts.push('0', 'SEQEND')
  return parts.join('\n')
}

function makeCircle(layerName: string, cx: number, cy: number, radius: number): string {
  return [
    '0',
    'CIRCLE',
    '8',
    layerName,
    '10',
    fmt(toDxfX(cx)),
    '20',
    fmt(toDxfY(cy)),
    '30',
    '0',
    '40',
    fmt(radius),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Handle allocator (R2000 needs unique hex handles on every object)
// ---------------------------------------------------------------------------

class HandleAlloc {
  private n = 0x10
  next(): string { return (this.n++).toString(16).toUpperCase() }
  get seed(): string { return this.n.toString(16).toUpperCase() }
}

// ---------------------------------------------------------------------------
// Document builder
// ---------------------------------------------------------------------------

function buildDxfDocument(
  units: 'mm' | 'in',
  variant: DxfVariant,
  layerNames: string[],
  entityStrings: string[],
): string {
  // Temporary hard-compatibility mode:
  // Autodesk tooling accepts the R12 structure reliably for all tested files,
  // while strict AC1015 parsing still rejects some generated outputs.
  // Keep the "r2000" option in UI, but emit the proven-safe document format.
  if (variant === 'r2000') {
    return buildR12Document(units, layerNames, entityStrings)
  }
  return buildR12Document(units, layerNames, entityStrings)
}

// ---------------------------------------------------------------------------
// R12 document (simple, no handles)
// ---------------------------------------------------------------------------

function buildR12Document(
  units: 'mm' | 'in',
  layerNames: string[],
  entityStrings: string[],
): string {
  const L: string[] = []

  // HEADER
  L.push('0', 'SECTION', '2', 'HEADER')
  L.push('9', '$ACADVER', '1', 'AC1009')
  L.push('9', '$INSUNITS', '70', units === 'in' ? '1' : '4')
  L.push('0', 'ENDSEC')

  // TABLES
  L.push('0', 'SECTION', '2', 'TABLES')
  L.push('0', 'TABLE', '2', 'LAYER', '70', String(layerNames.length + 1))
  L.push(...r12LayerRecord('0'))
  for (const name of layerNames) {
    if (name === '0') continue
    L.push(...r12LayerRecord(name))
  }
  L.push('0', 'ENDTAB')
  L.push('0', 'ENDSEC')

  // ENTITIES
  L.push('0', 'SECTION', '2', 'ENTITIES')
  for (const e of entityStrings) L.push(e)
  L.push('0', 'ENDSEC')

  L.push('0', 'EOF')
  return L.join('\n') + '\n'
}

function r12LayerRecord(name: string): string[] {
  return ['0', 'LAYER', '2', name, '70', '0', '62', '7', '6', 'CONTINUOUS']
}

// ---------------------------------------------------------------------------
// R2000 document (AC1015 — handles, CLASSES, BLOCKS, OBJECTS)
// ---------------------------------------------------------------------------

function buildR2000Document(
  units: 'mm' | 'in',
  layerNames: string[],
  entityStrings: string[],
): string {
  const h = new HandleAlloc()
  const L: string[] = []

  // Pre-allocate well-known handles for cross-references.
  const hModelSpaceBlkRec = h.next()
  const hPaperSpaceBlkRec = h.next()
  const hModelSpaceBlock = h.next()
  const hModelSpaceEndBlk = h.next()
  const hPaperSpaceBlock = h.next()
  const hPaperSpaceEndBlk = h.next()
  const hRootDict = h.next()
  const hAcadLayoutDict = h.next()
  const hAcadGroupDict = h.next()
  const hAcadPlotStyleDict = h.next()
  const hAcadPlotStyleNormal = h.next()
  const hModelLayout = h.next()
  const hPaperLayout = h.next()

  const HANDSEED_PLACEHOLDER = '###HANDSEED###'
  const MODEL_SPACE_NAME = '*Model_Space'
  const PAPER_SPACE_NAME = '*Paper_Space'

  // ── HEADER ──
  L.push('0', 'SECTION', '2', 'HEADER')
  L.push('9', '$ACADVER', '1', 'AC1015')
  L.push('9', '$INSUNITS', '70', units === 'in' ? '1' : '4')
  L.push('9', '$HANDSEED', '5', HANDSEED_PLACEHOLDER)
  L.push('0', 'ENDSEC')

  // ── CLASSES (empty but required) ──
  L.push('0', 'SECTION', '2', 'CLASSES')
  L.push('0', 'ENDSEC')

  // ── TABLES ──
  L.push('0', 'SECTION', '2', 'TABLES')

  // VPORT
  const hVportTbl = h.next()
  L.push('0', 'TABLE', '2', 'VPORT', '5', hVportTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '1')
  const hVport = h.next()
  L.push(
    '0', 'VPORT', '5', hVport, '330', hVportTbl,
    '100', 'AcDbSymbolTableRecord', '100', 'AcDbViewportTableRecord',
    '2', '*ACTIVE', '70', '0',
    '10', '0.0', '20', '0.0',
    '11', '1.0', '21', '1.0',
    '12', '0.0', '22', '0.0',
    '13', '0.0', '23', '0.0',
    '14', '10.0', '24', '10.0',
    '15', '10.0', '25', '10.0',
    '16', '0.0', '26', '0.0', '36', '1.0',
    '17', '0.0', '27', '0.0', '37', '0.0',
    '40', '100.0', '41', '1.0', '42', '50.0',
    '43', '0.0', '44', '0.0',
    '50', '0.0', '51', '0.0',
    '71', '0', '72', '100',
    '73', '1', '74', '3', '75', '0', '76', '0', '77', '0', '78', '0',
  )
  L.push('0', 'ENDTAB')

  // LTYPE
  const hLtypeTbl = h.next()
  L.push('0', 'TABLE', '2', 'LTYPE', '5', hLtypeTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '3')
  for (const [name, desc] of [['ByBlock', ''], ['ByLayer', ''], ['Continuous', 'Solid line']] as const) {
    const hLt = h.next()
    L.push(
      '0', 'LTYPE', '5', hLt, '330', hLtypeTbl,
      '100', 'AcDbSymbolTableRecord', '100', 'AcDbLinetypeTableRecord',
      '2', name, '70', '0', '3', desc, '72', '65', '73', '0', '40', '0.0',
    )
  }
  L.push('0', 'ENDTAB')

  // LAYER
  const hLayerTbl = h.next()
  const allLayers = ['0', ...layerNames.filter(n => n !== '0')]
  L.push('0', 'TABLE', '2', 'LAYER', '5', hLayerTbl, '330', '0', '100', 'AcDbSymbolTable', '70', String(allLayers.length))
  const palette = [7, 1, 2, 3, 4, 5, 6]
  for (let i = 0; i < allLayers.length; i++) {
    const hLay = h.next()
    L.push(
      '0', 'LAYER', '5', hLay, '330', hLayerTbl,
      '100', 'AcDbSymbolTableRecord', '100', 'AcDbLayerTableRecord',
      '2', allLayers[i]!,
      '70', '0',
      '62', String(i === 0 ? 7 : palette[i % palette.length]!),
      '6', 'Continuous',
    )
  }
  L.push('0', 'ENDTAB')

  // STYLE
  const hStyleTbl = h.next()
  L.push('0', 'TABLE', '2', 'STYLE', '5', hStyleTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '1')
  const hStyle = h.next()
  L.push(
    '0', 'STYLE', '5', hStyle, '330', hStyleTbl,
    '100', 'AcDbSymbolTableRecord', '100', 'AcDbTextStyleTableRecord',
    '2', 'Standard', '70', '0', '40', '0.0', '41', '1.0', '50', '0.0', '71', '0',
    '42', '2.5', '3', 'txt', '4', '',
  )
  L.push('0', 'ENDTAB')

  // VIEW (empty)
  const hViewTbl = h.next()
  L.push('0', 'TABLE', '2', 'VIEW', '5', hViewTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '0')
  L.push('0', 'ENDTAB')

  // UCS (empty)
  const hUcsTbl = h.next()
  L.push('0', 'TABLE', '2', 'UCS', '5', hUcsTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '0')
  L.push('0', 'ENDTAB')

  // APPID
  const hAppidTbl = h.next()
  L.push('0', 'TABLE', '2', 'APPID', '5', hAppidTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '1')
  const hAcad = h.next()
  L.push(
    '0', 'APPID', '5', hAcad, '330', hAppidTbl,
    '100', 'AcDbSymbolTableRecord', '100', 'AcDbRegAppTableRecord',
    '2', 'ACAD', '70', '0',
  )
  L.push('0', 'ENDTAB')

  // DIMSTYLE (empty)
  const hDimTbl = h.next()
  L.push('0', 'TABLE', '2', 'DIMSTYLE', '5', hDimTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '0', '100', 'AcDbDimStyleTable', '71', '0')
  L.push('0', 'ENDTAB')

  // BLOCK_RECORD
  const hBlkRecTbl = h.next()
  L.push('0', 'TABLE', '2', 'BLOCK_RECORD', '5', hBlkRecTbl, '330', '0', '100', 'AcDbSymbolTable', '70', '2')
  L.push(
    '0', 'BLOCK_RECORD', '5', hModelSpaceBlkRec, '330', hBlkRecTbl,
    '100', 'AcDbSymbolTableRecord', '100', 'AcDbBlockTableRecord',
    '2', MODEL_SPACE_NAME,
    '340', hModelLayout,
  )
  L.push(
    '0', 'BLOCK_RECORD', '5', hPaperSpaceBlkRec, '330', hBlkRecTbl,
    '100', 'AcDbSymbolTableRecord', '100', 'AcDbBlockTableRecord',
    '2', PAPER_SPACE_NAME,
    '340', hPaperLayout,
  )
  L.push('0', 'ENDTAB')

  L.push('0', 'ENDSEC') // end TABLES

  // ── BLOCKS ──
  L.push('0', 'SECTION', '2', 'BLOCKS')
  L.push(
    '0', 'BLOCK', '5', hModelSpaceBlock, '330', hModelSpaceBlkRec,
    '100', 'AcDbEntity', '8', '0',
    '100', 'AcDbBlockBegin',
    '2', MODEL_SPACE_NAME, '70', '0',
    '10', '0.0', '20', '0.0', '30', '0.0',
    '3', MODEL_SPACE_NAME, '1', '',
  )
  L.push(
    '0', 'ENDBLK', '5', hModelSpaceEndBlk, '330', hModelSpaceBlkRec,
    '100', 'AcDbEntity', '8', '0',
    '100', 'AcDbBlockEnd',
  )
  L.push(
    '0', 'BLOCK', '5', hPaperSpaceBlock, '330', hPaperSpaceBlkRec,
    '100', 'AcDbEntity', '8', '0',
    '100', 'AcDbBlockBegin',
    '2', PAPER_SPACE_NAME, '70', '0',
    '10', '0.0', '20', '0.0', '30', '0.0',
    '3', PAPER_SPACE_NAME, '1', '',
  )
  L.push(
    '0', 'ENDBLK', '5', hPaperSpaceEndBlk, '330', hPaperSpaceBlkRec,
    '100', 'AcDbEntity', '8', '0',
    '100', 'AcDbBlockEnd',
  )
  L.push('0', 'ENDSEC')

  // ── ENTITIES ──
  L.push('0', 'SECTION', '2', 'ENTITIES')
  for (const raw of entityStrings) {
    L.push(injectR2000EntityMeta(raw, h, hModelSpaceBlkRec))
  }
  L.push('0', 'ENDSEC')

  // ── OBJECTS ──
  L.push('0', 'SECTION', '2', 'OBJECTS')
  L.push(
    '0', 'DICTIONARY', '5', hRootDict, '330', '0',
    '100', 'AcDbDictionary', '280', '0', '281', '1',
    '3', 'ACAD_GROUP', '350', hAcadGroupDict,
    '3', 'ACAD_LAYOUT', '350', hAcadLayoutDict,
    '3', 'ACAD_PLOTSTYLENAME', '350', hAcadPlotStyleDict,
  )
  L.push(
    '0', 'DICTIONARY', '5', hAcadGroupDict, '330', hRootDict,
    '100', 'AcDbDictionary', '280', '1', '281', '1',
  )
  L.push(
    '0', 'DICTIONARY', '5', hAcadLayoutDict, '330', hRootDict,
    '100', 'AcDbDictionary', '280', '1', '281', '1',
    '3', 'Model', '350', hModelLayout,
    '3', 'Layout1', '350', hPaperLayout,
  )
  L.push(
    '0', 'ACDBDICTIONARYWDFLT', '5', hAcadPlotStyleDict, '330', hRootDict,
    '100', 'AcDbDictionary', '281', '1',
    '3', 'Normal', '350', hAcadPlotStyleNormal,
    '100', 'AcDbDictionaryWithDefault', '340', hAcadPlotStyleNormal,
  )
  L.push(
    '0', 'ACDBPLACEHOLDER', '5', hAcadPlotStyleNormal, '330', hAcadPlotStyleDict,
  )
  L.push(...makeLayoutObject({
    handle: hModelLayout,
    owner: hAcadLayoutDict,
    name: 'Model',
    tabOrder: 0,
    isModelSpace: true,
    blockRecordHandle: hModelSpaceBlkRec,
  }))
  L.push(...makeLayoutObject({
    handle: hPaperLayout,
    owner: hAcadLayoutDict,
    name: 'Layout1',
    tabOrder: 1,
    isModelSpace: false,
    blockRecordHandle: hPaperSpaceBlkRec,
  }))
  L.push('0', 'ENDSEC')

  L.push('0', 'EOF')

  const text = L.join('\n') + '\n'
  return text.replace(HANDSEED_PLACEHOLDER, h.seed)
}

function makeLayoutObject(options: {
  handle: string
  owner: string
  name: string
  tabOrder: number
  isModelSpace: boolean
  blockRecordHandle: string
}): string[] {
  const {
    handle,
    owner,
    name,
    tabOrder,
    isModelSpace,
    blockRecordHandle,
  } = options

  return [
    '0', 'LAYOUT',
    '5', handle,
    '330', owner,
    '100', 'AcDbPlotSettings',
    '1', '',
    '4', 'A3',
    '6', '',
    '40', '7.5',
    '41', '20.0',
    '42', '7.5',
    '43', '20.0',
    '44', '420.0',
    '45', '297.0',
    '46', '0.0',
    '47', '0.0',
    '48', '0.0',
    '49', '0.0',
    '140', '0.0',
    '141', '0.0',
    '142', '1.0',
    '143', '1.0',
    '70', isModelSpace ? '1024' : '0',
    '72', '1',
    '73', '0',
    '74', '5',
    '7', '',
    '75', '16',
    '76', '0',
    '77', '2',
    '78', '300',
    '147', '1.0',
    '148', '0.0',
    '149', '0.0',
    '100', 'AcDbLayout',
    '1', name,
    '70', isModelSpace ? '1' : '0',
    '71', String(tabOrder),
    '10', '0.0',
    '20', '0.0',
    '11', '420.0',
    '21', '297.0',
    '12', '0.0',
    '22', '0.0',
    '32', '0.0',
    '14', '1e+20',
    '24', '1e+20',
    '34', '1e+20',
    '15', '-1e+20',
    '25', '-1e+20',
    '35', '-1e+20',
    '146', '0.0',
    '13', '0.0',
    '23', '0.0',
    '33', '0.0',
    '16', '1.0',
    '26', '0.0',
    '36', '0.0',
    '17', '0.0',
    '27', '1.0',
    '37', '0.0',
    '76', '1',
    '330', blockRecordHandle,
  ]
}

/**
 * Takes a raw entity string (e.g. "0\nLWPOLYLINE\n8\nLAYER_NAME\n...")
 * and injects:
 *   - handle (group code 5)
 *   - owner block record (group code 330)
 *   - AcDbEntity subclass marker (100)
 *   - the proper AcDb* subclass marker for the entity type
 */
function injectR2000EntityMeta(raw: string, h: HandleAlloc, ownerHandle: string): string {
  const lines = raw.split('\n')
  if (lines.length < 2) return raw

  const entityType = lines[1]!.trim()
  const handle = h.next()

  // Find the layer line (group code 8) — everything after it is entity-specific data.
  let layerIdx = -1
  for (let i = 2; i < lines.length; i++) {
    if (lines[i]!.trim() === '8') { layerIdx = i; break }
  }
  if (layerIdx < 0) {
    // No layer found; just prepend handle after entity type
    return ['0', entityType, '5', handle, ...lines.slice(2)].join('\n')
  }

  const layerName = lines[layerIdx + 1]!.trim()
  const dataAfterLayer = lines.slice(layerIdx + 2)

  const subclass = entitySubclass(entityType)

  const result = [
    '0', entityType,
    '5', handle,
    '330', ownerHandle,
    '100', 'AcDbEntity',
    '8', layerName,
  ]
  if (subclass) result.push('100', subclass)
  result.push(...dataAfterLayer)

  return result.join('\n')
}

function entitySubclass(entityType: string): string | null {
  switch (entityType) {
    case 'LWPOLYLINE': return 'AcDbPolyline'
    case 'CIRCLE': return 'AcDbCircle'
    case 'LINE': return 'AcDbLine'
    case 'ARC': return 'AcDbArc'
    case 'POLYLINE': return 'AcDb2dPolyline'
    case 'POINT': return 'AcDbPoint'
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sanitizeLayerName(rawName: string): string {
  const sanitized = rawName
    .replace(/[<>\/\\":;?*|=]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 255)
    .trim()
  return sanitized || 'GERBER'
}

function toDxfX(x: number): number {
  return x
}

function toDxfY(y: number): number {
  return y
}

function samePoint(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) <= 1e-9 && Math.abs(a[1] - b[1]) <= 1e-9
}

function samePointDxf(a: DxfVertex, b: DxfVertex): boolean {
  return Math.abs(a.x - b.x) <= 1e-9 && Math.abs(a.y - b.y) <= 1e-9
}

function fmt(n: number): string {
  const rounded = Math.round(n * 1_000_000) / 1_000_000
  return String(rounded)
}

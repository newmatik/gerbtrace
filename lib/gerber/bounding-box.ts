import type { BoundingBox, ImageGraphic, Shape, PathSegment } from './types'

export function emptyBounds(): BoundingBox {
  return [Infinity, Infinity, -Infinity, -Infinity]
}

export function isEmpty(bb: BoundingBox): boolean {
  return bb[0] === Infinity
}

export function expandBounds(bb: BoundingBox, x: number, y: number): BoundingBox {
  return [
    Math.min(bb[0], x),
    Math.min(bb[1], y),
    Math.max(bb[2], x),
    Math.max(bb[3], y),
  ]
}

export function mergeBounds(a: BoundingBox, b: BoundingBox): BoundingBox {
  if (isEmpty(a)) return b
  if (isEmpty(b)) return a
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ]
}

export function boundsFromGraphics(graphics: ImageGraphic[]): BoundingBox {
  let bb = emptyBounds()
  for (const g of graphics) {
    bb = mergeBounds(bb, graphicBounds(g))
  }
  return bb
}

function graphicBounds(g: ImageGraphic): BoundingBox {
  switch (g.type) {
    case 'shape':
      return shapeBounds(g.shape)
    case 'path':
      return pathBoundsWithWidth(g.segments, g.width)
    case 'region':
      return segmentsBounds(g.segments)
  }
}

export function shapeBounds(shape: Shape): BoundingBox {
  switch (shape.type) {
    case 'circle':
      return [shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r]
    case 'rect':
      return [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h]
    case 'polygon': {
      let bb = emptyBounds()
      for (const [x, y] of shape.points) {
        bb = expandBounds(bb, x, y)
      }
      return bb
    }
    case 'outline':
      return segmentsBounds(shape.segments)
    case 'layered': {
      let bb = emptyBounds()
      for (const s of shape.shapes) {
        bb = mergeBounds(bb, shapeBounds(s))
      }
      return bb
    }
  }
}

function segmentsBounds(segments: PathSegment[]): BoundingBox {
  let bb = emptyBounds()
  for (const seg of segments) {
    bb = expandBounds(bb, seg.start[0], seg.start[1])
    bb = expandBounds(bb, seg.end[0], seg.end[1])
    if (seg.type === 'arc') {
      bb = expandBounds(bb, seg.center[0] + seg.radius, seg.center[1])
      bb = expandBounds(bb, seg.center[0] - seg.radius, seg.center[1])
      bb = expandBounds(bb, seg.center[0], seg.center[1] + seg.radius)
      bb = expandBounds(bb, seg.center[0], seg.center[1] - seg.radius)
    }
  }
  return bb
}

function pathBoundsWithWidth(segments: PathSegment[], width: number): BoundingBox {
  const bb = segmentsBounds(segments)
  if (isEmpty(bb)) return bb
  const hw = width / 2
  return [bb[0] - hw, bb[1] - hw, bb[2] + hw, bb[3] + hw]
}

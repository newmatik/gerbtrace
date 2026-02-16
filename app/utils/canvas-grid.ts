/**
 * Shared grid drawing utility for canvas-based Gerber viewers.
 *
 * Draws a background grid in Gerber coordinate space with major/minor lines.
 * Used by BoardCanvas (viewer), GerberCanvas (compare), and DiffHighlightView.
 */

export interface GridDrawOptions {
  ctx: CanvasRenderingContext2D
  cssWidth: number
  cssHeight: number
  dpr: number
  transform: { offsetX: number; offsetY: number; scale: number }
  mirrored?: boolean
  /** Gerber coordinate units ('mm' or 'in') */
  units: 'mm' | 'in'
  /** Grid spacing in millimeters */
  gridSpacingMm: number
  /** Whether the background is light (white) */
  isLight: boolean
}

export function drawCanvasGrid(opts: GridDrawOptions): void {
  const {
    ctx,
    cssWidth,
    cssHeight,
    dpr,
    transform,
    mirrored = false,
    units,
    gridSpacingMm,
    isLight,
  } = opts

  // Convert mm spacing to Gerber coordinate units
  const spacing = units === 'in' ? gridSpacingMm / 25.4 : gridSpacingMm

  const { offsetX, offsetY, scale } = transform
  if (scale <= 0 || spacing <= 0) return

  // Compute the visible Gerber coordinate range
  // Transform model: screenX = offsetX + gerberX * scale
  //                  screenY = offsetY - gerberY * scale
  const gerberXAtScreenLeft = mirrored
    ? (cssWidth - 0 - offsetX) / scale
    : (0 - offsetX) / scale
  const gerberXAtScreenRight = mirrored
    ? (cssWidth - cssWidth - offsetX) / scale
    : (cssWidth - offsetX) / scale
  const gerberXMin = Math.min(gerberXAtScreenLeft, gerberXAtScreenRight)
  const gerberXMax = Math.max(gerberXAtScreenLeft, gerberXAtScreenRight)
  const gerberYMin = (offsetY - cssHeight) / scale
  const gerberYMax = (offsetY - 0) / scale

  // Snap to grid lines
  const firstX = Math.floor(gerberXMin / spacing) * spacing
  const lastX = Math.ceil(gerberXMax / spacing) * spacing
  const firstY = Math.floor(gerberYMin / spacing) * spacing
  const lastY = Math.ceil(gerberYMax / spacing) * spacing

  // Limit to avoid performance issues at extreme zoom out
  const lineCountX = (lastX - firstX) / spacing
  const lineCountY = (lastY - firstY) / spacing
  if (lineCountX > 500 || lineCountY > 500) return

  // Choose grid colors based on background
  const minorColor = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const majorColor = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'
  const majorEvery = 5

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  ctx.lineWidth = 1

  // Vertical lines (along X axis)
  for (let gx = firstX; gx <= lastX; gx += spacing) {
    const screenX = mirrored
      ? cssWidth - (offsetX + gx * scale)
      : offsetX + gx * scale
    const gridIndex = Math.round(gx / spacing)
    const isMajor = gridIndex % majorEvery === 0
    ctx.strokeStyle = isMajor ? majorColor : minorColor
    ctx.beginPath()
    ctx.moveTo(Math.round(screenX) + 0.5, 0)
    ctx.lineTo(Math.round(screenX) + 0.5, cssHeight)
    ctx.stroke()
  }

  // Horizontal lines (along Y axis)
  for (let gy = firstY; gy <= lastY; gy += spacing) {
    const screenY = offsetY - gy * scale
    const gridIndex = Math.round(gy / spacing)
    const isMajor = gridIndex % majorEvery === 0
    ctx.strokeStyle = isMajor ? majorColor : minorColor
    ctx.beginPath()
    ctx.moveTo(0, Math.round(screenY) + 0.5)
    ctx.lineTo(cssWidth, Math.round(screenY) + 0.5)
    ctx.stroke()
  }

  ctx.restore()
}

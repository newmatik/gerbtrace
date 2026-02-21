export interface CanvasTransform {
  offsetX: number
  offsetY: number
  scale: number
}

interface MouseMoveOptions {
  invertPanX?: boolean
  rotationDeg?: number
}

export function useCanvasInteraction() {
  const transform = ref<CanvasTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  })

  const isDragging = ref(false)
  let lastX = 0
  let lastY = 0
  let moveRafId = 0
  let queuedMove: { x: number; y: number; options?: MouseMoveOptions } | null = null

  function resetView() {
    // Set to a sentinel that BoardCanvas/GerberCanvas will detect and auto-fit
    transform.value = { offsetX: 0, offsetY: 0, scale: 0 }
  }

  function zoomIn() {
    const t = transform.value
    // Zoom towards center of the canvas — we don't know canvas size here,
    // so just scale around the current offset center
    const factor = 1.25
    transform.value = {
      offsetX: t.offsetX,
      offsetY: t.offsetY,
      scale: t.scale * factor,
    }
  }

  function zoomOut() {
    const t = transform.value
    const factor = 1 / 1.25
    transform.value = {
      offsetX: t.offsetX,
      offsetY: t.offsetY,
      scale: t.scale * factor,
    }
  }

  /**
   * Un-rotate a screen point around the canvas center.
   * Used to map screen-space mouse coordinates into the un-rotated
   * coordinate space used by the transform (offsetX/offsetY/scale).
   */
  function unrotatePoint(sx: number, sy: number, cx: number, cy: number, rotDeg: number): { x: number; y: number } {
    if (rotDeg === 0) return { x: sx, y: sy }
    const rad = -(rotDeg * Math.PI) / 180
    const dx = sx - cx
    const dy = sy - cy
    return {
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    }
  }

  /**
   * Un-rotate a screen-space delta vector.
   */
  function unrotateDelta(dx: number, dy: number, rotDeg: number): { dx: number; dy: number } {
    if (rotDeg === 0) return { dx, dy }
    const rad = -(rotDeg * Math.PI) / 180
    return {
      dx: dx * Math.cos(rad) - dy * Math.sin(rad),
      dy: dx * Math.sin(rad) + dy * Math.cos(rad),
    }
  }

  /**
   * Zoom around the mouse cursor position.
   * Transform model: screenX = offsetX + gerberX * scale
   *                  screenY = offsetY - gerberY * scale
   * The Gerber point under the cursor must stay fixed after zoom.
   *
   * @param rotationDeg Optional board rotation in degrees. When non-zero,
   *   the mouse position is un-rotated around the canvas center before
   *   computing the zoom pivot so zooming feels natural in a rotated view.
   */
  function handleWheel(e: WheelEvent, canvasEl: HTMLCanvasElement, rotationDeg: number = 0) {
    const rect = canvasEl.getBoundingClientRect()
    let mouseX = e.clientX - rect.left
    let mouseY = e.clientY - rect.top

    if (rotationDeg !== 0) {
      const cx = rect.width / 2
      const cy = rect.height / 2
      const pt = unrotatePoint(mouseX, mouseY, cx, cy, rotationDeg)
      mouseX = pt.x
      mouseY = pt.y
    }

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const oldScale = transform.value.scale
    const newScale = oldScale * factor

    // Keep the Gerber point under the cursor fixed:
    //   mouseX = oldOffset + gerberX * oldScale
    //   mouseX = newOffset + gerberX * newScale
    //   → newOffset = mouseX - (mouseX - oldOffset) * (newScale / oldScale)
    transform.value = {
      scale: newScale,
      offsetX: mouseX - (mouseX - transform.value.offsetX) * (newScale / oldScale),
      offsetY: mouseY - (mouseY - transform.value.offsetY) * (newScale / oldScale),
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault()
      isDragging.value = true
      lastX = e.clientX
      lastY = e.clientY
      queuedMove = null
    }
  }

  function applyQueuedMove(x: number, y: number, options?: MouseMoveOptions) {
    let dx = x - lastX
    let dy = y - lastY
    lastX = x
    lastY = y

    if (options?.rotationDeg) {
      const r = unrotateDelta(dx, dy, options.rotationDeg)
      dx = r.dx
      dy = r.dy
    }

    const panDx = options?.invertPanX ? -dx : dx
    transform.value = {
      ...transform.value,
      offsetX: transform.value.offsetX + panDx,
      offsetY: transform.value.offsetY + dy,
    }
  }

  function handleMouseMove(e: MouseEvent, options?: MouseMoveOptions) {
    if (!isDragging.value) return
    queuedMove = { x: e.clientX, y: e.clientY, options }
    if (moveRafId) return
    moveRafId = requestAnimationFrame(() => {
      moveRafId = 0
      const move = queuedMove
      queuedMove = null
      if (!move || !isDragging.value) return
      applyQueuedMove(move.x, move.y, move.options)
    })
  }

  function handleMouseUp() {
    if (moveRafId) {
      cancelAnimationFrame(moveRafId)
      moveRafId = 0
    }
    if (queuedMove && isDragging.value) {
      applyQueuedMove(queuedMove.x, queuedMove.y, queuedMove.options)
    }
    queuedMove = null
    isDragging.value = false
  }

  return {
    transform,
    isDragging,
    resetView,
    zoomIn,
    zoomOut,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}

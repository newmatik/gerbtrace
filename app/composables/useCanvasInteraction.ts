export interface CanvasTransform {
  offsetX: number
  offsetY: number
  scale: number
}

interface MouseMoveOptions {
  invertPanX?: boolean
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
   * Zoom around the mouse cursor position.
   * Transform model: screenX = offsetX + gerberX * scale
   *                  screenY = offsetY - gerberY * scale
   * The Gerber point under the cursor must stay fixed after zoom.
   */
  function handleWheel(e: WheelEvent, canvasEl: HTMLCanvasElement) {
    const rect = canvasEl.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

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
    if (e.button === 2) {
      isDragging.value = true
      lastX = e.clientX
      lastY = e.clientY
    }
  }

  function handleMouseMove(e: MouseEvent, options?: MouseMoveOptions) {
    if (!isDragging.value) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    const panDx = options?.invertPanX ? -dx : dx
    transform.value = {
      ...transform.value,
      offsetX: transform.value.offsetX + panDx,
      offsetY: transform.value.offsetY + dy,
    }
  }

  function handleMouseUp() {
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

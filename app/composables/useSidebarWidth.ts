const STORAGE_PREFIX = 'gerbtrace:sidebar-width'
const MIN_WIDTH = 200
const MAX_WIDTH = 800

const PAGE_DEFAULTS: Record<string, number> = {
  files: 520,
  pcb: 360,
  panel: 360,
  smd: 360,
  tht: 360,
  bom: 50, // percentage
  docs: 340,
  compare: 420,
}

const widthCache = new Map<string, Ref<number>>()

function loadWidth(pageKey: string): number {
  if (typeof window === 'undefined') return PAGE_DEFAULTS[pageKey] ?? 360
  const stored = localStorage.getItem(`${STORAGE_PREFIX}:${pageKey}`)
  if (stored) {
    const n = parseFloat(stored)
    if (!isNaN(n)) return n
  }
  return PAGE_DEFAULTS[pageKey] ?? 360
}

function saveWidth(pageKey: string, w: number) {
  localStorage.setItem(`${STORAGE_PREFIX}:${pageKey}`, String(w))
}

function getWidthRef(pageKey: string): Ref<number> {
  let r = widthCache.get(pageKey)
  if (!r) {
    r = ref(loadWidth(pageKey))
    widthCache.set(pageKey, r)
  }
  return r
}

/**
 * Per-page-type sidebar width persisted to localStorage.
 * Each page type stores its own width independently.
 */
export function useSidebarWidth(pageKey: string) {
  const sidebarWidth = getWidthRef(pageKey)
  const dragging = ref(false)

  function onDragStart(e: MouseEvent) {
    e.preventDefault()
    dragging.value = true
    const startX = e.clientX
    const startWidth = sidebarWidth.value

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      sidebarWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
    }

    function onUp() {
      dragging.value = false
      saveWidth(pageKey, sidebarWidth.value)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return {
    sidebarWidth,
    dragging,
    onDragStart,
    MIN_WIDTH,
    MAX_WIDTH,
  }
}

/**
 * Per-page-type BOM split percentage persisted to localStorage.
 */
export function useBomSplitWidth() {
  const pct = getWidthRef('bom')
  const dragging = ref(false)

  function onDragStart(e: MouseEvent, containerEl: HTMLElement) {
    e.preventDefault()
    dragging.value = true
    const rect = containerEl.getBoundingClientRect()

    function onMove(ev: MouseEvent) {
      const x = ev.clientX - rect.left
      pct.value = Math.max(25, Math.min(75, (x / rect.width) * 100))
    }

    function onUp() {
      dragging.value = false
      saveWidth('bom', pct.value)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return {
    pct,
    dragging,
    onDragStart,
  }
}

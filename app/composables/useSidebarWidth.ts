const STORAGE_KEY = 'gerbtrace:sidebar-width'
const DEFAULT_WIDTH = 288 // 18rem = w-72
const MIN_WIDTH = 200
const MAX_WIDTH = 600

/** Shared sidebar width persisted to localStorage. */
const sidebarWidth = ref(loadWidth())

function loadWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const n = parseInt(stored, 10)
    if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n
  }
  return DEFAULT_WIDTH
}

function saveWidth(w: number) {
  localStorage.setItem(STORAGE_KEY, String(w))
}

export function useSidebarWidth() {
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
      saveWidth(sidebarWidth.value)
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

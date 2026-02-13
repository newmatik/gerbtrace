const BG_KEY = 'gerbtrace:bg-color'

type BgColor = '#000000' | '#ffffff'

function loadBg(): BgColor {
  if (typeof window === 'undefined') return '#000000'
  const stored = localStorage.getItem(BG_KEY)
  if (stored === '#ffffff' || stored === '#000000') return stored
  return '#000000'
}

const backgroundColor = ref<BgColor>(loadBg())

export function useBackgroundColor() {
  function toggle() {
    backgroundColor.value = backgroundColor.value === '#000000' ? '#ffffff' : '#000000'
    if (typeof window !== 'undefined') {
      localStorage.setItem(BG_KEY, backgroundColor.value)
    }
  }

  const isLight = computed(() => backgroundColor.value === '#ffffff')

  return {
    backgroundColor,
    isLight,
    toggle,
  }
}

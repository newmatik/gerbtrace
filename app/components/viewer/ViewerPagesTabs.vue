<template>
  <nav
    class="min-w-0 flex items-center"
    aria-label="Viewer pages"
  >
    <div
      role="tablist"
      class="viewer-tabs-scroller flex items-center min-w-0 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] gap-0.5"
    >
      <button
        v-for="t in allTabs"
        :key="t.value"
        v-show="t.visible"
        type="button"
        role="tab"
        :aria-selected="page === t.value"
        :tabindex="page === t.value ? 0 : -1"
        class="flex items-center gap-1.5 h-7 px-2.5 text-xs select-none whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        :class="page === t.value
          ? 'bg-neutral-200/80 text-neutral-950 font-semibold dark:bg-neutral-700/60 dark:text-neutral-50'
          : 'text-neutral-500 font-medium hover:text-neutral-800 hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700/30'"
        @click="page = t.value"
      >
        <UIcon
          :name="t.icon"
          class="text-sm shrink-0"
          :class="page === t.value ? 'opacity-100' : 'opacity-50'"
        />
        <span class="leading-none">{{ t.label }}</span>
        <UIcon
          v-if="isTabLocked(t.value)"
          name="i-lucide-lock"
          class="text-[10px] shrink-0"
          :class="page === t.value ? 'opacity-90' : 'opacity-60'"
          title="Locked"
        />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
type ViewerPage = 'files' | 'pcb' | 'panel' | 'smd' | 'tht' | 'bom' | 'pricing' | 'docs'

const page = defineModel<ViewerPage>({ required: true })

const props = defineProps<{
  showPanel?: boolean
  showPnP?: boolean
  showBom?: boolean
  showDocs?: boolean
  lockedTabs?: ViewerPage[]
}>()

interface TabDef { label: string; value: ViewerPage; icon: string; visible: boolean }

const allTabs = computed<TabDef[]>(() => [
  { label: 'Files', value: 'files', icon: 'i-lucide-folder-open', visible: true },
  { label: 'PCB', value: 'pcb', icon: 'i-lucide-circuit-board', visible: true },
  { label: 'Panel', value: 'panel', icon: 'i-lucide-layout-grid', visible: !!props.showPanel },
  { label: 'SMD', value: 'smd', icon: 'i-lucide-microchip', visible: !!props.showPnP },
  { label: 'THT', value: 'tht', icon: 'i-lucide-pin', visible: !!props.showPnP },
  { label: 'BOM', value: 'bom', icon: 'i-lucide-table', visible: !!props.showBom },
  { label: 'Docs', value: 'docs', icon: 'i-lucide-book-open-text', visible: !!props.showDocs },
  { label: 'Pricing', value: 'pricing', icon: 'i-lucide-dollar-sign', visible: true },
])

function isTabLocked(tab: ViewerPage): boolean {
  return (props.lockedTabs ?? []).includes(tab)
}
</script>

<style scoped>
.viewer-tabs-scroller::-webkit-scrollbar {
  display: none;
}
.viewer-tabs-scroller {
  scrollbar-width: none;
}
</style>

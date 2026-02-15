<template>
  <div
    class="flex flex-col h-full focus:outline-none"
    tabindex="0"
    @keydown="handleListKeydown"
  >
    <!-- Search -->
    <div class="p-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
      <UInput
        v-model="query"
        size="sm"
        placeholder="Search packages..."
        icon="i-lucide-search"
      />
      <div>
        <label class="mb-1 block text-[11px] text-neutral-400">Package Type (TPSys)</label>
        <USelect
          v-model="selectedTpsysType"
          size="sm"
          :items="tpsysTypeOptions"
          value-key="value"
          label-key="label"
        />
      </div>
    </div>

    <!-- List -->
    <div ref="listContainerRef" class="flex-1 overflow-y-auto">
      <div v-if="filteredPackages.length === 0" class="p-4 text-center text-xs text-neutral-400">
        No packages found
      </div>
      <button
        v-for="item in filteredPackages"
        :key="item.key"
        :data-package-key="item.key"
        class="w-full text-left px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        :class="selectedKey === item.key ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary' : ''"
        @click="$emit('select', item)"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-neutral-900 dark:text-white truncate">{{ item.pkg.name }}</span>
          <UIcon
            v-if="item.source === 'builtin'"
            name="i-lucide-lock"
            class="text-neutral-300 dark:text-neutral-600 text-xs shrink-0"
            title="Built-in package"
          />
        </div>
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="text-[11px] px-1.5 py-0 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
            {{ typeLabel(item.pkg.type) }}
          </span>
          <span v-if="item.pkg.aliases?.length" class="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
            {{ item.pkg.aliases.slice(0, 3).join(', ') }}{{ item.pkg.aliases.length > 3 ? '...' : '' }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PackageDefinition } from '~/utils/package-types'

export interface PackageListItem {
  key: string
  pkg: PackageDefinition
  source: 'builtin' | 'custom'
  customId?: number
}

const emit = defineEmits<{
  select: [item: PackageListItem]
}>()

const query = ref('')
const selectedTpsysType = ref<string>('ALL')

const tpsysTypeOptions = [
  { label: 'All', value: 'ALL' },
  { label: 'PT_TWO_POLE', value: 'PT_TWO_POLE' },
  { label: 'PT_THREE_POLE', value: 'PT_THREE_POLE' },
  { label: 'PT_TWO_SYM', value: 'PT_TWO_SYM' },
  { label: 'PT_FOUR_SYM', value: 'PT_FOUR_SYM' },
  { label: 'PT_TWO_PLUS_TWO', value: 'PT_TWO_PLUS_TWO' },
  { label: 'PT_BGA', value: 'PT_BGA' },
  { label: 'PT_GENERIC_BGA', value: 'PT_GENERIC_BGA' },
  { label: 'PT_OUTLINE', value: 'PT_OUTLINE' },
  { label: 'PT_GENERIC', value: 'PT_GENERIC' },
  { label: 'PT_FOUR_ON_TWO', value: 'PT_FOUR_ON_TWO' },
]

const props = defineProps<{
  packages: PackageListItem[]
  selectedKey: string | null
}>()

const listContainerRef = ref<HTMLElement | null>(null)

const filteredPackages = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.packages.filter((item) => {
    // Type filter
    if (!matchesTpsysType(item.pkg.type, selectedTpsysType.value)) return false
    // Text search
    if (q) {
      const nameMatch = item.pkg.name.toLowerCase().includes(q)
      const aliasMatch = item.pkg.aliases?.some(a => a.toLowerCase().includes(q)) ?? false
      if (!nameMatch && !aliasMatch) return false
    }
    return true
  })
})

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    Chip: 'Chip',
    ThreePole: 'SOT',
    TwoSymmetricLeadGroups: 'SO/SSOP',
    FourSymmetricLeadGroups: 'QFP/QFN',
    TwoPlusTwo: '2+2',
    FourOnTwo: '4-on-2',
    BGA: 'BGA',
    Outline: 'Outline',
  }
  return map[type] ?? type
}

function packageTpsysTypes(type: string): string[] {
  switch (type) {
    case 'Chip':
      return ['PT_TWO_POLE']
    case 'ThreePole':
      return ['PT_THREE_POLE']
    case 'TwoSymmetricLeadGroups':
      return ['PT_TWO_SYM']
    case 'FourSymmetricLeadGroups':
      return ['PT_FOUR_SYM']
    case 'TwoPlusTwo':
      return ['PT_TWO_PLUS_TWO']
    case 'FourOnTwo':
      return ['PT_FOUR_ON_TWO']
    case 'BGA':
      // We currently use one BGA runtime model for both TPSys BGA classes.
      return ['PT_BGA', 'PT_GENERIC_BGA']
    case 'Outline':
      return ['PT_OUTLINE']
    case 'PT_GENERIC':
      return ['PT_GENERIC']
    default:
      return []
  }
}

function matchesTpsysType(pkgType: string, selectedType: string): boolean {
  if (selectedType === 'ALL') return true
  return packageTpsysTypes(pkgType).includes(selectedType)
}

function handleListKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  if (!filteredPackages.value.length) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"], [role="textbox"]')) return

  event.preventDefault()

  const currentIndex = filteredPackages.value.findIndex(item => item.key === props.selectedKey)
  const offset = event.key === 'ArrowDown' ? 1 : -1

  let nextIndex = currentIndex + offset
  if (currentIndex === -1) {
    nextIndex = event.key === 'ArrowDown' ? 0 : filteredPackages.value.length - 1
  }
  nextIndex = Math.max(0, Math.min(nextIndex, filteredPackages.value.length - 1))

  const nextItem = filteredPackages.value[nextIndex]
  if (!nextItem || nextItem.key === props.selectedKey) return
  emit('select', nextItem)
}

function scrollSelectedIntoView() {
  if (!props.selectedKey || !listContainerRef.value) return
  const selector = `[data-package-key="${CSS.escape(props.selectedKey)}"]`
  const selectedButton = listContainerRef.value.querySelector(selector)
  if (!(selectedButton instanceof HTMLElement)) return
  selectedButton.scrollIntoView({ block: 'nearest' })
}

watch(
  () => props.selectedKey,
  () => {
    nextTick(() => {
      scrollSelectedIntoView()
    })
  },
)
</script>

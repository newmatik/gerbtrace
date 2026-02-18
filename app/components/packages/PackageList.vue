<template>
  <div
    class="flex flex-col h-full focus:outline-none"
    tabindex="0"
    @keydown="handleListKeydown"
  >
    <!-- Search -->
    <div class="p-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
      <div class="flex flex-wrap gap-1">
        <UButton
          size="xs"
          :variant="selectedLibraryIds.length === 0 ? 'solid' : 'outline'"
          color="neutral"
          @click="$emit('update:selected-library-ids', [])"
        >
          All Libraries
        </UButton>
        <UButton
          v-for="lib in libraries"
          :key="lib.id"
          size="xs"
          :variant="selectedLibraryIds.includes(lib.id) ? 'solid' : 'outline'"
          color="neutral"
          @click="$emit('update:selected-library-ids', selectedLibraryIds.includes(lib.id) ? [] : [lib.id])"
        >
          {{ lib.name }}
        </UButton>
      </div>
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
          :ui="{ content: 'min-w-fit', itemLabel: 'whitespace-nowrap' }"
        />
      </div>
    </div>

    <!-- List -->
    <div ref="listContainerRef" class="flex-1 overflow-y-auto">
      <div v-if="groupedPackages.length === 0" class="p-4 text-center text-xs text-neutral-400">
        No packages found
      </div>
      <div v-for="group in groupedPackages" :key="group.id" class="border-b border-neutral-100 dark:border-neutral-800">
        <button
          class="w-full text-left px-3 py-2 bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
          :class="selectedLibraryNode === group.id ? 'ring-1 ring-primary/50' : ''"
          @click="$emit('select-library', group.id)"
        >
          <span class="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
            {{ group.name }}
          </span>
          <span class="text-[11px] text-neutral-400">{{ group.items.length }}</span>
        </button>
        <button
          v-for="item in group.items"
          :key="item.key"
          :data-package-key="item.key"
          class="w-full text-left px-3 py-2.5 border-t border-neutral-100 dark:border-neutral-800 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
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
  </div>
</template>

<script setup lang="ts">
import { PACKAGE_TYPE_LABELS } from '~/utils/package-types'
import type { PackageDefinition } from '~/utils/package-types'
import type { BuiltinLibraryInfo } from '~/composables/usePackageLibrary'

export interface PackageListItem {
  key: string
  pkg: PackageDefinition
  source: 'builtin' | 'custom' | 'team'
  customId?: number
  teamId?: string
  libraryId?: string
  libraryName?: string
}

const emit = defineEmits<{
  select: [item: PackageListItem]
  'select-library': [libraryId: string]
  'update:selected-library-ids': [value: string[]]
}>()

const query = ref('')
const selectedTpsysType = ref<string>('ALL')

const tpsysTypeOptions = [
  { label: 'All', value: 'ALL' },
  { label: PACKAGE_TYPE_LABELS.PT_TWO_POLE, value: 'PT_TWO_POLE' },
  { label: PACKAGE_TYPE_LABELS.PT_THREE_POLE, value: 'PT_THREE_POLE' },
  { label: PACKAGE_TYPE_LABELS.PT_TWO_SYM, value: 'PT_TWO_SYM' },
  { label: PACKAGE_TYPE_LABELS.PT_FOUR_SYM, value: 'PT_FOUR_SYM' },
  { label: PACKAGE_TYPE_LABELS.PT_TWO_PLUS_TWO, value: 'PT_TWO_PLUS_TWO' },
  { label: PACKAGE_TYPE_LABELS.PT_FOUR_ON_TWO, value: 'PT_FOUR_ON_TWO' },
  { label: PACKAGE_TYPE_LABELS.PT_BGA, value: 'PT_BGA' },
  { label: 'BGA Generic', value: 'PT_GENERIC_BGA' },
  { label: PACKAGE_TYPE_LABELS.PT_OUTLINE, value: 'PT_OUTLINE' },
  { label: PACKAGE_TYPE_LABELS.PT_GENERIC, value: 'PT_GENERIC' },
]

const props = defineProps<{
  packages: PackageListItem[]
  selectedKey: string | null
  selectedLibraryNode: string | null
  libraries: BuiltinLibraryInfo[]
  selectedLibraryIds: string[]
}>()

const listContainerRef = ref<HTMLElement | null>(null)

const filteredPackages = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.packages.filter((item) => {
    if (props.selectedLibraryIds.length > 0) {
      const libId = item.libraryId
        ?? (item.source === 'builtin' ? 'newmatik' : 'team')
      if (!props.selectedLibraryIds.includes(libId)) return false
    }
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

const groupedPackages = computed(() => {
  const groups = new Map<string, { id: string, name: string, items: PackageListItem[] }>()
  for (const item of filteredPackages.value) {
    const id = item.libraryId
      ?? (item.source === 'builtin' ? 'newmatik' : 'team')
    const name = item.libraryName
      ?? (item.source === 'builtin' ? id : 'Team Library')
    if (!groups.has(id)) groups.set(id, { id, name, items: [] })
    groups.get(id)!.items.push(item)
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
})

function typeLabel(type: string): string {
  return (PACKAGE_TYPE_LABELS as Record<string, string>)[type] ?? type
}

function packageTpsysTypes(type: string): string[] {
  // Package type discriminators are already TPSys names.
  // PT_BGA also matches the PT_GENERIC_BGA filter.
  if (type === 'PT_BGA') return ['PT_BGA', 'PT_GENERIC_BGA']
  return [type]
}

function matchesTpsysType(pkgType: string, selectedType: string): boolean {
  if (selectedType === 'ALL') return true
  return packageTpsysTypes(pkgType).includes(selectedType)
}

function handleListKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const flat = groupedPackages.value.flatMap(g => g.items)
  if (!flat.length) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"], [role="textbox"]')) return

  event.preventDefault()

  const currentIndex = flat.findIndex(item => item.key === props.selectedKey)
  const offset = event.key === 'ArrowDown' ? 1 : -1

  let nextIndex = currentIndex + offset
  if (currentIndex === -1) {
    nextIndex = event.key === 'ArrowDown' ? 0 : flat.length - 1
  }
  nextIndex = Math.max(0, Math.min(nextIndex, flat.length - 1))

  const nextItem = flat[nextIndex]
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

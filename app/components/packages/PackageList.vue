<template>
  <div class="flex flex-col h-full">
    <!-- Search -->
    <div class="p-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
      <UInput
        v-model="query"
        size="sm"
        placeholder="Search packages..."
        icon="i-lucide-search"
      />
      <div class="flex flex-wrap gap-1">
        <button
          v-for="t in typeFilters"
          :key="t.value"
          class="px-2 py-0.5 text-[11px] rounded-full border transition-colors"
          :class="activeType === t.value
            ? 'bg-primary text-white border-primary'
            : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
          @click="activeType = activeType === t.value ? null : t.value"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="filteredPackages.length === 0" class="p-4 text-center text-xs text-neutral-400">
        No packages found
      </div>
      <button
        v-for="item in filteredPackages"
        :key="item.key"
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

defineEmits<{
  select: [item: PackageListItem]
}>()

const query = ref('')
const activeType = ref<string | null>(null)

const typeFilters = [
  { label: 'Chip', value: 'Chip' },
  { label: 'SOT', value: 'ThreePole' },
  { label: 'SO/SSOP', value: 'TwoSymmetricLeadGroups' },
  { label: 'QFP/QFN', value: 'FourSymmetricLeadGroups' },
  { label: 'BGA', value: 'BGA' },
  { label: 'Outline', value: 'Outline' },
]

const props = defineProps<{
  packages: PackageListItem[]
  selectedKey: string | null
}>()

const filteredPackages = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.packages.filter((item) => {
    // Type filter
    if (activeType.value && item.pkg.type !== activeType.value) return false
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
    BGA: 'BGA',
    Outline: 'Outline',
  }
  return map[type] ?? type
}
</script>

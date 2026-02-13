<template>
  <div class="absolute inset-0 flex flex-col bg-white dark:bg-neutral-900 font-mono text-xs">
    <div v-if="!match?.fileA || !match?.fileB" class="flex-1 flex items-center justify-center text-neutral-500">
      Select a matched layer pair to view text diff
    </div>
    <div v-else-if="match.identical" class="flex-1 flex flex-col items-center justify-center text-green-500">
      <UIcon name="i-lucide-check-circle" class="text-2xl mb-2" />
      <p>Files are identical</p>
    </div>
    <template v-else>
      <!-- Sticky stats bar -->
      <div class="flex items-center gap-4 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 shrink-0 bg-neutral-50 dark:bg-neutral-800/50">
        <span class="text-green-500 font-medium">+{{ stats.added }} added</span>
        <span class="text-red-500 font-medium">-{{ stats.removed }} removed</span>
        <span>{{ stats.unchanged }} unchanged</span>
        <button
          v-if="firstChangeIndex >= 0"
          class="ml-auto text-[11px] text-primary hover:underline"
          @click="scrollToFirstChange"
        >
          Jump to first change
        </button>
      </div>
      <!-- Scrollable diff content -->
      <div ref="scrollContainer" class="flex-1 overflow-auto">
        <table class="w-full border-collapse">
          <tbody>
            <tr
              v-for="(line, i) in diffLines"
              :key="i"
              :ref="i === firstChangeIndex ? 'firstChangeRow' : undefined"
              :class="{
                'bg-red-500/15 dark:bg-red-500/10': line.type === 'remove',
                'bg-green-500/15 dark:bg-green-500/10': line.type === 'add',
              }"
            >
              <td class="w-12 text-right pr-2 text-neutral-400 select-none border-r border-neutral-200 dark:border-neutral-800 tabular-nums">
                {{ line.lineA || '' }}
              </td>
              <td class="w-12 text-right pr-2 text-neutral-400 select-none border-r border-neutral-200 dark:border-neutral-800 tabular-nums">
                {{ line.lineB || '' }}
              </td>
              <td class="w-6 text-center select-none font-bold" :class="{
                'text-red-500': line.type === 'remove',
                'text-green-500': line.type === 'add',
              }">
                {{ line.type === 'remove' ? '-' : line.type === 'add' ? '+' : ' ' }}
              </td>
              <td class="px-2 whitespace-pre" :class="{
                'text-red-700 dark:text-red-300': line.type === 'remove',
                'text-green-700 dark:text-green-300': line.type === 'add',
              }">{{ line.content }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { LayerMatch } from '~/utils/gerber-helpers'
import { computeTextDiff, getDiffStats } from '~/utils/diff-utils'

const props = defineProps<{
  match: LayerMatch | null
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const firstChangeRow = ref<HTMLElement[] | null>(null)

const diffLines = computed(() => {
  if (!props.match?.fileA || !props.match?.fileB || props.match.identical) return []
  return computeTextDiff(props.match.fileA.content, props.match.fileB.content)
})

const stats = computed(() => getDiffStats(diffLines.value))

const firstChangeIndex = computed(() => {
  return diffLines.value.findIndex(l => l.type !== 'unchanged')
})

function scrollToFirstChange() {
  if (firstChangeRow.value?.[0]) {
    firstChangeRow.value[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// Auto-scroll to first change when diff loads
watch(diffLines, () => {
  nextTick(() => {
    if (firstChangeRow.value?.[0]) {
      firstChangeRow.value[0].scrollIntoView({ block: 'center' })
    }
  })
})
</script>

<template>
  <div class="h-full min-h-0 flex flex-col">
    <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2 flex-wrap">
      <UInput
        v-model="findQuery"
        size="xs"
        icon="i-lucide-search"
        placeholder="Find"
        class="w-44"
      />
      <UInput
        v-model="replaceValue"
        size="xs"
        icon="i-lucide-replace"
        placeholder="Replace"
        class="w-44"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :disabled="!canReplaceAll"
        @click="replaceAll"
      >
        Replace all
      </UButton>
      <span v-if="findQuery" class="text-[11px] text-neutral-500">
        {{ matchCount }} match{{ matchCount === 1 ? '' : 'es' }}
      </span>

      <div class="flex-1" />

      <UButton
        v-if="editable && mode === 'text'"
        size="xs"
        color="neutral"
        variant="outline"
        :icon="isEditing ? 'i-lucide-check' : 'i-lucide-pencil'"
        @click="isEditing = !isEditing"
      >
        {{ isEditing ? 'Done' : 'Edit' }}
      </UButton>
    </div>

    <div v-if="mode === 'diff'" class="flex-1 min-h-0 overflow-auto font-mono text-[11px]">
      <table class="w-full border-collapse">
        <tbody>
          <tr
            v-for="(line, idx) in diffLines"
            :key="`d-${idx}`"
            :class="{
              'bg-red-500/15 dark:bg-red-500/10': line.type === 'remove',
              'bg-green-500/15 dark:bg-green-500/10': line.type === 'add',
            }"
          >
            <td class="w-12 px-2 text-right text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 tabular-nums">
              {{ line.lineA || '' }}
            </td>
            <td class="w-12 px-2 text-right text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 tabular-nums">
              {{ line.lineB || '' }}
            </td>
            <td class="w-6 text-center font-bold select-none" :class="{
              'text-red-600 dark:text-red-300': line.type === 'remove',
              'text-green-600 dark:text-green-300': line.type === 'add',
            }">
              {{ line.type === 'remove' ? '-' : line.type === 'add' ? '+' : ' ' }}
            </td>
            <td
              class="px-2 py-0.5 whitespace-pre-wrap break-words"
              :class="{
                'text-red-700 dark:text-red-300': line.type === 'remove',
                'text-green-700 dark:text-green-300': line.type === 'add',
              }"
              v-html="highlightMatchHtml(line.content)"
            />
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="flex-1 min-h-0 overflow-hidden">
      <div v-if="isEditing && editable" class="h-full min-h-0 flex">
        <div ref="lineNumberColRef" class="shrink-0 w-14 overflow-auto border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70">
          <div
            v-for="lineNo in lineNumbers"
            :key="`ln-edit-${lineNo}`"
            class="h-[1.35rem] px-2 text-right text-[11px] leading-[1.35rem] tabular-nums text-neutral-500 select-none"
            :class="{ 'bg-amber-200/70 dark:bg-amber-500/20': changedLineSet.has(lineNo) }"
          >
            {{ lineNo }}
          </div>
        </div>
        <textarea
          ref="editorRef"
          v-model="draftText"
          class="flex-1 min-h-0 resize-none outline-none border-0 p-2 font-mono text-[11px] leading-[1.35rem] text-neutral-800 dark:text-neutral-100 bg-white dark:bg-neutral-950"
          spellcheck="false"
          @scroll="syncEditorScroll"
        />
      </div>

      <div v-else class="h-full overflow-auto font-mono text-[11px]">
        <table class="w-full border-collapse">
          <tbody>
            <tr
              v-for="(line, idx) in currentLines"
              :key="`t-${idx}`"
              :class="{ 'bg-amber-200/70 dark:bg-amber-500/20': changedLineSet.has(idx + 1) }"
            >
              <td class="w-14 px-2 align-top text-right border-r border-neutral-200 dark:border-neutral-800 text-neutral-500 tabular-nums select-none">
                {{ idx + 1 }}
              </td>
              <td
                class="px-2 py-0.5 align-top whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-200"
                v-html="highlightMatchHtml(line || ' ')"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computeTextDiff } from '~/utils/diff-utils'

const props = withDefaults(defineProps<{
  modelValue: string
  originalText?: string | null
  mode: 'text' | 'diff'
  editable?: boolean
}>(), {
  originalText: null,
  editable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isEditing = ref(false)
const draftText = ref(props.modelValue ?? '')
const findQuery = ref('')
const replaceValue = ref('')
const editorRef = ref<HTMLTextAreaElement | null>(null)
const lineNumberColRef = ref<HTMLElement | null>(null)

const currentText = computed(() => props.modelValue ?? '')
const originalTextResolved = computed(() => props.originalText ?? '')
const currentTextNormalized = computed(() => normalizeLineEndings(currentText.value))
const originalTextNormalized = computed(() => normalizeLineEndings(originalTextResolved.value))
const currentLines = computed(() => currentTextNormalized.value.split('\n'))
const originalLines = computed(() => originalTextNormalized.value.split('\n'))

const changedLineSet = computed(() => {
  const out = new Set<number>()
  const max = Math.max(currentLines.value.length, originalLines.value.length)
  for (let i = 0; i < max; i++) {
    if ((currentLines.value[i] ?? '') !== (originalLines.value[i] ?? '')) {
      out.add(i + 1)
    }
  }
  return out
})

const lineNumbers = computed(() =>
  Array.from({ length: currentLines.value.length }, (_, idx) => idx + 1),
)

const diffLines = computed(() => computeTextDiff(originalTextNormalized.value, currentTextNormalized.value))

const matchCount = computed(() => {
  const q = findQuery.value
  if (!q) return 0
  return countOccurrences(currentText.value, q)
})

const canReplaceAll = computed(() => !!findQuery.value && props.editable)

watch(
  () => props.modelValue,
  (next) => {
    if (next !== draftText.value) draftText.value = next ?? ''
  },
  { immediate: true },
)

watch(draftText, (next) => {
  if (!props.editable) return
  if (next !== props.modelValue) emit('update:modelValue', next)
})

function replaceAll() {
  if (!canReplaceAll.value) return
  const replaced = replaceAllOccurrences(currentText.value, findQuery.value, replaceValue.value)
  draftText.value = replaced
  emit('update:modelValue', replaced)
}

function syncEditorScroll() {
  const editor = editorRef.value
  const col = lineNumberColRef.value
  if (!editor || !col) return
  col.scrollTop = editor.scrollTop
}

function highlightMatchHtml(input: string): string {
  const safe = escapeHtml(input)
  const q = findQuery.value
  if (!q) return safe
  const safeQuery = escapeRegExp(escapeHtml(q))
  return safe.replace(
    new RegExp(safeQuery, 'g'),
    '<mark class="bg-yellow-300/80 dark:bg-yellow-500/50 text-inherit px-0">$&</mark>',
  )
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let pos = 0
  while (true) {
    const next = haystack.indexOf(needle, pos)
    if (next < 0) break
    count++
    pos = next + needle.length
  }
  return count
}

function replaceAllOccurrences(input: string, find: string, replaceWith: string): string {
  if (!find) return input
  return input.split(find).join(replaceWith)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}
</script>

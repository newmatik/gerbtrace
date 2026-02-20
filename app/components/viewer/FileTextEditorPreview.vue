<template>
  <div class="h-full min-h-0 flex flex-col">
    <!-- Toolbar: Find / Replace -->
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
    </div>

    <!-- Diff view -->
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

    <!-- Editable text view -->
    <div v-else-if="editable" class="flex-1 min-h-0 overflow-hidden relative">
      <div class="h-full flex">
        <!-- Line number gutter -->
        <div
          ref="gutterRef"
          class="shrink-0 overflow-hidden border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 select-none pointer-events-none"
          aria-hidden="true"
        >
          <div :style="{ transform: `translateY(${-scrollTop}px)` }">
            <div
              v-for="lineNo in lineCount"
              :key="lineNo"
              class="h-[1.375rem] px-2 min-w-[3.5rem] text-right text-[11px] leading-[1.375rem] tabular-nums"
              :class="changedLineSet.has(lineNo) ? 'text-amber-600 dark:text-amber-400 bg-amber-200/70 dark:bg-amber-500/20' : 'text-neutral-400'"
            >
              {{ lineNo }}
            </div>
          </div>
        </div>
        <!-- Textarea -->
        <textarea
          ref="editorRef"
          :value="draftText"
          class="flex-1 min-h-0 min-w-0 resize-none outline-none border-0 p-0 pl-2 pt-0 font-mono text-[11px] leading-[1.375rem] text-neutral-800 dark:text-neutral-100 bg-white dark:bg-neutral-950 whitespace-pre overflow-auto"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          @input="onInput"
          @scroll="onScroll"
          @keydown="onKeyDown"
        />
      </div>
    </div>

    <!-- Read-only text view -->
    <div v-else class="flex-1 min-h-0 overflow-auto font-mono text-[11px]">
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

const TAB_SIZE = 2
const TAB_STR = ' '.repeat(TAB_SIZE)

const draftText = ref(props.modelValue ?? '')
const findQuery = ref('')
const replaceValue = ref('')
const editorRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

const currentText = computed(() => props.modelValue ?? '')
const originalTextResolved = computed(() => props.originalText ?? '')
const currentTextNormalized = computed(() => normalizeLineEndings(currentText.value))
const originalTextNormalized = computed(() => normalizeLineEndings(originalTextResolved.value))
const currentLines = computed(() => currentTextNormalized.value.split('\n'))
const originalLines = computed(() => originalTextNormalized.value.split('\n'))
const lineCount = computed(() => draftText.value.split('\n').length)

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

const diffLines = computed(() => computeTextDiff(originalTextNormalized.value, currentTextNormalized.value))

const matchCount = computed(() => {
  const q = findQuery.value
  if (!q) return 0
  return countOccurrences(currentText.value, q)
})

const canReplaceAll = computed(() => !!findQuery.value && props.editable)

// Sync external value → draft (but not while user is actively typing)
watch(
  () => props.modelValue,
  (next) => {
    const val = next ?? ''
    if (val !== draftText.value) draftText.value = val
  },
)

function onInput(e: Event) {
  const ta = e.target as HTMLTextAreaElement
  draftText.value = ta.value
  emit('update:modelValue', ta.value)
}

function onScroll() {
  const ta = editorRef.value
  if (ta) scrollTop.value = ta.scrollTop
}

function onKeyDown(e: KeyboardEvent) {
  const ta = editorRef.value
  if (!ta) return

  // Tab → insert spaces
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    const { selectionStart: start, selectionEnd: end, value } = ta

    if (e.shiftKey) {
      // Shift-Tab: dedent selected lines
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEnd = value.indexOf('\n', end)
      const block = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      const dedented = block.split('\n').map(l =>
        l.startsWith(TAB_STR) ? l.slice(TAB_SIZE) : l.replace(/^\t/, ''),
      ).join('\n')
      const next = value.slice(0, lineStart) + dedented + (lineEnd === -1 ? '' : value.slice(lineEnd))
      setTextarea(ta, next, Math.max(lineStart, start - TAB_SIZE), Math.max(lineStart, end - (block.length - dedented.length)))
    } else if (start === end) {
      // No selection: insert spaces at cursor
      const next = value.slice(0, start) + TAB_STR + value.slice(end)
      setTextarea(ta, next, start + TAB_SIZE, start + TAB_SIZE)
    } else {
      // Selection: indent all selected lines
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEnd = value.indexOf('\n', end)
      const block = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      const indented = block.split('\n').map(l => TAB_STR + l).join('\n')
      const next = value.slice(0, lineStart) + indented + (lineEnd === -1 ? '' : value.slice(lineEnd))
      setTextarea(ta, next, start + TAB_SIZE, end + (indented.length - block.length))
    }
    return
  }

  // Enter → auto-indent: match leading whitespace of current line
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    const { selectionStart: start, selectionEnd: end, value } = ta
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const line = value.slice(lineStart, start)
    const indent = line.match(/^[ \t]*/)?.[0] ?? ''
    const insert = '\n' + indent
    const next = value.slice(0, start) + insert + value.slice(end)
    setTextarea(ta, next, start + insert.length, start + insert.length)
    return
  }
}

function setTextarea(ta: HTMLTextAreaElement, value: string, selStart: number, selEnd: number) {
  ta.value = value
  draftText.value = value
  emit('update:modelValue', value)
  nextTick(() => {
    ta.selectionStart = selStart
    ta.selectionEnd = selEnd
  })
}

function replaceAll() {
  if (!canReplaceAll.value) return
  const replaced = replaceAllOccurrences(currentText.value, findQuery.value, replaceValue.value)
  draftText.value = replaced
  emit('update:modelValue', replaced)
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

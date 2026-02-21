<template>
  <div class="h-full min-h-0 flex flex-col">
    <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2 flex-wrap">
      <div class="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
        <span>Delimiter</span>
        <USelect
          :model-value="delimiterMode"
          :items="delimiterItems"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-32"
          @update:model-value="delimiterMode = ($event as DelimiterMode)"
        />
      </div>
      <div class="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
        <span>Decimal</span>
        <USelect
          :model-value="decimalMode"
          :items="decimalItems"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-28"
          @update:model-value="decimalMode = ($event as DecimalMode)"
        />
      </div>
      <div class="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
        <UCheckbox
          :model-value="hasHeaderRow"
          :ui="{ base: 'scale-90' }"
          @update:model-value="hasHeaderRow = !!$event"
        />
        <span>Header row</span>
      </div>
      <USelect
        v-if="isExcel && sheetItems.length > 1"
        :model-value="selectedSheet"
        :items="sheetItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-44"
        @update:model-value="selectedSheet = String($event)"
      />
      <div class="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
        <span>Skip lines</span>
        <UInput
          :model-value="String(skipRowsLocal)"
          type="number"
          min="0"
          size="xs"
          class="w-16"
          @update:model-value="skipRowsLocal = Math.max(0, Number.parseInt(String($event ?? '0'), 10) || 0)"
        />
      </div>
      <div class="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
        <span>Skip bottom</span>
        <UInput
          :model-value="String(skipBottomRowsLocal)"
          type="number"
          min="0"
          size="xs"
          class="w-16"
          @update:model-value="skipBottomRowsLocal = Math.max(0, Number.parseInt(String($event ?? '0'), 10) || 0)"
        />
      </div>
      <div class="flex-1" />
      <span class="text-[10px] text-neutral-400">
        {{ autoSummary }}
      </span>
      <span class="text-[10px] text-neutral-300 dark:text-neutral-600">|</span>
      <span class="text-[10px] text-neutral-400">
        {{ visibleRows.length }} row{{ visibleRows.length === 1 ? '' : 's' }} · {{ columnCount }} col{{ columnCount === 1 ? '' : 's' }}
      </span>
      <UButton
        v-if="canEditFixedColumns"
        size="xs"
        color="neutral"
        variant="outline"
        @click="showFixedColumnEditor = !showFixedColumnEditor"
      >
        {{ showFixedColumnEditor ? 'Hide column markers' : 'Edit column markers' }}
      </UButton>
    </div>

    <div
      v-if="showFixedColumnEditor && canEditFixedColumns"
      class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40"
    >
      <div class="text-[11px] text-neutral-600 dark:text-neutral-300 mb-2">
        Click in the preview to add/remove split markers.
      </div>
      <div class="mb-2 flex items-center gap-2">
        <UButton size="xs" color="neutral" variant="outline" @click="autoDetectFixedMarkers">
          Auto-detect markers
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="fixedColumnsLocal = []">
          Clear markers
        </UButton>
      </div>
      <div
        ref="fixedEditorRef"
        class="overflow-auto border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 max-h-64"
      >
        <div class="flex min-w-max">
          <div class="shrink-0 w-12 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60">
            <div
              v-for="line in fixedEditorLineItems"
              :key="`ln-${line.number}`"
              class="h-5 pr-2 text-right text-[10px] leading-5 tabular-nums text-neutral-500 select-none"
            >
              {{ line.number }}
            </div>
          </div>
          <div
            ref="fixedEditorTextRef"
            class="relative cursor-crosshair font-mono text-[11px] leading-5"
            @mousemove="onFixedEditorMouseMove"
            @mouseleave="onFixedEditorMouseLeave"
            @click="onFixedEditorClick"
          >
            <div class="absolute inset-y-0 left-0 pointer-events-none">
              <div
                v-for="marker in fixedColumnsLocal"
                :key="`marker-${marker}`"
                class="absolute inset-y-0 w-px bg-primary-500/80"
                :style="markerLineStyle(marker)"
              />
              <div
                v-if="hoverMarker != null"
                class="absolute inset-y-0 w-px border-l border-dashed border-amber-400/90"
                :style="markerLineStyle(hoverMarker)"
              />
            </div>
            <div class="py-0.5">
              <div
                v-for="line in fixedEditorLineItems"
                :key="`txt-${line.number}`"
                class="fixed-editor-line h-5 px-2 whitespace-pre text-neutral-700 dark:text-neutral-200"
              >
                {{ line.content || ' ' }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-1 flex-wrap">
        <UBadge
          v-for="marker in fixedColumnsLocal"
          :key="`marker-chip-${marker}`"
          color="neutral"
          variant="subtle"
          size="xs"
          class="cursor-pointer"
          @click="removeFixedMarker(marker)"
        >
          {{ marker }}
        </UBadge>
        <span v-if="fixedColumnsLocal.length === 0" class="text-[11px] text-neutral-500">
          No markers set
        </span>
      </div>
    </div>

    <div v-if="loadError" class="h-full flex items-center justify-center p-6 text-xs text-red-500">
      {{ loadError }}
    </div>
    <div v-else-if="isLoading" class="h-full flex items-center justify-center p-6 text-xs text-neutral-400">
      Loading table preview...
    </div>
    <div v-else-if="visibleRows.length === 0" class="h-full flex items-center justify-center p-6 text-xs text-neutral-400">
      No tabular data detected.
    </div>
    <div v-else class="flex-1 min-h-0 overflow-auto">
      <table class="w-max text-[11px] border-collapse">
        <thead class="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-800">
          <tr>
            <th
              class="w-px px-1.5 py-1 text-right border-b border-r border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 whitespace-nowrap tabular-nums"
            >
              #
            </th>
            <th
              v-for="(header, idx) in headers"
              :key="`h-${idx}`"
              class="w-px px-1.5 py-1 text-left border-b border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 whitespace-nowrap"
              :style="columnStyle(idx)"
            >
              {{ header || `Column ${idx + 1}` }}
            </th>
          </tr>
          <tr v-if="(mappingFields?.length ?? 0) > 0">
            <th class="w-px px-1.5 py-1 border-b border-r border-neutral-200 dark:border-neutral-700" />
            <th
              v-for="(_, idx) in headers"
              :key="`m-${idx}`"
              class="w-px px-1.5 py-1 text-left border-b border-r border-neutral-200 dark:border-neutral-700"
              :style="columnStyle(idx)"
            >
              <USelect
                :model-value="fieldForColumn(idx)"
                :items="mappingItems"
                value-key="value"
                label-key="label"
                size="xs"
                class="w-full min-w-0"
                :ui="{ value: 'truncate', itemLabel: 'whitespace-nowrap' }"
                @update:model-value="updateColumnField(idx, $event)"
              />
              <label
                v-if="isColumnUnmapped(idx) && headerNameForColumn(idx)"
                class="flex items-center gap-1 mt-1 cursor-pointer"
              >
                <UCheckbox
                  :model-value="isExtraColumn(idx)"
                  :ui="{ base: 'scale-90' }"
                  @update:model-value="toggleExtraColumn(idx)"
                />
                <span class="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Include</span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in visibleRows"
            :key="`r-${rowIndex}`"
            class="odd:bg-white even:bg-neutral-50 dark:odd:bg-neutral-900 dark:even:bg-neutral-900/60"
          >
            <td
              class="px-1.5 py-1 border-b border-r border-neutral-100 dark:border-neutral-800 align-top whitespace-nowrap text-right tabular-nums text-neutral-500"
            >
              {{ visibleRowNumbers[rowIndex] }}
            </td>
            <td
              v-for="(cell, colIndex) in row"
              :key="`c-${rowIndex}-${colIndex}`"
              class="px-1.5 py-1 border-b border-r border-neutral-100 dark:border-neutral-800 align-top whitespace-nowrap"
              :class="isQuantityColumn(colIndex) ? 'text-right tabular-nums' : 'text-left'"
              :style="columnStyle(colIndex)"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as XLSX from 'xlsx'
import { detectFixedWidthMarkers, parseFixedWidthText } from '~/utils/fixed-width'

type DelimiterMode = ',' | ';' | '\t' | 'fixed'
type DecimalMode = '.' | ','
const UNMAPPED_VALUE = '__unmapped__'

function cellToString(cell: unknown): string {
  if (cell == null) return ''
  if (typeof cell === 'number') {
    if (Number.isFinite(cell) && Number.isInteger(cell) && Math.abs(cell) <= Number.MAX_SAFE_INTEGER) {
      return cell.toFixed(0)
    }
    return String(cell)
  }
  return String(cell)
}

const props = defineProps<{
  fileName: string
  textContent?: string | null
  blobUrl?: string | null
  skipRows?: number
  skipBottomRows?: number
  mapping?: Record<string, number | undefined> | null
  mappingFields?: Array<{ key: string; label: string }>
  fixedColumns?: readonly number[] | undefined
  delimiter?: DelimiterMode
  decimal?: DecimalMode
  extraColumns?: string[]
}>()

const emit = defineEmits<{
  'update:mapping': [value: Record<string, number | undefined>]
  'update:skipRows': [value: number]
  'update:skip-bottom-rows': [value: number]
  'update:fixed-columns': [value: number[]]
  'update:delimiter': [value: DelimiterMode]
  'update:decimal': [value: DecimalMode]
  'update:extra-columns': [value: string[]]
}>()

const delimiterItems = [
  { label: 'Comma', value: ',' as const },
  { label: 'Semicolon', value: ';' as const },
  { label: 'Tab', value: '\t' as const },
  { label: 'Fixed Width', value: 'fixed' as const },
]

const decimalItems = [
  { label: 'Dot', value: '.' as const },
  { label: 'Comma', value: ',' as const },
]

const isLoading = ref(false)
const loadError = ref('')
const delimiterMode = ref<DelimiterMode>(',')
const decimalMode = ref<DecimalMode>('.')
const hasHeaderRow = ref(true)
const skipRowsLocal = ref(0)
const skipBottomRowsLocal = ref(0)

const isExcel = computed(() => /\.(xlsx|xls)$/i.test(props.fileName))

const csvText = ref('')
const workbook = ref<XLSX.WorkBook | null>(null)
const selectedSheet = ref('')
const fixedColumnsLocal = ref<number[]>([])
const showFixedColumnEditor = ref(false)
const fixedEditorRef = ref<HTMLElement | null>(null)
const fixedEditorTextRef = ref<HTMLElement | null>(null)
const hoverMarker = ref<number | null>(null)
const fixedEditorCharWidthPx = ref(8)
const fixedEditorContentStartPx = ref(0)

const canEditFixedColumns = computed(() =>
  !isExcel.value && (resolvedDelimiter.value === 'fixed' || fixedColumnsLocal.value.length > 0),
)

const fixedEditorLineItems = computed<Array<{ number: number; content: string }>>(() => {
  if (!csvText.value) return []
  const all = csvText.value.split(/\r?\n/)
  const start = Math.max(0, skipRowsLocal.value)
  const end = Math.max(start, all.length - Math.max(0, skipBottomRowsLocal.value))
  const slice = all.slice(start, end).slice(0, 40)
  return slice.map((content, idx) => ({
    number: start + idx + 1,
    content,
  }))
})

const baseRows = computed<string[][]>(() => {
  if (isExcel.value) {
    if (!workbook.value) return []
    const sheetName = selectedSheet.value || workbook.value.SheetNames[0]
    if (!sheetName) return []
    const sheet = workbook.value.Sheets[sheetName]
    if (!sheet) return []
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][]
    return rows.map(row => row.map(v => cellToString(v)))
  }

  const text = csvText.value
  if (!text) return []
  const delimiter = delimiterMode.value
  if (delimiter === 'fixed') return parseFixedWidthText(text, fixedColumnsLocal.value)
  return parseDelimitedText(text, delimiter)
})

const parsedRows = computed<string[][]>(() => {
  return applySkipWindow(baseRows.value)
})

const resolvedDelimiter = computed<',' | ';' | '\t' | 'fixed'>(() => delimiterMode.value)
const resolvedDecimalMode = computed<'.' | ','>(() => decimalMode.value)

const autoSummary = computed(() => {
  const delimiterLabel = resolvedDelimiter.value === '\t'
    ? 'tab'
    : (resolvedDelimiter.value === 'fixed' ? `fixed width (${fixedColumnsLocal.value.length} markers)` : resolvedDelimiter.value)
  return `Using: delimiter ${delimiterLabel}, decimal ${resolvedDecimalMode.value}`
})

const columnCount = computed(() => {
  let max = 0
  for (const row of parsedRows.value) {
    if (row.length > max) max = row.length
  }
  return max
})

const headers = computed(() => {
  const cols = columnCount.value
  if (cols === 0) return []
  if (!hasHeaderRow.value) return Array.from({ length: cols }, (_, i) => `Column ${i + 1}`)
  const first = parsedRows.value[0] || []
  return Array.from({ length: cols }, (_, i) => first[i] ?? '')
})

const visibleRows = computed(() => {
  const cols = columnCount.value
  if (cols === 0) return []
  const source = hasHeaderRow.value ? parsedRows.value.slice(1) : parsedRows.value
  const capped = source.slice(0, 1000)
  return capped.map(row => Array.from({ length: cols }, (_, i) => row[i] ?? ''))
})

const visibleRowNumbers = computed(() => {
  const start = skipRowsLocal.value + (hasHeaderRow.value ? 2 : 1)
  return Array.from({ length: visibleRows.value.length }, (_, i) => start + i)
})

const sheetItems = computed(() => {
  if (!workbook.value) return []
  return workbook.value.SheetNames.map(name => ({ label: name, value: name }))
})

const mappingItems = computed(() => [
  { value: UNMAPPED_VALUE, label: '-- Unmapped --' },
  ...((props.mappingFields ?? []).map(field => ({ value: field.key, label: field.label }))),
])

const mappingLabelByKey = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  for (const item of mappingItems.value) {
    out[String(item.value)] = item.label
  }
  return out
})

const columnWidthsCh = computed<number[]>(() => {
  const cols = columnCount.value
  if (cols <= 0) return []
  const sampleRows = visibleRows.value.slice(0, 250)
  const widths: number[] = []
  for (let i = 0; i < cols; i++) {
    const headerLen = String(headers.value[i] ?? `Column ${i + 1}`).trim().length
    const mappingKey = fieldForColumn(i)
    const mappingLen = String(mappingLabelByKey.value[mappingKey] ?? '').trim().length
    let maxLen = Math.max(headerLen, mappingLen)
    for (const row of sampleRows) {
      const len = String(row[i] ?? '').trim().length
      if (len > maxLen) maxLen = len
    }
    widths.push(Math.min(48, Math.max(8, maxLen + 2)))
  }
  return widths
})

function fieldForColumn(columnIndex: number): string {
  if (!props.mapping) return UNMAPPED_VALUE
  for (const [fieldKey, idx] of Object.entries(props.mapping)) {
    if (idx === columnIndex) return fieldKey
  }
  return UNMAPPED_VALUE
}

function updateColumnField(columnIndex: number, value: unknown) {
  const next: Record<string, number | undefined> = { ...(props.mapping ?? {}) }
  for (const [key, idx] of Object.entries(next)) {
    if (idx === columnIndex) next[key] = undefined
  }
  const fieldKey = String(value ?? UNMAPPED_VALUE)
  if (fieldKey && fieldKey !== UNMAPPED_VALUE) next[fieldKey] = columnIndex
  emit('update:mapping', next)
}

const extraColumnsSet = computed(() => new Set(props.extraColumns ?? []))

function isColumnUnmapped(columnIndex: number): boolean {
  return fieldForColumn(columnIndex) === UNMAPPED_VALUE
}

function headerNameForColumn(columnIndex: number): string {
  return (headers.value[columnIndex] ?? '').trim()
}

function isExtraColumn(columnIndex: number): boolean {
  const name = headerNameForColumn(columnIndex)
  return !!name && extraColumnsSet.value.has(name)
}

function toggleExtraColumn(columnIndex: number) {
  const name = headerNameForColumn(columnIndex)
  if (!name) return
  const next = new Set(extraColumnsSet.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  emit('update:extra-columns', [...next])
}

watch(
  () => [props.fileName, props.textContent, props.blobUrl],
  async () => {
    await loadData()
  },
  { immediate: true },
)

watch(
  () => props.skipRows,
  (next) => {
    skipRowsLocal.value = Math.max(0, Number(next ?? 0) || 0)
  },
  { immediate: true },
)

watch(
  () => props.skipBottomRows,
  (next) => {
    skipBottomRowsLocal.value = Math.max(0, Number(next ?? 0) || 0)
  },
  { immediate: true },
)

watch(
  () => props.fixedColumns,
  (next) => {
    const normalized = normalizeFixedColumns(next)
    if (numberArrayEquals(fixedColumnsLocal.value, normalized)) return
    fixedColumnsLocal.value = normalized
    // Restored markers imply fixed-width mode — override auto-detected delimiter
    if (normalized.length > 0 && delimiterMode.value !== 'fixed') {
      delimiterMode.value = 'fixed'
    }
  },
  { immediate: true },
)

watch(() => props.delimiter, (next) => {
  if (next && next !== delimiterMode.value) delimiterMode.value = next
})

watch(() => props.decimal, (next) => {
  if (next && next !== decimalMode.value) decimalMode.value = next
})

watch(skipRowsLocal, (next) => {
  emit('update:skipRows', Math.max(0, Number(next) || 0))
})

watch(skipBottomRowsLocal, (next) => {
  emit('update:skip-bottom-rows', Math.max(0, Number(next) || 0))
})

watch(fixedColumnsLocal, (next) => {
  const normalizedProps = normalizeFixedColumns(props.fixedColumns)
  if (numberArrayEquals(next, normalizedProps)) return
  emit('update:fixed-columns', [...next])
}, { deep: true })

watch(delimiterMode, (next) => {
  if (next !== props.delimiter) emit('update:delimiter', next)
})

watch(() => props.mapping, () => {
  if (!props.extraColumns || props.extraColumns.length === 0) return
  if (isLoading.value) return
  if (headers.value.length === 0) return
  if ((props.mappingFields?.length ?? 0) === 0) return
  const stillUnmapped = props.extraColumns.filter((name) => {
    const idx = headers.value.indexOf(name)
    return idx >= 0 && isColumnUnmapped(idx)
  })
  if (stillUnmapped.length !== props.extraColumns.length) {
    emit('update:extra-columns', stillUnmapped)
  }
}, { deep: true })

watch(decimalMode, (next) => {
  if (next !== props.decimal) emit('update:decimal', next)
})

watch(
  [showFixedColumnEditor, fixedEditorLineItems],
  async ([isOpen]) => {
    if (!isOpen) return
    await nextTick()
    measureFixedEditorMetrics()
  },
  { immediate: true },
)

function onWindowResize() {
  if (!showFixedColumnEditor.value) return
  measureFixedEditorMetrics()
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
})

async function loadData() {
  loadError.value = ''
  workbook.value = null
  csvText.value = ''
  selectedSheet.value = ''
  isLoading.value = true

  try {
    if (isExcel.value) {
      const buffer = await getExcelBuffer()
      workbook.value = XLSX.read(buffer, { type: 'array' })
      selectedSheet.value = workbook.value.SheetNames[0] || ''
      return
    }

    if (props.textContent != null) {
      csvText.value = props.textContent
      applyAutoDetectedModes(csvText.value)
      return
    }
    if (props.blobUrl) {
      const resp = await fetch(props.blobUrl)
      csvText.value = await resp.text()
      applyAutoDetectedModes(csvText.value)
      return
    }
  } catch (err) {
    console.warn('[FileTablePreview] failed to load table preview', err)
    loadError.value = 'Could not parse this file as a table.'
  } finally {
    isLoading.value = false
  }
}

async function getExcelBuffer(): Promise<ArrayBuffer> {
  if (props.blobUrl) {
    const resp = await fetch(props.blobUrl)
    return await resp.arrayBuffer()
  }
  if (props.textContent != null) {
    const dataUrlMatch = props.textContent.match(/^data:.*;base64,(.+)$/i)
    if (dataUrlMatch?.[1]) {
      const binary = atob(dataUrlMatch[1])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes.buffer
    }
    try {
      const wb = XLSX.read(props.textContent, { type: 'binary' })
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      return out as ArrayBuffer
    } catch {
      // Fallback for legacy text-stored workbook data.
      return new TextEncoder().encode(props.textContent).buffer as ArrayBuffer
    }
  }
  throw new Error('No Excel source available')
}

function detectDelimiter(text: string): ',' | ';' | '\t' | 'fixed' {
  const sampleLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 12)

  if (sampleLines.length === 0) return ','
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t']

  let best: ',' | ';' | '\t' = ','
  let bestScore = -1

  for (const delimiter of candidates) {
    let countSum = 0
    let nonZeroLines = 0
    for (const line of sampleLines) {
      const count = countDelimiterOutsideQuotes(line, delimiter)
      if (count > 0) nonZeroLines++
      countSum += count
    }
    const score = countSum + nonZeroLines * 2
    if (score > bestScore) {
      bestScore = score
      best = delimiter
    }
  }
  if (bestScore <= 0) {
    const fixed = detectFixedWidthMarkers(text)
    if (fixed.markers.length >= 2 && fixed.confidence >= 0.45) return 'fixed'
  }
  return best
}

function applyAutoDetectedModes(text: string) {
  // Persisted settings take precedence over auto-detection
  if (props.delimiter) {
    delimiterMode.value = props.delimiter
  } else if (fixedColumnsLocal.value.length > 0) {
    delimiterMode.value = 'fixed'
  } else {
    delimiterMode.value = detectDelimiter(text)
  }

  const rows = delimiterMode.value === 'fixed'
    ? parseFixedWidthText(text, fixedColumnsLocal.value)
    : parseDelimitedText(text, delimiterMode.value)
  const rowsAfterSkip = applySkipWindow(rows)

  if (props.decimal) {
    decimalMode.value = props.decimal
  } else {
    decimalMode.value = detectDecimalSeparator(rowsAfterSkip)
  }
}

function applySkipWindow<T>(rows: T[]): T[] {
  const start = Math.max(0, skipRowsLocal.value)
  const end = Math.max(start, rows.length - Math.max(0, skipBottomRowsLocal.value))
  return rows.slice(start, end)
}

function autoDetectFixedMarkers() {
  const text = csvText.value
  if (!text) return
  const detected = detectFixedWidthMarkers(text).markers
  fixedColumnsLocal.value = normalizeFixedColumns(detected)
}

function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) count++
  }
  return count
}

function parseDelimitedText(text: string, delimiter: ',' | ';' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && ch === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += ch
  }

  row.push(cell)
  rows.push(row)

  while (rows.length > 0 && rows[rows.length - 1]?.every(c => c.trim() === '')) {
    rows.pop()
  }

  return rows
}

function detectDecimalSeparator(rows: string[][]): '.' | ',' {
  let commaCount = 0
  let dotCount = 0
  for (const row of rows.slice(0, 100)) {
    for (const cell of row.slice(0, 40)) {
      const value = String(cell).trim()
      if (!value) continue
      if (/^-?\d+,\d+$/.test(value)) commaCount++
      if (/^-?\d+\.\d+$/.test(value)) dotCount++
    }
  }
  if (commaCount > dotCount) return ','
  return '.'
}

function isQuantityColumn(columnIndex: number): boolean {
  return fieldForColumn(columnIndex) === 'quantity'
}

function columnStyle(columnIndex: number): { width: string; minWidth: string } {
  const width = columnWidthsCh.value[columnIndex] ?? 12
  return {
    width: `${width}ch`,
    minWidth: `${width}ch`,
  }
}

function normalizeFixedColumns(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map(v => Number(v))
    .filter(v => Number.isFinite(v))
    .map(v => Math.max(1, Math.floor(v))))]
    .sort((a, b) => a - b)
}

function numberArrayEquals(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  const aa = a ?? []
  const bb = b ?? []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false
  }
  return true
}

function onFixedEditorClick(event: MouseEvent) {
  const marker = markerFromMouseEvent(event)
  if (marker == null) return
  toggleFixedMarker(marker)
}

function onFixedEditorMouseMove(event: MouseEvent) {
  const marker = markerFromMouseEvent(event)
  if (hoverMarker.value !== marker) hoverMarker.value = marker
}

function onFixedEditorMouseLeave() {
  hoverMarker.value = null
}

function markerLineStyle(marker: number) {
  const leftPx = fixedEditorContentStartPx.value + marker * fixedEditorCharWidthPx.value
  return { left: `${leftPx}px` }
}

function markerFromMouseEvent(event: MouseEvent): number | null {
  const textEl = fixedEditorTextRef.value
  if (!textEl) return null
  const rect = textEl.getBoundingClientRect()
  // `getBoundingClientRect()` already reflects current scroll position.
  // Adding container.scrollLeft here causes double-counting and cursor drift.
  const clickX = Math.max(0, event.clientX - rect.left)
  const contentX = Math.max(0, clickX - fixedEditorContentStartPx.value)
  const chWidth = fixedEditorCharWidthPx.value
  return Math.max(1, Math.round(contentX / Math.max(1, chWidth)))
}

function measureFixedEditorMetrics() {
  const textEl = fixedEditorTextRef.value
  if (!textEl) return
  const lineEl = textEl.querySelector<HTMLElement>('.fixed-editor-line')
  if (!lineEl) return

  const lineStyles = window.getComputedStyle(lineEl)
  const textStyles = window.getComputedStyle(textEl)
  const paddingLeft = Number.parseFloat(lineStyles.paddingLeft || '0')
  fixedEditorContentStartPx.value = Number.isFinite(paddingLeft) ? paddingLeft : 0

  // Measure rendered width directly in the same DOM context to avoid
  // cumulative drift from canvas/ch-unit rounding.
  const probe = document.createElement('span')
  probe.textContent = '0'.repeat(128)
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.whiteSpace = 'pre'
  probe.style.pointerEvents = 'none'
  probe.style.font = textStyles.font
  probe.style.letterSpacing = textStyles.letterSpacing
  textEl.appendChild(probe)
  const width = probe.getBoundingClientRect().width / 128
  probe.remove()
  fixedEditorCharWidthPx.value = Number.isFinite(width) && width > 0 ? width : 8
}

function toggleFixedMarker(value: number) {
  const next = new Set(fixedColumnsLocal.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  fixedColumnsLocal.value = [...next].sort((a, b) => a - b)
}

function removeFixedMarker(value: number) {
  fixedColumnsLocal.value = fixedColumnsLocal.value.filter(v => v !== value)
}
</script>

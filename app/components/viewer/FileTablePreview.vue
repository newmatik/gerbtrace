<template>
  <div class="h-full min-h-0 flex flex-col">
    <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2 flex-wrap">
      <USelect
        :model-value="delimiterMode"
        :items="delimiterItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-36"
        @update:model-value="delimiterMode = ($event as DelimiterMode)"
      />
      <USelect
        :model-value="decimalMode"
        :items="decimalItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-36"
        @update:model-value="decimalMode = ($event as DecimalMode)"
      />
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
      <div class="flex-1" />
      <span class="text-[10px] text-neutral-400">
        {{ autoSummary }}
      </span>
      <span class="text-[10px] text-neutral-300 dark:text-neutral-600">|</span>
      <span class="text-[10px] text-neutral-400">
        {{ visibleRows.length }} row{{ visibleRows.length === 1 ? '' : 's' }} · {{ columnCount }} col{{ columnCount === 1 ? '' : 's' }}
      </span>
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
              v-for="(header, idx) in headers"
              :key="`h-${idx}`"
              class="w-px px-1.5 py-1 text-left border-b border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 whitespace-nowrap"
            >
              {{ header || `Column ${idx + 1}` }}
            </th>
          </tr>
          <tr v-if="(mappingFields?.length ?? 0) > 0">
            <th
              v-for="(_, idx) in headers"
              :key="`m-${idx}`"
              class="w-px px-1.5 py-1 text-left border-b border-r border-neutral-200 dark:border-neutral-700"
            >
              <USelect
                :model-value="fieldForColumn(idx)"
                :items="mappingItems"
                value-key="value"
                label-key="label"
                size="xs"
                class="w-[108px]"
                :ui="{ value: 'truncate', itemLabel: 'truncate' }"
                @update:model-value="updateColumnField(idx, $event)"
              />
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
              v-for="(cell, colIndex) in row"
              :key="`c-${rowIndex}-${colIndex}`"
              class="px-1.5 py-1 border-b border-r border-neutral-100 dark:border-neutral-800 align-top whitespace-nowrap"
              :class="isNumericCell(cell) ? 'text-right tabular-nums' : 'text-left'"
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

type DelimiterMode = 'auto' | ',' | ';' | '\t'
type DecimalMode = 'auto' | '.' | ','
const UNMAPPED_VALUE = '__unmapped__'

const props = defineProps<{
  fileName: string
  textContent?: string | null
  blobUrl?: string | null
  skipRows?: number
  mapping?: Record<string, number | undefined> | null
  mappingFields?: Array<{ key: string; label: string }>
}>()

const emit = defineEmits<{
  'update:mapping': [value: Record<string, number | undefined>]
  'update:skipRows': [value: number]
}>()

const delimiterItems = [
  { label: 'Delimiter: Auto', value: 'auto' as const },
  { label: 'Delimiter: Comma', value: ',' as const },
  { label: 'Delimiter: Semicolon', value: ';' as const },
  { label: 'Delimiter: Tab', value: '\t' as const },
]

const decimalItems = [
  { label: 'Decimal: Auto', value: 'auto' as const },
  { label: 'Decimal: Dot', value: '.' as const },
  { label: 'Decimal: Comma', value: ',' as const },
]

const isLoading = ref(false)
const loadError = ref('')
const delimiterMode = ref<DelimiterMode>('auto')
const decimalMode = ref<DecimalMode>('auto')
const hasHeaderRow = ref(true)
const skipRowsLocal = ref(0)

const isExcel = computed(() => /\.(xlsx|xls)$/i.test(props.fileName))

const csvText = ref('')
const workbook = ref<XLSX.WorkBook | null>(null)
const selectedSheet = ref('')

const baseRows = computed<string[][]>(() => {
  if (isExcel.value) {
    if (!workbook.value) return []
    const sheetName = selectedSheet.value || workbook.value.SheetNames[0]
    if (!sheetName) return []
    const sheet = workbook.value.Sheets[sheetName]
    if (!sheet) return []
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]
    return rows.map(row => row.map(v => String(v ?? '')))
  }

  const text = csvText.value
  if (!text) return []
  const delimiter = delimiterMode.value === 'auto' ? detectDelimiter(text) : delimiterMode.value
  return parseDelimitedText(text, delimiter)
})

const parsedRows = computed<string[][]>(() => {
  if (skipRowsLocal.value <= 0) return baseRows.value
  return baseRows.value.slice(skipRowsLocal.value)
})

const resolvedDelimiter = computed<',' | ';' | '\t'>(() => {
  if (delimiterMode.value !== 'auto') return delimiterMode.value
  return detectDelimiter(csvText.value)
})

const resolvedDecimalMode = computed<'.' | ','>(() => {
  if (decimalMode.value !== 'auto') return decimalMode.value
  return detectDecimalSeparator(parsedRows.value)
})

const autoSummary = computed(() => {
  const delimiterLabel = resolvedDelimiter.value === '\t' ? 'tab' : resolvedDelimiter.value
  return `Detected: delimiter ${delimiterLabel}, decimal ${resolvedDecimalMode.value}`
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

const sheetItems = computed(() => {
  if (!workbook.value) return []
  return workbook.value.SheetNames.map(name => ({ label: name, value: name }))
})

const mappingItems = computed(() => [
  { value: UNMAPPED_VALUE, label: '-- Unmapped --' },
  ...((props.mappingFields ?? []).map(field => ({ value: field.key, label: field.label }))),
])

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

watch(skipRowsLocal, (next) => {
  emit('update:skipRows', Math.max(0, Number(next) || 0))
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
      return
    }
    if (props.blobUrl) {
      const resp = await fetch(props.blobUrl)
      csvText.value = await resp.text()
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

function detectDelimiter(text: string): ',' | ';' | '\t' {
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
  return best
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

function parseNumeric(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const decimal = resolvedDecimalMode.value
  const normalized = decimal === ','
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/,/g, '')

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function isNumericCell(value: string): boolean {
  return parseNumeric(value) != null
}
</script>

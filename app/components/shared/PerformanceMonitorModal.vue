<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-lg' }">
    <template #content>
      <div class="flex flex-col max-h-[85vh]">
        <!-- Sticky header -->
        <div class="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Performance Monitor</h3>
          <div class="flex items-center gap-1.5">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-clipboard-copy" @click="copyAll">
              {{ copied ? 'Copied' : 'Copy' }}
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-refresh-cw" @click="$emit('refresh')" />
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="open = false" />
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="overflow-y-auto px-4 pb-4 space-y-3">

          <!-- Project context -->
          <section v-if="props.context">
            <SectionLabel>Project</SectionLabel>
            <div class="grid grid-cols-2 gap-x-4 gap-y-px text-xs">
              <Row v-if="props.context.projectName" label="Name" :value="props.context.projectName" />
              <Row v-if="props.context.teamName" label="Team" :value="props.context.teamName" />
              <Row v-if="props.context.userName" label="User" :value="props.context.userName" />
              <Row v-if="props.context.projectId" label="ID" :value="String(props.context.projectId)" />
            </div>
          </section>

          <!-- System + Hardware -->
          <section>
            <SectionLabel>System</SectionLabel>
            <div class="grid grid-cols-2 gap-x-4 gap-y-px text-xs">
              <Row label="App" :value="sysInfo.appVersion" />
              <Row label="Platform" :value="sysInfo.platform" />
              <Row label="Browser" :value="sysInfo.browser" />
              <Row label="Window" :value="sysInfo.windowSize" />
              <Row label="Screen" :value="sysInfo.screenSize" />
              <Row label="Pixel ratio" :value="sysInfo.dpr" />
              <Row label="CPU cores" :value="String(snapshot?.logicalCores ?? '—')" />
              <Row label="RAM" :value="snapshot?.deviceMemoryGb ? `${snapshot.deviceMemoryGb} GB` : '—'" />
              <Row v-if="sysInfo.connection" label="Network" :value="sysInfo.connection" />
            </div>
            <div class="mt-1 text-xs">
              <Row label="GPU" :value="snapshot?.gpuRenderer || 'Unavailable'" />
            </div>
          </section>

          <!-- Frame timing — keep as cards, these are the key metrics -->
          <section>
            <SectionLabel>Frame Timing</SectionLabel>
            <div class="grid grid-cols-3 gap-1.5">
              <MetricCard label="FPS" :value="fmtNum(snapshot?.fpsApprox)" :color="fpsColor" />
              <MetricCard label="Frame time" :value="fmtMs(snapshot?.frameMs)" />
              <MetricCard label="Long tasks" :value="String(snapshot?.longTaskCount30s ?? '—')" />
            </div>
          </section>

          <!-- Memory -->
          <section>
            <SectionLabel>Memory</SectionLabel>
            <div v-if="snapshot?.memorySupported" class="grid grid-cols-2 gap-x-4 gap-y-px text-xs">
              <Row label="JS used" :value="fmtBytes(snapshot?.heapUsedBytes)" />
              <Row label="JS allocated" :value="fmtBytes(snapshot?.heapTotalBytes)" />
              <Row label="JS limit" :value="fmtBytes(snapshot?.heapLimitBytes)" />
            </div>
            <p v-else class="text-xs text-neutral-500 dark:text-neutral-400">Not exposed by this browser.</p>
          </section>

          <!-- Storage -->
          <section>
            <SectionLabel>Storage</SectionLabel>
            <div class="grid grid-cols-2 gap-x-4 gap-y-px text-xs">
              <Row label="Browser used" :value="fmtBytes(snapshot?.storageUsageBytes)" />
              <Row label="Browser limit" :value="fmtBytes(snapshot?.storageQuotaBytes)" />
              <Row label="This project" :value="fmtBytes(snapshot?.projectEstimateBytes)" />
            </div>
          </section>

          <!-- Canvas Caches -->
          <section>
            <SectionLabel>Render Cache</SectionLabel>
            <div class="grid grid-cols-2 gap-x-4 gap-y-px text-xs">
              <div class="space-y-px">
                <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-0.5">Board</div>
                <Row label="Scene" :value="fmtBytes(snapshot?.board?.sceneCacheBytes)" />
                <Row label="Pool" :value="String(snapshot?.board?.canvasPoolSize ?? '—')" />
                <Row label="Draws" :value="String(snapshot?.board?.draws ?? '—')" />
              </div>
              <div class="space-y-px">
                <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-0.5">Panel</div>
                <Row label="Tiles" :value="fmtBytes(snapshot?.panel?.tileBytesTotal)" />
                <Row label="Pool" :value="String(snapshot?.panel?.canvasPoolSize ?? '—')" />
                <Row label="Draws" :value="String(snapshot?.panel?.draws ?? '—')" />
              </div>
            </div>
          </section>

          <!-- Mini overlay toggle -->
          <div class="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 py-2">
            <div class="text-xs">
              <div class="font-medium text-neutral-800 dark:text-neutral-200">Mini overlay on canvas</div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Double-click the overlay to open this panel</div>
            </div>
            <USwitch v-model="appSettings.miniPerfOverlay" size="sm" />
          </div>

          <p class="text-[10px] text-neutral-400 dark:text-neutral-500 leading-snug">
            Browser APIs don't expose CPU/GPU process usage.
            Use <strong>Copy</strong> to paste this snapshot into a support ticket.
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { settings: appSettings } = useAppSettings()
const open = defineModel<boolean>('open', { default: false })
const runtimeConfig = useRuntimeConfig()

export interface PerfContext {
  projectName?: string
  projectId?: string | number | null
  url?: string
  userName?: string
  teamName?: string | null
}

const props = defineProps<{
  context?: PerfContext
  snapshot: {
    fpsApprox?: number
    frameMs?: number
    longTaskCount30s?: number
    memorySupported?: boolean
    heapUsedBytes?: number
    heapTotalBytes?: number
    heapLimitBytes?: number
    storageUsageBytes?: number
    storageQuotaBytes?: number
    projectEstimateBytes?: number
    logicalCores?: number
    deviceMemoryGb?: number | null
    gpuRenderer?: string | null
    board?: { sceneCacheBytes?: number, canvasPoolSize?: number, draws?: number }
    panel?: { tileBytesTotal?: number, canvasPoolSize?: number, draws?: number }
  } | null
}>()

defineEmits<{ refresh: [] }>()

// ─── system info ───

interface SystemInfo {
  appVersion: string
  platform: string
  browser: string
  windowSize: string
  screenSize: string
  dpr: string
  connection: string | null
  userAgent: string
}

const sysInfo = computed<SystemInfo>(() => {
  const ua = navigator.userAgent
  return {
    appVersion: runtimeConfig.public.appVersion as string || '—',
    platform: parsePlatform(ua),
    browser: parseBrowser(ua),
    windowSize: `${window.innerWidth} x ${window.innerHeight}`,
    screenSize: `${screen.width} x ${screen.height}`,
    dpr: `${window.devicePixelRatio.toFixed(2)}`,
    connection: getConnection(),
    userAgent: ua,
  }
})

function parsePlatform(ua: string): string {
  if (/Windows/.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/)
    const ver = m?.[1]
    if (ver === '10.0') return 'Windows 10/11'
    if (ver) return `Windows NT ${ver}`
    return 'Windows'
  }
  if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/)
    return m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS'
  }
  if (/Linux/.test(ua)) return 'Linux'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  return navigator.platform || 'Unknown'
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/)
    return `Edge ${m?.[1] ?? ''}`
  }
  if (/OPR\//.test(ua)) {
    const m = ua.match(/OPR\/([\d.]+)/)
    return `Opera ${m?.[1] ?? ''}`
  }
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/)
    return `Chrome ${m?.[1] ?? ''}`
  }
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/)
    return `Safari ${m?.[1] ?? ''}`
  }
  if (/Firefox\//.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/)
    return `Firefox ${m?.[1] ?? ''}`
  }
  return ua.slice(0, 60)
}

function getConnection(): string | null {
  const c = (navigator as any).connection
  if (!c) return null
  const parts: string[] = []
  if (c.effectiveType) parts.push(c.effectiveType)
  if (c.downlink) parts.push(`${c.downlink} Mbps`)
  if (c.rtt) parts.push(`${c.rtt} ms RTT`)
  return parts.length ? parts.join(', ') : null
}

// ─── formatters ───

function fmtBytes(bytes?: number | null): string {
  if (!Number.isFinite(bytes as number) || (bytes as number) <= 0) return '—'
  const b = bytes as number
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}

function fmtNum(val?: number | null): string {
  if (!Number.isFinite(val as number) || (val as number) <= 0) return '—'
  return (val as number).toFixed(1)
}

function fmtMs(val?: number | null): string {
  if (!Number.isFinite(val as number) || (val as number) <= 0) return '—'
  return `${(val as number).toFixed(1)} ms`
}

const fpsColor = computed(() => {
  const v = props.snapshot?.fpsApprox
  if (!v || !Number.isFinite(v) || v <= 0) return undefined
  if (v >= 55) return 'text-emerald-500'
  if (v >= 30) return 'text-amber-500'
  return 'text-red-500'
})

// ─── copy-all ───

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

function buildCopyText(): string {
  const s = props.snapshot
  const si = sysInfo.value
  const ctx = props.context
  const lines: string[] = [
    `Gerbtrace Performance Snapshot`,
    `Date: ${new Date().toISOString()}`,
  ]

  if (ctx) {
    lines.push(
      ``,
      `Project`,
    )
    if (ctx.projectName) lines.push(`  Name:     ${ctx.projectName}`)
    if (ctx.teamName) lines.push(`  Team:     ${ctx.teamName}`)
    if (ctx.userName) lines.push(`  User:     ${ctx.userName}`)
    if (ctx.projectId) lines.push(`  ID:       ${ctx.projectId}`)
    if (ctx.url) lines.push(`  URL:      ${ctx.url}`)
  }

  lines.push(
    ``,
    `System`,
    `  App:          ${si.appVersion}`,
    `  Platform:     ${si.platform}`,
    `  Browser:      ${si.browser}`,
    `  Window:       ${si.windowSize}`,
    `  Screen:       ${si.screenSize}`,
    `  Pixel ratio:  ${si.dpr}`,
    `  CPU cores:    ${s?.logicalCores ?? '—'}`,
    `  RAM:          ${s?.deviceMemoryGb ? `${s.deviceMemoryGb} GB` : '—'}`,
  )
  if (si.connection) lines.push(`  Network:      ${si.connection}`)
  lines.push(
    `  GPU:          ${s?.gpuRenderer || 'Unavailable'}`,
    `  User-Agent:   ${si.userAgent}`,
    ``,
    `Frame Timing`,
    `  FPS:          ${fmtNum(s?.fpsApprox)}`,
    `  Frame time:   ${fmtMs(s?.frameMs)}`,
    `  Long tasks:   ${s?.longTaskCount30s ?? '—'}`,
    ``,
  )

  if (s?.memorySupported) {
    lines.push(
      `Memory`,
      `  JS used:      ${fmtBytes(s.heapUsedBytes)}`,
      `  JS allocated: ${fmtBytes(s.heapTotalBytes)}`,
      `  JS limit:     ${fmtBytes(s.heapLimitBytes)}`,
      ``,
    )
  }

  lines.push(
    `Storage`,
    `  Browser used:  ${fmtBytes(s?.storageUsageBytes)}`,
    `  Browser limit: ${fmtBytes(s?.storageQuotaBytes)}`,
    `  This project:  ${fmtBytes(s?.projectEstimateBytes)}`,
    ``,
    `Render Cache`,
    `  Board: scene ${fmtBytes(s?.board?.sceneCacheBytes)}, pool ${s?.board?.canvasPoolSize ?? '—'}, draws ${s?.board?.draws ?? '—'}`,
    `  Panel: tiles ${fmtBytes(s?.panel?.tileBytesTotal)}, pool ${s?.panel?.canvasPoolSize ?? '—'}, draws ${s?.panel?.draws ?? '—'}`,
  )

  return lines.join('\n')
}

async function copyAll() {
  const text = buildCopyText()
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 2000)
}

// ─── inline sub-components ───

const SectionLabel = defineComponent({
  setup(_, { slots }) {
    return () => h('div', {
      class: 'text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-1',
    }, slots.default?.())
  },
})

const Row = defineComponent({
  props: { label: String, value: String },
  setup(p) {
    return () => h('div', { class: 'flex justify-between gap-2 leading-[18px]' }, [
      h('span', { class: 'text-neutral-500 dark:text-neutral-400 shrink-0' }, p.label),
      h('span', { class: 'font-mono text-neutral-800 dark:text-neutral-200 text-right truncate' }, p.value || '—'),
    ])
  },
})

const MetricCard = defineComponent({
  props: { label: String, value: String, color: String },
  setup(p) {
    return () => h('div', {
      class: 'rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center',
    }, [
      h('div', { class: `text-sm font-mono font-semibold leading-tight ${p.color || 'text-neutral-900 dark:text-white'}` }, p.value || '—'),
      h('div', { class: 'text-[10px] text-neutral-500 dark:text-neutral-400 mt-px' }, p.label),
    ])
  },
})
</script>

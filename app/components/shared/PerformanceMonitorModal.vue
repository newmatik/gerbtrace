<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4 max-w-3xl">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Performance Monitor</h3>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Live diagnostics for support/debug sessions.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-refresh-cw" @click="$emit('refresh')">
              Refresh
            </UButton>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="open = false" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded border border-neutral-200 dark:border-neutral-700 p-2">
            <div class="text-[10px] uppercase tracking-wide text-neutral-400 mb-1">Frame Timing</div>
            <div class="space-y-0.5">
              <div>FPS (approx): <span class="font-mono">{{ fmtNum(snapshot?.fpsApprox) }}</span></div>
              <div>Frame time (ms): <span class="font-mono">{{ fmtNum(snapshot?.frameMs) }}</span></div>
              <div>Long tasks (30s): <span class="font-mono">{{ snapshot?.longTaskCount30s ?? '—' }}</span></div>
            </div>
          </div>
          <div class="rounded border border-neutral-200 dark:border-neutral-700 p-2">
            <div class="text-[10px] uppercase tracking-wide text-neutral-400 mb-1">Browser Memory</div>
            <div v-if="snapshot?.memorySupported" class="space-y-0.5">
              <div>Used heap: <span class="font-mono">{{ fmtMb(snapshot?.heapUsedBytes) }}</span></div>
              <div>Total heap: <span class="font-mono">{{ fmtMb(snapshot?.heapTotalBytes) }}</span></div>
              <div>Heap limit: <span class="font-mono">{{ fmtMb(snapshot?.heapLimitBytes) }}</span></div>
            </div>
            <div v-else class="text-neutral-500">Not exposed by this browser.</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded border border-neutral-200 dark:border-neutral-700 p-2">
            <div class="text-[10px] uppercase tracking-wide text-neutral-400 mb-1">Storage</div>
            <div class="space-y-0.5">
              <div>Origin usage: <span class="font-mono">{{ fmtMb(snapshot?.storageUsageBytes) }}</span></div>
              <div>Origin quota: <span class="font-mono">{{ fmtMb(snapshot?.storageQuotaBytes) }}</span></div>
              <div>Current project estimate: <span class="font-mono">{{ fmtMb(snapshot?.projectEstimateBytes) }}</span></div>
            </div>
          </div>
          <div class="rounded border border-neutral-200 dark:border-neutral-700 p-2">
            <div class="text-[10px] uppercase tracking-wide text-neutral-400 mb-1">Hardware / Graphics</div>
            <div class="space-y-0.5">
              <div>Logical cores: <span class="font-mono">{{ snapshot?.logicalCores ?? '—' }}</span></div>
              <div>Device memory (GB): <span class="font-mono">{{ snapshot?.deviceMemoryGb ?? '—' }}</span></div>
              <div>GPU renderer: <span class="font-mono break-all">{{ snapshot?.gpuRenderer || 'Unavailable' }}</span></div>
            </div>
          </div>
        </div>

        <div class="rounded border border-neutral-200 dark:border-neutral-700 p-2 text-xs">
          <div class="text-[10px] uppercase tracking-wide text-neutral-400 mb-1">Canvas Caches</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="font-medium mb-1">Board Canvas</div>
              <div>Scene cache: <span class="font-mono">{{ fmtMb(snapshot?.board?.sceneCacheBytes) }}</span></div>
              <div>Pool size: <span class="font-mono">{{ snapshot?.board?.canvasPoolSize ?? '—' }}</span></div>
              <div>Draws: <span class="font-mono">{{ snapshot?.board?.draws ?? '—' }}</span></div>
            </div>
            <div>
              <div class="font-medium mb-1">Panel Canvas</div>
              <div>Tile cache total: <span class="font-mono">{{ fmtMb(snapshot?.panel?.tileBytesTotal) }}</span></div>
              <div>Pool size: <span class="font-mono">{{ snapshot?.panel?.canvasPoolSize ?? '—' }}</span></div>
              <div>Draws: <span class="font-mono">{{ snapshot?.panel?.draws ?? '—' }}</span></div>
            </div>
          </div>
        </div>

        <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
          CPU/GPU process percentages are not exposed to web apps by browsers.
          This monitor shows reliable browser-side proxies (frame timing, long tasks, heap, storage, and render cache sizes).
        </p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

defineProps<{
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
    deviceMemoryGb?: number
    gpuRenderer?: string | null
    board?: { sceneCacheBytes?: number, canvasPoolSize?: number, draws?: number }
    panel?: { tileBytesTotal?: number, canvasPoolSize?: number, draws?: number }
  } | null
}>()

defineEmits<{ refresh: [] }>()

function fmtMb(bytes?: number | null): string {
  if (!Number.isFinite(bytes as number) || (bytes as number) < 0) return '—'
  return `${((bytes as number) / (1024 * 1024)).toFixed(2)} MB`
}

function fmtNum(val?: number | null): string {
  if (!Number.isFinite(val as number)) return '—'
  return (val as number).toFixed(1)
}
</script>

<template>
  <!-- Click-position marker -->
  <svg
    v-if="info.active.value && info.clickScreenPos.value && groupedLayers.length > 0"
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  >
    <circle
      :cx="info.clickScreenPos.value.x"
      :cy="info.clickScreenPos.value.y"
      r="5"
      fill="none"
      stroke="#f59e0b"
      stroke-width="1.5"
    />
    <line
      :x1="info.clickScreenPos.value.x - 9" :y1="info.clickScreenPos.value.y"
      :x2="info.clickScreenPos.value.x + 9" :y2="info.clickScreenPos.value.y"
      stroke="#f59e0b" stroke-width="1" opacity="0.7"
    />
    <line
      :x1="info.clickScreenPos.value.x" :y1="info.clickScreenPos.value.y - 9"
      :x2="info.clickScreenPos.value.x" :y2="info.clickScreenPos.value.y + 9"
      stroke="#f59e0b" stroke-width="1" opacity="0.7"
    />
  </svg>

  <!-- Info panel — anchored top-right -->
  <div
    v-if="info.active.value && groupedLayers.length > 0"
    class="absolute top-3 right-3 z-20 w-60 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-neutral-200/60 dark:border-neutral-700/60">
      <span class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
        {{ totalUniqueCount }} object{{ totalUniqueCount !== 1 ? 's' : '' }}
      </span>
      <button
        class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-0.5 -mr-1"
        @click="info.clear()"
      >
        <UIcon name="i-lucide-x" class="text-sm" />
      </button>
    </div>

    <!-- Grouped results -->
    <div class="max-h-[50vh] overflow-y-auto">
      <div
        v-for="(layer, li) in groupedLayers"
        :key="li"
        class="border-b border-neutral-100 dark:border-neutral-700/50 last:border-b-0"
      >
        <!-- Layer header -->
        <div class="flex items-center gap-1.5 px-3 pt-2 pb-1">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: layer.layerColor }"
          />
          <span class="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 truncate">
            {{ layer.layerType }}
          </span>
        </div>

        <!-- Items in this layer -->
        <div class="px-3 pb-2 space-y-1.5">
          <div
            v-for="(item, ii) in layer.items"
            :key="ii"
            class="bg-neutral-100/60 dark:bg-white/5 rounded px-2 py-1.5"
          >
            <!-- Object type + count -->
            <div class="flex items-baseline justify-between mb-0.5">
              <span class="text-[11px] font-semibold text-neutral-800 dark:text-neutral-100">
                {{ item.objectType }}
              </span>
              <span v-if="item.count > 1" class="text-[10px] text-neutral-400 dark:text-neutral-500">
                &times;{{ item.count }}
              </span>
            </div>

            <!-- Properties -->
            <div v-if="item.properties.length" class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-px">
              <template v-for="prop in item.properties" :key="prop.label">
                <span class="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{{ prop.label }}</span>
                <span class="text-[10px] font-mono text-neutral-700 dark:text-neutral-200 text-right">{{ prop.value }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InfoHitResult, InfoHitProperty } from '~/composables/useInfoTool'

interface GroupedItem {
  objectType: string
  count: number
  properties: InfoHitProperty[]
}

interface GroupedLayer {
  layerType: string
  layerName: string
  layerColor: string
  items: GroupedItem[]
}

const props = defineProps<{
  info: ReturnType<typeof useInfoTool>
}>()

/** Group hits by layer, then deduplicate identical objects within each layer. */
const groupedLayers = computed<GroupedLayer[]>(() => {
  const hits = props.info.hits.value
  if (!hits.length) return []

  const layerMap = new Map<string, GroupedLayer>()

  for (const hit of hits) {
    const layerKey = `${hit.layerType}\0${hit.layerName}`

    if (!layerMap.has(layerKey)) {
      layerMap.set(layerKey, {
        layerType: hit.layerType,
        layerName: hit.layerName,
        layerColor: hit.layerColor,
        items: [],
      })
    }

    const group = layerMap.get(layerKey)!
    const itemKey = makeItemKey(hit)
    const existing = group.items.find(it => makeItemKey2(it) === itemKey)

    if (existing) {
      existing.count++
    } else {
      group.items.push({
        objectType: hit.objectType,
        count: 1,
        properties: [...hit.properties],
      })
    }
  }

  return Array.from(layerMap.values())
})

/** Total unique object types (for display). */
const totalUniqueCount = computed(() => {
  return groupedLayers.value.reduce(
    (sum, layer) => sum + layer.items.reduce((s, it) => s + it.count, 0),
    0,
  )
})

function makeItemKey(hit: InfoHitResult): string {
  return `${hit.objectType}|${hit.properties.map(p => `${p.label}=${p.value}`).join('|')}`
}

function makeItemKey2(item: GroupedItem): string {
  return `${item.objectType}|${item.properties.map(p => `${p.label}=${p.value}`).join('|')}`
}
</script>

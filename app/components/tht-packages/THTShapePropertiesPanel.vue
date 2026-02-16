<template>
  <div class="p-3 space-y-3 text-xs overflow-y-auto">
    <template v-if="shape">
      <h4 class="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
        Shape Properties
      </h4>

      <!-- Role -->
      <div class="space-y-1">
        <label class="text-[10px] text-neutral-400 uppercase">Role</label>
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="r in roles"
            :key="r.value"
            class="px-2 py-0.5 text-[10px] rounded border transition-colors"
            :class="shape.role === r.value
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400'"
            @click="updateProp('role', r.value)"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <!-- Position -->
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-0.5">
          <label class="text-[10px] text-neutral-400 uppercase">X (mm)</label>
          <input
            :value="posX"
            type="number"
            step="0.01"
            class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onPosXChange"
          />
        </div>
        <div class="space-y-0.5">
          <label class="text-[10px] text-neutral-400 uppercase">Y (mm)</label>
          <input
            :value="posY"
            type="number"
            step="0.01"
            class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onPosYChange"
          />
        </div>
      </div>

      <!-- Dimensions: Rect / RoundedRect -->
      <template v-if="shape.kind === 'rect' || shape.kind === 'roundedRect'">
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400 uppercase">Width (mm)</label>
            <input
              :value="shape.width"
              type="number"
              step="0.01"
              min="0.01"
              class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @change="onDimChange('width', $event)"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400 uppercase">Height (mm)</label>
            <input
              :value="shape.height"
              type="number"
              step="0.01"
              min="0.01"
              class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @change="onDimChange('height', $event)"
            />
          </div>
        </div>
      </template>

      <!-- Corner radius: Rect or RoundedRect -->
      <template v-if="shape.kind === 'roundedRect' || shape.kind === 'rect'">
        <div class="space-y-0.5">
          <label class="text-[10px] text-neutral-400 uppercase">Corner Radius (mm)</label>
          <input
            :value="shape.kind === 'roundedRect' ? shape.cornerRadius : 0"
            type="number"
            step="0.01"
            min="0"
            class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onCornerRadiusChange($event)"
          />
        </div>
      </template>

      <!-- Radius: Circle only -->
      <template v-if="shape.kind === 'circle'">
        <div class="space-y-0.5">
          <label class="text-[10px] text-neutral-400 uppercase">Radius (mm)</label>
          <input
            :value="shape.radius"
            type="number"
            step="0.01"
            min="0.01"
            class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onDimChange('radius', $event)"
          />
        </div>
      </template>

      <!-- Stroke width: Line only -->
      <template v-if="shape.kind === 'line'">
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400 uppercase">End X (mm)</label>
            <input
              :value="shape.x2"
              type="number"
              step="0.01"
              class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @change="onDimChange('x2', $event)"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400 uppercase">End Y (mm)</label>
            <input
              :value="shape.y2"
              type="number"
              step="0.01"
              class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @change="onDimChange('y2', $event)"
            />
          </div>
        </div>
        <div class="space-y-0.5">
          <label class="text-[10px] text-neutral-400 uppercase">Stroke Width (mm)</label>
          <input
            :value="shape.strokeWidth"
            type="number"
            step="0.01"
            min="0.01"
            class="w-full px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onDimChange('strokeWidth', $event)"
          />
        </div>
      </template>

      <!-- Color overrides -->
      <template v-if="shape.role === 'body' || shape.role === 'pin' || shape.role === 'pin1'">
        <div class="space-y-1">
          <label class="text-[10px] text-neutral-400 uppercase">Fill Color</label>
          <div class="flex items-center gap-2">
            <input
              :value="shape.color || ''"
              type="color"
              class="w-7 h-6 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer"
              @input="onColorChange('color', $event)"
            />
            <input
              :value="shape.color || ''"
              type="text"
              placeholder="Inherit"
              class="flex-1 px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @change="onColorTextChange('color', $event)"
            />
            <button
              v-if="shape.color"
              class="text-[10px] text-neutral-400 hover:text-red-500"
              title="Clear color override"
              @click="updateProp('color', undefined)"
            >
              <UIcon name="i-lucide-x" />
            </button>
          </div>
        </div>
      </template>

      <template v-if="shape.kind !== 'line'">
        <div class="space-y-1">
          <label class="text-[10px] text-neutral-400 uppercase">Stroke Color</label>
          <div class="flex items-center gap-2">
            <input
              :value="(shape as any).strokeColor || ''"
              type="color"
              class="w-7 h-6 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer"
              @input="onColorChange('strokeColor', $event)"
            />
            <input
              :value="(shape as any).strokeColor || ''"
              type="text"
              placeholder="Inherit"
              class="flex-1 px-1.5 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @change="onColorTextChange('strokeColor', $event)"
            />
            <button
              v-if="(shape as any).strokeColor"
              class="text-[10px] text-neutral-400 hover:text-red-500"
              title="Clear color override"
              @click="updateProp('strokeColor', undefined)"
            >
              <UIcon name="i-lucide-x" />
            </button>
          </div>
        </div>
      </template>

      <!-- Delete shape -->
      <div class="pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <button
          class="w-full px-2 py-1 text-[11px] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          @click="emit('delete')"
        >
          Delete Shape
        </button>
      </div>
    </template>

    <!-- Multi-selection info -->
    <template v-else-if="(selectedCount ?? 0) > 1">
      <div class="text-center py-4 text-neutral-400 text-[11px]">
        {{ selectedCount }} shapes selected
      </div>
      <div class="px-3 pt-1 border-t border-neutral-200 dark:border-neutral-700">
        <button
          class="w-full px-2 py-1 text-[11px] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          @click="emit('delete')"
        >
          Delete {{ selectedCount }} Shapes
        </button>
      </div>
    </template>

    <!-- No selection -->
    <template v-else>
      <div class="text-center py-4 text-neutral-400 text-[11px]">
        Select a shape to edit its properties
      </div>

      <!-- Measurement info -->
      <template v-if="measureStart && measureEnd">
        <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <div class="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">Measurement</div>
          <div class="text-[11px] text-blue-800 dark:text-blue-200 tabular-nums">
            <div>dX: {{ (measureEnd.x - measureStart.x).toFixed(3) }} mm</div>
            <div>dY: {{ (measureEnd.y - measureStart.y).toFixed(3) }} mm</div>
            <div class="font-medium">
              Distance: {{ Math.sqrt(Math.pow(measureEnd.x - measureStart.x, 2) + Math.pow(measureEnd.y - measureStart.y, 2)).toFixed(3) }} mm
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { THTShape, THTShapeRole } from '~/utils/tht-package-types'

const props = defineProps<{
  shape: THTShape | null
  selectedCount?: number
  measureStart: { x: number; y: number } | null
  measureEnd: { x: number; y: number } | null
}>()

const emit = defineEmits<{
  'update:shape': [shape: THTShape]
  delete: []
}>()

const roles: { value: THTShapeRole; label: string }[] = [
  { value: 'body', label: 'Body' },
  { value: 'pin', label: 'Pin' },
  { value: 'pin1', label: 'Pin 1' },
  { value: 'polarity-marker', label: 'Polarity' },
]

const posX = computed(() => {
  if (!props.shape) return 0
  return props.shape.kind === 'line' ? props.shape.x1 : props.shape.x
})

const posY = computed(() => {
  if (!props.shape) return 0
  return props.shape.kind === 'line' ? props.shape.y1 : props.shape.y
})

function updateProp(key: string, value: any) {
  if (!props.shape) return
  emit('update:shape', { ...props.shape, [key]: value } as THTShape)
}

function onPosXChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(val) || !props.shape) return
  if (props.shape.kind === 'line') {
    const dx = val - props.shape.x1
    emit('update:shape', { ...props.shape, x1: val, x2: props.shape.x2 + dx })
  } else {
    emit('update:shape', { ...props.shape, x: val } as THTShape)
  }
}

function onPosYChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(val) || !props.shape) return
  if (props.shape.kind === 'line') {
    const dy = val - props.shape.y1
    emit('update:shape', { ...props.shape, y1: val, y2: props.shape.y2 + dy })
  } else {
    emit('update:shape', { ...props.shape, y: val } as THTShape)
  }
}

function onDimChange(key: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(val) || !props.shape) return
  emit('update:shape', { ...props.shape, [key]: val } as THTShape)
}

function onCornerRadiusChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(val) || !props.shape) return
  if (props.shape.kind === 'roundedRect') {
    if (val <= 0) {
      // Convert roundedRect back to rect when radius is set to 0
      const { cornerRadius: _, kind: __, ...rest } = props.shape
      emit('update:shape', { ...rest, kind: 'rect' } as THTShape)
    } else {
      emit('update:shape', { ...props.shape, cornerRadius: val })
    }
  } else if (props.shape.kind === 'rect' && val > 0) {
    // Promote rect to roundedRect
    const { kind: _, ...rest } = props.shape
    emit('update:shape', { ...rest, kind: 'roundedRect', cornerRadius: val } as THTShape)
  }
}

function onColorChange(key: string, e: Event) {
  const val = (e.target as HTMLInputElement).value
  updateProp(key, val || undefined)
}

function onColorTextChange(key: string, e: Event) {
  const val = (e.target as HTMLInputElement).value.trim()
  updateProp(key, val || undefined)
}
</script>

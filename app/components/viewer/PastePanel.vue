<template>
  <div
    class="flex-1 flex flex-col overflow-hidden"
    :class="{ 'pointer-events-none opacity-80': locked }"
  >
    <div class="flex-1 overflow-y-auto">
      <!-- Section: Paste Application Mode -->
      <div class="p-4 pb-2">
        <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Paste Application
        </div>

        <URadioGroup
          :model-value="localSettings.mode"
          :items="modeRadioItems"
          value-key="value"
          label-key="label"
          size="sm"
          @update:model-value="(value) => updateMode(value as PasteMode)"
        />
      </div>

      <!-- Section: Jetprint Parameters (visible only in jetprint mode) -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="localSettings.mode === 'jetprint'" class="px-4 pb-4">
          <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Jetprint Settings
          </div>

          <div class="space-y-3">
            <!-- Dot Diameter -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[10px] text-neutral-400">Dot Diameter</label>
                <span class="text-[10px] text-neutral-500 tabular-nums">{{ localSettings.dotDiameter.toFixed(2) }} mm</span>
              </div>
              <UInput
                :model-value="localSettings.dotDiameter"
                type="number"
                size="xs"
                :min="DOT_DIAMETER_MIN"
                :max="DOT_DIAMETER_MAX"
                step="0.01"
                @update:model-value="(value) => updateDotDiameter(Number(value))"
              />
              <div class="flex justify-between text-[9px] text-neutral-400">
                <span>{{ DOT_DIAMETER_MIN }} mm</span>
                <span>{{ DOT_DIAMETER_MAX }} mm</span>
              </div>
            </div>

            <!-- Dot Spacing -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[10px] text-neutral-400">Dot Spacing</label>
                <span class="text-[10px] text-neutral-500 tabular-nums">{{ localSettings.dotSpacing.toFixed(2) }} mm</span>
              </div>
              <UInput
                :model-value="localSettings.dotSpacing"
                type="number"
                size="xs"
                :min="DOT_SPACING_MIN"
                :max="DOT_SPACING_MAX"
                step="0.01"
                @update:model-value="(value) => updateDotSpacing(Number(value))"
              />
              <div class="flex justify-between text-[9px] text-neutral-400">
                <span>{{ DOT_SPACING_MIN }} mm</span>
                <span>{{ DOT_SPACING_MAX }} mm</span>
              </div>
            </div>

            <!-- Dot Pattern -->
            <div class="space-y-1.5">
              <label class="text-[10px] text-neutral-400">Dot Pattern</label>
              <URadioGroup
                :model-value="localSettings.pattern"
                :items="patternRadioItems"
                value-key="value"
                label-key="label"
                size="sm"
                orientation="horizontal"
                @update:model-value="(value) => updatePattern(value as DotPattern)"
              />
            </div>

            <!-- Dynamic Dot Control -->
            <div class="flex items-center justify-between pt-1">
              <div class="min-w-0 mr-2">
                <label class="text-[10px] text-neutral-400 leading-tight block">Dynamic Dot Control</label>
                <span class="text-[9px] text-neutral-500 leading-tight">Auto-shrink dots on small pads</span>
              </div>
              <USwitch
                :model-value="localSettings.dynamicDots"
                size="xs"
                @update:model-value="toggleDynamic"
              />
            </div>

            <!-- Highlight Dots -->
            <div class="flex items-center justify-between">
              <label class="text-[10px] text-neutral-400">Highlight Dots</label>
              <USwitch
                :model-value="localSettings.highlightDots"
                size="xs"
                @update:model-value="toggleHighlight"
              />
            </div>

            <!-- Show Jet Path -->
            <div class="flex items-center justify-between">
              <div class="min-w-0 mr-2">
                <label class="text-[10px] text-neutral-400 leading-tight block">Show Jet Path</label>
                <span class="text-[9px] text-neutral-500 leading-tight">Simulated head movement overlay</span>
              </div>
              <USwitch
                :model-value="localSettings.showJetPath"
                size="xs"
                @update:model-value="toggleJetPath"
              />
            </div>
          </div>

          <!-- Export JPSys -->
          <div class="pt-3 border-t border-neutral-200 dark:border-neutral-700 mt-3">
            <UButton
              block
              size="sm"
              variant="outline"
              icon="i-lucide-download"
              @click="$emit('exportJpsys')"
            >
              Export JPSys Program
            </UButton>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PasteSettings, PasteMode, DotPattern } from '~/composables/usePasteSettings'
import { DOT_DIAMETER_MIN, DOT_DIAMETER_MAX, DOT_SPACING_MIN, DOT_SPACING_MAX } from '~/composables/usePasteSettings'

const props = defineProps<{
  pasteSettings: PasteSettings
  locked?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:pasteSettings', settings: PasteSettings): void
  (e: 'exportJpsys'): void
}>()

const localSettings = computed(() => props.pasteSettings)

const modeOptions: { value: PasteMode; label: string; description: string; icon: string }[] = [
  {
    value: 'stencil',
    label: 'Stencil',
    description: 'Solid paste through laser-cut steel stencil',
    icon: 'i-lucide-square',
  },
  {
    value: 'jetprint',
    label: 'Jetprint',
    description: 'Individual dots deposited by jet printer',
    icon: 'i-lucide-droplets',
  },
]

const patternOptions: { value: DotPattern; label: string; icon: string }[] = [
  { value: 'grid', label: 'Grid', icon: 'i-lucide-grid-3x3' },
  { value: 'hex', label: 'Hex', icon: 'i-lucide-hexagon' },
]

const modeRadioItems = modeOptions.map(opt => ({ value: opt.value, label: opt.label, description: opt.description }))
const patternRadioItems = patternOptions.map(opt => ({ value: opt.value, label: opt.label }))

function updateMode(mode: PasteMode) {
  emit('update:pasteSettings', { ...localSettings.value, mode })
}

function updateDotDiameter(v: number) {
  emit('update:pasteSettings', { ...localSettings.value, dotDiameter: clamp(v, DOT_DIAMETER_MIN, DOT_DIAMETER_MAX) })
}

function updateDotSpacing(v: number) {
  emit('update:pasteSettings', { ...localSettings.value, dotSpacing: clamp(v, DOT_SPACING_MIN, DOT_SPACING_MAX) })
}

function updatePattern(pattern: DotPattern) {
  emit('update:pasteSettings', { ...localSettings.value, pattern })
}

function toggleDynamic(v: boolean) {
  emit('update:pasteSettings', { ...localSettings.value, dynamicDots: v })
}

function toggleHighlight(v: boolean) {
  emit('update:pasteSettings', { ...localSettings.value, highlightDots: v })
}

function toggleJetPath(v: boolean) {
  emit('update:pasteSettings', { ...localSettings.value, showJetPath: v })
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
</script>

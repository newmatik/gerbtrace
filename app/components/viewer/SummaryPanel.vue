<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-3 md:p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider">
            Assembly Summary
          </h2>
          <div class="flex items-center gap-1.5">
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              @click="copyToClipboard"
            >
              Copy Summary
            </UButton>
          </div>
        </div>

        <div v-if="!hasData" class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/50 p-4 text-center text-neutral-400 text-sm">
          No PnP or BOM data loaded.
        </div>

        <template v-else>
          <!-- Compact KPI row -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div class="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 px-3 py-2">
              <div class="text-[10px] text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">SMD</div>
              <div class="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums leading-tight">{{ smdCount }}</div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Top {{ smdTopCount }} · Bot {{ smdBotCount }}</div>
            </div>
            <div class="rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-800/40 px-3 py-2">
              <div class="text-[10px] text-purple-600/80 dark:text-purple-400/80 uppercase tracking-wider">THT</div>
              <div class="text-xl font-bold text-purple-700 dark:text-purple-300 tabular-nums leading-tight">{{ thtCount }}</div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Top {{ thtTopCount }} · Bot {{ thtBotCount }}</div>
            </div>
            <div class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 px-3 py-2">
              <div class="text-[10px] text-red-600/80 dark:text-red-400/80 uppercase tracking-wider">DNP</div>
              <div class="text-xl font-bold text-red-700 dark:text-red-300 tabular-nums leading-tight">{{ dnpCount }}</div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Not populated</div>
            </div>
            <div class="rounded-md bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 px-3 py-2">
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">BOM Lines</div>
              <div class="text-xl font-bold text-neutral-800 dark:text-neutral-100 tabular-nums leading-tight">{{ bomTotalLines }}</div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400">{{ bomSmdLines }} SMD · {{ bomThtLines }} THT · {{ bomMountingLines }} MNT</div>
            </div>
          </div>

          <!-- Main dense grid -->
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <!-- PCB + quick flags -->
            <div class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/50 p-3 text-[11px]">
              <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                PCB Information
              </div>
              <div v-if="pcbData?.sizeX && pcbData?.sizeY" class="space-y-1 text-neutral-600 dark:text-neutral-300">
                <div class="tabular-nums font-medium text-neutral-800 dark:text-neutral-100">
                  {{ pcbData.sizeX }} x {{ pcbData.sizeY }} mm · {{ pcbData.layerCount ?? '?' }}L
                </div>
                <div>{{ materialLabel }} · {{ pcbData.surfaceFinish ?? '?' }} · {{ pcbData.copperWeight ?? '?' }}</div>
                <div class="tabular-nums">
                  Area {{ ((pcbData.sizeX * pcbData.sizeY) / 100).toFixed(1) }} cm² · Thickness {{ pcbData.thicknessMm ?? 1.6 }} mm
                </div>
              </div>
              <div v-else class="text-neutral-400">
                No board parameters set — fill in the PCB tab.
              </div>
              <div class="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[10px]">
                <div v-if="unmatchedCount > 0" class="text-amber-600 dark:text-amber-400">
                  {{ unmatchedCount }} unmatched component{{ unmatchedCount !== 1 ? 's' : '' }}
                </div>
                <div v-else class="text-emerald-600 dark:text-emerald-400">
                  All components matched to library packages
                </div>
              </div>
            </div>

            <!-- Placement categories -->
            <div class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/50 p-3 text-[11px]">
              <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Placement Categories (SMD)
              </div>
              <div v-if="smdCount > 0" class="space-y-1">
                <div
                  v-for="cat in placementCategories"
                  :key="cat.key"
                  class="grid grid-cols-[auto_auto_1fr_auto] items-center gap-1.5"
                >
                  <span class="inline-flex items-center justify-center min-w-[76px] px-1.5 py-0.5 rounded text-[10px] font-medium" :class="cat.badgeClass">
                    {{ cat.label }}
                  </span>
                  <span class="tabular-nums font-medium text-neutral-700 dark:text-neutral-200">{{ cat.count }}</span>
                  <div class="h-1 rounded bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    <div class="h-full bg-neutral-500/60 dark:bg-neutral-400/60" :style="{ width: `${cat.pct}%` }" />
                  </div>
                  <span class="text-[10px] tabular-nums text-neutral-400">{{ cat.pct }}%</span>
                </div>
              </div>
              <div v-else class="text-neutral-400">No SMD components.</div>
            </div>

            <!-- Wave + hand solder -->
            <div class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/50 p-3 text-[11px] space-y-3">
              <div>
                <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                  Wave Soldering
                </div>
                <UBadge :color="waveSolder.color" size="xs" variant="subtle">
                  {{ waveSolder.status }}
                </UBadge>
                <ul class="mt-1.5 space-y-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <li v-for="(reason, idx) in waveSolder.reasons.slice(0, 3)" :key="idx">{{ reason }}</li>
                </ul>
              </div>

              <div v-if="thtCount > 0" class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                  Hand Solder Estimate
                </div>
                <div class="flex items-baseline gap-2">
                  <span class="text-lg font-bold text-neutral-800 dark:text-neutral-100 tabular-nums">~{{ handSolderPoints }}</span>
                  <span class="text-[10px] text-neutral-500 dark:text-neutral-400">points / board</span>
                </div>
                <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {{ thtCount }} components · avg {{ avgPinsPerTht }} pins
                </div>
                <div v-if="handSolderByType.length > 1" class="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <div v-for="entry in handSolderByType" :key="entry.type">
                    {{ entry.label }}: {{ entry.points }}
                  </div>
                </div>
              </div>
              <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                  Assembly Time Estimate
                </div>
                <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <div>Per board time</div>
                  <div class="text-right tabular-nums">~{{ estimatedAssemblyMinutes.toFixed(1) }} min</div>
                  <div>Labor cost / board</div>
                  <div class="text-right tabular-nums">€{{ estimatedLaborCost.toFixed(2) }}</div>
                  <div>Boards per 8h shift</div>
                  <div class="text-right tabular-nums">{{ estimatedBoardsPerShift }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Warnings (full width) -->
          <div v-if="warnings.length > 0" class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/50 p-3 text-[11px]">
            <div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
              Assembly Warnings
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
              <div
                v-for="(w, idx) in warnings"
                :key="idx"
                class="flex items-start gap-2 rounded-md px-2 py-1.5"
                :class="w.level === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40'
                  : 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-800/30'"
              >
                <UIcon
                  :name="w.level === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
                  class="mt-0.5 shrink-0 text-xs"
                  :class="w.level === 'warning' ? 'text-amber-500' : 'text-blue-400'"
                />
                <div class="min-w-0">
                  <div class="font-medium text-[10px]" :class="w.level === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'">
                    {{ w.title }}
                  </div>
                  <div v-if="w.designators" class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 break-all">
                    {{ w.designators }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import type { BomLine } from '~/utils/bom-types'
import type { PackageDefinition } from '~/utils/package-types'
import type { THTPackageDefinition } from '~/utils/tht-package-types'
import type { SurfaceFinish, PcbMaterial, PcbThicknessMm } from '~/utils/pcb-pricing'
import type { SolderMaskColor } from '~/utils/pcb-presets'
import { PCB_MATERIAL_OPTIONS } from '~/utils/pcb-pricing'

interface PcbData {
  sizeX?: number
  sizeY?: number
  layerCount?: number
  material?: PcbMaterial
  surfaceFinish?: SurfaceFinish
  copperWeight?: string
  thicknessMm?: PcbThicknessMm
  solderMaskColor?: SolderMaskColor
}

type ThtAssemblyType = 'wave' | 'hand' | 'mounting' | 'coating' | 'cable' | 'delivered-loose'

const props = defineProps<{
  pcbData: PcbData | null | undefined
  smdComponents: EditablePnPComponent[]
  thtComponents: EditablePnPComponent[]
  bomLines: BomLine[]
  matchPackage?: ((name: string) => PackageDefinition | undefined) | null
  matchThtPackage?: ((name: string) => THTPackageDefinition | undefined) | null
  projectName?: string
  assemblyTypeOverrides?: Map<string, ThtAssemblyType>
}>()
const toast = useToast()

const materialLabel = computed(() => {
  const mat = props.pcbData?.material ?? 'FR4'
  return PCB_MATERIAL_OPTIONS.find(o => o.value === mat)?.label ?? mat
})

const activeSmd = computed(() => props.smdComponents.filter(c => !c.dnp))
const activeTht = computed(() => props.thtComponents.filter(c => !c.dnp))

const smdCount = computed(() => activeSmd.value.length)
const thtCount = computed(() => activeTht.value.length)
const dnpCount = computed(() =>
  props.smdComponents.filter(c => c.dnp).length + props.thtComponents.filter(c => c.dnp).length,
)

const smdTopCount = computed(() => activeSmd.value.filter(c => c.side === 'top').length)
const smdBotCount = computed(() => activeSmd.value.filter(c => c.side === 'bottom').length)
const thtTopCount = computed(() => activeTht.value.filter(c => c.side === 'top').length)
const thtBotCount = computed(() => activeTht.value.filter(c => c.side === 'bottom').length)

const unmatchedCount = computed(() =>
  [...activeSmd.value, ...activeTht.value].filter(c => !c.matchedPackage).length,
)

const hasData = computed(() =>
  props.smdComponents.length > 0 || props.thtComponents.length > 0 || props.bomLines.length > 0,
)

const bomSmdLines = computed(() => props.bomLines.filter(l => !l.dnp && l.type === 'SMD').length)
const bomThtLines = computed(() => props.bomLines.filter(l => !l.dnp && l.type === 'THT').length)
const bomMountingLines = computed(() => props.bomLines.filter(l => !l.dnp && l.type === 'Mounting').length)
const bomTotalLines = computed(() => props.bomLines.filter(l => !l.dnp).length)

// ── Placement Categories ──

interface PlacementCategory {
  key: string
  label: string
  desc: string
  count: number
  pct: string
  badgeClass: string
}

const placementCategories = computed<PlacementCategory[]>(() => {
  const cats: Record<string, { label: string; desc: string; count: number; badgeClass: string }> = {
    chip: { label: 'Chip (fast)', desc: 'R, C, D', count: 0, badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    standard: { label: 'Standard', desc: 'SOT, SOIC, SSOP', count: 0, badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    finepitch: { label: 'Fine-pitch', desc: 'pitch < 0.5mm', count: 0, badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    qfp: { label: 'QFP/QFN', desc: 'pitch >= 0.5mm', count: 0, badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    bga: { label: 'BGA', desc: 'Ball grid array', count: 0, badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    other: { label: 'Other', desc: 'Unmatched / special', count: 0, badgeClass: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' },
  }

  for (const comp of activeSmd.value) {
    const pkg = comp.matchedPackage && props.matchPackage ? props.matchPackage(comp.matchedPackage) : undefined
    if (!pkg) {
      cats.other.count++
      continue
    }
    switch (pkg.type) {
      case 'PT_TWO_POLE':
        cats.chip.count++
        break
      case 'PT_THREE_POLE':
      case 'PT_TWO_SYM':
      case 'PT_TWO_PLUS_TWO':
        cats.standard.count++
        break
      case 'PT_FOUR_SYM': {
        const pitch = getFourSymPitch(pkg)
        if (pitch !== null && pitch < 0.5) {
          cats.finepitch.count++
        } else {
          cats.qfp.count++
        }
        break
      }
      case 'PT_BGA':
        cats.bga.count++
        break
      default:
        cats.other.count++
    }
  }

  const total = smdCount.value || 1
  return Object.entries(cats)
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => ({
      key,
      label: v.label,
      desc: v.desc,
      count: v.count,
      pct: ((v.count / total) * 100).toFixed(0),
      badgeClass: v.badgeClass,
    }))
})

function getFourSymPitch(pkg: PackageDefinition): number | null {
  if (pkg.type !== 'PT_FOUR_SYM') return null
  const params = (pkg as any).fourSymmetric
  if (params?.pitch != null) return params.pitch
  return null
}

// ── Wave Soldering ──

const waveSolder = computed(() => {
  if (!hasData.value) {
    return { status: 'Not Applicable', color: 'neutral' as const, reasons: ['No PnP data loaded.'] }
  }
  if (thtCount.value === 0) {
    return { status: 'Not Suitable', color: 'error' as const, reasons: ['No THT components detected — wave soldering not applicable.'] }
  }

  const reasons: string[] = []
  reasons.push(`${thtCount.value} THT component${thtCount.value !== 1 ? 's' : ''} (top: ${thtTopCount.value}, bottom: ${thtBotCount.value})`)

  const mat = props.pcbData?.material
  if (mat === 'Flex' || mat === 'Rigid-Flex') {
    reasons.push(`Board material: ${materialLabel.value} — verify wave solder compatibility.`)
  }

  if (smdBotCount.value > 0) {
    reasons.push(`${smdBotCount.value} SMD component${smdBotCount.value !== 1 ? 's' : ''} on bottom side (conflict for wave soldering).`)
    return { status: 'Conditionally Suitable', color: 'warning' as const, reasons }
  }

  return { status: 'Suitable', color: 'success' as const, reasons }
})

// ── Assembly Warnings ──

interface Warning {
  level: 'warning' | 'info'
  title: string
  designators?: string
}

const warnings = computed<Warning[]>(() => {
  const result: Warning[] = []

  const bgaComps = activeSmd.value.filter((c) => {
    const pkg = c.matchedPackage && props.matchPackage ? props.matchPackage(c.matchedPackage) : undefined
    return pkg?.type === 'PT_BGA'
  })
  if (bgaComps.length > 0) {
    result.push({
      level: 'warning',
      title: `${bgaComps.length} BGA component${bgaComps.length !== 1 ? 's' : ''} (X-ray inspection required)`,
      designators: bgaComps.map(c => c.designator).join(', '),
    })
  }

  const fpComps = activeSmd.value.filter((c) => {
    const pkg = c.matchedPackage && props.matchPackage ? props.matchPackage(c.matchedPackage) : undefined
    if (pkg?.type !== 'PT_FOUR_SYM') return false
    const pitch = getFourSymPitch(pkg)
    return pitch !== null && pitch < 0.5
  })
  if (fpComps.length > 0) {
    result.push({
      level: 'warning',
      title: `${fpComps.length} fine-pitch component${fpComps.length !== 1 ? 's' : ''} (precise placement required)`,
      designators: fpComps.map(c => c.designator).join(', '),
    })
  }

  const unmatchedComps = [...activeSmd.value, ...activeTht.value].filter(c => !c.matchedPackage)
  if (unmatchedComps.length > 0) {
    result.push({
      level: 'warning',
      title: `${unmatchedComps.length} component${unmatchedComps.length !== 1 ? 's' : ''} without matched library package`,
      designators: unmatchedComps.slice(0, 30).map(c => `${c.designator} (${c.cadPackage})`).join(', ')
        + (unmatchedComps.length > 30 ? `, ... +${unmatchedComps.length - 30} more` : ''),
    })
  }

  if (smdTopCount.value > 0 && smdBotCount.value > 0) {
    result.push({
      level: 'info',
      title: `Double-sided SMD — two reflow passes required (top: ${smdTopCount.value}, bottom: ${smdBotCount.value})`,
    })
  }

  if (smdCount.value > 0 && thtCount.value > 0) {
    result.push({
      level: 'info',
      title: 'Mixed technology (SMD + THT) — multiple process steps required.',
    })
  }

  return result
})

// ── Hand Solder Estimate ──

function countThtPins(comp: EditablePnPComponent): number {
  if (!comp.matchedPackage || !props.matchThtPackage) return 2
  const pkg = props.matchThtPackage(comp.matchedPackage)
  if (!pkg) return 2
  return pkg.shapes.filter(s => s.role === 'pin' || s.role === 'pin1').length || 2
}

const handSolderPoints = computed(() => {
  let total = 0
  for (const comp of activeTht.value) {
    total += countThtPins(comp)
  }
  return total
})

const avgPinsPerTht = computed(() => {
  if (thtCount.value === 0) return '0'
  return (handSolderPoints.value / thtCount.value).toFixed(1)
})

const THT_ASSEMBLY_LABELS: Record<string, string> = {
  wave: 'Wave',
  hand: 'Hand',
  mounting: 'Mounting',
  coating: 'Coating',
  cable: 'Cable',
  'delivered-loose': 'Delivered Loose',
}

const handSolderByType = computed(() => {
  const map = new Map<string, { count: number; points: number }>()
  for (const comp of activeTht.value) {
    const type = props.assemblyTypeOverrides?.get(comp.key) ?? 'wave'
    const entry = map.get(type) ?? { count: 0, points: 0 }
    entry.count++
    entry.points += countThtPins(comp)
    map.set(type, entry)
  }
  return [...map.entries()].map(([type, data]) => ({
    type,
    label: THT_ASSEMBLY_LABELS[type] ?? type,
    count: data.count,
    points: data.points,
  }))
})

const LABOR_RATE_PER_SECOND_EUR = 0.01533
const estimatedAssemblySeconds = computed(() => {
  const smdSeconds = smdCount.value * 1.2
  const thtSeconds = thtCount.value * 3
  const pinSeconds = handSolderPoints.value * 0.8
  return smdSeconds + thtSeconds + pinSeconds
})
const estimatedAssemblyMinutes = computed(() => estimatedAssemblySeconds.value / 60)
const estimatedLaborCost = computed(() => estimatedAssemblySeconds.value * LABOR_RATE_PER_SECOND_EUR)
const estimatedBoardsPerShift = computed(() => {
  if (estimatedAssemblySeconds.value <= 0) return 0
  return Math.max(1, Math.floor((8 * 60 * 60) / estimatedAssemblySeconds.value))
})

// ── Copy to Clipboard ──

function buildSummaryText(): string {
  const lines: string[] = []
  const name = props.projectName || 'Untitled'
  lines.push(`Assembly Summary — ${name}`)

  if (props.pcbData?.sizeX && props.pcbData?.sizeY) {
    const parts = [
      `${props.pcbData.sizeX} x ${props.pcbData.sizeY} mm`,
      `${props.pcbData.layerCount ?? '?'}L`,
      materialLabel.value,
      props.pcbData.surfaceFinish ?? '?',
      props.pcbData.copperWeight ?? '?',
      `${props.pcbData.thicknessMm ?? 1.6}mm`,
    ]
    lines.push(`PCB: ${parts.join(' | ')}`)
  }

  lines.push('')

  if (hasData.value) {
    lines.push(`SMD: ${smdCount.value} components (${bomSmdLines.value} unique lines) | Top: ${smdTopCount.value}, Bottom: ${smdBotCount.value}`)
    lines.push(`THT: ${thtCount.value} components (${bomThtLines.value} unique lines) | Top: ${thtTopCount.value}, Bottom: ${thtBotCount.value}`)
    lines.push(`DNP: ${dnpCount.value}`)

    if (placementCategories.value.length > 0) {
      lines.push('')
      lines.push('Placement Categories (SMD):')
      for (const cat of placementCategories.value) {
        lines.push(`  ${cat.label}: ${cat.count} (${cat.pct}%)`)
      }
    }

    lines.push('')
    lines.push(`Wave Soldering: ${waveSolder.value.status}`)
    for (const reason of waveSolder.value.reasons) {
      lines.push(`  - ${reason}`)
    }

    if (warnings.value.length > 0) {
      lines.push('')
      lines.push('Warnings:')
      for (const w of warnings.value) {
        lines.push(`  - ${w.title}${w.designators ? `: ${w.designators}` : ''}`)
      }
    }

    if (thtCount.value > 0) {
      lines.push('')
      lines.push(`Hand Solder Points: ~${handSolderPoints.value} (avg ${avgPinsPerTht.value} pins/component)`)
    }
  }

  return lines.join('\n')
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(buildSummaryText())
    toast.add({ title: 'Summary copied to clipboard', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to copy summary', color: 'error' })
  }
}
</script>

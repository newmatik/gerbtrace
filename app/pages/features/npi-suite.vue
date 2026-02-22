<script setup lang="ts">
useHead({
  title: 'NPI Suite — CAD/CAM Data Preparation for PCB Manufacturing | Gerbtrace',
  meta: [
    { name: 'description', content: 'PCB NPI and CAD/CAM data preparation platform. BOM management, pick and place verification, Gerber panelization, solder paste configuration, and production handover — all in one tool.' },
    { property: 'og:title', content: 'NPI Suite — CAD/CAM Data Preparation for PCB Manufacturing' },
    { property: 'og:description', content: 'Complete manufacturing data preparation: BOM management, pick and place, panelization, paste config, and production summaries for PCB assembly.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/bom-panel-light.png' },
  ],
})

useSchemaOrg([
  defineWebPage(),
])

const modules = [
  {
    id: 'bom',
    title: 'BOM Management',
    subtitle: 'Import, enrich, and price your bill of materials',
    description: 'Import BOM files from Excel or CSV and organize components into custom groups. Automatic part matching suggests standardized descriptions and manufacturer part numbers. Add multiple manufacturers per component and fetch live pricing from global distributors.',
    features: [
      'Import from Excel, CSV, or manual entry',
      'AI-powered part enrichment with Spark AI',
      'Multiple manufacturers per component',
      'Live distributor pricing with quantity tiers',
      'Cross-reference with pick and place data',
      'Filter by SMD, THT, DNP, or missing data',
    ],
    icon: 'i-lucide-list-todo',
    screenshotDark: '/images/docs/bom-panel-dark.png',
    screenshotLight: '/images/docs/bom-panel-light.png',
    screenshotAlt: 'BOM management panel with component groups and pricing',
  },
  {
    id: 'pnp',
    title: 'Pick and Place',
    subtitle: 'Verify component placement and export machine files',
    description: 'Visualize SMD components directly on the PCB canvas with bidirectional highlighting. Match CAD package names to library packages, edit rotations, and verify polarity. Support for Mycronic, IPC-7351, and IEC 61188-7 rotation conventions.',
    features: [
      'Visual component placement on PCB canvas',
      'Automatic CAD-to-library package matching',
      'Multiple rotation convention support',
      'Polarity and orientation verification',
      'Batch editing and group operations',
      'Export production-ready placement data',
    ],
    icon: 'i-lucide-cpu',
    screenshotDark: '/images/docs/smd-highlight-dark.png',
    screenshotLight: '/images/docs/smd-highlight-light.png',
    screenshotAlt: 'Pick and place visualization with component highlighting on PCB',
  },
  {
    id: 'panel',
    title: 'Panelization',
    subtitle: 'Create production panels with frames and tooling',
    description: 'Configure multi-up panel layouts with grid settings, frame rails, fiducials, and tooling holes. AI-powered suggestions optimize board count within your panel size limits. Choose between routed channels with breakaway tabs, V-cut, or mixed separation.',
    features: [
      'Grid layout with AI-optimized board count',
      'Frame rails, fiducials, and tooling holes',
      'V-cut, routed tabs, or mixed separation',
      'Mouse bite perforation configuration',
      'Support bars between columns and rows',
      'Real-time canvas preview with components',
    ],
    icon: 'i-lucide-layout-grid',
    screenshotDark: '/images/docs/panel-overview-dark.png',
    screenshotLight: '/images/docs/panel-overview-light.png',
    screenshotAlt: 'Panel configuration with grid layout and frame settings',
  },
  {
    id: 'paste',
    title: 'Paste and Stencil',
    subtitle: 'Configure solder paste for stencil or jet printing',
    description: 'Set up solder paste for traditional laser-cut stencils or stencil-free jet printing. For jet printing, configure dot diameter, spacing, and pattern for each pad. Compatible with Mycronic MY600 jet printers with direct JPSys JSON export.',
    features: [
      'Laser-cut stencil configuration',
      'Jet printing mode (Mycronic MY600)',
      'Adjustable dot diameter and spacing',
      'Grid or hexagonal dot patterns',
      'Dynamic dot control for small pads',
      'JPSys program export',
    ],
    icon: 'i-lucide-droplets',
    screenshotDark: '/images/docs/paste-jetprint-dark.png',
    screenshotLight: '/images/docs/paste-jetprint-light.png',
    screenshotAlt: 'Solder paste jet printing configuration',
  },
  {
    id: 'summary',
    title: 'Production Summary',
    subtitle: 'Assembly overview and manufacturing handover',
    description: 'Get a complete assembly overview with component counts broken down by SMD and THT, placement speed categories, wave soldering suitability, and hand solder estimates. Assembly warnings flag production considerations like BGA, fine-pitch, or mixed technology boards.',
    features: [
      'Component count breakdown (SMD/THT by side)',
      'Placement speed categories (chip, standard, QFP)',
      'Wave soldering suitability check',
      'Assembly warnings for production',
      'Cost estimation with quantity tiers',
      'Copy summary to clipboard for quotations',
    ],
    icon: 'i-lucide-clipboard-list',
    screenshotDark: '/images/docs/summary-dark.png',
    screenshotLight: '/images/docs/summary-light.png',
    screenshotAlt: 'Production summary with assembly overview and cost estimation',
  },
]
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1">
      <!-- Hero -->
      <section class="py-20 px-4">
        <div class="max-w-3xl mx-auto text-center">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 text-xs font-medium mb-6">
            <UIcon name="i-lucide-settings-2" class="size-3.5" />
            Manufacturing Data Preparation
          </div>
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            NPI Suite
          </h1>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Complete CAD/CAM data preparation for PCB manufacturing.
            From BOM import to production handover, prepare all your manufacturing data in one platform.
          </p>
          <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/dashboard" size="lg" icon="i-lucide-plus" class="px-6">
              Start a Project
            </UButton>
            <UButton to="/" size="lg" color="neutral" variant="ghost" class="px-6">
              All Features
            </UButton>
          </div>
        </div>
      </section>

      <!-- Module sections -->
      <section class="pb-12 px-4">
        <div class="max-w-5xl mx-auto space-y-24">
          <article
            v-for="(mod, index) in modules"
            :id="mod.id"
            :key="mod.id"
            class="scroll-mt-20"
          >
            <div :class="['flex flex-col gap-8', index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row']">
              <!-- Description side -->
              <div class="flex-1 min-w-0">
                <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 inline-block mb-4">
                  <UIcon :name="mod.icon" class="text-2xl text-[var(--ui-primary)]" />
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">{{ mod.title }}</h2>
                <p class="text-sm font-medium text-[var(--ui-primary)] mb-3">{{ mod.subtitle }}</p>
                <p class="text-gray-600 dark:text-gray-400 leading-relaxed">{{ mod.description }}</p>
              </div>

              <!-- Feature list side -->
              <div class="flex-1 min-w-0">
                <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                  <ul class="space-y-3">
                    <li
                      v-for="feature in mod.features"
                      :key="feature"
                      class="flex items-start gap-3 text-sm"
                    >
                      <UIcon name="i-lucide-check" class="text-green-500 shrink-0 mt-0.5" />
                      <span class="text-gray-700 dark:text-gray-300">{{ feature }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Screenshot -->
            <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl mt-8">
              <img :src="mod.screenshotDark" :alt="mod.screenshotAlt" class="hidden dark:block w-full">
              <img :src="mod.screenshotLight" :alt="mod.screenshotAlt" class="block dark:hidden w-full">
            </div>
          </article>
        </div>
      </section>

      <!-- Workflow -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">From design files to factory floor</h2>
          <div class="grid sm:grid-cols-5 gap-4">
            <div v-for="(step, i) in [
              { label: 'Import', desc: 'Drop Gerber, BOM, and PnP files', icon: 'i-lucide-upload' },
              { label: 'Review', desc: 'Inspect layers, verify components', icon: 'i-lucide-eye' },
              { label: 'Prepare', desc: 'Panelize, configure paste, enrich BOM', icon: 'i-lucide-settings-2' },
              { label: 'Price', desc: 'Get live component and assembly costs', icon: 'i-lucide-calculator' },
              { label: 'Hand Off', desc: 'Export production-ready data', icon: 'i-lucide-send' },
            ]" :key="step.label" class="text-center">
              <div class="mx-auto w-12 h-12 rounded-full bg-[var(--ui-primary)]/10 flex items-center justify-center mb-3">
                <UIcon :name="step.icon" class="text-xl text-[var(--ui-primary)]" />
              </div>
              <div class="text-xs font-medium text-[var(--ui-primary)] mb-1">Step {{ i + 1 }}</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ step.label }}</div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Start preparing your PCB data</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Free to start. All NPI tools are available on every plan.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/dashboard" size="lg" class="px-6">
              Open Gerbtrace
            </UButton>
            <UButton to="/pricing" size="lg" color="neutral" variant="outline" class="px-6">
              View Pricing
            </UButton>
          </div>
        </div>
      </section>
    </main>

    <MarketingFooter />
  </div>
</template>

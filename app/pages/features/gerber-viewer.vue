<script setup lang="ts">
useHead({
  title: 'Free Gerber Viewer — View PCB Layouts Online | Gerbtrace',
  meta: [
    { name: 'description', content: 'Free online Gerber file viewer. View, measure, and inspect PCB layouts in your browser. Supports Gerber RS-274X, Excellon drill files, and PDF. No installation required.' },
    { property: 'og:title', content: 'Free Gerber Viewer — View PCB Layouts Online | Gerbtrace' },
    { property: 'og:description', content: 'View and inspect Gerber files directly in your browser. Layer management, realistic rendering, measurement tools, and side-by-side revision comparison.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/pcb-light.png' },
  ],
})

useSchemaOrg([
  defineWebPage(),
])

const capabilities = [
  {
    title: 'Layer Management',
    description: 'Toggle individual layers on and off, customize colors, and control rendering order. Supports copper, solder mask, silkscreen, paste, and drill layers.',
    icon: 'i-lucide-layers',
  },
  {
    title: 'Realistic Rendering',
    description: 'Switch to realistic mode to see your PCB as it will look after manufacturing — complete with solder mask color, surface finish, and silkscreen.',
    icon: 'i-lucide-palette',
  },
  {
    title: 'Measurement Tools',
    description: 'Measure distances, inspect pad coordinates, and verify clearances directly on the canvas. Supports metric and imperial units.',
    icon: 'i-lucide-ruler',
  },
  {
    title: 'Compare Revisions',
    description: 'Side-by-side comparison of two Gerber packages with synchronized pan and zoom. Overlay blink mode and pixel diff highlight every change between revisions.',
    icon: 'i-lucide-columns-2',
  },
  {
    title: 'Auto File Detection',
    description: 'Drag and drop a ZIP or individual files. Gerbtrace automatically classifies Gerber, drill, pick and place, BOM, and PDF files by content analysis.',
    icon: 'i-lucide-file-search',
  },
  {
    title: 'Multi-Format Support',
    description: 'Import Gerber RS-274X, Excellon drill files, pick and place data, BOM spreadsheets, and PDF documents. All standard PCB manufacturing formats supported.',
    icon: 'i-lucide-files',
  },
  {
    title: 'Draw and Annotate',
    description: 'Draw lines, rectangles, and shapes directly on the PCB canvas. Add visual annotations for team reviews and manufacturing notes.',
    icon: 'i-lucide-pencil',
  },
  {
    title: 'Board Parameters',
    description: 'Configure board dimensions, layer count, material, surface finish, copper weight, and solder mask color. Parameters feed into cost estimation.',
    icon: 'i-lucide-circuit-board',
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
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs font-medium mb-6">
            <UIcon name="i-lucide-eye" class="size-3.5" />
            Free to use
          </div>
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Gerber Viewer
          </h1>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            View, measure, and inspect PCB layouts directly in your browser.
            No installation required — just drag and drop your Gerber files to get started.
          </p>
          <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/dashboard" size="lg" icon="i-lucide-eye" class="px-6">
              Open Viewer
            </UButton>
            <UButton to="/" size="lg" color="neutral" variant="ghost" class="px-6">
              All Features
            </UButton>
          </div>
        </div>
      </section>

      <!-- Hero screenshot -->
      <section class="pb-12 px-4">
        <div class="max-w-5xl mx-auto">
          <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <img src="/images/docs/pcb-dark.png" alt="Gerbtrace PCB Viewer showing a circuit board with layer management" class="hidden dark:block w-full">
            <img src="/images/docs/pcb-light.png" alt="Gerbtrace PCB Viewer showing a circuit board with layer management" class="block dark:hidden w-full">
          </div>
        </div>
      </section>

      <!-- Capabilities grid -->
      <section class="pb-20 px-4">
        <div class="max-w-5xl mx-auto">
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div
              v-for="cap in capabilities"
              :key="cap.title"
              class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
            >
              <div class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 inline-block mb-3">
                <UIcon :name="cap.icon" class="text-lg text-[var(--ui-primary)]" />
              </div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">{{ cap.title }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{{ cap.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Screenshots row -->
      <section class="pb-16 px-4">
        <div class="max-w-5xl mx-auto grid sm:grid-cols-2 gap-6">
          <div>
            <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
              <img src="/images/docs/pcb-realistic-dark.png" alt="Realistic PCB rendering mode" class="hidden dark:block w-full">
              <img src="/images/docs/pcb-realistic-light.png" alt="Realistic PCB rendering mode" class="block dark:hidden w-full">
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Realistic rendering mode</p>
          </div>
          <div>
            <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
              <img src="/images/docs/pcb-measure-dark.png" alt="Measurement tools on PCB canvas" class="hidden dark:block w-full">
              <img src="/images/docs/pcb-measure-light.png" alt="Measurement tools on PCB canvas" class="block dark:hidden w-full">
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Measurement and inspection tools</p>
          </div>
        </div>
      </section>

      <!-- Compare screenshots -->
      <section class="pb-16 px-4">
        <div class="max-w-5xl mx-auto">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">Compare Revisions</h2>
          <p class="text-gray-600 dark:text-gray-400 text-center mb-8">Side-by-side, overlay, and pixel diff modes to catch every change.</p>
          <div class="grid sm:grid-cols-3 gap-5">
            <div>
              <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
                <img src="/images/docs/compare-side-by-side-dark.png" alt="Side-by-side Gerber comparison" class="hidden dark:block w-full">
                <img src="/images/docs/compare-side-by-side-light.png" alt="Side-by-side Gerber comparison" class="block dark:hidden w-full">
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Side-by-side</p>
            </div>
            <div>
              <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
                <img src="/images/docs/compare-overlay-dark.png" alt="Overlay comparison mode" class="hidden dark:block w-full">
                <img src="/images/docs/compare-overlay-light.png" alt="Overlay comparison mode" class="block dark:hidden w-full">
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Overlay blink</p>
            </div>
            <div>
              <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
                <img src="/images/docs/compare-diff-dark.png" alt="Pixel diff highlighting changes" class="hidden dark:block w-full">
                <img src="/images/docs/compare-diff-light.png" alt="Pixel diff highlighting changes" class="block dark:hidden w-full">
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Pixel diff</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Format support -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Supported Formats</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-8">
            Import all standard PCB manufacturing file formats.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <span v-for="fmt in ['Gerber RS-274X', 'Excellon Drill', 'Pick & Place CSV', 'BOM (Excel / CSV)', 'PDF Documents']" :key="fmt" class="px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-300">
              {{ fmt }}
            </span>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Try the Gerber Viewer now</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            No sign-up required. Drag and drop your Gerber files or try our sample project.
          </p>
          <UButton to="/dashboard" size="lg" class="px-6">
            Open Gerbtrace
          </UButton>
        </div>
      </section>
    </main>

    <MarketingFooter />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Spark AI — AI-Powered BOM Enrichment | Gerbtrace',
  meta: [
    { name: 'description', content: 'Spark AI enriches your PCB bill of materials automatically. AI suggests manufacturer part numbers, standardizes descriptions, and classifies component packages.' },
    { property: 'og:title', content: 'Spark AI — AI-Powered BOM Enrichment | Gerbtrace' },
    { property: 'og:description', content: 'Automatic BOM enrichment: missing MPN suggestions, description standardization, and package classification powered by AI.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/bom-groups-light.png' },
  ],
})

useSchemaOrg([
  defineWebPage(),
])

const capabilities = [
  {
    title: 'Part Number Suggestions',
    description: 'Spark AI identifies components from partial descriptions and suggests matching manufacturer part numbers (MPNs) from its knowledge base.',
    icon: 'i-lucide-hash',
  },
  {
    title: 'Description Standardization',
    description: 'Normalizes component descriptions to a consistent format. Converts shorthand like "100nF 0402" into standardized descriptions with all relevant parameters.',
    icon: 'i-lucide-text',
  },
  {
    title: 'Package Classification',
    description: 'Automatically maps component footprints to standard package types. Matches CAD package names to the library for accurate pick and place visualization.',
    icon: 'i-lucide-box',
  },
  {
    title: 'Batch Processing',
    description: 'Enrich your entire BOM in one operation. Spark AI processes all components and lets you review suggestions before applying them.',
    icon: 'i-lucide-layers',
  },
]

const steps = [
  {
    step: '1',
    title: 'Import your BOM',
    description: 'Upload your bill of materials from Excel, CSV, or enter components manually.',
  },
  {
    step: '2',
    title: 'Run Spark AI',
    description: 'Click the Spark AI button to analyze your BOM. The AI processes each component and generates suggestions.',
  },
  {
    step: '3',
    title: 'Review and apply',
    description: 'Review AI suggestions for each component. Accept, modify, or skip individual recommendations.',
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
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs font-medium mb-6">
            <UIcon name="i-lucide-sparkles" class="size-3.5" />
            Pro &amp; Team Plans
          </div>
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Spark AI
          </h1>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            AI-powered BOM enrichment that fills in the gaps.
            Spark AI suggests manufacturer part numbers, standardizes descriptions, and classifies packages — so you can spend less time on data entry.
          </p>
          <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/pricing" size="lg" class="px-6">
              View Plans
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
            <img src="/images/docs/bom-groups-dark.png" alt="Spark AI enriching BOM components with part numbers and descriptions" class="hidden dark:block w-full">
            <img src="/images/docs/bom-groups-light.png" alt="Spark AI enriching BOM components with part numbers and descriptions" class="block dark:hidden w-full">
          </div>
        </div>
      </section>

      <!-- Capabilities -->
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

      <!-- How it works -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">How it works</h2>
          <div class="space-y-6">
            <div
              v-for="s in steps"
              :key="s.step"
              class="flex items-start gap-4"
            >
              <div class="w-8 h-8 rounded-full bg-[var(--ui-primary)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                {{ s.step }}
              </div>
              <div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ s.title }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ s.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Try Spark AI</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Available on Pro and Team plans. Enrich your BOM in seconds.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/pricing" size="lg" class="px-6">
              View Plans
            </UButton>
            <UButton to="/features/npi-suite" size="lg" color="neutral" variant="outline" class="px-6">
              Explore NPI Suite
            </UButton>
          </div>
        </div>
      </section>
    </main>

    <MarketingFooter />
  </div>
</template>

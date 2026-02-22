<script setup lang="ts">
useHead({
  title: 'Part Search — Live Component Pricing for PCB BOM | Gerbtrace',
  meta: [
    { name: 'description', content: 'Search electronic component pricing from global distributors. Compare quantity tiers from Farnell, TME, LCSC, Weltron, Anglia, and more. Estimate full PCB project costs including fabrication and assembly.' },
    { property: 'og:title', content: 'Part Search — Live Component Pricing for PCB BOM' },
    { property: 'og:description', content: 'Live distributor pricing for electronic components. Fetch prices from Farnell, TME, LCSC, and more directly into your BOM.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/pricing-table-light.png' },
  ],
})

useSchemaOrg([
  defineWebPage(),
])

const distributors = [
  'Farnell', 'TME', 'LCSC', 'Weltron', 'Anglia', 'Abacus',
]

const capabilities = [
  {
    title: 'Multi-Distributor Search',
    description: 'Fetch live pricing from multiple distributors in a single search. Compare offers side by side and pick the best supplier for each component.',
    icon: 'i-lucide-search',
  },
  {
    title: 'Quantity Tier Comparison',
    description: 'See price breaks across different order quantities. Understand how volume affects your BOM cost and find the optimal order size.',
    icon: 'i-lucide-bar-chart-3',
  },
  {
    title: 'BOM Cost Estimation',
    description: 'Get a complete project cost estimate combining component pricing, PCB fabrication, and assembly costs. Compare costs at different production volumes.',
    icon: 'i-lucide-calculator',
  },
  {
    title: 'Integrated Workflow',
    description: 'Pricing flows directly into your BOM. No copy-pasting between tools — search, compare, and assign pricing all within Gerbtrace.',
    icon: 'i-lucide-workflow',
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
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-6">
            <UIcon name="i-lucide-search" class="size-3.5" />
            Pro &amp; Team Plans
          </div>
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Part Search
          </h1>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Live component pricing from global electronic distributors.
            Search, compare, and estimate project costs — all without leaving your BOM.
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
        <div class="max-w-5xl mx-auto grid sm:grid-cols-2 gap-6">
          <div>
            <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
              <img src="/images/docs/bom-suppliers.png" alt="BOM with live distributor pricing from multiple suppliers" class="w-full">
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Multi-distributor pricing in BOM</p>
          </div>
          <div>
            <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
              <img src="/images/docs/pricing-table-dark.png" alt="Cost estimation with quantity tier breakdown" class="hidden dark:block w-full">
              <img src="/images/docs/pricing-table-light.png" alt="Cost estimation with quantity tier breakdown" class="block dark:hidden w-full">
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Cost estimation with quantity tiers</p>
          </div>
        </div>
      </section>

      <!-- Capabilities -->
      <section class="pb-20 px-4">
        <div class="max-w-5xl mx-auto">
          <div class="grid sm:grid-cols-2 gap-5">
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

      <!-- Distributors -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Supported Distributors</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-8">
            Powered by the Elexess API. Search across leading electronic component distributors.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <span
              v-for="dist in distributors"
              :key="dist"
              class="px-5 py-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {{ dist }}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Additional distributors are added regularly.
          </p>
        </div>
      </section>

      <!-- Cost estimation -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-4xl mx-auto">
          <div class="flex flex-col lg:flex-row gap-8 items-center">
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Full project cost estimation</h2>
              <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                Part Search doesn't just show component prices. Combined with board parameters and panel configuration,
                Gerbtrace estimates your total project cost per piece — including fabrication, assembly, BOM, and NRE/tooling.
              </p>
              <ul class="space-y-2">
                <li v-for="item in ['Component costs from distributor pricing', 'PCB fabrication based on board parameters', 'Assembly costs by component count and type', 'NRE and tooling costs shown separately', 'Multiple quantity tiers for volume comparison']" :key="item" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <UIcon name="i-lucide-check" class="text-green-500 shrink-0" />
                  {{ item }}
                </li>
              </ul>
            </div>
            <div class="flex-1 w-full">
              <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">Cost breakdown per piece</h3>
                <div class="space-y-3">
                  <div v-for="row in [
                    { label: 'BOM (components)', value: 'Live pricing' },
                    { label: 'PCB fabrication', value: 'Board params' },
                    { label: 'Assembly', value: 'Component count' },
                    { label: 'Markup', value: 'Configurable' },
                    { label: 'NRE / Tooling', value: 'One-time' },
                  ]" :key="row.label" class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">{{ row.label }}</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{{ row.value }}</span>
                  </div>
                  <div class="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-sm font-semibold">
                    <span class="text-gray-900 dark:text-white">Total per piece</span>
                    <span class="text-[var(--ui-primary)]">Calculated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-16 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Get live component pricing</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Available on Pro (1,000 searches/month) and Team (10,000 searches/month) plans.
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

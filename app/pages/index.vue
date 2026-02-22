<script setup lang="ts">
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

definePageMeta({
  middleware: 'home-redirect',
})

useHead({
  title: 'Gerbtrace — Free PCB Viewer & NPI Manufacturing Platform',
  meta: [
    { name: 'description', content: 'Free online Gerber viewer with PCB manufacturing data preparation. Import design files, manage BOMs, verify pick and place, configure panelization, and hand off to your factory.' },
    { property: 'og:title', content: 'Gerbtrace — Free PCB Viewer & NPI Manufacturing Platform' },
    { property: 'og:description', content: 'Free Gerber viewer, CAD/CAM data preparation, AI BOM enrichment, and component pricing — everything you need from design to factory floor.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/pcb-light.png' },
  ],
})

useSchemaOrg([
  defineWebSite({ name: 'Gerbtrace' }),
  defineWebPage(),
])

const isTauri = import.meta.client && coreIsTauri()
const { release } = useLatestRelease()

const features = [
  {
    title: 'Gerber Viewer',
    description: 'View, measure, and inspect PCB layouts directly in your browser. Layer management, realistic rendering, and multi-format support.',
    icon: 'i-lucide-eye',
    to: '/features/gerber-viewer',
  },
  {
    title: 'NPI Suite',
    description: 'Complete CAD/CAM data preparation. BOM management, pick and place verification, panelization, stencil configuration, and production handover.',
    icon: 'i-lucide-settings-2',
    to: '/features/npi-suite',
  },
  {
    title: 'Spark AI',
    description: 'AI-powered BOM enrichment that suggests manufacturer part numbers, standardizes descriptions, and classifies packages automatically.',
    icon: 'i-lucide-sparkles',
    to: '/features/spark-ai',
  },
  {
    title: 'Part Search',
    description: 'Live component pricing from global distributors. Compare quantity tiers and estimate full project costs in seconds.',
    icon: 'i-lucide-search',
    to: '/features/part-search',
  },
]

const workflow = [
  { step: '1', title: 'Import', description: 'Drag and drop your Gerber, Excellon, BOM, or pick and place files.' },
  { step: '2', title: 'Review', description: 'Inspect layers, measure distances, compare revisions side by side.' },
  { step: '3', title: 'Prepare', description: 'Enrich your BOM, configure panelization and paste, verify placement.' },
  { step: '4', title: 'Hand off', description: 'Export production-ready data and share with your manufacturing team.' },
]

const formats = [
  { name: 'Gerber RS-274X', ext: '.gbr / .ger' },
  { name: 'Excellon Drill', ext: '.drl / .exc' },
  { name: 'Pick and Place', ext: '.csv / .txt' },
  { name: 'Bill of Materials', ext: '.csv / .xlsx' },
  { name: 'PDF Drawings', ext: '.pdf' },
  { name: 'DXF Export', ext: '.dxf' },
]

const highlights = [
  {
    title: 'Realistic PCB rendering',
    description: 'See your board as it will look after manufacturing. Copper, soldermask, silkscreen, and drill layers rendered with realistic colors and materials.',
    darkImg: '/images/docs/pcb-realistic-dark.png',
    lightImg: '/images/docs/pcb-realistic-light.png',
    alt: 'Gerbtrace realistic PCB rendering',
  },
  {
    title: 'Side-by-side revision compare',
    description: 'Compare two Gerber file sets to catch changes between revisions. Overlay, diff, and side-by-side modes help you review what changed and why.',
    darkImg: '/images/docs/compare-side-by-side-dark.png',
    lightImg: '/images/docs/compare-side-by-side-light.png',
    alt: 'Gerbtrace PCB revision comparison',
  },
  {
    title: 'Component visualization',
    description: 'Import your pick and place file and see SMD and THT components placed on the board. Search, filter, and highlight individual parts to verify placement.',
    darkImg: '/images/docs/smd-highlight-dark.png',
    lightImg: '/images/docs/smd-highlight-light.png',
    alt: 'Gerbtrace component placement visualization',
  },
]
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1">
      <!-- ── Hero ──────────────────────────────────────────────────────── -->
      <section class="pt-20 pb-12 px-4">
        <div class="max-w-3xl mx-auto text-center">
          <UBadge color="primary" variant="subtle" size="md" class="mb-6">Free &amp; open-source PCB platform</UBadge>
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl leading-[1.15]">
            Everything you need from
            <span class="text-[var(--ui-primary)]">design to factory floor</span>
          </h1>
          <p class="mt-5 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Gerbtrace combines a powerful Gerber viewer with a full manufacturing data preparation suite.
            Import your design files, prepare production data, and hand off to your factory — all in one platform.
          </p>
          <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/dashboard" size="lg" class="px-6">
              Open Gerbtrace — It's Free
            </UButton>
            <UButton to="/pricing" size="lg" color="neutral" variant="outline" class="px-6">
              View Plans
            </UButton>
          </div>
        </div>
      </section>

      <!-- ── Hero screenshot ───────────────────────────────────────────── -->
      <section class="pb-20 px-4">
        <div class="max-w-5xl mx-auto">
          <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <img src="/images/docs/pcb-dark.png" alt="Gerbtrace PCB viewer and NPI platform" class="hidden dark:block w-full">
            <img src="/images/docs/pcb-light.png" alt="Gerbtrace PCB viewer and NPI platform" class="block dark:hidden w-full">
          </div>
        </div>
      </section>

      <!-- ── How it works ──────────────────────────────────────────────── -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto">
          <div class="text-center mb-14">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">How it works</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Go from raw design files to production-ready data in minutes, not hours.
            </p>
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div v-for="item in workflow" :key="item.step" class="text-center sm:text-left">
              <div class="inline-flex items-center justify-center size-10 rounded-full bg-[var(--ui-primary)]/10 text-[var(--ui-primary)] font-bold text-sm mb-4">
                {{ item.step }}
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1.5">{{ item.title }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Highlights (alternating image + text) ─────────────────────── -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto space-y-24">
          <div
            v-for="(item, idx) in highlights"
            :key="item.title"
            :class="['flex flex-col gap-10 items-center', idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse']"
          >
            <div class="lg:w-1/2 shrink-0">
              <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
                <img :src="item.darkImg" :alt="item.alt" class="hidden dark:block w-full">
                <img :src="item.lightImg" :alt="item.alt" class="block dark:hidden w-full">
              </div>
            </div>
            <div class="lg:w-1/2">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">{{ item.title }}</h3>
              <p class="text-gray-600 dark:text-gray-400 leading-relaxed">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Feature cards ─────────────────────────────────────────────── -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto">
          <div class="text-center mb-14">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Built for every step of NPI</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Whether you need a quick Gerber viewer or a full manufacturing data preparation workflow, Gerbtrace has you covered.
            </p>
          </div>
          <div class="grid sm:grid-cols-2 gap-6">
            <NuxtLink
              v-for="feature in features"
              :key="feature.to"
              :to="feature.to"
              class="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all"
            >
              <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 inline-block mb-4 group-hover:bg-[var(--ui-primary)]/10 transition-colors">
                <UIcon :name="feature.icon" class="text-2xl text-[var(--ui-primary)]" />
              </div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {{ feature.title }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                {{ feature.description }}
              </p>
              <span class="text-sm font-medium text-[var(--ui-primary)] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Learn more
                <UIcon name="i-lucide-arrow-right" class="size-4" />
              </span>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- ── Supported formats ─────────────────────────────────────────── -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto">
          <div class="text-center mb-14">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Works with your files</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Import directly from KiCad, Altium, Eagle, or any EDA tool that exports standard formats.
            </p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div
              v-for="fmt in formats"
              :key="fmt.name"
              class="text-center p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            >
              <div class="font-semibold text-sm text-gray-900 dark:text-white mb-1">{{ fmt.name }}</div>
              <div class="text-xs text-gray-500 font-mono">{{ fmt.ext }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Desktop app callout ───────────────────────────────────────── -->
      <section v-if="!isTauri && release" class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <div class="inline-flex items-center justify-center size-14 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-6">
            <UIcon name="i-lucide-monitor" class="text-2xl text-gray-700 dark:text-gray-300" />
          </div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl mb-3">Also available as a desktop app</h2>
          <p class="text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-8">
            Run Gerbtrace natively on macOS or Windows. Same features, offline access, and automatic updates.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <a
              v-if="release.macosUrl"
              :href="release.macosUrl"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all bg-white dark:bg-gray-900"
            >
              <UIcon name="i-lucide-apple" class="size-5" />
              Download for macOS
            </a>
            <a
              v-if="release.windowsExeUrl"
              :href="release.windowsExeUrl"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all bg-white dark:bg-gray-900"
            >
              <UIcon name="i-lucide-monitor" class="size-5" />
              Download for Windows
            </a>
          </div>
          <a
            v-if="release.releasePage"
            :href="release.releasePage"
            target="_blank"
            class="inline-block mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            v{{ release.version }} release notes
          </a>
        </div>
      </section>

      <!-- ── CTA ───────────────────────────────────────────────────────── -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl mb-3">Ready to get started?</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
            Start using Gerbtrace for free. No credit card required. View Gerber files in seconds or set up your full NPI workflow.
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

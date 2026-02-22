<script setup lang="ts">
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

useHead({
  title: 'Desktop App — Native PCB Viewer for macOS & Windows | Gerbtrace',
  meta: [
    { name: 'description', content: 'Download Gerbtrace for macOS and Windows. Native desktop PCB viewer with offline access, automatic updates, and the full NPI manufacturing suite. Built with Tauri.' },
    { property: 'og:title', content: 'Desktop App — Native PCB Viewer for macOS & Windows | Gerbtrace' },
    { property: 'og:description', content: 'Run Gerbtrace natively on your desktop. Same powerful Gerber viewer and NPI suite, with offline access, drag-and-drop file import, and automatic updates.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/pcb-light.png' },
  ],
})

useSchemaOrg([
  defineWebPage(),
])

const isTauri = import.meta.client && coreIsTauri()
const { release } = useLatestRelease()

const capabilities = [
  {
    title: 'Offline Access',
    description: 'Work without an internet connection. View Gerber files, manage BOMs, and prepare manufacturing data entirely offline.',
    icon: 'i-lucide-wifi-off',
  },
  {
    title: 'Automatic Updates',
    description: 'Gerbtrace checks for updates on launch and installs them in the background. Always stay on the latest version without manual downloads.',
    icon: 'i-lucide-refresh-cw',
  },
  {
    title: 'Native Performance',
    description: 'Built with Tauri for a lightweight, fast experience. Uses your system\'s native webview — no Electron bloat, minimal memory footprint.',
    icon: 'i-lucide-zap',
  },
  {
    title: 'Drag and Drop',
    description: 'Drop Gerber files, ZIPs, BOMs, and pick-and-place data directly onto the app window. File type detection is automatic.',
    icon: 'i-lucide-mouse-pointer-click',
  },
  {
    title: 'System Integration',
    description: 'Respects your system theme (dark/light mode), native window controls, and keyboard shortcuts you\'re used to.',
    icon: 'i-lucide-monitor',
  },
  {
    title: 'Full Feature Parity',
    description: 'Every feature available on the web — Gerber viewer, compare, NPI suite, Spark AI, part search, and team collaboration — works in the desktop app.',
    icon: 'i-lucide-check-circle',
  },
]

const platforms = [
  {
    name: 'macOS',
    icon: 'i-lucide-apple',
    format: '.dmg installer',
    requirements: 'macOS 11 (Big Sur) or later',
    key: 'macosUrl' as const,
  },
  {
    name: 'Windows',
    icon: 'i-lucide-monitor',
    format: '.exe installer',
    requirements: 'Windows 10 or later',
    key: 'windowsExeUrl' as const,
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
            <UIcon name="i-lucide-download" class="size-3.5" />
            Free download
          </div>
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Desktop App
          </h1>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Run Gerbtrace natively on macOS and Windows.
            Same powerful Gerber viewer and manufacturing prep suite, with offline access and automatic updates.
          </p>
          <div v-if="!isTauri && release" class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <UButton
              v-if="release.macosUrl"
              :href="release.macosUrl"
              tag="a"
              size="lg"
              icon="i-lucide-apple"
              class="px-6"
            >
              Download for macOS
            </UButton>
            <UButton
              v-if="release.windowsExeUrl"
              :href="release.windowsExeUrl"
              tag="a"
              size="lg"
              icon="i-lucide-monitor"
              :color="release.macosUrl ? 'neutral' : 'primary'"
              :variant="release.macosUrl ? 'outline' : 'solid'"
              class="px-6"
            >
              Download for Windows
            </UButton>
          </div>
          <div v-if="isTauri" class="mt-8">
            <UButton to="/dashboard" size="lg" icon="i-lucide-layout-dashboard" class="px-6">
              Open Dashboard
            </UButton>
          </div>
          <p v-if="release" class="mt-3 text-xs text-gray-400">
            Latest version: v{{ release.version }}
            <a v-if="release.releasePage" :href="release.releasePage" target="_blank" class="underline hover:text-gray-600 dark:hover:text-gray-300 ml-1">Release notes</a>
          </p>
        </div>
      </section>

      <!-- Hero screenshot -->
      <section class="pb-12 px-4">
        <div class="max-w-5xl mx-auto">
          <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <img src="/images/docs/pcb-dark.png" alt="Gerbtrace desktop app showing PCB viewer" class="hidden dark:block w-full">
            <img src="/images/docs/pcb-light.png" alt="Gerbtrace desktop app showing PCB viewer" class="block dark:hidden w-full">
          </div>
        </div>
      </section>

      <!-- Why desktop -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto">
          <div class="text-center mb-14">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Why the desktop app?</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Gerbtrace works great in the browser. The desktop app adds offline access, native performance, and system-level integration.
            </p>
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="cap in capabilities"
              :key="cap.title"
              class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
            >
              <div class="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 inline-block mb-4">
                <UIcon :name="cap.icon" class="text-xl text-[var(--ui-primary)]" />
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1.5">{{ cap.title }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ cap.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Visual highlights -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto">
          <div class="flex flex-col lg:flex-row gap-10 items-center">
            <div class="lg:w-1/2 shrink-0">
              <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
                <img src="/images/docs/smd-highlight-dark.png" alt="Component visualization in Gerbtrace desktop app" class="hidden dark:block w-full">
                <img src="/images/docs/smd-highlight-light.png" alt="Component visualization in Gerbtrace desktop app" class="block dark:hidden w-full">
              </div>
            </div>
            <div class="lg:w-1/2 space-y-4">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">The full NPI suite, on your desktop</h3>
              <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
                Every feature from the web version is available offline. Import Gerber files, enrich your BOM with Spark AI,
                verify component placement, configure panelization, and export production data — all without a browser tab.
              </p>
              <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="size-4 text-green-500 mt-0.5 shrink-0" />
                  Gerber viewer with layer management and measurement
                </li>
                <li class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="size-4 text-green-500 mt-0.5 shrink-0" />
                  Side-by-side revision comparison
                </li>
                <li class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="size-4 text-green-500 mt-0.5 shrink-0" />
                  BOM management and AI enrichment
                </li>
                <li class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="size-4 text-green-500 mt-0.5 shrink-0" />
                  Pick and place visualization
                </li>
                <li class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="size-4 text-green-500 mt-0.5 shrink-0" />
                  Panelization and paste configuration
                </li>
                <li class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="size-4 text-green-500 mt-0.5 shrink-0" />
                  Team collaboration and shared spaces
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Platform downloads -->
      <section v-if="!isTauri" class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto">
          <div class="text-center mb-14">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Download</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400">
              Free to download. Free to use. No account required to get started.
            </p>
          </div>
          <div class="grid sm:grid-cols-2 gap-6">
            <div
              v-for="platform in platforms"
              :key="platform.name"
              class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center"
            >
              <div class="inline-flex items-center justify-center size-14 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-5">
                <UIcon :name="platform.icon" class="text-2xl text-gray-700 dark:text-gray-300" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ platform.name }}</h3>
              <p class="text-xs text-gray-500 mb-1">{{ platform.format }}</p>
              <p class="text-xs text-gray-400 mb-6">{{ platform.requirements }}</p>
              <UButton
                v-if="release?.[platform.key]"
                :href="release[platform.key]!"
                tag="a"
                block
                size="lg"
              >
                Download for {{ platform.name }}
              </UButton>
              <p v-else class="text-sm text-gray-400">Loading release info...</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Built with Tauri -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl mb-3">Built with Tauri</h2>
          <p class="text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6">
            Gerbtrace uses <a href="https://tauri.app" target="_blank" class="text-[var(--ui-primary)] hover:underline">Tauri</a>
            to deliver a native desktop experience. Unlike Electron apps, Tauri uses your system's built-in webview,
            resulting in a much smaller download size and lower resource usage.
          </p>
          <div class="inline-flex items-center gap-8 text-sm text-gray-500">
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-white">~8 MB</div>
              <div class="text-xs">Download size</div>
            </div>
            <div class="w-px h-10 bg-gray-200 dark:bg-gray-800" />
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-white">~50 MB</div>
              <div class="text-xs">Memory usage</div>
            </div>
            <div class="w-px h-10 bg-gray-200 dark:bg-gray-800" />
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-white">&lt;2s</div>
              <div class="text-xs">Launch time</div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-20 px-4 border-t border-gray-200 dark:border-gray-800">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl mb-3">Try it now</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
            Don't want to download? Use Gerbtrace directly in your browser — same features, zero setup.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton to="/dashboard" size="lg" class="px-6">
              Open in Browser
            </UButton>
            <UButton to="/" size="lg" color="neutral" variant="ghost" class="px-6">
              All Features
            </UButton>
          </div>
        </div>
      </section>
    </main>

    <MarketingFooter />
  </div>
</template>

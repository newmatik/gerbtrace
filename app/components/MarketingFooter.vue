<template>
  <footer class="py-8 border-t border-gray-200 dark:border-gray-800 mt-10 bg-white dark:bg-gray-950">
    <div class="max-w-7xl mx-auto px-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <!-- Brand -->
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <a href="https://www.newmatik.com" target="_blank" class="font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Gerbtrace by Newmatik</a>
          <span class="opacity-30">&bull;</span>
          <span>v{{ appVersion }}</span>
        </div>

        <!-- Nav links -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <NuxtLink to="/" class="hover:text-gray-900 dark:hover:text-white transition-colors">Home</NuxtLink>
          <NuxtLink to="/pricing" class="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</NuxtLink>
          <button class="hover:text-gray-900 dark:hover:text-white transition-colors" @click="openDocs()">Docs</button>
          <a v-if="release?.releasePage" :href="release.releasePage" target="_blank" class="hover:text-gray-900 dark:hover:text-white transition-colors">Releases</a>
          <template v-if="!isTauri && release">
            <a v-if="release.macosUrl" :href="release.macosUrl" class="hover:text-gray-900 dark:hover:text-white transition-colors">macOS</a>
            <a v-if="release.windowsExeUrl" :href="release.windowsExeUrl" class="hover:text-gray-900 dark:hover:text-white transition-colors">Windows</a>
          </template>
          <span class="opacity-30">&bull;</span>
          <NuxtLink to="/privacy" class="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</NuxtLink>
          <NuxtLink to="/terms" class="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

const { openDocs } = useDocsLink()
const { release } = useLatestRelease()
const isTauri = import.meta.client && coreIsTauri()
const appVersion = useRuntimeConfig().public.appVersion as string
</script>

<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

const { data: navigation } = await useAsyncData('docs-navigation', () => queryCollectionNavigation('docs'))
const { data: searchFiles } = useLazyAsyncData('docs-search', () => queryCollectionSearchSections('docs'), {
  server: false,
})

provide('navigation', navigation)
provide('docs-search-files', searchFiles)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-neutral-900">
    <div class="sticky top-0 z-10 shrink-0 bg-white dark:bg-neutral-900">
      <AppHeader>
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <NuxtLink to="/docs" class="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
          Docs
        </NuxtLink>
      </AppHeader>
    </div>

    <UContainer class="flex-1">
      <UPage
        :ui="{
          root: 'flex flex-col lg:grid lg:grid-cols-12 lg:gap-8',
          left: 'lg:col-span-3',
          center: 'lg:col-span-9',
        }"
      >
        <template #left>
          <UPageAside>
            <UContentSearchButton :collapsed="false" block class="mb-4" />

            <UContentNavigation
              highlight
              :navigation="navigation"
              :ui="{
                linkTitle: '',
                listWithChildren: 'ms-3 border-s border-default',
              }"
            />
          </UPageAside>
        </template>

        <slot />
      </UPage>
    </UContainer>

    <footer class="border-t border-neutral-200 dark:border-neutral-800">
      <UContainer>
        <div class="flex items-center justify-between py-4 text-sm text-neutral-500 dark:text-neutral-400">
          <span>Built with <a href="https://ui.nuxt.com" target="_blank" class="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Nuxt UI</a></span>
          <span>&copy; {{ new Date().getFullYear() }} Newmatik GmbH</span>
        </div>
      </UContainer>
    </footer>

    <ClientOnly>
      <LazyUContentSearch
        :files="searchFiles"
        :navigation="navigation"
      />
    </ClientOnly>
  </div>
</template>

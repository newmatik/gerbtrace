<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { findPageHeadline } from '@nuxt/content/utils'

definePageMeta({
  layout: 'docs',
})

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')
const DOCS_RESOLVE_RETRIES = 5
const DOCS_RESOLVE_RETRY_DELAY_MS = 150

async function loadDocsHome() {
  const candidates = ['/docs', '/docs/', '/docs/index', '/index', '/', 'docs', 'docs/index', 'index']
  for (const candidate of candidates) {
    const doc = await queryCollection('docs').path(candidate).first()
    if (doc) return doc
    const byStem = await queryCollection('docs').where('stem', '=', candidate).first()
    if (byStem) return byStem
  }
  return null
}

async function loadDocsHomeWithRetry() {
  for (let attempt = 0; attempt < DOCS_RESOLVE_RETRIES; attempt++) {
    const doc = await loadDocsHome()
    if (doc) return doc
    if (attempt < DOCS_RESOLVE_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, DOCS_RESOLVE_RETRY_DELAY_MS))
    }
  }
  return null
}

const { data: page, refresh: refreshPage } = await useAsyncData('docs-home', loadDocsHomeWithRetry)

const surround = ref([])

const title = computed(() => page.value?.seo?.title || page.value?.title || 'Gerbtrace Docs')
const description = computed(() => page.value?.seo?.description || page.value?.description || 'Gerbtrace documentation')

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description,
})

const headline = computed(() => findPageHeadline(navigation?.value, page.value?.path))

const safePage = computed(() => {
  const value = page.value as any
  if (!value) return value
  if (!value.body || typeof value.body !== 'object') return value
  if (!value.body.tags || typeof value.body.tags !== 'object') {
    value.body.tags = {}
  }
  return value
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :headline="headline"
    />

    <UPageBody>
      <ContentRenderer
        v-if="safePage"
        class="docs-page-content"
        :value="safePage"
      />

      <USeparator v-if="surround?.length" />

      <UContentSurround :surround="surround" />
    </UPageBody>

    <template
      v-if="page?.body?.toc?.links?.length"
      #right
    >
      <UContentToc
        title="Table of Contents"
        :links="page.body?.toc?.links"
      />
    </template>
  </UPage>

  <UPage v-else>
    <UPageBody>
      <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-neutral-600 dark:text-neutral-300">
        Docs are still loading. If this page was opened right after a dev restart, try once more.
        <UButton class="ml-2" size="xs" variant="soft" color="neutral" @click="refreshPage()">
          Retry
        </UButton>
      </div>
    </UPageBody>
  </UPage>
</template>

<style scoped>
:deep(.docs-page-content > h1:first-child) {
  display: none;
}
</style>

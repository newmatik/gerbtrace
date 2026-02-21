<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { findPageHeadline } from '@nuxt/content/utils'

definePageMeta({
  layout: 'docs',
})

const route = useRoute()
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')
const DOCS_RESOLVE_RETRIES = 5
const DOCS_RESOLVE_RETRY_DELAY_MS = 150

async function loadDoc(path: string) {
  const trimmed = path.replace(/\/+$/, '')
  const stripped = trimmed.replace(/^\/docs/, '') || '/index'
  const stem = stripped.replace(/^\//, '')
  const stemWithDocs = `docs/${stem}`
  const candidates = Array.from(new Set([
    trimmed || '/docs',
    '/docs/',
    path,
    stripped,
    trimmed === '/docs' ? '/docs/index' : trimmed,
    stripped === '/index' ? '/' : stripped,
    stem,
    stemWithDocs,
    `/${stemWithDocs}`,
  ]))

  for (const candidate of candidates) {
    const byPath = await queryCollection('docs').path(candidate).first()
    if (byPath) return byPath
    const byStem = await queryCollection('docs').where('stem', '=', candidate).first()
    if (byStem) return byStem
  }

  return null
}

async function loadDocWithRetry(path: string) {
  for (let attempt = 0; attempt < DOCS_RESOLVE_RETRIES; attempt++) {
    const doc = await loadDoc(path)
    if (doc) return doc
    if (attempt < DOCS_RESOLVE_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, DOCS_RESOLVE_RETRY_DELAY_MS))
    }
  }
  return null
}

const { data: page } = await useAsyncData(route.path, () => loadDocWithRetry(route.path))
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const docPath = computed(() => page.value?.path || route.path)

const { data: surround } = await useAsyncData(`${route.path}-surround`, () => {
  return queryCollectionItemSurroundings('docs', docPath.value, {
    fields: ['description'],
  })
})

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
</template>

<style scoped>
:deep(.docs-page-content > h1:first-child) {
  display: none;
}
</style>

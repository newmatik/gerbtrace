<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-6">
      <div class="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <aside class="lg:sticky lg:top-4 self-start rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
          <div class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">
            Documentation
          </div>
          <div class="mb-2">
            <UInput
              v-model="searchQuery"
              size="xs"
              icon="i-lucide-search"
              placeholder="Search docs..."
            />
          </div>
          <div
            v-if="searchQuery.trim()"
            class="mb-3 rounded-md border border-neutral-200 dark:border-neutral-800 max-h-64 overflow-auto"
          >
            <NuxtLink
              v-for="item in filteredSearchResults"
              :key="`search-${item.path}`"
              :to="item.path"
              class="block px-2 py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <div class="text-xs font-medium text-neutral-800 dark:text-neutral-100 truncate">
                {{ item.title }}
              </div>
              <div class="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                {{ item.description || item.path }}
              </div>
            </NuxtLink>
            <div v-if="filteredSearchResults.length === 0" class="px-2 py-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              No matching docs.
            </div>
          </div>
          <nav class="space-y-1">
            <NuxtLink
              v-for="item in docsNav"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
              :class="isActive(item.to)
                ? 'bg-primary/10 text-primary'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
            >
              <UIcon :name="item.icon" class="text-[11px] shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </NuxtLink>
          </nav>
        </aside>

        <section class="min-w-0 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-6">
          <ContentRenderer v-if="doc" :value="doc" />
          <div v-else class="py-10 text-center">
            <h1 class="text-lg font-semibold text-neutral-900 dark:text-white">Document not found</h1>
            <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              This doc page does not exist yet.
            </p>
            <NuxtLink to="/docs" class="mt-3 inline-flex text-sm text-primary hover:underline">
              Go to docs home
            </NuxtLink>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  path: string
}>()

const route = useRoute()
const searchQuery = ref('')
const normalizedPath = computed(() => props.path.replace(/\/+$/, '') || '/docs/index')

interface DocSearchItem {
  title: string
  description?: string
  path: string
  stem?: string
}

async function loadDoc(path: string) {
  const stripped = path.replace(/^\/docs/, '') || '/index'
  const stem = stripped.replace(/^\//, '')
  const stemWithDocs = `docs/${stem}`
  const candidates = Array.from(new Set([
    path,
    stripped,
    path === '/docs/index' ? '/docs' : path,
    stripped === '/index' ? '/' : stripped,
    stem,
    stemWithDocs,
  ]))

  const collections = ['docs', 'content']
  for (const collection of collections) {
    for (const candidate of candidates) {
      const byPath = await queryCollection(collection).path(candidate).first()
      if (byPath) return byPath
      const byStem = await queryCollection(collection).where('stem', '=', candidate).first()
      if (byStem) return byStem
    }
  }
  return null
}

async function loadDocsIndex(): Promise<DocSearchItem[]> {
  const collections = ['docs', 'content']
  for (const collection of collections) {
    const list = await queryCollection(collection)
      .select('title', 'description', 'path', 'stem')
      .all() as DocSearchItem[]
    if (Array.isArray(list) && list.length > 0) {
      return list
        .filter(item => typeof item?.path === 'string' && item.path.startsWith('/docs'))
        .sort((a, b) => {
          if (a.path === '/docs') return -1
          if (b.path === '/docs') return 1
          return a.path.localeCompare(b.path)
        })
    }
  }
  return []
}

const { data: doc } = await useAsyncData(
  () => `docs:${normalizedPath.value}`,
  () => loadDoc(normalizedPath.value),
  { watch: [normalizedPath] },
)
const { data: docsIndex } = await useAsyncData('docs:index', loadDocsIndex)

const docsNav = computed(() => {
  const fallback = [
    { label: 'Overview', to: '/docs', icon: 'i-lucide-book-open' },
  ]
  const entries = docsIndex.value ?? []
  if (entries.length === 0) return fallback
  return entries.map((entry, idx) => ({
    label: entry.title || entry.path.replace('/docs/', ''),
    to: entry.path,
    icon: idx === 0 ? 'i-lucide-book-open' : 'i-lucide-file-text',
  }))
})

const filteredSearchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  const source = docsIndex.value ?? []
  return source
    .filter((entry) => {
      const haystack = [entry.title, entry.description, entry.path, entry.stem].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
    .slice(0, 12)
})

function isActive(to: string): boolean {
  return route.path === to
}
</script>

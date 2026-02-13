<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-5xl mx-auto">
        <div class="flex items-center justify-center gap-3 mb-3">
          <img
            :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
            alt="Gerbtrace"
            class="size-10 rounded-lg"
          >
          <h1 class="text-4xl font-bold">Gerbtrace</h1>
        </div>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-8 text-center">
          View and compare Gerber PCB files.
        </p>

        <div class="mb-10">
          <div class="flex justify-center gap-3">
            <UButton size="lg" icon="i-lucide-eye" @click="createProject('viewer')">
              New Viewer Project
            </UButton>
            <UButton size="lg" icon="i-lucide-columns-2" variant="outline" @click="createProject('compare')">
              New Compare Project
            </UButton>
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>Try an example:</span>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-eye" @click="loadSample('viewer')">
              View Arduino UNO
            </UButton>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-columns-2" @click="loadSample('compare')">
              Compare UNO Revisions
            </UButton>
          </div>
        </div>

        <section class="mb-10">
          <div class="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 class="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Your Projects</h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ filteredProjects.length }} project{{ filteredProjects.length === 1 ? '' : 's' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UInput
                v-model="query"
                size="sm"
                placeholder="Search projects..."
                icon="i-lucide-search"
                class="w-64"
              />
              <USelect
                v-model="modeFilter"
                size="sm"
                :items="modeOptions"
                value-key="value"
                label-key="label"
                class="w-36"
              />
            </div>
          </div>

          <div v-if="filteredProjects.length" class="space-y-2">
            <ProjectCard
              v-for="project in filteredProjects"
              :key="project.id"
              :project="project"
              @open="openProject"
              @request-delete="confirmDelete"
            />
          </div>

          <div v-else class="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No projects found.
          </div>
        </section>

        <!-- Desktop app download (only in browser, not in Tauri) -->
        <div v-if="!isTauri && release" class="pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-center gap-2 text-xs text-neutral-400 dark:text-neutral-500 mb-3">
            <UIcon name="i-lucide-download" class="text-sm" />
            <span>Download the desktop app</span>
          </div>
          <div class="flex items-center justify-center gap-3">
            <a
              v-if="release.macosUrl"
              :href="release.macosUrl"
              class="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs transition-colors border border-neutral-200 dark:border-neutral-700 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary text-neutral-600 dark:text-neutral-400"
              :class="platform === 'macos' ? 'border-primary/40 text-primary font-medium' : ''"
            >
              <UIcon name="i-lucide-apple" class="text-base" />
              <span>macOS</span>
              <span class="text-neutral-400 dark:text-neutral-500 font-normal">.dmg</span>
            </a>
            <a
              v-if="release.windowsExeUrl"
              :href="release.windowsExeUrl"
              class="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs transition-colors border border-neutral-200 dark:border-neutral-700 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary text-neutral-600 dark:text-neutral-400"
              :class="platform === 'windows' ? 'border-primary/40 text-primary font-medium' : ''"
            >
              <UIcon name="i-lucide-monitor" class="text-base" />
              <span>Windows</span>
              <span class="text-neutral-400 dark:text-neutral-500 font-normal">.exe</span>
            </a>
          </div>
          <div class="text-center mt-2">
            <a
              :href="release.releasePage"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              v{{ release.version }} release notes
            </a>
          </div>
        </div>
      </div>
    </main>

    <footer class="py-4 px-4 flex items-center justify-center gap-3 text-[11px] text-neutral-400 dark:text-neutral-500">
      <span class="font-mono">v{{ appVersion }}</span>
      <span class="opacity-30">|</span>
      <button class="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" @click="aboutOpen = true">
        About
      </button>
    </footer>

    <AppAboutModal v-model:open="aboutOpen" />

    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Delete project?</h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                This will permanently remove the project and its files.
              </p>
            </div>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="deleteModalOpen = false" />
          </div>

          <div v-if="projectToDelete" class="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
            <div class="text-sm font-medium text-neutral-900 dark:text-white">{{ projectToDelete.name }}</div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {{ projectToDelete.mode === 'viewer' ? 'Viewer' : 'Compare' }} • Updated {{ formatDate(projectToDelete.updatedAt) }}
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton size="sm" variant="outline" color="neutral" @click="deleteModalOpen = false">Cancel</UButton>
            <UButton size="sm" color="error" icon="i-lucide-trash-2" @click="performDelete">
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { projects, createNewProject, removeProject } = useProject()
const { loadSampleProject } = useSampleProject()
const { release, platform } = useLatestRelease()
const isTauri = import.meta.client && !!(window as any).__TAURI_INTERNALS__
const appVersion = useRuntimeConfig().public.appVersion as string
const aboutOpen = ref(false)

const query = ref('')
const modeFilter = ref<'all' | 'viewer' | 'compare'>('all')
const modeOptions = [
  { label: 'All', value: 'all' },
  { label: 'Viewer', value: 'viewer' },
  { label: 'Compare', value: 'compare' },
]

const filteredProjects = computed(() => {
  const q = query.value.trim().toLowerCase()
  return projects.value.filter(p => {
    const matchesMode = modeFilter.value === 'all' ? true : p.mode === modeFilter.value
    const matchesQuery = !q ? true : p.name.toLowerCase().includes(q)
    return matchesMode && matchesQuery
  })
})

const deleteModalOpen = ref(false)
const projectToDelete = ref<any>(null)

async function createProject(mode: 'viewer' | 'compare') {
  const project = await createNewProject(mode)
  openProject(project)
}

function openProject(project: { id?: number; mode: string }) {
  if (!project.id) return
  router.push(`/${project.mode}/${project.id}`)
}

function confirmDelete(project: any) {
  projectToDelete.value = project
  deleteModalOpen.value = true
}

async function performDelete() {
  const p = projectToDelete.value
  if (!p?.id) return
  await removeProject(p.id)
  deleteModalOpen.value = false
  projectToDelete.value = null
}

async function loadSample(mode: 'viewer' | 'compare') {
  const project = await loadSampleProject(mode)
  if (project?.id) {
    router.push(`/${mode}/${project.id}`)
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

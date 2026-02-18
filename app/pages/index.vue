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

        <!-- ── Search & Filter ─────────────────────────────────────────── -->
        <div v-if="hasAnyProjects" class="flex items-center gap-2 mb-6">
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
          <USelect
            v-if="isAuthenticated && hasTeam"
            v-model="assigneeFilter"
            size="sm"
            :items="assigneeFilterOptions"
            value-key="value"
            label-key="label"
            class="w-52"
          />
        </div>

        <!-- ── Team Projects (when logged in with team) ────────────────── -->
        <section v-if="isAuthenticated && hasTeam" class="mb-10">
          <div class="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 class="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                {{ currentTeam?.name ?? 'Team' }} Projects
              </h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ filteredTeamProjects.length }} project{{ filteredTeamProjects.length === 1 ? '' : 's' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                v-if="isEditor"
                size="sm"
                icon="i-lucide-plus"
                @click="createTeamProject('viewer')"
              >
                New Team Project
              </UButton>
            </div>
          </div>

          <div v-if="teamProjectsLoading" class="text-center py-6 text-sm text-neutral-400">
            Loading team projects...
          </div>

          <div v-else-if="filteredTeamProjects.length" class="space-y-2">
            <div
              v-for="project in filteredTeamProjects"
              :key="project.id"
              class="group flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
              @click="openTeamProject(project)"
            >
              <UIcon
                :name="project.mode === 'viewer' ? 'i-lucide-eye' : 'i-lucide-columns-2'"
                class="text-lg text-neutral-400 shrink-0"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ project.name }}</div>
                <div class="text-xs text-neutral-400 mt-0.5">
                  Updated {{ formatDate(project.updated_at) }}
                </div>
              </div>
              <UBadge
                :color="project.status === 'approved' ? 'success' : 'warning'"
                size="xs"
                variant="subtle"
              >
                <UIcon
                  v-if="project.status === 'approved'"
                  name="i-lucide-lock"
                  class="text-xs mr-0.5"
                />
                {{ project.status === 'approved' ? 'Approved' : 'Draft' }}
              </UBadge>
              <UBadge size="xs" variant="subtle" color="neutral">
                {{ project.mode }}
              </UBadge>
              <div class="min-w-[170px]" @click.stop>
                <USelect
                  v-if="isEditor"
                  :model-value="project.assignee_user_id ?? ASSIGNEE_UNASSIGNED"
                  size="xs"
                  :items="assigneeOptions"
                  value-key="value"
                  label-key="label"
                  :disabled="isAssigning(project.id)"
                  @update:model-value="(value: string) => updateProjectAssignee(project, value)"
                />
                <UBadge v-else size="xs" variant="subtle" color="neutral">
                  {{ getAssigneeLabel(project.assignee_user_id) }}
                </UBadge>
              </div>
              <UButton
                v-if="isAdmin"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click.stop="confirmDeleteTeamProject(project)"
              />
            </div>
          </div>

          <div v-else class="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {{ teamProjects.length ? 'No team projects found.' : 'No team projects yet. Create one to start collaborating.' }}
          </div>
        </section>

        <!-- ── Create/Join Team prompt (logged in, no team) ────────────── -->
        <section v-if="isAuthenticated && !hasTeam && teamsLoaded" class="mb-10">
          <div class="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
            <UIcon name="i-lucide-users" class="text-2xl text-primary mb-2" />
            <h3 class="text-sm font-semibold mb-1">Collaborate with your team</h3>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Create a team to share projects and packages with colleagues.
            </p>
            <UButton size="sm" to="/team/create" icon="i-lucide-plus">
              Create a Team
            </UButton>
          </div>
        </section>

        <!-- ── Personal Projects (local) ───────────────────────────────── -->
        <section class="mb-10">
          <div class="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 class="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                {{ isAuthenticated ? 'Personal Projects' : 'Your Projects' }}
              </h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ filteredProjects.length }} project{{ filteredProjects.length === 1 ? '' : 's' }}
              </p>
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

    <!-- Team project delete confirmation modal -->
    <UModal v-model:open="teamDeleteModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Delete team project?</h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                This will permanently remove the project and all its files for the entire team.
              </p>
            </div>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="teamDeleteModalOpen = false" />
          </div>

          <div v-if="teamProjectToDelete" class="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
            <div class="text-sm font-medium text-neutral-900 dark:text-white">{{ teamProjectToDelete.name }}</div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {{ teamProjectToDelete.mode === 'viewer' ? 'Viewer' : 'Compare' }} •
              {{ teamProjectToDelete.status === 'approved' ? 'Approved' : 'Draft' }} •
              Updated {{ formatDate(teamProjectToDelete.updated_at) }}
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton size="sm" variant="outline" color="neutral" @click="teamDeleteModalOpen = false">Cancel</UButton>
            <UButton size="sm" color="error" icon="i-lucide-trash-2" :loading="teamDeleteLoading" @click="performDeleteTeamProject">
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

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
import { useColorMode } from '#imports'
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { projects, createNewProject, removeProject } = useProject()
const { loadSampleProject } = useSampleProject()
const { release, platform } = useLatestRelease()
const isTauri = import.meta.client && coreIsTauri()
const appVersion = useRuntimeConfig().public.appVersion as string
const aboutOpen = ref(false)

// Auth and team state
const { isAuthenticated } = useAuth()
const { currentTeam, hasTeam, isEditor, isAdmin, teamsLoaded } = useTeam()
const { members } = useTeamMembers()
const { projects: teamProjects, projectsLoading: teamProjectsLoading, createProject: createTeamProjectFn, updateProject: updateTeamProjectFn, deleteProject: deleteTeamProjectFn } = useTeamProjects()

const query = ref('')
const modeFilter = ref<'all' | 'viewer' | 'compare'>('all')
const modeOptions = [
  { label: 'All', value: 'all' },
  { label: 'Viewer', value: 'viewer' },
  { label: 'Compare', value: 'compare' },
]
const ASSIGNEE_ALL = '__all__'
const ASSIGNEE_UNASSIGNED = '__unassigned__'
const assigneeFilter = ref<string>(ASSIGNEE_ALL)
const assigningByProjectId = ref<Record<string, boolean>>({})

const assignableMembers = computed(() => {
  return members.value.filter(m => m.status === 'active' && (m.role === 'admin' || m.role === 'editor'))
})

const assigneeFilterOptions = computed(() => {
  return [
    { label: 'All assignees', value: ASSIGNEE_ALL },
    { label: 'Unassigned', value: ASSIGNEE_UNASSIGNED },
    ...assignableMembers.value.map(member => ({
      label: member.profile?.name?.trim() || member.profile?.email || 'Unnamed member',
      value: member.user_id,
    })),
  ]
})

const assigneeOptions = computed(() => {
  return [
    { label: 'Unassigned', value: ASSIGNEE_UNASSIGNED },
    ...assignableMembers.value.map(member => ({
      label: member.profile?.name?.trim() || member.profile?.email || 'Unnamed member',
      value: member.user_id,
    })),
  ]
})

const hasAnyProjects = computed(() => projects.value.length > 0 || teamProjects.value.length > 0)

const filteredTeamProjects = computed(() => {
  const q = query.value.trim().toLowerCase()
  return teamProjects.value.filter(p => {
    const matchesMode = modeFilter.value === 'all' ? true : p.mode === modeFilter.value
    const matchesQuery = !q ? true : p.name.toLowerCase().includes(q)
    const matchesAssignee = assigneeFilter.value === ASSIGNEE_ALL
      ? true
      : assigneeFilter.value === ASSIGNEE_UNASSIGNED
        ? !p.assignee_user_id
        : p.assignee_user_id === assigneeFilter.value
    return matchesMode && matchesQuery && matchesAssignee
  })
})

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

async function createTeamProject(mode: 'viewer' | 'compare') {
  const { project } = await createTeamProjectFn(mode)
  if (project) {
    router.push(`/${mode}/team-${project.id}`)
  }
}

function getAssigneeLabel(assigneeUserId: string | null) {
  if (!assigneeUserId) return 'Unassigned'
  const member = assignableMembers.value.find(m => m.user_id === assigneeUserId)
  return member?.profile?.name?.trim() || member?.profile?.email || 'Former member'
}

function isAssigning(projectId: string) {
  return Boolean(assigningByProjectId.value[projectId])
}

async function updateProjectAssignee(project: { id: string; assignee_user_id: string | null }, assigneeValue: string) {
  if (!isEditor.value || isAssigning(project.id)) return

  const nextAssigneeUserId = assigneeValue === ASSIGNEE_UNASSIGNED ? null : assigneeValue
  if (nextAssigneeUserId === project.assignee_user_id) return

  assigningByProjectId.value = { ...assigningByProjectId.value, [project.id]: true }
  try {
    await updateTeamProjectFn(project.id, { assignee_user_id: nextAssigneeUserId })
  } finally {
    const next = { ...assigningByProjectId.value }
    delete next[project.id]
    assigningByProjectId.value = next
  }
}

function openProject(project: { id?: number; mode: string }) {
  if (!project.id) return
  router.push(`/${project.mode}/${project.id}`)
}

function openTeamProject(project: { id: string; mode: string }) {
  router.push(`/${project.mode}/team-${project.id}`)
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

// Team project deletion
const teamDeleteModalOpen = ref(false)
const teamProjectToDelete = ref<any>(null)
const teamDeleteLoading = ref(false)

function confirmDeleteTeamProject(project: any) {
  teamProjectToDelete.value = project
  teamDeleteModalOpen.value = true
}

async function performDeleteTeamProject() {
  const p = teamProjectToDelete.value
  if (!p?.id) return
  teamDeleteLoading.value = true
  try {
    const { error } = await deleteTeamProjectFn(p.id)
    if (!error) {
      teamDeleteModalOpen.value = false
      teamProjectToDelete.value = null
    }
  } finally {
    teamDeleteLoading.value = false
  }
}

async function loadSample(mode: 'viewer' | 'compare') {
  const project = await loadSampleProject(mode)
  if (project?.id) {
    router.push(`/${mode}/${project.id}`)
  }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

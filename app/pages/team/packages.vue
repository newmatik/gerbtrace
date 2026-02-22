<template>
  <div class="h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex overflow-hidden">
      <!-- Left: Package List -->
      <div class="w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0">
        <div class="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold">Team Packages</h2>
            <UButton
              v-if="isEditor"
              size="xs"
              icon="i-lucide-plus"
              @click="startNewPackage"
            >
              New
            </UButton>
          </div>
          <UInput
            v-model="searchQuery"
            size="xs"
            placeholder="Search packages..."
            icon="i-lucide-search"
          />
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="pkg in filteredPackages"
            :key="pkg.id"
            class="px-3 py-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800/50"
            :class="{ 'bg-primary/5 border-l-2 border-l-primary': selectedId === pkg.id }"
            @click="selectPackage(pkg)"
          >
            <div class="text-sm font-medium truncate">{{ pkg.data.name }}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-[11px] px-1.5 py-0 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                {{ pkg.data.type }}
              </span>
              <span v-if="pkg.data.aliases?.length" class="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                {{ pkg.data.aliases.slice(0, 3).join(', ') }}{{ pkg.data.aliases.length > 3 ? '...' : '' }}
              </span>
            </div>
          </div>
          <div v-if="!filteredPackages.length" class="p-4 text-center text-xs text-neutral-400">
            {{ teamPackages.length === 0 ? 'No team packages yet' : 'No matches' }}
          </div>
        </div>
      </div>

      <!-- Right: Package Form / Preview -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Preview -->
        <div class="h-72 shrink-0 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
          <PackagePreview :pkg="editingDef" />
        </div>

        <!-- Form -->
        <div class="flex-1 overflow-y-auto p-6">
          <NuxtLink to="/dashboard" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
            <UIcon name="i-lucide-arrow-left" class="text-sm" />
            Back to projects
          </NuxtLink>

          <div v-if="!selectedPackage && !isCreating" class="text-center py-20 text-sm text-neutral-400">
            Select a package from the list or create a new one.
          </div>

          <div v-else>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">
                {{ isCreating ? 'New Team Package' : selectedPackage?.data.name }}
              </h2>
              <div class="flex gap-2">
                <UButton
                  v-if="selectedPackage && isAdmin"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="handleDelete"
                >
                  Delete
                </UButton>
              </div>
            </div>

            <p v-if="nameConflict" class="mb-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <UIcon name="i-lucide-alert-triangle" />
              This name conflicts with a built-in package and cannot be saved.
            </p>

            <!-- Reuse existing PackageForm component -->
            <PackageForm
              v-if="editingDef"
              :model-value="editingDef"
              :readonly="!isEditor"
              @update:model-value="handleFormUpdate"
            />

            <div v-if="isEditor" class="flex justify-end gap-2 mt-4">
              <UButton
                variant="outline"
                color="neutral"
                @click="cancelEdit"
              >
                Cancel
              </UButton>
              <UButton
                :loading="saving"
                :disabled="nameConflict"
                @click="handleSave"
              >
                {{ isCreating ? 'Create' : 'Save' }}
              </UButton>
            </div>

            <p v-if="errorMessage" class="mt-3 text-sm text-red-600 dark:text-red-400">
              {{ errorMessage }}
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type { PackageDefinition } from '~/utils/package-types'
import type { TeamPackageRecord } from '~/composables/useTeamPackages'

const router = useRouter()
const { isAuthenticated } = useAuth()
const { isEditor, isAdmin } = useTeam()
const { teamPackages, addTeamPackage, updateTeamPackage, removeTeamPackage, isBuiltInConflict } = useTeamPackages()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

const searchQuery = ref('')
const selectedId = ref<string | null>(null)
const isCreating = ref(false)
const editingDef = ref<PackageDefinition | null>(null)
const saving = ref(false)
const errorMessage = ref('')

const selectedPackage = computed(() =>
  teamPackages.value.find(p => p.id === selectedId.value) ?? null,
)

const filteredPackages = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return teamPackages.value
  return teamPackages.value.filter(p =>
    p.data.name.toLowerCase().includes(q) || p.data.type.toLowerCase().includes(q),
  )
})

const nameConflict = computed(() => {
  if (!editingDef.value) return false
  return isBuiltInConflict(editingDef.value.name)
})

function selectPackage(pkg: DeepReadonly<TeamPackageRecord>) {
  selectedId.value = pkg.id
  isCreating.value = false
  editingDef.value = JSON.parse(JSON.stringify(pkg.data))
}

function startNewPackage() {
  selectedId.value = null
  isCreating.value = true
  editingDef.value = {
    name: '',
    type: 'PT_TWO_POLE',
    body: { length: 1, width: 0.5 },
    chip: { chipLength: 1, leadWidth: 0.3, leadLength: 0.2 },
  } as PackageDefinition
}

function cancelEdit() {
  if (isCreating.value) {
    isCreating.value = false
    editingDef.value = null
  } else if (selectedPackage.value) {
    editingDef.value = JSON.parse(JSON.stringify(selectedPackage.value.data))
  }
}

function handleFormUpdate(val: PackageDefinition) {
  editingDef.value = val
}

async function handleSave() {
  if (!editingDef.value) return
  errorMessage.value = ''
  saving.value = true

  try {
    if (isCreating.value) {
      const { data, error } = await addTeamPackage(editingDef.value)
      if (error) {
        errorMessage.value = (error as any).message ?? 'Failed to create'
      } else if (data) {
        isCreating.value = false
        selectedId.value = data.id
      }
    } else if (selectedId.value) {
      const { error } = await updateTeamPackage(selectedId.value, editingDef.value)
      if (error) {
        errorMessage.value = (error as any).message ?? 'Failed to save'
      }
    }
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!selectedId.value) return
  const { error } = await removeTeamPackage(selectedId.value)
  if (!error) {
    selectedId.value = null
    editingDef.value = null
  }
}
</script>

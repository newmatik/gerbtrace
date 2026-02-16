<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex overflow-hidden">
      <!-- Left: Package List -->
      <div class="w-72 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0">
        <div class="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold">THT Packages</h2>
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
            <div class="text-xs text-neutral-400">{{ pkg.data.shapes?.length ?? 0 }} shapes</div>
          </div>
          <div v-if="!filteredPackages.length" class="p-4 text-center text-xs text-neutral-400">
            {{ teamThtPackages.length === 0 ? 'No THT packages yet' : 'No matches' }}
          </div>
        </div>
      </div>

      <!-- Right: Editor or Placeholder -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 px-4 pt-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to projects
        </NuxtLink>

        <div v-if="!editingDef && !isCreating" class="flex-1 flex items-center justify-center text-sm text-neutral-400">
          Select a package from the list or create a new one.
        </div>

        <div v-else class="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <!-- Header -->
          <div class="flex items-center justify-between py-3">
            <h2 class="text-lg font-semibold">
              {{ isCreating ? 'New THT Package' : selectedPackage?.data.name }}
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

          <!-- Package name + aliases -->
          <div class="flex gap-3 mb-3">
            <div class="flex-1 space-y-1">
              <label class="text-[10px] text-neutral-400 uppercase font-medium">Package Name</label>
              <input
                :value="editingDef?.name ?? ''"
                type="text"
                placeholder="e.g. PinHeader-2x5"
                class="w-full px-2 py-1.5 text-sm rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                :disabled="!isEditor"
                @input="onNameInput"
              />
            </div>
            <div class="flex-1 space-y-1">
              <label class="text-[10px] text-neutral-400 uppercase font-medium">Aliases (comma-separated)</label>
              <input
                :value="editingDef?.aliases?.join(', ') ?? ''"
                type="text"
                placeholder="e.g. 2x5-header, HDR-2x5"
                class="w-full px-2 py-1.5 text-sm rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                :disabled="!isEditor"
                @input="onAliasesInput"
              />
            </div>
          </div>

          <!-- Default colors -->
          <div class="flex gap-3 mb-3">
            <div class="space-y-1">
              <label class="text-[10px] text-neutral-400 uppercase font-medium">Body Color</label>
              <div class="flex items-center gap-1.5">
                <input
                  :value="editingDef?.bodyColor ?? '#333333'"
                  type="color"
                  class="w-7 h-6 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer"
                  :disabled="!isEditor"
                  @input="onColorInput('bodyColor', $event)"
                />
                <span class="text-[10px] text-neutral-400 tabular-nums">{{ editingDef?.bodyColor ?? '#333333' }}</span>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-neutral-400 uppercase font-medium">Body Stroke</label>
              <div class="flex items-center gap-1.5">
                <input
                  :value="editingDef?.bodyStrokeColor ?? '#555555'"
                  type="color"
                  class="w-7 h-6 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer"
                  :disabled="!isEditor"
                  @input="onColorInput('bodyStrokeColor', $event)"
                />
                <span class="text-[10px] text-neutral-400 tabular-nums">{{ editingDef?.bodyStrokeColor ?? '#555555' }}</span>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-neutral-400 uppercase font-medium">Pin Color</label>
              <div class="flex items-center gap-1.5">
                <input
                  :value="editingDef?.pinColor ?? '#c0c0c0'"
                  type="color"
                  class="w-7 h-6 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer"
                  :disabled="!isEditor"
                  @input="onColorInput('pinColor', $event)"
                />
                <span class="text-[10px] text-neutral-400 tabular-nums">{{ editingDef?.pinColor ?? '#c0c0c0' }}</span>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-neutral-400 uppercase font-medium">Pin Stroke</label>
              <div class="flex items-center gap-1.5">
                <input
                  :value="editingDef?.pinStrokeColor ?? '#808080'"
                  type="color"
                  class="w-7 h-6 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer"
                  :disabled="!isEditor"
                  @input="onColorInput('pinStrokeColor', $event)"
                />
                <span class="text-[10px] text-neutral-400 tabular-nums">{{ editingDef?.pinStrokeColor ?? '#808080' }}</span>
              </div>
            </div>
          </div>

          <!-- Visual Editor -->
          <div v-if="editingDef" class="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <THTPackageEditor
              :model-value="editingDef"
              @update:model-value="handleEditorUpdate"
            />
          </div>

          <!-- Actions -->
          <div v-if="isEditor" class="flex justify-end gap-2 mt-3">
            <UButton
              variant="outline"
              color="neutral"
              @click="cancelEdit"
            >
              Cancel
            </UButton>
            <UButton
              :loading="saving"
              @click="handleSave"
            >
              {{ isCreating ? 'Create' : 'Save' }}
            </UButton>
          </div>

          <p v-if="errorMessage" class="mt-2 text-sm text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type { THTPackageDefinition } from '~/utils/tht-package-types'
import { createEmptyThtPackage } from '~/utils/tht-package-types'
import type { TeamThtPackageRecord } from '~/composables/useTeamThtPackages'

const router = useRouter()
const { isAuthenticated } = useAuth()
const { isEditor, isAdmin } = useTeam()
const { teamThtPackages, addTeamThtPackage, updateTeamThtPackage, removeTeamThtPackage } = useTeamThtPackages()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

const searchQuery = ref('')
const selectedId = ref<string | null>(null)
const isCreating = ref(false)
const editingDef = ref<THTPackageDefinition | null>(null)
const saving = ref(false)
const errorMessage = ref('')

const selectedPackage = computed(() =>
  teamThtPackages.value.find(p => p.id === selectedId.value) ?? null,
)

const filteredPackages = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return teamThtPackages.value
  return teamThtPackages.value.filter(p =>
    p.data.name.toLowerCase().includes(q),
  )
})

function selectPackage(pkg: DeepReadonly<TeamThtPackageRecord>) {
  selectedId.value = pkg.id
  isCreating.value = false
  editingDef.value = JSON.parse(JSON.stringify(pkg.data))
}

function startNewPackage() {
  selectedId.value = null
  isCreating.value = true
  editingDef.value = createEmptyThtPackage()
}

function cancelEdit() {
  if (isCreating.value) {
    isCreating.value = false
    editingDef.value = null
  } else if (selectedPackage.value) {
    editingDef.value = JSON.parse(JSON.stringify(selectedPackage.value.data))
  }
}

function handleEditorUpdate(val: THTPackageDefinition) {
  editingDef.value = val
}

function onNameInput(e: Event) {
  if (!editingDef.value) return
  editingDef.value = { ...editingDef.value, name: (e.target as HTMLInputElement).value }
}

function onAliasesInput(e: Event) {
  if (!editingDef.value) return
  const raw = (e.target as HTMLInputElement).value
  const aliases = raw.split(',').map(s => s.trim()).filter(Boolean)
  editingDef.value = { ...editingDef.value, aliases: aliases.length > 0 ? aliases : undefined }
}

function onColorInput(key: 'bodyColor' | 'bodyStrokeColor' | 'pinColor' | 'pinStrokeColor', e: Event) {
  if (!editingDef.value) return
  editingDef.value = { ...editingDef.value, [key]: (e.target as HTMLInputElement).value }
}

async function handleSave() {
  if (!editingDef.value) return
  if (!editingDef.value.name.trim()) {
    errorMessage.value = 'Package name is required'
    return
  }
  errorMessage.value = ''
  saving.value = true

  try {
    if (isCreating.value) {
      const { data, error } = await addTeamThtPackage(editingDef.value)
      if (error) {
        errorMessage.value = (error as any).message ?? 'Failed to create'
      } else if (data) {
        isCreating.value = false
        selectedId.value = data.id
      }
    } else if (selectedId.value) {
      const { error } = await updateTeamThtPackage(selectedId.value, editingDef.value)
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
  const { error } = await removeTeamThtPackage(selectedId.value)
  if (!error) {
    selectedId.value = null
    editingDef.value = null
  }
}
</script>

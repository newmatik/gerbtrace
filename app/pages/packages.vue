<template>
  <div class="h-screen flex flex-col">
    <AppHeader>
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-neutral-600 dark:text-neutral-300">Package Manager</span>
        <div class="flex rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <button
            class="px-2.5 py-1 text-xs"
            :class="packageMode === 'smd' ? 'bg-primary text-white' : 'bg-transparent text-neutral-600 dark:text-neutral-300'"
            @click="packageMode = 'smd'"
          >
            SMD (TPSys)
          </button>
          <button
            class="px-2.5 py-1 text-xs border-l border-neutral-200 dark:border-neutral-700"
            :class="packageMode === 'tht' ? 'bg-primary text-white' : 'bg-transparent text-neutral-600 dark:text-neutral-300'"
            @click="packageMode = 'tht'"
          >
            THT Generic
          </button>
        </div>
      </div>
    </AppHeader>

    <div v-if="packageMode === 'smd'" class="flex-1 flex overflow-hidden">
      <!-- Left Panel: Package List -->
      <div class="w-80 shrink-0 border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-900">
        <PackageList
          :packages="allPackageItems"
          :selected-key="selectedKey"
          :selected-library-node="selectedLibraryNode"
          :libraries="smdSelectableLibraries"
          :selected-library-ids="smdSelectedLibraryIdsUi"
          @select="selectPackage"
          @select-library="selectLibraryNode"
          @update:selected-library-ids="onSelectedLibrariesUpdate"
        />
        <div v-if="canAddSmdPackage" class="p-3 border-t border-neutral-200 dark:border-neutral-700">
          <UButton
            size="sm"
            icon="i-lucide-plus"
            block
            @click="createSmdPackage"
          >
            New Package
          </UButton>
        </div>
      </div>

      <!-- Right Panel: Preview + Form -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Preview -->
        <div class="h-72 shrink-0 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
          <PackagePreview :pkg="currentPkg" />
        </div>

        <!-- Form / Details -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="!currentPkg && selectedLibraryInfo" class="p-4 space-y-3">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ selectedLibraryInfo.name }}</h2>
            <div class="text-sm text-neutral-600 dark:text-neutral-300">
              <p><strong>Owner:</strong> {{ selectedLibraryInfo.owner }}</p>
              <p v-if="selectedLibraryInfo.sourceType"><strong>Source:</strong> {{ selectedLibraryInfo.sourceType }}</p>
              <p v-if="selectedLibraryInfo.license"><strong>License:</strong> {{ selectedLibraryInfo.license }}</p>
              <p><strong>Packages:</strong> {{ selectedLibraryInfo.packageCount }}</p>
            </div>
            <div
              v-if="selectedLibraryInfo.attribution?.notice"
              class="rounded border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200"
            >
              {{ selectedLibraryInfo.attribution.notice }}
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              <a
                v-if="selectedLibraryInfo.attribution?.upstreamUrl"
                :href="selectedLibraryInfo.attribution.upstreamUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="underline"
              >
                View upstream source
              </a>
            </div>
          </div>
          <div v-else-if="!currentPkg" class="flex items-center justify-center h-full text-sm text-neutral-400 dark:text-neutral-500">
            Select a package or a library node
          </div>
          <div v-else class="p-4">
            <!-- Action bar -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ currentPkg.name }}</h2>
                <UBadge
                  v-if="selectedItem?.source === 'builtin'"
                  size="xs"
                  color="neutral"
                  variant="subtle"
                >
                  Built-in
                </UBadge>
                <UBadge
                  v-else-if="selectedItem?.source === 'team'"
                  size="xs"
                  color="primary"
                  variant="subtle"
                >
                  Team
                </UBadge>
              </div>
              <div class="flex items-center gap-1.5">
                <UButton
                  v-if="selectedItem?.source === 'builtin'"
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-copy"
                  @click="duplicateBuiltin"
                >
                  Duplicate
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-download"
                  @click="exportJson"
                >
                  Export JSON
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-file-output"
                  @click="exportPck"
                >
                  Export .pck
                </UButton>
                <UButton
                  v-if="selectedItem?.source === 'team' && isAdmin"
                  size="xs"
                  variant="outline"
                  color="error"
                  icon="i-lucide-trash-2"
                  @click="confirmDelete"
                >
                  Delete
                </UButton>
              </div>
            </div>

            <PackageForm
              v-if="selectedItem?.source === 'team' && editPkg"
              :model-value="editPkg"
              :library-attribution="currentPackageLibraryAttribution"
              @update:model-value="onFormUpdate"
            />
            <PackageForm
              v-else-if="currentPkg"
              :model-value="currentPkg"
              :library-attribution="currentPackageLibraryAttribution"
              readonly
            />

            <!-- Save button for custom packages -->
            <div v-if="selectedItem?.source === 'team' && isDirty" class="mt-4 flex justify-end">
              <UButton
                size="sm"
                icon="i-lucide-save"
                @click="saveChanges"
              >
                Save Changes
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex-1 flex overflow-hidden">
      <div class="w-80 shrink-0 border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-900">
        <div class="p-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
          <div class="flex flex-wrap gap-1">
            <UButton
              size="xs"
              :variant="thtSelectedLibraryIdsUi.length === 0 ? 'solid' : 'outline'"
              color="neutral"
              @click="onSelectedThtLibrariesUpdate([])"
            >
              All Libraries
            </UButton>
            <UButton
              v-for="lib in thtSelectableLibraries"
              :key="lib.id"
              size="xs"
              :variant="thtSelectedLibraryIdsUi.includes(lib.id) ? 'solid' : 'outline'"
              color="neutral"
              @click="onSelectedThtLibrariesUpdate(thtSelectedLibraryIdsUi.includes(lib.id) ? [] : [lib.id])"
            >
              {{ lib.name }}
            </UButton>
          </div>
          <UInput v-model="thtQuery" size="sm" placeholder="Search THT packages..." icon="i-lucide-search" />
        </div>
        <div class="flex-1 overflow-y-auto">
          <button
            v-for="item in filteredThtItems"
            :key="item.key"
            class="w-full text-left px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            :class="selectedThtKey === item.key ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary' : ''"
            @click="selectTht(item)"
          >
            <div class="text-sm font-medium text-neutral-900 dark:text-white truncate">{{ item.pkg.name }}</div>
            <div class="text-[11px] text-neutral-400">
              {{ item.source === 'team' ? 'Team' : (item.libraryName ?? 'Library') }} · {{ item.pkg.shapes.length }} shapes
            </div>
          </button>
          <div v-if="filteredThtItems.length === 0" class="p-4 text-center text-xs text-neutral-400">No THT packages found</div>
        </div>
        <div v-if="canAddThtPackage" class="p-3 border-t border-neutral-200 dark:border-neutral-700">
          <UButton
            size="sm"
            icon="i-lucide-plus"
            block
            @click="createThtPackage"
          >
            New Package
          </UButton>
        </div>
      </div>
      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="h-72 shrink-0 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
          <THTPackagePreview v-if="currentThtPkg" :package="currentThtPkg" />
          <div v-else class="h-full flex items-center justify-center text-sm text-neutral-400">Select or create a THT package</div>
        </div>
        <div class="flex-1 overflow-hidden p-4">
          <div v-if="currentThtPkg" class="h-full flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="currentThtPkg.name"
                size="sm"
                placeholder="Package name"
                @update:model-value="onThtNameUpdate"
              />
              <UBadge size="xs" :color="selectedThtItem?.source === 'team' ? 'primary' : 'neutral'" variant="subtle">
                {{ selectedThtItem?.source === 'team' ? 'Team' : 'Built-in' }}
              </UBadge>
            </div>
            <UTabs :items="thtEditorTabs" :unmount-on-hide="false" size="sm" variant="link" color="neutral" class="flex-1 flex flex-col overflow-hidden min-h-0">
              <template #editor>
                <div class="flex-1 overflow-hidden pt-3">
                  <div v-if="selectedThtItem?.source === 'team'" class="h-full border border-neutral-200 dark:border-neutral-700 rounded overflow-hidden">
                    <THTPackageEditor :model-value="currentThtPkg" @update:model-value="onThtEditorUpdate" />
                  </div>
                  <div v-else class="h-full rounded border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-500 dark:text-neutral-400">
                    Built-in library package is read-only. Copy it to team packages to edit.
                  </div>
                </div>
              </template>
              <template #attribution>
                <div class="pt-3">
                  <PackageFormAttribution
                    :provenance="currentThtPkg.provenance"
                    :library-attribution="currentThtLibraryAttribution ?? undefined"
                  />
                </div>
              </template>
            </UTabs>
            <div class="flex justify-end gap-2">
              <UButton
                v-if="selectedThtItem?.source === 'builtin'"
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-copy"
                :disabled="!isEditor || !hasTeam"
                @click="copyBuiltinThtToTeam"
              >
                Copy to Team
              </UButton>
              <UButton
                v-if="selectedThtItem?.source === 'team' && isAdmin"
                size="sm"
                variant="outline"
                color="error"
                icon="i-lucide-trash-2"
                @click="deleteTeamTht"
              >
                Delete
              </UButton>
              <UButton v-if="selectedThtItem?.source === 'team'" size="sm" icon="i-lucide-save" @click="saveTht">Save Changes</UButton>
            </div>
          </div>
          <div v-else class="h-full flex items-center justify-center text-sm text-neutral-400">Select or create a THT package</div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Delete package?</h3>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              This will permanently remove <strong>{{ currentPkg?.name }}</strong> from your custom packages.
            </p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton size="sm" variant="outline" color="neutral" @click="deleteModalOpen = false">Cancel</UButton>
            <UButton size="sm" color="error" icon="i-lucide-trash-2" @click="performDelete">Delete</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="createSmdModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">New SMD Package</h3>
          <div class="space-y-2">
            <label class="text-xs text-neutral-500">TPSys type</label>
            <USelect
              v-model="createSmdType"
              size="sm"
              :items="createSmdTypeOptions"
              value-key="value"
              label-key="label"
              :ui="{ content: 'min-w-[280px]', itemLabel: 'whitespace-nowrap' }"
            />
          </div>
          <div class="flex justify-end gap-2">
            <UButton size="sm" variant="outline" color="neutral" @click="createSmdModalOpen = false">Cancel</UButton>
            <UButton size="sm" icon="i-lucide-plus" @click="confirmCreateSmdPackage">Create</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { PACKAGE_TYPES, PACKAGE_TYPE_LABELS } from '~/utils/package-types'
import type { PackageDefinition } from '~/utils/package-types'
import type { PackageListItem } from '~/components/packages/PackageList.vue'
import type { THTPackageDefinition } from '~/utils/tht-package-types'
import { serializeToPck } from '~/utils/pck-serializer'
import { createEmptyThtPackage } from '~/utils/tht-package-types'
import { saveBlobFile } from '~/utils/file-download'

const {
  packages: builtinPackages,
  loadPackages,
  libraries: builtinLibraries,
  setSelectedLibraries,
} = usePackageLibrary()
const { teamPackages, addTeamPackage, updateTeamPackage, removeTeamPackage } = useTeamPackages()
const { teamThtPackages, addTeamThtPackage, updateTeamThtPackage, removeTeamThtPackage } = useTeamThtPackages()
const {
  builtInPackages: builtInThtPackages,
  libraries: thtLibraries,
  setSelectedLibraries: setSelectedThtLibraries,
  loadPackages: loadThtPackages,
} = useThtPackageLibrary()
const { isEditor, isAdmin, hasTeam } = useTeam()

const packageMode = ref<'smd' | 'tht'>('smd')
const smdSelectedLibraryIdsUi = ref<string[]>([])

// Load built-in packages
onMounted(() => {
  loadPackages()
  loadThtPackages()
})

// Build combined list
const allPackageItems = computed<PackageListItem[]>(() => {
  const items: PackageListItem[] = []

  // Built-in packages
  for (const pkg of builtinPackages.value) {
    const libId = (pkg as any).libraryId as string | undefined
    const libName = (pkg as any).libraryName as string | undefined
    items.push({
      key: `builtin-${libId ?? 'newmatik'}-${pkg.name}`,
      pkg: pkg as PackageDefinition,
      source: 'builtin',
      libraryId: libId,
      libraryName: libName,
    })
  }

  for (const record of teamPackages.value) {
    items.push({
      key: `team-${record.id}`,
      pkg: record.data as PackageDefinition,
      source: 'team',
      teamId: record.id,
      libraryId: 'team',
      libraryName: 'Team Library',
    })
  }

  return items
})

// Selection
const selectedKey = ref<string | null>(null)
const selectedLibraryNode = ref<string | null>(null)
const selectedItem = computed(() => allPackageItems.value.find(i => i.key === selectedKey.value) ?? null)
/** For display: use editPkg if editing a custom package, otherwise the stored definition */
const currentPkg = computed(() => {
  if (selectedItem.value?.source === 'team' && editPkg.value) return editPkg.value
  return selectedItem.value?.pkg ?? null
})

// Edit state for custom packages
const editPkg = ref<PackageDefinition | null>(null)
const isDirty = ref(false)

function selectPackage(item: PackageListItem) {
  selectedKey.value = item.key
  selectedLibraryNode.value = item.libraryId ?? null
  if (item.source === 'team') {
    editPkg.value = JSON.parse(JSON.stringify(item.pkg))
    isDirty.value = false
  } else {
    editPkg.value = null
    isDirty.value = false
  }
}

function selectLibraryNode(libraryId: string) {
  selectedLibraryNode.value = libraryId
  selectedKey.value = null
  editPkg.value = null
  isDirty.value = false
}

async function onSelectedLibrariesUpdate(ids: string[]) {
  const unique = [...new Set(ids)]
  smdSelectedLibraryIdsUi.value = unique
  const builtInIdSet = new Set(builtinLibraries.value.map((l) => l.id))
  await setSelectedLibraries(unique.filter((id) => builtInIdSet.has(id)))
  if (selectedItem.value) {
    const libId = selectedItem.value.libraryId
      ?? (selectedItem.value.source === 'builtin' ? 'newmatik' : 'team')
    if (unique.length > 0 && !unique.includes(libId)) selectedKey.value = null
  }
}

function onFormUpdate(pkg: PackageDefinition) {
  editPkg.value = pkg
  isDirty.value = true
}

async function saveChanges() {
  if (!editPkg.value || !selectedItem.value) return
  if (selectedItem.value.source === 'team' && selectedItem.value.teamId) {
    await updateTeamPackage(selectedItem.value.teamId, editPkg.value)
  }
  isDirty.value = false
}

// Duplicate built-in
async function duplicateBuiltin() {
  if (!currentPkg.value) return
  const clone: PackageDefinition = JSON.parse(JSON.stringify(currentPkg.value))
  clone.name = `${clone.name} (copy)`
  clone.aliases = []
  const { data } = await addTeamPackage(clone)
  await nextTick()
  const newKey = data?.id ? `team-${data.id}` : null
  if (!newKey) return
  const newItem = allPackageItems.value.find(i => i.key === newKey)
  if (newItem) selectPackage(newItem)
}

// Export — uses the live edit state for custom packages
async function exportJson() {
  const pkg = currentPkg.value
  if (!pkg) return
  const json = JSON.stringify(pkg, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  await saveBlobFile(blob, `${pkg.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`)
}

// Export .pck
async function exportPck() {
  const pkg = currentPkg.value
  if (!pkg) return
  const pckText = serializeToPck(pkg)
  const blob = new Blob([pckText], { type: 'text/plain' })
  await saveBlobFile(blob, `${pkg.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.pck`)
}

// Delete
const deleteModalOpen = ref(false)

function confirmDelete() {
  deleteModalOpen.value = true
}

async function performDelete() {
  if (!selectedItem.value) return
  if (selectedItem.value.source === 'team' && selectedItem.value.teamId) {
    await removeTeamPackage(selectedItem.value.teamId)
  } else {
    return
  }
  selectedKey.value = null
  editPkg.value = null
  isDirty.value = false
  deleteModalOpen.value = false
}

const smdSelectableLibraries = computed(() => {
  const out = [...builtinLibraries.value]
  out.push({
    id: 'team',
    name: 'Team Library',
    owner: 'team',
    sourceType: 'Team',
    packageCount: teamPackages.value.length,
  })
  return out
})

const selectedLibraryInfo = computed(() => {
  if (!selectedLibraryNode.value) return null
  return smdSelectableLibraries.value.find(l => l.id === selectedLibraryNode.value) ?? null
})

const currentPackageLibraryAttribution = computed(() => {
  const pkg = currentPkg.value as PackageDefinition | null
  if (!pkg) return null
  const sourceLibraryId = pkg.provenance?.sourceLibrary ?? selectedItem.value?.libraryId
  if (!sourceLibraryId || sourceLibraryId === 'team' || sourceLibraryId === 'custom') return null
  const lib = builtinLibraries.value.find((entry) => entry.id === sourceLibraryId)
  return lib?.attribution ?? null
})

type ThtListItem = {
  key: string
  pkg: THTPackageDefinition
  source: 'team' | 'builtin'
  teamId?: string
  libraryId?: string
  libraryName?: string
}

const thtQuery = ref('')
const thtSelectedLibraryIdsUi = ref<string[]>([])
const selectedThtKey = ref<string | null>(null)
const thtEditPkg = ref<THTPackageDefinition | null>(null)
const thtItems = computed<ThtListItem[]>(() => {
  const out: ThtListItem[] = []
  for (const pkg of builtInThtPackages.value) {
    out.push({
      key: `builtin-${(pkg as any).libraryId ?? 'tht'}-${pkg.name}`,
      pkg: pkg as THTPackageDefinition,
      source: 'builtin',
      libraryId: (pkg as any).libraryId,
      libraryName: (pkg as any).libraryName,
    })
  }
  for (const rec of teamThtPackages.value) {
    out.push({
      key: `team-${rec.id}`,
      pkg: rec.data as THTPackageDefinition,
      source: 'team',
      teamId: rec.id,
      libraryId: 'team',
      libraryName: 'Team Library',
    })
  }
  return out
})
const thtSelectableLibraries = computed(() => {
  const out = [...thtLibraries.value]
  out.push({
    id: 'team',
    name: 'Team Library',
    packageCount: teamThtPackages.value.length,
  })
  return out
})
const filteredThtItems = computed(() => {
  const q = thtQuery.value.trim().toLowerCase()
  return thtItems.value.filter((i) => {
    if (thtSelectedLibraryIdsUi.value.length > 0) {
      const libId = i.libraryId ?? (i.source === 'team' ? 'team' : 'builtin')
      if (!thtSelectedLibraryIdsUi.value.includes(libId)) return false
    }
    if (!q) return true
    return i.pkg.name.toLowerCase().includes(q) || (i.pkg.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  })
})
const selectedThtItem = computed(() => thtItems.value.find((i) => i.key === selectedThtKey.value) ?? null)
const currentThtPkg = computed(() => thtEditPkg.value ?? selectedThtItem.value?.pkg ?? null)

const thtEditorTabs = [
  { label: 'Editor', icon: 'i-lucide-pen-tool', slot: 'editor' },
  { label: 'Attribution', icon: 'i-lucide-bookmark', slot: 'attribution' },
]

const currentThtLibraryAttribution = computed(() => {
  const pkg = currentThtPkg.value
  if (!pkg) return null
  const sourceLibraryId = pkg.provenance?.sourceLibrary ?? selectedThtItem.value?.libraryId
  if (!sourceLibraryId || sourceLibraryId === 'team') return null
  const lib = thtLibraries.value.find((entry) => entry.id === sourceLibraryId)
  return lib?.attribution ?? null
})

function selectTht(item: ThtListItem) {
  selectedThtKey.value = item.key
  thtEditPkg.value = JSON.parse(JSON.stringify(item.pkg))
}

function onThtEditorUpdate(pkg: THTPackageDefinition) {
  thtEditPkg.value = pkg
}

function onThtNameUpdate(name: string | number) {
  if (!thtEditPkg.value) return
  thtEditPkg.value = { ...thtEditPkg.value, name: String(name ?? '') }
}

async function saveTht() {
  if (!thtEditPkg.value || !selectedThtItem.value) return
  if (selectedThtItem.value.source === 'team' && selectedThtItem.value.teamId) {
    await updateTeamThtPackage(selectedThtItem.value.teamId, thtEditPkg.value)
  }
}

async function deleteTeamTht() {
  if (!selectedThtItem.value || selectedThtItem.value.source !== 'team' || !selectedThtItem.value.teamId) return
  await removeTeamThtPackage(selectedThtItem.value.teamId)
  selectedThtKey.value = null
  thtEditPkg.value = null
}

async function copyBuiltinThtToTeam() {
  if (!selectedThtItem.value || selectedThtItem.value.source !== 'builtin') return
  const clone = JSON.parse(JSON.stringify(selectedThtItem.value.pkg)) as THTPackageDefinition
  clone.name = `${clone.name} (copy)`
  const { data } = await addTeamThtPackage(clone)
  if (data?.id) {
    await nextTick()
    const item = thtItems.value.find((i) => i.key === `team-${data.id}`)
    if (item) selectTht(item)
  }
}

async function onSelectedThtLibrariesUpdate(ids: string[]) {
  const unique = [...new Set(ids)]
  thtSelectedLibraryIdsUi.value = unique
  const builtInIdSet = new Set(thtLibraries.value.map((l) => l.id))
  await setSelectedThtLibraries(unique.filter((id) => builtInIdSet.has(id)))
  if (selectedThtItem.value) {
    const libId = selectedThtItem.value.libraryId ?? (selectedThtItem.value.source === 'team' ? 'team' : '')
    if (libId && unique.length > 0 && !unique.includes(libId)) {
      selectedThtKey.value = null
      thtEditPkg.value = null
    }
  }
}

const canAddSmdPackage = computed(() => {
  if (!isEditor.value || !hasTeam.value) return false
  return smdSelectedLibraryIdsUi.value.length === 1 && smdSelectedLibraryIdsUi.value[0] === 'team'
})

const canAddThtPackage = computed(() => {
  if (!isEditor.value || !hasTeam.value) return false
  return thtSelectedLibraryIdsUi.value.length === 1 && thtSelectedLibraryIdsUi.value[0] === 'team'
})

const createSmdModalOpen = ref(false)
const createSmdType = ref<PackageDefinition['type']>('PT_TWO_POLE')
const createSmdTypeOptions = PACKAGE_TYPES.map(t => ({ label: PACKAGE_TYPE_LABELS[t], value: t }))

function createSmdPackage() {
  if (!canAddSmdPackage.value) return
  createSmdModalOpen.value = true
}

function buildDefaultSmd(type: PackageDefinition['type']): PackageDefinition {
  const base = {
    name: 'New Package',
    aliases: [] as string[],
    body: { length: 1, width: 1 },
  }
  switch (type) {
    case 'PT_TWO_POLE':
      return { ...base, type, chip: { chipLength: 1, leadWidth: 0.5, leadLength: 0.3 } }
    case 'PT_THREE_POLE':
      return { ...base, type, threePole: { widthOverLeads: 2.2, ccDistance: 1, leadWidth: 0.4, leadLength: 0.4 } }
    case 'PT_TWO_SYM':
      return { ...base, type, twoSymmetric: { numberOfLeads: 8, widthOverLeads: 6, leadPitch: 1.27, leadWidth: 0.4, leadLength: 0.5 } }
    case 'PT_FOUR_SYM':
      return { ...base, type, fourSymmetric: { numberOfLeads: 16, widthOverLeads: 5, leadPitch: 0.5, leadWidth: 0.25, leadLength: 0.3 } }
    case 'PT_TWO_PLUS_TWO':
      return { ...base, type, twoPlusTwo: { leadsLong: 4, leadsShort: 2, widthOverLeadsX: 6, widthOverLeadsY: 4, leadPitch: 0.65, leadWidth: 0.25, leadLength: 0.3 } }
    case 'PT_FOUR_ON_TWO':
      return { ...base, type, fourOnTwo: { leadsPerGroup: 3, widthOverLeads: 6, leadPitch: 0.65, leadWidth: 0.25, leadLength: 0.3, groupGap: 1 } }
    case 'PT_BGA':
      return { ...base, type, bga: { leadsPerRow: 6, leadsPerColumn: 6, leadPitch: 0.5, leadDiameter: 0.3 } }
    case 'PT_GENERIC':
      return {
        ...base,
        type,
        generic: {
          leadGroups: [
            { shape: 'GULLWING', numLeads: 4, distFromCenter: -1, ccHalf: 0.5, angleMilliDeg: 0, padLength: 0.4, padWidth: 0.25 },
            { shape: 'GULLWING', numLeads: 4, distFromCenter: 1, ccHalf: 0.5, angleMilliDeg: 180000, padLength: 0.4, padWidth: 0.25 },
          ],
        },
      }
    case 'PT_OUTLINE':
    default:
      return { ...base, type: 'PT_OUTLINE', outline: { length: 5, width: 5 } }
  }
}

async function confirmCreateSmdPackage() {
  if (!canAddSmdPackage.value) return
  const def = buildDefaultSmd(createSmdType.value)
  const { data } = await addTeamPackage(def)
  createSmdModalOpen.value = false
  await nextTick()
  if (data?.id) {
    const item = allPackageItems.value.find((i) => i.key === `team-${data.id}`)
    if (item) selectPackage(item)
  }
}

async function createThtPackage() {
  if (!canAddThtPackage.value) return
  const { data } = await addTeamThtPackage(createEmptyThtPackage('New THT Package'))
  await nextTick()
  if (data?.id) {
    const item = thtItems.value.find((i) => i.key === `team-${data.id}`)
    if (item) selectTht(item)
  }
}
</script>

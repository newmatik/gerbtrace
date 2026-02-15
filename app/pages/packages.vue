<template>
  <div class="h-screen flex flex-col">
    <AppHeader>
      <span class="text-sm font-medium text-neutral-600 dark:text-neutral-300">Package Manager</span>
    </AppHeader>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left Panel: Package List -->
      <div class="w-80 shrink-0 border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-900">
        <PackageList
          :packages="allPackageItems"
          :selected-key="selectedKey"
          @select="selectPackage"
        />
        <div class="p-3 border-t border-neutral-200 dark:border-neutral-700">
          <UButton
            size="sm"
            icon="i-lucide-plus"
            block
            @click="createNew"
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
          <div v-if="!currentPkg" class="flex items-center justify-center h-full text-sm text-neutral-400 dark:text-neutral-500">
            Select a package from the list or create a new one
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
                  v-else
                  size="xs"
                  color="primary"
                  variant="subtle"
                >
                  Custom
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
                  v-if="selectedItem?.source === 'custom'"
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
              v-if="selectedItem?.source === 'custom' && editPkg"
              :model-value="editPkg"
              @update:model-value="onFormUpdate"
            />
            <PackageForm
              v-else-if="currentPkg"
              :model-value="currentPkg"
              readonly
            />

            <!-- Save button for custom packages -->
            <div v-if="selectedItem?.source === 'custom' && isDirty" class="mt-4 flex justify-end">
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
  </div>
</template>

<script setup lang="ts">
import type { PackageDefinition } from '~/utils/package-types'
import type { PackageListItem } from '~/components/packages/PackageList.vue'
import { serializeToPck } from '~/utils/pck-serializer'

const { packages: builtinPackages, loadPackages, loaded: builtinLoaded } = usePackageLibrary()
const { packages: customRecords, customDefinitions, addPackage, updatePackage, removePackage, loaded: customLoaded } = useCustomPackages()

// Load built-in packages
onMounted(() => {
  loadPackages()
})

// Build combined list
const allPackageItems = computed<PackageListItem[]>(() => {
  const items: PackageListItem[] = []

  // Custom packages first
  for (const record of customRecords.value) {
    items.push({
      key: `custom-${record.id}`,
      pkg: record.data,
      source: 'custom',
      customId: record.id,
    })
  }

  // Built-in packages
  for (const pkg of builtinPackages.value) {
    items.push({
      key: `builtin-${pkg.name}`,
      pkg,
      source: 'builtin',
    })
  }

  return items
})

// Selection
const selectedKey = ref<string | null>(null)
const selectedItem = computed(() => allPackageItems.value.find(i => i.key === selectedKey.value) ?? null)
/** For display: use editPkg if editing a custom package, otherwise the stored definition */
const currentPkg = computed(() => {
  if (selectedItem.value?.source === 'custom' && editPkg.value) return editPkg.value
  return selectedItem.value?.pkg ?? null
})

// Edit state for custom packages
const editPkg = ref<PackageDefinition | null>(null)
const isDirty = ref(false)

function selectPackage(item: PackageListItem) {
  selectedKey.value = item.key
  if (item.source === 'custom') {
    editPkg.value = JSON.parse(JSON.stringify(item.pkg))
    isDirty.value = false
  } else {
    editPkg.value = null
    isDirty.value = false
  }
}

function onFormUpdate(pkg: PackageDefinition) {
  editPkg.value = pkg
  isDirty.value = true
}

async function saveChanges() {
  if (!editPkg.value || !selectedItem.value?.customId) return
  await updatePackage(selectedItem.value.customId, editPkg.value)
  isDirty.value = false
}

// Create new
async function createNew() {
  const defaultPkg: PackageDefinition = {
    name: 'New Package',
    type: 'Chip',
    aliases: [],
    body: { length: 1.0, width: 0.5 },
    chip: { chipLength: 1.0, leadWidth: 0.5, leadLength: 0.25 },
  }
  const id = await addPackage(defaultPkg)
  // Select the new package
  await nextTick()
  const newKey = `custom-${id}`
  const newItem = allPackageItems.value.find(i => i.key === newKey)
  if (newItem) selectPackage(newItem)
}

// Duplicate built-in
async function duplicateBuiltin() {
  if (!currentPkg.value) return
  const clone: PackageDefinition = JSON.parse(JSON.stringify(currentPkg.value))
  clone.name = `${clone.name} (copy)`
  clone.aliases = []
  const id = await addPackage(clone)
  await nextTick()
  const newKey = `custom-${id}`
  const newItem = allPackageItems.value.find(i => i.key === newKey)
  if (newItem) selectPackage(newItem)
}

// Export — uses the live edit state for custom packages
function exportJson() {
  const pkg = currentPkg.value
  if (!pkg) return
  const json = JSON.stringify(pkg, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pkg.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Export .pck
function exportPck() {
  const pkg = currentPkg.value
  if (!pkg) return
  const pckText = serializeToPck(pkg)
  const blob = new Blob([pckText], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pkg.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.pck`
  a.click()
  URL.revokeObjectURL(url)
}

// Delete
const deleteModalOpen = ref(false)

function confirmDelete() {
  deleteModalOpen.value = true
}

async function performDelete() {
  if (!selectedItem.value?.customId) return
  await removePackage(selectedItem.value.customId)
  selectedKey.value = null
  editPkg.value = null
  isDirty.value = false
  deleteModalOpen.value = false
}
</script>

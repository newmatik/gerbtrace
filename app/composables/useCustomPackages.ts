import Dexie from 'dexie'
import { toRaw } from 'vue'
import type { PackageDefinition } from '~/utils/package-types'

interface CustomPackageRecord {
  id?: number
  /** The full PackageDefinition JSON */
  data: PackageDefinition
  createdAt: Date
  updatedAt: Date
}

class PackageDB extends Dexie {
  packages!: Dexie.Table<CustomPackageRecord, number>

  constructor() {
    super('GerbtracePackagesDB')
    this.version(1).stores({
      packages: '++id, createdAt, updatedAt',
    })
  }
}

const db = new PackageDB()

function deepToRaw<T>(val: T): T {
  const raw = toRaw(val)
  if (Array.isArray(raw)) return raw.map(deepToRaw) as T
  if (raw !== null && typeof raw === 'object' && !(raw instanceof Date) && !(raw instanceof Blob)) {
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, deepToRaw(v)]),
    ) as T
  }
  return raw
}

function toIndexedDbSafe<T>(val: T): T {
  const raw = deepToRaw(val)
  try {
    return structuredClone(raw)
  } catch {
    return JSON.parse(
      JSON.stringify(raw, (_, value) => {
        if (typeof value === 'bigint') return value.toString()
        if (typeof value === 'function' || typeof value === 'symbol') return undefined
        return value
      }),
    ) as T
  }
}

/**
 * Composable for CRUD operations on user-created custom packages.
 * Stores packages in IndexedDB (separate DB from projects).
 */
export function useCustomPackages() {
  const packages = ref<CustomPackageRecord[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  async function loadCustomPackages() {
    if (loading.value) return
    loading.value = true
    try {
      packages.value = await db.packages.orderBy('updatedAt').reverse().toArray()
      loaded.value = true
    } catch (err) {
      console.warn('[CustomPackages] Failed to load', err)
    } finally {
      loading.value = false
    }
  }

  async function addPackage(pkg: PackageDefinition): Promise<number> {
    const now = new Date()
    const record: CustomPackageRecord = {
      data: toIndexedDbSafe(pkg),
      createdAt: now,
      updatedAt: now,
    }
    const id = await db.packages.add(record)
    await loadCustomPackages()
    return id
  }

  async function updatePackage(id: number, pkg: PackageDefinition) {
    await db.packages.update(id, { data: toIndexedDbSafe(pkg), updatedAt: new Date() })
    await loadCustomPackages()
  }

  async function removePackage(id: number) {
    await db.packages.delete(id)
    await loadCustomPackages()
  }

  /** Get just the PackageDefinition objects */
  const customDefinitions = computed<PackageDefinition[]>(() =>
    packages.value.map(r => r.data),
  )

  // Auto-load on client
  if (import.meta.client) {
    loadCustomPackages()
  }

  return {
    packages,
    customDefinitions,
    loaded,
    loading,
    loadCustomPackages,
    addPackage,
    updatePackage,
    removePackage,
  }
}

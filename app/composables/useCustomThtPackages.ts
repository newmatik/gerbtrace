import Dexie from 'dexie'
import { toRaw } from 'vue'
import type { THTPackageDefinition } from '~/utils/tht-package-types'

interface CustomThtPackageRecord {
  id?: number
  /** The full THTPackageDefinition JSON */
  data: THTPackageDefinition
  createdAt: Date
  updatedAt: Date
}

class ThtPackageDB extends Dexie {
  packages!: Dexie.Table<CustomThtPackageRecord, number>

  constructor() {
    super('GerbtraceTHTPackagesDB')
    this.version(1).stores({
      packages: '++id, createdAt, updatedAt',
    })
  }
}

const db = new ThtPackageDB()

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
 * Composable for CRUD operations on user-created custom THT packages.
 * Stores packages in IndexedDB (separate DB from SMD packages and projects).
 */
export function useCustomThtPackages() {
  const packages = ref<CustomThtPackageRecord[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  async function loadCustomThtPackages() {
    if (loading.value) return
    loading.value = true
    try {
      packages.value = await db.packages.orderBy('updatedAt').reverse().toArray()
      loaded.value = true
    } catch (err) {
      console.warn('[CustomThtPackages] Failed to load', err)
    } finally {
      loading.value = false
    }
  }

  async function addPackage(pkg: THTPackageDefinition): Promise<number> {
    const now = new Date()
    const record: CustomThtPackageRecord = {
      data: toIndexedDbSafe(pkg),
      createdAt: now,
      updatedAt: now,
    }
    const id = await db.packages.add(record)
    await loadCustomThtPackages()
    return id
  }

  async function updatePackage(id: number, pkg: THTPackageDefinition) {
    await db.packages.update(id, { data: toIndexedDbSafe(pkg), updatedAt: new Date() })
    await loadCustomThtPackages()
  }

  async function removePackage(id: number) {
    await db.packages.delete(id)
    await loadCustomThtPackages()
  }

  /** Get just the THTPackageDefinition objects */
  const customThtDefinitions = computed<THTPackageDefinition[]>(() =>
    packages.value.map(r => r.data),
  )

  // Auto-load on client
  if (import.meta.client) {
    loadCustomThtPackages()
  }

  return {
    packages,
    customThtDefinitions,
    loaded,
    loading,
    loadCustomThtPackages,
    addPackage,
    updatePackage,
    removePackage,
  }
}

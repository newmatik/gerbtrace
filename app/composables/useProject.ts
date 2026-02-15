import Dexie from 'dexie'
import type { GerberFile } from '~/utils/gerber-helpers'
import type { PnPConvention } from '~/utils/pnp-conventions'

interface ProjectRecord {
  id?: number
  name: string
  mode: 'viewer' | 'compare'
  createdAt: Date
  updatedAt: Date
  /** PnP origin X in Gerber coordinate units (null = auto / default) */
  pnpOriginX?: number | null
  /** PnP origin Y in Gerber coordinate units */
  pnpOriginY?: number | null
  /** PnP orientation convention (null = default 'mycronic') */
  pnpConvention?: PnPConvention | null
  /** Per-component PnP rotation overrides keyed by stable component key */
  pnpRotationOverrides?: Record<string, number> | null
  /** Component keys marked as DNP (Do Not Populate) */
  pnpDnpComponents?: string[] | null
  /** Manual mapping from CAD package string -> our package name */
  pnpCadPackageMap?: Record<string, string> | null
  /** Per-component polarized overrides keyed by stable component key */
  pnpPolarizedOverrides?: Record<string, boolean> | null
}

interface FileRecord {
  id?: number
  projectId: number
  packet: number
  fileName: string
  content: string
  layerType?: string
}

class GerbtraceDB extends Dexie {
  projects!: Dexie.Table<ProjectRecord, number>
  files!: Dexie.Table<FileRecord, number>

  constructor() {
    super('GerbtraceDB')
    this.version(1).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v2: add layerType column to files (non-indexed, just stored)
    this.version(2).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v3: add pnpOriginX/pnpOriginY to projects (non-indexed, just stored)
    this.version(3).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v4: add pnpConvention to projects (non-indexed, just stored)
    this.version(4).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v5: add pnpRotationOverrides to projects (non-indexed, just stored)
    this.version(5).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v6: add pnpDnpComponents to projects (non-indexed, just stored)
    this.version(6).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v7: add pnpCadPackageMap to projects (non-indexed, just stored)
    this.version(7).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v8: add pnpPolarizedOverrides to projects (non-indexed, just stored)
    this.version(8).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
  }
}

const db = new GerbtraceDB()

export function useProject() {
  const projects = ref<ProjectRecord[]>([])

  async function loadProjects() {
    projects.value = await db.projects.orderBy('updatedAt').reverse().toArray()
  }

  async function createNewProject(mode: 'viewer' | 'compare', name?: string): Promise<ProjectRecord> {
    const now = new Date()
    const project: ProjectRecord = {
      name: name || `${mode === 'viewer' ? 'View' : 'Compare'} Project ${now.toLocaleDateString()}`,
      mode,
      createdAt: now,
      updatedAt: now,
    }
    project.id = await db.projects.add(project)
    await loadProjects()
    return project
  }

  async function getProject(id: number): Promise<ProjectRecord | undefined> {
    return db.projects.get(id)
  }

  async function removeProject(id: number) {
    await db.files.where('projectId').equals(id).delete()
    await db.projects.delete(id)
    await loadProjects()
  }

  async function getFiles(projectId: number, packet: number): Promise<GerberFile[]> {
    const records = await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet)
      .toArray()
    return records.map(r => ({
      fileName: r.fileName,
      content: r.content,
      layerType: r.layerType,
    }))
  }

  async function addFiles(projectId: number, packet: number, files: GerberFile[]) {
    const records: FileRecord[] = files.map(f => ({
      projectId,
      packet,
      fileName: f.fileName,
      content: f.content,
      layerType: f.layerType,
    }))
    await db.files.bulkAdd(records)
    await db.projects.update(projectId, { updatedAt: new Date() })
  }

  /**
   * Merge files into a project packet: overwrite existing files with the same
   * name, add new files, keep everything else untouched.
   */
  async function upsertFiles(projectId: number, packet: number, files: GerberFile[]) {
    for (const f of files) {
      const existing = await db.files
        .where('projectId').equals(projectId)
        .and(r => r.packet === packet && r.fileName === f.fileName)
        .first()
      if (existing?.id) {
        await db.files.update(existing.id, { content: f.content, layerType: f.layerType })
      } else {
        await db.files.add({
          projectId,
          packet,
          fileName: f.fileName,
          content: f.content,
          layerType: f.layerType,
        })
      }
    }
    await db.projects.update(projectId, { updatedAt: new Date() })
  }

  async function updateFileLayerType(projectId: number, packet: number, fileName: string, layerType: string) {
    const record = await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet && r.fileName === fileName)
      .first()
    if (record?.id) {
      await db.files.update(record.id, { layerType })
      await db.projects.update(projectId, { updatedAt: new Date() })
    }
  }

  async function updateFileContent(projectId: number, packet: number, fileName: string, content: string) {
    const record = await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet && r.fileName === fileName)
      .first()
    if (record?.id) {
      await db.files.update(record.id, { content })
      await db.projects.update(projectId, { updatedAt: new Date() })
    }
  }

  async function renameProject(id: number, name: string) {
    await db.projects.update(id, { name, updatedAt: new Date() })
    await loadProjects()
  }

  async function updateProjectOrigin(id: number, originX: number | null, originY: number | null) {
    await db.projects.update(id, { pnpOriginX: originX, pnpOriginY: originY, updatedAt: new Date() })
  }

  async function updateProjectConvention(id: number, convention: PnPConvention) {
    await db.projects.update(id, { pnpConvention: convention, updatedAt: new Date() })
  }

  async function updateProjectRotationOverrides(id: number, overrides: Record<string, number>) {
    await db.projects.update(id, { pnpRotationOverrides: overrides, updatedAt: new Date() })
  }

  async function updateProjectDnp(id: number, dnpKeys: string[]) {
    await db.projects.update(id, { pnpDnpComponents: dnpKeys, updatedAt: new Date() })
  }

  async function updateProjectCadPackageMap(id: number, map: Record<string, string>) {
    await db.projects.update(id, { pnpCadPackageMap: map, updatedAt: new Date() })
  }

  async function updateProjectPolarizedOverrides(id: number, overrides: Record<string, boolean>) {
    await db.projects.update(id, { pnpPolarizedOverrides: overrides, updatedAt: new Date() })
  }

  async function clearFiles(projectId: number, packet: number) {
    await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet)
      .delete()
  }

  // Load on init
  if (import.meta.client) {
    loadProjects()
  }

  return {
    projects,
    loadProjects,
    createNewProject,
    getProject,
    removeProject,
    renameProject,
    getFiles,
    addFiles,
    upsertFiles,
    clearFiles,
    updateFileContent,
    updateFileLayerType,
    updateProjectOrigin,
    updateProjectConvention,
    updateProjectRotationOverrides,
    updateProjectDnp,
    updateProjectCadPackageMap,
    updateProjectPolarizedOverrides,
  }
}

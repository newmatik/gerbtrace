import Dexie from 'dexie'
import type { GerberFile } from '~/utils/gerber-helpers'

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
    clearFiles,
    updateFileContent,
    updateFileLayerType,
    updateProjectOrigin,
  }
}

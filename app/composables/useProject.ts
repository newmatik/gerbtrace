import Dexie from 'dexie'
import { toRaw } from 'vue'
import type { GerberFile } from '~/utils/gerber-helpers'
import type { PnPConvention } from '~/utils/pnp-conventions'
import type { PnPColumnMapping, PnPCoordUnit } from '~/utils/pnp-parser'
import type { BomColumnMapping } from '~/utils/bom-types'
import type { BomLine, BomPricingCache } from '~/utils/bom-types'
import type { SurfaceFinish, CopperWeight } from '~/utils/pcb-pricing'
import type { DocumentType } from '~/utils/document-types'
import type { PanelConfig } from '~/utils/panel-types'
import type { PasteSettings } from '~/composables/usePasteSettings'

/**
 * Recursively strip Vue reactivity proxies so objects can be stored in IndexedDB.
 * IndexedDB uses the structured-clone algorithm which cannot handle Proxy objects.
 */
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
    // Final safety net: strip unsupported values rather than failing writes.
    return JSON.parse(JSON.stringify(raw)) as T
  }
}

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
  /** PnP orientation convention (null = default 'iec61188') */
  pnpConvention?: PnPConvention | null
  /** Per-component PnP rotation overrides keyed by stable component key */
  pnpRotationOverrides?: Record<string, number> | null
  /** Component keys marked as DNP (Do Not Populate) */
  pnpDnpComponents?: string[] | null
  /** Manual mapping from CAD package string -> our package name */
  pnpCadPackageMap?: Record<string, string> | null
  /** Per-component polarized overrides keyed by stable component key */
  pnpPolarizedOverrides?: Record<string, boolean> | null
  /** Per-component user notes keyed by stable component key */
  pnpComponentNotes?: Record<string, string> | null
  /** Per-component field overrides (designator, value, x, y) */
  pnpFieldOverrides?: Record<string, { designator?: string; value?: string; description?: string; x?: number; y?: number }> | null
  /** User-added manual components */
  pnpManualComponents?: { id: string; designator: string; value: string; description?: string; package: string; x: number; y: number; rotation: number; side: 'top' | 'bottom'; componentType?: 'smd' | 'tht' }[] | null
  /** Component keys deleted by the user (parsed components removed from view) */
  pnpDeletedComponents?: string[] | null
  /** Persisted sort state for SMD component table */
  pnpSortSmd?: { key: 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package' | null; asc: boolean } | null
  /** Persisted sort state for THT component table */
  pnpSortTht?: { key: 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package' | null; asc: boolean } | null
  /** Persisted manual row order for SMD component table */
  pnpManualOrderSmd?: string[] | null
  /** Persisted manual row order for THT component table */
  pnpManualOrderTht?: string[] | null
  /** Persisted user-defined PnP groups for SMD/THT */
  pnpComponentGroups?: { id: string; componentType: 'smd' | 'tht'; name: string; comment: string; hidden: boolean; collapsed: boolean }[] | null
  /** Component key -> group id assignment map */
  pnpGroupAssignments?: Record<string, string> | null
  /** Per-THT-component assembly type overrides */
  pnpAssemblyTypes?: Record<string, string> | null
  /** BOM line items */
  bomLines?: BomLine[] | null
  /** Cached Elexess pricing data keyed by manufacturer part number */
  bomPricingCache?: BomPricingCache | null
  /** Board quantity for BOM pricing calculation */
  bomBoardQuantity?: number | null
  /** PCB board parameters for pricing estimation */
  pcbData?: {
    sizeX?: number            // mm
    sizeY?: number            // mm
    layerCount?: number       // 1, 2, 4, 6, 8, 10
    surfaceFinish?: SurfaceFinish
    copperWeight?: CopperWeight
    innerCopperWeight?: '0.5oz' | CopperWeight
    thicknessMm?: number
    solderMaskColor?: 'green' | 'black' | 'blue' | 'red' | 'white' | 'purple' | 'brown'
    material?: 'FR4' | 'IMS-AL' | 'Flex' | 'Rigid-Flex'
    panelizationMode?: 'single' | 'panelized'
    pricingQuantities?: number[]
    selectedPricingQuantity?: number
  } | null
  /** Panel configuration for panelization */
  panelData?: PanelConfig | null
  /** Paste application settings (stencil vs jetprint) */
  pasteSettings?: PasteSettings | null
  /** Persisted layer ordering by file name */
  layerOrder?: string[] | null
  /** Persisted document ordering by file name */
  documentOrder?: string[] | null
  /** Per-file BOM import options (header skip + mapping + optional fixed-width markers) */
  bomFileImportOptions?: Record<string, { skipRows?: number; skipBottomRows?: number; mapping?: BomColumnMapping; fixedColumns?: readonly number[] }> | null
  /** Per-file PnP import options (header skip + mapping + unit override + optional fixed-width markers) */
  pnpFileImportOptions?: Record<string, { skipRows?: number; skipBottomRows?: number; mapping?: PnPColumnMapping; unitOverride?: 'auto' | PnPCoordUnit; fixedColumns?: readonly number[] }> | null
  /** Small PNG thumbnail of the rendered PCB board */
  previewImage?: Blob | null
}

interface FileRecord {
  id?: number
  projectId: number
  packet: number
  fileName: string
  content: string
  layerType?: string
}

interface FileOriginalRecord {
  id?: number
  projectId: number
  packet: number
  fileName: string
  content: string
}

interface DocumentRecord {
  id?: number
  projectId: number
  fileName: string
  docType: DocumentType
  /** PDF binary data stored as Blob for efficient IndexedDB storage */
  data: Blob
}

class GerbtraceDB extends Dexie {
  projects!: Dexie.Table<ProjectRecord, number>
  files!: Dexie.Table<FileRecord, number>
  fileOriginals!: Dexie.Table<FileOriginalRecord, number>
  documents!: Dexie.Table<DocumentRecord, number>

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
    // v9: add pnpComponentNotes to projects (non-indexed, just stored)
    this.version(9).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v10: add pnpFieldOverrides and pnpManualComponents to projects
    this.version(10).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
    })
    // v11: add fileOriginals table for tracking original layer content across reloads
    this.version(11).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
    })
    // v12: add pnpDeletedComponents to projects (non-indexed, just stored)
    this.version(12).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
    })
    // v13: add bomLines and bomPricingCache to projects (non-indexed, just stored)
    this.version(13).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
    })
    // v14: add pcbData to projects (non-indexed, just stored)
    this.version(14).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
    })
    // v15: add documents table for PDF document storage
    this.version(15).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v16: add bomBoardQuantity to projects (non-indexed, just stored)
    this.version(16).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v17: add panelData to projects (non-indexed, just stored)
    this.version(17).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v18: add persisted PnP sort/group state to projects
    this.version(18).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v19: add persisted manual PnP order state
    this.version(19).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v20: add paste settings (non-indexed, just stored)
    this.version(20).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v21: add persisted layer/document ordering
    this.version(21).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v22: add per-file BOM/PnP import options to projects
    this.version(22).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
    })
    // v23: add previewImage (Blob) to projects for PCB thumbnail
    this.version(23).stores({
      projects: '++id, name, mode, createdAt, updatedAt',
      files: '++id, projectId, packet, fileName',
      fileOriginals: '++id, projectId, packet, fileName',
      documents: '++id, projectId, fileName',
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
    await db.fileOriginals.where('projectId').equals(id).delete()
    await db.documents.where('projectId').equals(id).delete()
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
    await db.projects.update(id, { pnpRotationOverrides: toIndexedDbSafe(overrides), updatedAt: new Date() })
  }

  async function updateProjectDnp(id: number, dnpKeys: string[]) {
    await db.projects.update(id, { pnpDnpComponents: toIndexedDbSafe(dnpKeys), updatedAt: new Date() })
  }

  async function updateProjectCadPackageMap(id: number, map: Record<string, string>) {
    await db.projects.update(id, { pnpCadPackageMap: toIndexedDbSafe(map), updatedAt: new Date() })
  }

  async function updateProjectPolarizedOverrides(id: number, overrides: Record<string, boolean>) {
    await db.projects.update(id, { pnpPolarizedOverrides: toIndexedDbSafe(overrides), updatedAt: new Date() })
  }

  async function updateProjectComponentNotes(id: number, notes: Record<string, string>) {
    await db.projects.update(id, { pnpComponentNotes: toIndexedDbSafe(notes), updatedAt: new Date() })
  }

  async function updateProjectFieldOverrides(id: number, overrides: Record<string, { designator?: string; value?: string; description?: string; x?: number; y?: number }>) {
    await db.projects.update(id, { pnpFieldOverrides: toIndexedDbSafe(overrides), updatedAt: new Date() })
  }

  async function updateProjectManualComponents(id: number, components: { id: string; designator: string; value: string; description?: string; package: string; x: number; y: number; rotation: number; side: 'top' | 'bottom'; componentType?: 'smd' | 'tht' }[]) {
    await db.projects.update(id, { pnpManualComponents: toIndexedDbSafe(components), updatedAt: new Date() })
  }

  async function updateProjectDeletedComponents(id: number, keys: string[]) {
    await db.projects.update(id, { pnpDeletedComponents: toIndexedDbSafe(keys), updatedAt: new Date() })
  }

  async function updateProjectSortSmd(id: number, sortState: { key: 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package' | null; asc: boolean }) {
    await db.projects.update(id, { pnpSortSmd: toIndexedDbSafe(sortState), updatedAt: new Date() })
  }

  async function updateProjectSortTht(id: number, sortState: { key: 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package' | null; asc: boolean }) {
    await db.projects.update(id, { pnpSortTht: toIndexedDbSafe(sortState), updatedAt: new Date() })
  }

  async function updateProjectManualOrderSmd(id: number, keys: string[]) {
    await db.projects.update(id, { pnpManualOrderSmd: toIndexedDbSafe(keys), updatedAt: new Date() })
  }

  async function updateProjectManualOrderTht(id: number, keys: string[]) {
    await db.projects.update(id, { pnpManualOrderTht: toIndexedDbSafe(keys), updatedAt: new Date() })
  }

  async function updateProjectComponentGroups(id: number, groups: { id: string; componentType: 'smd' | 'tht'; name: string; comment: string; hidden: boolean; collapsed: boolean }[]) {
    await db.projects.update(id, { pnpComponentGroups: toIndexedDbSafe(groups), updatedAt: new Date() })
  }

  async function updateProjectGroupAssignments(id: number, assignments: Record<string, string>) {
    await db.projects.update(id, { pnpGroupAssignments: toIndexedDbSafe(assignments), updatedAt: new Date() })
  }

  async function updatePnpAssemblyTypes(id: number, types: Record<string, string>) {
    await db.projects.update(id, { pnpAssemblyTypes: toIndexedDbSafe(types), updatedAt: new Date() })
  }

  async function updateBomLines(id: number, lines: BomLine[]) {
    await db.projects.update(id, { bomLines: toIndexedDbSafe(lines), updatedAt: new Date() })
  }

  async function updateBomPricingCache(id: number, cache: BomPricingCache) {
    await db.projects.update(id, { bomPricingCache: toIndexedDbSafe(cache), updatedAt: new Date() })
  }

  async function updateBomBoardQuantity(id: number, qty: number) {
    await db.projects.update(id, { bomBoardQuantity: qty, updatedAt: new Date() })
  }

  async function updatePcbData(id: number, pcbData: ProjectRecord['pcbData']) {
    await db.projects.update(id, { pcbData: toIndexedDbSafe(pcbData), updatedAt: new Date() })
  }

  async function updatePanelData(id: number, panelData: ProjectRecord['panelData']) {
    await db.projects.update(id, { panelData: toIndexedDbSafe(panelData), updatedAt: new Date() })
  }

  async function updatePasteSettings(id: number, pasteSettings: ProjectRecord['pasteSettings']) {
    await db.projects.update(id, { pasteSettings: toIndexedDbSafe(pasteSettings), updatedAt: new Date() })
  }

  async function updateLayerOrder(id: number, layerOrder: string[]) {
    await db.projects.update(id, { layerOrder: toIndexedDbSafe(layerOrder), updatedAt: new Date() })
  }

  async function updateDocumentOrder(id: number, documentOrder: string[]) {
    await db.projects.update(id, { documentOrder: toIndexedDbSafe(documentOrder), updatedAt: new Date() })
  }

  async function updateBomFileImportOptions(
    id: number,
    options: Record<string, { skipRows?: number; skipBottomRows?: number; mapping?: BomColumnMapping; fixedColumns?: readonly number[] }>,
  ) {
    await db.projects.update(id, { bomFileImportOptions: toIndexedDbSafe(options), updatedAt: new Date() })
  }

  async function updatePnpFileImportOptions(
    id: number,
    options: Record<string, { skipRows?: number; skipBottomRows?: number; mapping?: PnPColumnMapping; unitOverride?: 'auto' | PnPCoordUnit; fixedColumns?: readonly number[] }>,
  ) {
    await db.projects.update(id, { pnpFileImportOptions: toIndexedDbSafe(options), updatedAt: new Date() })
  }

  async function updateProjectPreview(id: number, blob: Blob | null) {
    await db.projects.update(id, { previewImage: blob, updatedAt: new Date() })
  }

  // ── File originals (for edit detection and reset) ──

  async function getOriginalFiles(projectId: number, packet: number): Promise<Map<string, string>> {
    const records = await db.fileOriginals
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet)
      .toArray()
    const map = new Map<string, string>()
    for (const r of records) map.set(r.fileName, r.content)
    return map
  }

  async function storeOriginalFiles(projectId: number, packet: number, files: { fileName: string; content: string }[]) {
    for (const f of files) {
      const existing = await db.fileOriginals
        .where('projectId').equals(projectId)
        .and(r => r.packet === packet && r.fileName === f.fileName)
        .first()
      if (existing?.id) {
        await db.fileOriginals.update(existing.id, { content: f.content })
      } else {
        await db.fileOriginals.add({ projectId, packet, fileName: f.fileName, content: f.content })
      }
    }
  }

  async function renameOriginalFile(projectId: number, packet: number, oldName: string, newName: string) {
    const record = await db.fileOriginals
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet && r.fileName === oldName)
      .first()
    if (record?.id) {
      await db.fileOriginals.update(record.id, { fileName: newName })
    }
  }

  async function removeOriginalFile(projectId: number, packet: number, fileName: string) {
    await db.fileOriginals
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet && r.fileName === fileName)
      .delete()
  }

  async function renameFile(projectId: number, packet: number, oldName: string, newName: string) {
    const record = await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet && r.fileName === oldName)
      .first()
    if (record?.id) {
      await db.files.update(record.id, { fileName: newName })
      await db.projects.update(projectId, { updatedAt: new Date() })
    }
  }

  async function removeFile(projectId: number, packet: number, fileName: string) {
    await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet && r.fileName === fileName)
      .delete()
    await db.projects.update(projectId, { updatedAt: new Date() })
  }

  async function clearFiles(projectId: number, packet: number) {
    await db.files
      .where('projectId').equals(projectId)
      .and(r => r.packet === packet)
      .delete()
  }

  // ── Document storage (PDF files) ──

  async function getDocuments(projectId: number): Promise<{ fileName: string; docType: DocumentType; data: Blob }[]> {
    const records = await db.documents
      .where('projectId').equals(projectId)
      .toArray()
    return records.map(r => ({ fileName: r.fileName, docType: r.docType, data: r.data }))
  }

  async function addDocument(projectId: number, fileName: string, docType: DocumentType, data: Blob) {
    await db.documents.add({ projectId, fileName, docType, data })
    await db.projects.update(projectId, { updatedAt: new Date() })
  }

  async function removeDocument(projectId: number, fileName: string) {
    await db.documents
      .where('projectId').equals(projectId)
      .and(r => r.fileName === fileName)
      .delete()
    await db.projects.update(projectId, { updatedAt: new Date() })
  }

  async function updateDocumentType(projectId: number, fileName: string, docType: DocumentType) {
    const record = await db.documents
      .where('projectId').equals(projectId)
      .and(r => r.fileName === fileName)
      .first()
    if (record?.id) {
      await db.documents.update(record.id, { docType })
    }
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
    renameFile,
    removeFile,
    getOriginalFiles,
    storeOriginalFiles,
    renameOriginalFile,
    removeOriginalFile,
    updateFileContent,
    updateFileLayerType,
    updateProjectOrigin,
    updateProjectConvention,
    updateProjectRotationOverrides,
    updateProjectDnp,
    updateProjectCadPackageMap,
    updateProjectPolarizedOverrides,
    updateProjectComponentNotes,
    updateProjectFieldOverrides,
    updateProjectManualComponents,
    updateProjectDeletedComponents,
    updateProjectSortSmd,
    updateProjectSortTht,
    updateProjectManualOrderSmd,
    updateProjectManualOrderTht,
    updateProjectComponentGroups,
    updateProjectGroupAssignments,
    updatePnpAssemblyTypes,
    updateBomLines,
    updateBomPricingCache,
    updateBomBoardQuantity,
    updatePcbData,
    updatePanelData,
    updatePasteSettings,
    updateLayerOrder,
    updateDocumentOrder,
    updateBomFileImportOptions,
    updatePnpFileImportOptions,
    updateProjectPreview,
    getDocuments,
    addDocument,
    removeDocument,
    updateDocumentType,
  }
}

export type DocumentType = 'Schematics' | 'Drawings' | 'Datasheets' | 'Instructions'

export interface ProjectDocument {
  id: string
  name: string
  type: DocumentType
  blobUrl: string
  /** Supabase record ID (team projects only) */
  dbId?: string
  /** Supabase storage path (team projects only) */
  storagePath?: string
}

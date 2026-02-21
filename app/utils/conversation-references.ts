export type ReferenceType = 'file' | 'bom' | 'pnp' | 'doc'

export interface ConversationReference {
  type: ReferenceType
  id: string
  fallbackLabel: string
}

export interface ConversationReferenceItem {
  type: ReferenceType
  id: string
  label: string
  sublabel?: string
  icon: string
}

export interface ReferenceResolveResult {
  type: ReferenceType
  id: string
  label: string
  icon: string
  exists: boolean
}

const REFERENCE_ICONS: Record<ReferenceType, string> = {
  file: 'i-lucide-file',
  bom: 'i-lucide-list',
  pnp: 'i-lucide-cpu',
  doc: 'i-lucide-file-text',
}

export function referenceIcon(type: ReferenceType): string {
  return REFERENCE_ICONS[type] ?? 'i-lucide-link'
}

export function serializeReference(type: ReferenceType, id: string, label: string): string {
  return `{{ref:${type}:${id}:${label}}}`
}

export const REFERENCE_REGEX = /\{\{ref:(\w+):([^:}]+):([^}]+)\}\}/g

export function parseReferences(body: string): ConversationReference[] {
  const results: ConversationReference[] = []
  for (const match of body.matchAll(REFERENCE_REGEX)) {
    results.push({
      type: match[1] as ReferenceType,
      id: match[2],
      fallbackLabel: match[3],
    })
  }
  return results
}

export function resolveReference(
  ref: ConversationReference,
  items: ConversationReferenceItem[],
): ReferenceResolveResult {
  const match = items.find(item => item.type === ref.type && item.id === ref.id)
  if (match) {
    return {
      type: ref.type,
      id: ref.id,
      label: match.label,
      icon: match.icon,
      exists: true,
    }
  }
  return {
    type: ref.type,
    id: ref.id,
    label: ref.fallbackLabel,
    icon: referenceIcon(ref.type),
    exists: false,
  }
}

export const REFERENCE_CATEGORY_LABELS: Record<ReferenceType, string> = {
  file: 'Files',
  bom: 'BOM Lines',
  pnp: 'Components',
  doc: 'Documents',
}

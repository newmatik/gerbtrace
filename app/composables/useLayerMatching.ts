import type { GerberFile, LayerMatch } from '~/utils/gerber-helpers'
import { normalizeLayerName, detectLayerType } from '~/utils/gerber-helpers'

export function useLayerMatching() {
  function autoMatch(filesA: GerberFile[], filesB: GerberFile[]): LayerMatch[] {
    const matches: LayerMatch[] = []
    const usedB = new Set<number>()

    for (const fileA of filesA) {
      let bestMatch: GerberFile | null = null
      let bestScore = 0
      let bestIdx = -1

      for (let i = 0; i < filesB.length; i++) {
        if (usedB.has(i)) continue
        const score = matchScore(fileA, filesB[i])
        if (score > bestScore) {
          bestScore = score
          bestMatch = filesB[i]
          bestIdx = i
        }
      }

      if (bestMatch && bestScore > 0 && bestIdx >= 0) {
        usedB.add(bestIdx)
      }

      matches.push({
        fileA,
        fileB: bestScore > 0 ? bestMatch : null,
        identical: bestMatch ? fileA.content === bestMatch.content : false,
        type: detectLayerType(fileA.fileName),
      })
    }

    return matches
  }

  function matchScore(a: GerberFile, b: GerberFile): number {
    // Exact name match
    if (a.fileName === b.fileName) return 100

    // Normalized name match
    const normA = normalizeLayerName(a.fileName)
    const normB = normalizeLayerName(b.fileName)
    if (normA === normB) return 80

    // Extension match
    const extA = a.fileName.slice(a.fileName.lastIndexOf('.')).toLowerCase()
    const extB = b.fileName.slice(b.fileName.lastIndexOf('.')).toLowerCase()
    if (extA === extB && extA.length > 1) return 60

    // Layer type match
    const typeA = detectLayerType(a.fileName)
    const typeB = detectLayerType(b.fileName)
    if (typeA !== 'Unmatched' && typeA === typeB) return 40

    return 0
  }

  return { autoMatch }
}

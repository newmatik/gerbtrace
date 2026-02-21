export interface FixedWidthDetectionResult {
  markers: number[]
  confidence: number
}

function charAt(line: string, index: number): string {
  if (index < 0 || index >= line.length) return ' '
  return line[index] ?? ' '
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t'
}

export function splitFixedWidthLine(line: string, markers: readonly number[]): string[] {
  const sorted = [...new Set(markers)]
    .map(v => Math.floor(Number(v)))
    .filter(v => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)

  if (sorted.length === 0) return [line.trim()]

  const cells: string[] = []
  let start = 0
  for (const end of sorted) {
    cells.push(line.slice(start, end).trim())
    start = end
  }
  cells.push(line.slice(start).trim())
  return cells
}

export function parseFixedWidthText(text: string, markers: readonly number[]): string[][] {
  const lines = text.split(/\r?\n/)
  const rows = lines.map(line => splitFixedWidthLine(line, markers))
  while (rows.length > 0 && rows[rows.length - 1]?.every(c => c.trim() === '')) {
    rows.pop()
  }
  return rows
}

export function detectFixedWidthMarkers(text: string): FixedWidthDetectionResult {
  const source = text.split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .slice(0, 80)

  if (source.length < 3) return { markers: [], confidence: 0 }

  let maxLen = 0
  for (const line of source) {
    if (line.length > maxLen) maxLen = line.length
  }
  if (maxLen < 8) return { markers: [], confidence: 0 }

  const candidateScores: Array<{ pos: number; score: number }> = []
  const lineCount = source.length

  for (let i = 1; i < maxLen - 1; i++) {
    let leftNonSpace = 0
    let atSpace = 0
    let rightNonSpace = 0

    for (const line of source) {
      if (!isSpace(charAt(line, i - 1))) leftNonSpace++
      if (isSpace(charAt(line, i))) atSpace++
      if (!isSpace(charAt(line, i + 1))) rightNonSpace++
    }

    const score = Math.min(leftNonSpace, atSpace, rightNonSpace) / lineCount
    if (score >= 0.42) candidateScores.push({ pos: i, score })
  }

  if (candidateScores.length === 0) return { markers: [], confidence: 0 }

  // Merge neighboring positions that belong to the same visual gap.
  const clustered: number[] = []
  let clusterStart = candidateScores[0]!.pos
  let clusterEnd = candidateScores[0]!.pos
  for (let i = 1; i < candidateScores.length; i++) {
    const current = candidateScores[i]!.pos
    if (current <= clusterEnd + 1) {
      clusterEnd = current
      continue
    }
    clustered.push(Math.round((clusterStart + clusterEnd) / 2))
    clusterStart = current
    clusterEnd = current
  }
  clustered.push(Math.round((clusterStart + clusterEnd) / 2))

  const markers = clustered
    .filter(v => v >= 2)
    .filter((v, idx, arr) => idx === 0 || v - arr[idx - 1]! >= 2)

  if (markers.length < 2) return { markers: [], confidence: 0 }

  const avgScore = candidateScores.reduce((sum, item) => sum + item.score, 0) / candidateScores.length
  const confidence = Math.min(1, Math.max(0, avgScore))
  return { markers, confidence }
}

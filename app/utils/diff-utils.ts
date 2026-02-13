import { diffLines, type Change } from 'diff'

export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged'
  content: string
  lineA?: number
  lineB?: number
}

export function computeTextDiff(textA: string, textB: string): DiffLine[] {
  const changes: Change[] = diffLines(textA, textB)
  const lines: DiffLine[] = []
  let lineA = 1
  let lineB = 1

  for (const change of changes) {
    const content = change.value.replace(/\n$/, '')
    const subLines = content.split('\n')

    for (const sub of subLines) {
      if (change.added) {
        lines.push({ type: 'add', content: sub, lineB })
        lineB++
      } else if (change.removed) {
        lines.push({ type: 'remove', content: sub, lineA })
        lineA++
      } else {
        lines.push({ type: 'unchanged', content: sub, lineA, lineB })
        lineA++
        lineB++
      }
    }
  }

  return lines
}

export function getDiffStats(lines: DiffLine[]): { added: number; removed: number; unchanged: number } {
  let added = 0
  let removed = 0
  let unchanged = 0
  for (const line of lines) {
    if (line.type === 'add') added++
    else if (line.type === 'remove') removed++
    else unchanged++
  }
  return { added, removed, unchanged }
}

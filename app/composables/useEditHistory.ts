/**
 * Session-scoped undo history for gerber file edits.
 *
 * Each entry captures the previous file contents before a destructive edit
 * (e.g. deleting traces). The stack lives only for the current page session —
 * navigating away or reopening the project starts fresh.
 */

interface UndoEntry {
  /** Snapshots of file contents before the edit, keyed by fileName */
  snapshots: Map<string, string>
  /** Human-readable label, e.g. "Deleted 3 objects" */
  description: string
}

export function useEditHistory(maxEntries = 50) {
  const stack = ref<UndoEntry[]>([])

  const canUndo = computed(() => stack.value.length > 0)
  const undoCount = computed(() => stack.value.length)
  const lastDescription = computed(() => stack.value.length > 0 ? stack.value[stack.value.length - 1].description : '')

  /** Record a snapshot of layer contents before a destructive operation. */
  function pushEntry(snapshots: Map<string, string>, description: string) {
    stack.value = [...stack.value, { snapshots, description }]
    if (stack.value.length > maxEntries) {
      stack.value = stack.value.slice(stack.value.length - maxEntries)
    }
  }

  /** Pop and return the most recent undo entry, or undefined if empty. */
  function popEntry(): UndoEntry | undefined {
    if (stack.value.length === 0) return undefined
    const entry = stack.value[stack.value.length - 1]
    stack.value = stack.value.slice(0, -1)
    return entry
  }

  function clear() {
    stack.value = []
  }

  return {
    canUndo,
    undoCount,
    lastDescription,
    pushEntry,
    popEntry,
    clear,
  }
}

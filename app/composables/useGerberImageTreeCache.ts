import type { ImageTree } from '@lib/gerber/types'
import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'
import GerberParseWorker from '~/workers/gerber-parse.worker?worker'

interface LayerLike {
  file: {
    fileName: string
    content: string
  }
}

interface WorkerResultOk {
  id: number
  key: string
  ok: true
  tree: ImageTree
}

interface WorkerResultErr {
  id: number
  key: string
  ok: false
  error: string
}

const imageTreeCache = new Map<string, ImageTree>()
const prewarmPromises = new Map<string, Promise<ImageTree | null>>()

let worker: Worker | null = null
let workerReqId = 0
const workerResolvers = new Map<number, (result: WorkerResultOk | WorkerResultErr) => void>()

function ensureWorker(): Worker | null {
  if (!import.meta.client || typeof Worker === 'undefined') return null
  if (worker) return worker
  worker = new GerberParseWorker()
  worker.onmessage = (event: MessageEvent<WorkerResultOk | WorkerResultErr>) => {
    const resolver = workerResolvers.get(event.data.id)
    if (!resolver) return
    workerResolvers.delete(event.data.id)
    resolver(event.data)
  }
  return worker
}

function cacheKeyForLayer(layer: LayerLike): string {
  const content = layer.file.content
  const len = content.length
  const head = content.slice(0, 2048)
  const tail = len > 2048 ? content.slice(len - 2048) : ''
  let hash = 2166136261
  const sample = `${head}|${tail}|${len}`
  for (let i = 0; i < sample.length; i++) {
    hash ^= sample.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const unsigned = hash >>> 0
  return `${layer.file.fileName}|${len}|${unsigned.toString(36)}`
}

function parseSync(layer: LayerLike): ImageTree {
  const ast = parseGerber(layer.file.content)
  return plotImageTree(ast)
}

async function parseInWorker(layer: LayerLike, key: string): Promise<ImageTree | null> {
  const activeWorker = ensureWorker()
  if (!activeWorker) {
    try {
      return parseSync(layer)
    } catch {
      return null
    }
  }
  const id = ++workerReqId
  return await new Promise<ImageTree | null>((resolve) => {
    workerResolvers.set(id, (result) => {
      if (!result.ok) return resolve(null)
      resolve(result.tree)
    })
    activeWorker.postMessage({
      id,
      key,
      content: layer.file.content,
    })
  })
}

export function useGerberImageTreeCache() {
  function getCachedTree(layer: LayerLike): ImageTree | null {
    const key = cacheKeyForLayer(layer)
    return imageTreeCache.get(key) ?? null
  }

  function getOrParseSync(layer: LayerLike): ImageTree | null {
    const key = cacheKeyForLayer(layer)
    const cached = imageTreeCache.get(key)
    if (cached) return cached
    try {
      const tree = parseSync(layer)
      imageTreeCache.set(key, tree)
      return tree
    } catch {
      return null
    }
  }

  async function prewarmLayer(layer: LayerLike): Promise<ImageTree | null> {
    const key = cacheKeyForLayer(layer)
    const cached = imageTreeCache.get(key)
    if (cached) return cached
    if (prewarmPromises.has(key)) return await prewarmPromises.get(key)!

    const task = (async () => {
      const tree = await parseInWorker(layer, key)
      if (tree) imageTreeCache.set(key, tree)
      return tree
    })()
    prewarmPromises.set(key, task)
    try {
      return await task
    } finally {
      prewarmPromises.delete(key)
    }
  }

  async function prewarmLayers(layers: LayerLike[]): Promise<void> {
    await Promise.all(layers.map(prewarmLayer))
  }

  function clearLayer(layer: LayerLike) {
    imageTreeCache.delete(cacheKeyForLayer(layer))
  }

  function clearByFileName(fileName: string) {
    for (const key of imageTreeCache.keys()) {
      if (key.startsWith(`${fileName}|`)) {
        imageTreeCache.delete(key)
      }
    }
  }

  function clearAll() {
    imageTreeCache.clear()
    prewarmPromises.clear()
  }

  return {
    getCachedTree,
    getOrParseSync,
    prewarmLayer,
    prewarmLayers,
    clearLayer,
    clearByFileName,
    clearAll,
    getCacheSize: () => imageTreeCache.size,
  }
}

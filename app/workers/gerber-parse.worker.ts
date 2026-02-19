import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'

interface GerberParseRequest {
  id: number
  key: string
  content: string
}

interface GerberParseSuccess {
  id: number
  key: string
  ok: true
  tree: ReturnType<typeof plotImageTree>
}

interface GerberParseFailure {
  id: number
  key: string
  ok: false
  error: string
}

self.onmessage = (event: MessageEvent<GerberParseRequest>) => {
  const { id, key, content } = event.data
  try {
    const ast = parseGerber(content)
    const tree = plotImageTree(ast)
    const payload: GerberParseSuccess = { id, key, ok: true, tree }
    self.postMessage(payload)
  } catch (error) {
    const payload: GerberParseFailure = {
      id,
      key,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(payload)
  }
}

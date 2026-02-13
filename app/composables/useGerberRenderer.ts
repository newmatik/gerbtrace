import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'
import { renderToCanvas } from '@lib/renderer/canvas-renderer'
import type { ImageTree } from '@lib/gerber/types'

export function useGerberRenderer() {
  function parse(gerberContent: string): ImageTree {
    const ast = parseGerber(gerberContent)
    return plotImageTree(ast)
  }

  function render(
    imageTree: ImageTree,
    canvas: HTMLCanvasElement,
    color: string = '#cc0000',
    transform?: { offsetX: number; offsetY: number; scale: number },
  ) {
    renderToCanvas(imageTree, canvas, {
      color,
      transform,
    })
  }

  function parseAndRender(
    gerberContent: string,
    canvas: HTMLCanvasElement,
    color: string = '#cc0000',
    transform?: { offsetX: number; offsetY: number; scale: number },
  ): ImageTree {
    const imageTree = parse(gerberContent)
    render(imageTree, canvas, color, transform)
    return imageTree
  }

  return { parse, render, parseAndRender }
}

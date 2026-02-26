import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parseGerber } from '../lib/gerber'
import { plotImageTree } from '../lib/gerber/plotter'
import {
  exportImageTreeToDxf,
  exportImageTreesToCombinedDxf,
} from '../lib/renderer/dxf-exporter'

async function loadFixture(name: string): Promise<string> {
  const path = new URL(`./fixtures/cadexport/${name}`, import.meta.url)
  return readFile(path, 'utf8')
}

async function fixtureToImageTree(name: string) {
  const source = await loadFixture(name)
  const ast = parseGerber(source)
  return plotImageTree(ast)
}

describe('DXF exporter defaults', () => {
  it('uses R12 by default for single-layer exports', async () => {
    const tree = await fixtureToImageTree('22_SILKSCREEN_BOTTOM.art')
    const dxf = exportImageTreeToDxf(tree, { layerName: 'SILKSCREEN_BOTTOM' })
    expect(dxf).toContain('$ACADVER')
    expect(dxf).toContain('AC1009')
  })

  it('uses R12 by default for combined exports', async () => {
    const silk = await fixtureToImageTree('22_SILKSCREEN_BOTTOM.art')
    const mask = await fixtureToImageTree('21_SOLDERMASK_BOTTOM.art')
    const dxf = exportImageTreesToCombinedDxf([
      { name: 'SILKSCREEN_BOTTOM', tree: silk },
      { name: 'SOLDERMASK_BOTTOM', tree: mask },
    ])
    expect(dxf).toContain('$ACADVER')
    expect(dxf).toContain('AC1009')
  })
})

describe('DXF R2000 structure hardening', () => {
  it('emits AC1015 structure when variant is r2000', async () => {
    const tree = await fixtureToImageTree('22_SILKSCREEN_BOTTOM.art')
    const dxf = exportImageTreeToDxf(tree, {
      variant: 'r2000',
      layerName: 'SILKSCREEN_BOTTOM',
    })

    expect(dxf).toContain('$ACADVER')
    expect(dxf).toContain('AC1015')
    expect(dxf).toContain('SECTION\n2\nOBJECTS')
  })

  it('emits LWPOLYLINE entities in r2000 mode', async () => {
    const tree = await fixtureToImageTree('21_SOLDERMASK_BOTTOM.art')
    const dxf = exportImageTreeToDxf(tree, {
      variant: 'r2000',
      layerName: 'SOLDERMASK_BOTTOM',
    })

    expect(dxf).toContain('\nLWPOLYLINE\n')
  })

  it('produces non-empty exports for both problematic fixtures', async () => {
    const silk = await fixtureToImageTree('22_SILKSCREEN_BOTTOM.art')
    const mask = await fixtureToImageTree('21_SOLDERMASK_BOTTOM.art')

    const silkR12 = exportImageTreeToDxf(silk, { variant: 'r12', layerName: 'SILKSCREEN_BOTTOM' })
    const silkR2000 = exportImageTreeToDxf(silk, { variant: 'r2000', layerName: 'SILKSCREEN_BOTTOM' })
    const maskR12 = exportImageTreeToDxf(mask, { variant: 'r12', layerName: 'SOLDERMASK_BOTTOM' })
    const maskR2000 = exportImageTreeToDxf(mask, { variant: 'r2000', layerName: 'SOLDERMASK_BOTTOM' })

    expect(silkR12.length).toBeGreaterThan(200)
    expect(silkR2000.length).toBeGreaterThan(200)
    expect(maskR12.length).toBeGreaterThan(200)
    expect(maskR2000.length).toBeGreaterThan(200)
  })
})

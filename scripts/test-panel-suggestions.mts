import assert from 'node:assert/strict'
import { generatePanelSuggestions } from '../app/utils/panel-suggestions'
import { computePricingTable } from '../app/utils/pcb-pricing'

function envelopeDistance(width: number, height: number, targetWidth: number, targetHeight: number): number {
  const norm = Math.abs(width - targetWidth) / targetWidth + Math.abs(height - targetHeight) / targetHeight
  const rot = Math.abs(height - targetWidth) / targetWidth + Math.abs(width - targetHeight) / targetHeight
  return Math.min(norm, rot)
}

function run() {
  const baseInput = {
    boardWidthMm: 62,
    boardHeightMm: 46,
    limits: {
      preferredWidthMm: 300,
      preferredHeightMm: 250,
      maxWidthMm: 450,
      maxHeightMm: 400,
    },
  }

  const thin = generatePanelSuggestions({ ...baseInput, thicknessMm: 0.8, maxSuggestions: 5 })
  const thick = generatePanelSuggestions({ ...baseInput, thicknessMm: 1.6, maxSuggestions: 5 })
  assert.ok(thin.length > 0, 'Expected thin-board suggestions')
  assert.ok(thick.length > 0, 'Expected thick-board suggestions')
  assert.ok(
    thin[0].reasons.some(r => r.toLowerCase().includes('thin board')),
    'Thin-board top suggestion should include thickness reasoning',
  )
  assert.ok(
    thin.length <= 3 && thick.length <= 3,
    'Suggestion list must be capped at 3 entries',
  )
  assert.ok(
    thin[0].panelWidthMm >= thin[0].panelHeightMm,
    'Top suggestion should prefer landscape orientation',
  )

  const closeness = thin.map(s => envelopeDistance(s.panelWidthMm, s.panelHeightMm, 300, 250))
  for (let i = 1; i < closeness.length; i++) {
    assert.ok(
      closeness[i - 1] <= closeness[i] + 0.7,
      'Higher-ranked suggestions should not be far worse for preferred envelope proximity',
    )
  }

  const oversized = generatePanelSuggestions({
    ...baseInput,
    thicknessMm: 1.0,
    limits: {
      preferredWidthMm: 200,
      preferredHeightMm: 140,
      maxWidthMm: 50,
      maxHeightMm: 40,
    },
    maxSuggestions: 3,
  })
  assert.ok(oversized.length > 0, 'Oversized scenario should still produce suggestions')
  assert.ok(
    oversized.some(s => s.warnings.some(w => w.includes('Exceeds maximum envelope'))),
    'Oversized scenarios should surface at least one max-envelope warning',
  )

  const pricingBase = computePricingTable({
    sizeX: 80,
    sizeY: 60,
    layerCount: 4,
    surfaceFinish: 'ENIG',
    copperWeight: '1oz',
  })
  const pricingWithThickness = computePricingTable({
    sizeX: 80,
    sizeY: 60,
    layerCount: 4,
    surfaceFinish: 'ENIG',
    copperWeight: '1oz',
    thicknessMm: 0.8,
  } as any)
  assert.deepEqual(pricingWithThickness, pricingBase, 'Pricing output must remain unchanged by thickness in v1')

  const constrained = generatePanelSuggestions({
    ...baseInput,
    thicknessMm: 1.6,
    edgeConstraints: {
      prohibitScoredEdges: { left: true },
      smdProtrudingEdges: { left: true },
      forceSupportBetweenPcbs: { x: true },
      tabKeepoutsMm: {
        left: [{ startMm: 18, endMm: 42 }],
      },
    },
    maxSuggestions: 3,
  })
  assert.ok(constrained.length > 0, 'Expected constrained suggestions')
  for (const s of constrained) {
    assert.equal(s.config.frame.enabled, true, 'Frame should stay enabled for suggestions')
    const leftIsScored = s.config.separationType === 'scored'
      || (s.config.separationType === 'mixed' && s.config.edges.left.type === 'scored')
    assert.equal(leftIsScored, false, 'Left edge with protruding components must not be V-Cut')
    if (s.config.separationType === 'mixed'
      && s.config.edges.top.type === 'scored'
      && s.config.edges.bottom.type === 'scored'
      && s.config.edges.left.type === 'routed'
      && s.config.edges.right.type === 'routed'
    ) {
      assert.equal(
        s.config.supports.xGaps.length,
        0,
        'Side-protrusion strategy should avoid vertical (X) supports',
      )
      if (s.config.countY > 1) {
        assert.equal(
          s.config.supports.yGaps.length,
          s.config.countY - 1,
          'Side-protrusion strategy should use row supports in every inter-row gap',
        )
      }
    }
    const leftTabs = s.config.tabs.edgeOverrides['sync-left-main'] ?? []
    const hasUnsafeLeftTab = leftTabs.some((t: number) => {
      const posMm = t * baseInput.boardHeightMm
      return posMm >= 18 && posMm <= 42
    })
    assert.equal(hasUnsafeLeftTab, false, 'Left tab positions should avoid keepout zone')
  }

  console.log('panel suggestions checks passed')
}

run()

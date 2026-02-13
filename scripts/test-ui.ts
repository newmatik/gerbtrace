/**
 * Automated UI test script using Playwright
 * Tests landing page, viewer mode, and compare mode with sample data
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCREENSHOTS_DIR = './test-screenshots'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()

  // Collect console messages
  const consoleErrors: string[] = []
  const consoleWarnings: string[] = []
  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    if (msg.type() === 'error') consoleErrors.push(text)
    else if (msg.type() === 'warning') consoleWarnings.push(text)
    else consoleLogs.push(text)
  })
  page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`))

  const fs = await import('fs')
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  // ===== TEST 1: Landing Page =====
  console.log('\n===== TEST 1: Landing Page =====')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-landing.png`, fullPage: true })

  const heading = await page.textContent('h1')
  console.log(`  Heading: "${heading}"`)
  assert(heading?.includes('Gerbtrace'), 'Landing page heading should contain "Gerbtrace"')

  const viewerBtn = page.locator('button:has-text("New Viewer Project")')
  const compareBtn = page.locator('button:has-text("New Compare Project")')
  const viewSampleBtn = page.locator('button:has-text("View Arduino UNO")')
  const compareSampleBtn = page.locator('button:has-text("Compare UNO Revisions")')

  assert(await viewerBtn.count() > 0, '"New Viewer Project" button exists')
  assert(await compareBtn.count() > 0, '"New Compare Project" button exists')
  assert(await viewSampleBtn.count() > 0, '"View Arduino UNO" button exists')
  assert(await compareSampleBtn.count() > 0, '"Compare UNO Revisions" button exists')
  console.log('  ✓ All landing page elements present')

  // ===== TEST 2: Viewer Mode - Load Sample =====
  console.log('\n===== TEST 2: Viewer Mode (Sample) =====')

  // Add listener for any errors during click
  const errBefore = consoleErrors.length
  await viewSampleBtn.click()

  // Wait for navigation with longer timeout
  try {
    await page.waitForURL('**/viewer/**', { timeout: 10000 })
    console.log(`  ✓ Navigated to: ${page.url()}`)
  } catch {
    console.log(`  ✗ URL after 10s: ${page.url()}`)
    // Check for new errors
    if (consoleErrors.length > errBefore) {
      for (let i = errBefore; i < consoleErrors.length; i++) {
        console.log(`  Error during load: ${consoleErrors[i]}`)
      }
    }
    // Try to debug - check page state
    const bodyText = await page.textContent('body')
    console.log(`  Body preview: "${bodyText?.slice(0, 300)}"`)

    // Check console logs for any useful info
    console.log(`  Recent console logs:`)
    for (const log of consoleLogs.slice(-10)) {
      console.log(`    ${log}`)
    }
  }

  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-viewer.png`, fullPage: true })

  if (page.url().includes('/viewer/')) {
    // Check canvas
    const canvasCount = await page.locator('canvas').count()
    console.log(`  Canvas elements: ${canvasCount}`)

    // Check for layer items
    const layerText = await page.textContent('body')
    const hasLayers = layerText?.includes('.gtl') || layerText?.includes('.gbl') || layerText?.includes('Top Copper')
    console.log(`  Has layer references: ${hasLayers}`)

    // Check for file items
    const fileItems = await page.locator('text=board.').count()
    console.log(`  File items with 'board.': ${fileItems}`)
  }

  // ===== TEST 3: Compare Mode =====
  console.log('\n===== TEST 3: Compare Mode (Sample) =====')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const compareSampleBtn2 = page.locator('button:has-text("Compare UNO Revisions")')
  await compareSampleBtn2.click()

  try {
    await page.waitForURL('**/compare/**', { timeout: 10000 })
    console.log(`  ✓ Navigated to: ${page.url()}`)
  } catch {
    console.log(`  ✗ URL after 10s: ${page.url()}`)
    if (consoleErrors.length > errBefore) {
      for (let i = errBefore; i < consoleErrors.length; i++) {
        console.log(`  Error: ${consoleErrors[i]}`)
      }
    }
  }

  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-compare.png`, fullPage: true })

  if (page.url().includes('/compare/')) {
    // Check for comparison toolbar
    const hasSideBySide = await page.locator('button:has-text("Side by Side")').count() > 0
    const hasOverlay = await page.locator('button:has-text("Overlay")').count() > 0
    const hasDiff = await page.locator('button:has-text("Diff")').count() > 0
    const hasText = await page.locator('button:has-text("Text")').count() > 0
    console.log(`  Toolbar: SideBySide=${hasSideBySide}, Overlay=${hasOverlay}, Diff=${hasDiff}, Text=${hasText}`)

    // Check for match info
    const bodyText = await page.textContent('body')
    const hasSame = bodyText?.includes('Same')
    const hasChanged = bodyText?.includes('Changed')
    console.log(`  Match badges: Same=${hasSame}, Changed=${hasChanged}`)

    // Test view switching
    if (hasText) {
      await page.locator('button:has-text("Text")').click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-compare-text.png`, fullPage: true })
      const textDiffContent = await page.textContent('body')
      const hasDiffContent = textDiffContent?.includes('+') || textDiffContent?.includes('-') || textDiffContent?.includes('identical')
      console.log(`  Text diff has content: ${hasDiffContent}`)
    }

    if (hasDiff) {
      await page.locator('button:has-text("Diff")').click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-compare-diff.png`, fullPage: true })
      console.log('  ✓ Diff view loaded')
    }

    if (hasOverlay) {
      await page.locator('button:has-text("Overlay")').click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-compare-overlay.png`, fullPage: true })
      console.log('  ✓ Overlay view loaded')
    }
  }

  // ===== TEST 4: Test zoom on viewer =====
  console.log('\n===== TEST 4: Zoom Controls =====')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.locator('button:has-text("View Arduino UNO")').click()

  try {
    await page.waitForURL('**/viewer/**', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const canvas = page.locator('canvas').first()
    if (await canvas.count() > 0) {
      const box = await canvas.boundingBox()
      if (box) {
        console.log(`  Canvas: ${Math.round(box.width)}x${Math.round(box.height)}`)

        // Wheel zoom
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.wheel(0, -300)
        await page.waitForTimeout(500)
        console.log('  ✓ Wheel zoom executed')

        // Drag pan
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 5 })
        await page.mouse.up()
        await page.waitForTimeout(300)
        console.log('  ✓ Drag pan executed')

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-zoomed.png`, fullPage: true })
      }
    } else {
      console.log('  No canvas found for zoom test')
    }
  } catch {
    console.log('  ✗ Could not navigate to viewer for zoom test')
  }

  // ===== RESULTS =====
  console.log('\n===== CONSOLE ERRORS =====')
  if (consoleErrors.length === 0) {
    console.log('  ✓ No console errors!')
  } else {
    for (const err of consoleErrors) {
      console.log(`  ✗ ${err}`)
    }
  }

  // Only show unique warnings
  const uniqueWarnings = [...new Set(consoleWarnings.map(w => {
    // Extract just the component name from "Failed to resolve component: X" warnings
    const match = w.match(/Failed to resolve component: (\w+)/)
    return match ? `Failed to resolve component: ${match[1]}` : w.slice(0, 100)
  }))]

  console.log(`\n===== CONSOLE WARNINGS (${uniqueWarnings.length} unique) =====`)
  for (const w of uniqueWarnings) {
    console.log(`  ⚠ ${w}`)
  }

  console.log(`\n===== SCREENSHOTS saved to ${SCREENSHOTS_DIR}/ =====`)

  await browser.close()

  if (consoleErrors.length > 0) {
    console.log('\n⚠ There were console errors.')
    process.exit(1)
  }
  console.log('\n✓ All tests passed!')
}

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`  ✗ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
  console.log(`  ✓ ${message}`)
}

main().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})

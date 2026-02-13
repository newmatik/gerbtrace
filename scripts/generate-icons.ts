/**
 * Icon Generation Script for Gerbtrace
 *
 * Generates all required icon sizes from two source PNGs:
 * - icon-blue.png  → light-mode icon (web favicons, android, apple-touch)
 * - icon-black.png → dark-mode icon (web favicons) + Tauri app bundle icon
 *
 * Usage: npx tsx scripts/generate-icons.ts
 */

import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

const ROOT = resolve(import.meta.dirname, '..')
const ICON_BLUE = join(ROOT, 'public', 'icon-blue.png')
const ICON_BLACK = join(ROOT, 'public', 'icon-black.png')
const TAURI_ICONS_DIR = join(ROOT, 'src-tauri', 'icons')
const PUBLIC_DIR = join(ROOT, 'public')

async function generatePng(inputPath: string, size: number, outputPath: string) {
  await sharp(inputPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
  console.log(`  ✓ ${outputPath} (${size}x${size})`)
}

async function generateIcns(inputPath: string) {
  // macOS .icns requires an iconset directory with specific naming
  const iconsetDir = join(TAURI_ICONS_DIR, 'icon.iconset')

  if (existsSync(iconsetDir)) {
    rmSync(iconsetDir, { recursive: true })
  }
  mkdirSync(iconsetDir, { recursive: true })

  // Required sizes for macOS iconset
  const iconsetSizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ]

  for (const { name, size } of iconsetSizes) {
    await generatePng(inputPath, size, join(iconsetDir, name))
  }

  // Use macOS iconutil to create .icns
  const icnsPath = join(TAURI_ICONS_DIR, 'icon.icns')
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`)
  console.log(`  ✓ ${icnsPath} (macOS .icns)`)

  // Clean up iconset directory
  rmSync(iconsetDir, { recursive: true })
}

async function generateIco(inputPath: string, outputPath: string, sizes: number[]) {
  const pngBuffers: Buffer[] = []

  for (const size of sizes) {
    const buf = await sharp(inputPath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    pngBuffers.push(buf)
  }

  const icoBuffer = await pngToIco(pngBuffers)
  writeFileSync(outputPath, icoBuffer)
  console.log(`  ✓ ${outputPath} (.ico with sizes: ${sizes.join(', ')})`)
}

async function main() {
  console.log('🎨 Generating Gerbtrace icons from source PNGs...\n')

  // Ensure directories exist
  mkdirSync(TAURI_ICONS_DIR, { recursive: true })
  mkdirSync(PUBLIC_DIR, { recursive: true })

  // ─── Tauri App Icons (from icon-black — used as bundle icon) ───────────
  console.log('📦 Tauri app icons (from icon-black):')

  await generatePng(ICON_BLACK, 512, join(TAURI_ICONS_DIR, 'icon.png'))
  await generatePng(ICON_BLACK, 32, join(TAURI_ICONS_DIR, '32x32.png'))
  await generatePng(ICON_BLACK, 128, join(TAURI_ICONS_DIR, '128x128.png'))
  await generatePng(ICON_BLACK, 256, join(TAURI_ICONS_DIR, '128x128@2x.png'))

  // macOS .icns
  console.log('\n🍎 macOS icon (.icns from icon-black):')
  await generateIcns(ICON_BLACK)

  // Windows .ico (16, 24, 32, 48, 64, 256)
  console.log('\n🪟 Windows icon (.ico from icon-black):')
  await generateIco(ICON_BLACK, join(TAURI_ICONS_DIR, 'icon.ico'), [16, 24, 32, 48, 64, 256])

  // ─── Windows Store / UWP Tiles (from icon-black) ──────────────────────
  console.log('\n🪟 Windows Store tile icons:')
  const windowsTiles = [
    { name: 'Square30x30Logo.png', size: 30 },
    { name: 'Square44x44Logo.png', size: 44 },
    { name: 'Square71x71Logo.png', size: 71 },
    { name: 'Square89x89Logo.png', size: 89 },
    { name: 'Square107x107Logo.png', size: 107 },
    { name: 'Square142x142Logo.png', size: 142 },
    { name: 'Square150x150Logo.png', size: 150 },
    { name: 'Square284x284Logo.png', size: 284 },
    { name: 'Square310x310Logo.png', size: 310 },
    { name: 'StoreLogo.png', size: 50 },
  ]

  for (const { name, size } of windowsTiles) {
    await generatePng(ICON_BLACK, size, join(TAURI_ICONS_DIR, name))
  }

  // ─── Web Favicons ─────────────────────────────────────────────────────
  console.log('\n🌐 Web favicons:')

  // Light-mode favicons (from icon-blue)
  await generateIco(ICON_BLUE, join(PUBLIC_DIR, 'favicon.ico'), [16, 32, 48])
  await generatePng(ICON_BLUE, 16, join(PUBLIC_DIR, 'favicon-light-16x16.png'))
  await generatePng(ICON_BLUE, 32, join(PUBLIC_DIR, 'favicon-light-32x32.png'))

  // Dark-mode favicons (from icon-black)
  await generatePng(ICON_BLACK, 16, join(PUBLIC_DIR, 'favicon-dark-16x16.png'))
  await generatePng(ICON_BLACK, 32, join(PUBLIC_DIR, 'favicon-dark-32x32.png'))

  // Android Chrome icons (from icon-blue — used in manifest)
  await generatePng(ICON_BLUE, 192, join(PUBLIC_DIR, 'android-chrome-192x192.png'))
  await generatePng(ICON_BLUE, 512, join(PUBLIC_DIR, 'android-chrome-512x512.png'))

  // Apple Touch Icon (180x180 from icon-blue, white bg for iOS)
  await sharp(ICON_BLUE)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC_DIR, 'apple-touch-icon.png'))
  console.log(`  ✓ ${join(PUBLIC_DIR, 'apple-touch-icon.png')} (180x180, white bg)`)

  // Web manifest
  const manifest = {
    name: 'Gerbtrace',
    short_name: 'Gerbtrace',
    description: 'Gerber Viewer & Comparator',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#3B8EF0',
    background_color: '#ffffff',
    display: 'standalone',
  }
  writeFileSync(join(PUBLIC_DIR, 'site.webmanifest'), JSON.stringify(manifest, null, 2))
  console.log(`  ✓ ${join(PUBLIC_DIR, 'site.webmanifest')}`)

  console.log('\n✅ All icons generated successfully!')
}

main().catch((err) => {
  console.error('Failed to generate icons:', err)
  process.exit(1)
})

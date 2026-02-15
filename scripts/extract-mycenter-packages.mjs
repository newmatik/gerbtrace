#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const rootDir = path.resolve(import.meta.dirname, '..')
const inputPath = path.join(rootDir, '.local', 'mycenter-package-export.pck')
const outputDir = path.join(rootDir, 'public', 'mycenter-packages')

function toFileBaseFromP00(value) {
  // Keep the P00 name as-is, only patch characters that break paths.
  return value.replaceAll('/', '∕').replace(/\u0000/g, '').trim() || 'package'
}

async function run() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`)
  }

  fs.rmSync(outputDir, { recursive: true, force: true })
  fs.mkdirSync(outputDir, { recursive: true })

  let packageCount = 0
  let currentLines = []
  let currentHeader = ''
  const usedFilenames = new Set()

  const flushCurrent = () => {
    if (currentLines.length === 0) {
      return
    }

    packageCount += 1
    const packageName = currentHeader.startsWith('P00 ')
      ? currentHeader.slice(4).trim()
      : `package-${String(packageCount)}`
    const safeToken = toFileBaseFromP00(packageName)
    let index = 1
    let filename = `${safeToken}.pck`
    let normalized = filename.toLowerCase()
    while (usedFilenames.has(normalized)) {
      index += 1
      filename = `${safeToken}__${String(index).padStart(3, '0')}.pck`
      normalized = filename.toLowerCase()
    }
    usedFilenames.add(normalized)
    const targetPath = path.join(outputDir, filename)

    fs.writeFileSync(targetPath, `${currentLines.join('\n')}\n`, 'utf8')
    currentLines = []
    currentHeader = ''
  }

  const reader = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const rawLine of reader) {
    const line = rawLine

    if (line === '#') {
      flushCurrent()
      continue
    }

    if (line.startsWith('P00 ') && currentLines.length > 0) {
      // Safety split for files that might miss the # separator.
      flushCurrent()
    }

    if (currentLines.length === 0 && line.startsWith('P00 ')) {
      currentHeader = line
    }

    currentLines.push(line)
  }

  flushCurrent()

  const generatedFiles = fs.readdirSync(outputDir).filter((name) => name.endsWith('.pck')).length
  console.log(`Extracted ${packageCount} packages to ${outputDir}`)
  console.log(`Generated ${generatedFiles} .pck files`)
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})

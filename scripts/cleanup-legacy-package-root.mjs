import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const PACKAGES_DIR = path.join(ROOT, 'public', 'packages')

async function main() {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true })
  let removed = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.json')) continue
    if (entry.name === '_manifest.json') continue
    await fs.rm(path.join(PACKAGES_DIR, entry.name), { force: true })
    removed++
  }
  console.log(`Removed ${removed} legacy root package JSON files`)
}

main().catch((err) => {
  console.error('[cleanup-legacy-package-root] Failed:', err)
  process.exitCode = 1
})

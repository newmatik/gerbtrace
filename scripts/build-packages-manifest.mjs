import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const PACKAGES_DIR = path.resolve(process.cwd(), 'public', 'packages')
const MANIFEST_PATH = path.join(PACKAGES_DIR, '_manifest.json')

function sortCaseInsensitive(a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

async function main() {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true })

  const filenames = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => n.toLowerCase().endsWith('.json'))
    .filter((n) => n !== '_manifest.json')
    .sort(sortCaseInsensitive)

  const json = JSON.stringify(filenames, null, 2) + '\n'
  await fs.writeFile(MANIFEST_PATH, json, 'utf8')
}

main().catch((err) => {
  console.error('[build-packages-manifest] Failed:', err)
  process.exitCode = 1
})


import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const THT_DIR = path.join(ROOT, 'public', 'packages', 'tht-libraries')
const TREE_PATH = path.join(THT_DIR, '_tree.json')

function sortCaseInsensitive(a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function main() {
  await fs.mkdir(THT_DIR, { recursive: true })
  const entries = await fs.readdir(THT_DIR, { withFileTypes: true })
  const libraries = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('_')) continue
    const id = entry.name
    const libraryDir = path.join(THT_DIR, id)
    const metaPath = path.join(libraryDir, 'library.json')
    const pkgDir = path.join(libraryDir, 'packages')

    let meta = null
    try {
      meta = await readJson(metaPath)
    } catch {
      continue
    }

    let files = []
    try {
      const pkgEntries = await fs.readdir(pkgDir, { withFileTypes: true })
      files = pkgEntries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
        .map((e) => e.name)
        .sort(sortCaseInsensitive)
    } catch {
      files = []
    }

    const packages = []
    for (const file of files) {
      try {
        const pkg = await readJson(path.join(pkgDir, file))
        packages.push({
          file,
          name: pkg?.name ?? file.replace(/\.json$/i, ''),
          aliases: Array.isArray(pkg?.aliases) ? pkg.aliases : [],
          shapeCount: Array.isArray(pkg?.shapes) ? pkg.shapes.length : 0,
        })
      } catch {}
    }

    libraries.push({
      id,
      path: `tht-libraries/${id}`,
      packageCount: packages.length,
      library: meta,
      packages,
    })
  }

  libraries.sort((a, b) => sortCaseInsensitive(a.id, b.id))
  const payload = {
    generatedAt: new Date().toISOString(),
    root: 'public/packages/tht-libraries',
    libraries,
  }
  await fs.writeFile(TREE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

main().catch((err) => {
  console.error('[build-tht-packages-manifest] Failed:', err)
  process.exitCode = 1
})

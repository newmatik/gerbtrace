import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const PACKAGES_DIR = path.resolve(ROOT, 'public', 'packages')
const MANIFEST_PATH = path.join(PACKAGES_DIR, '_manifest.json')
const LIBRARIES_DIR = path.join(PACKAGES_DIR, 'libraries')
const TREE_MANIFEST_PATH = path.join(LIBRARIES_DIR, '_tree.json')

function sortCaseInsensitive(a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

async function existsDir(dirPath) {
  try {
    const st = await fs.stat(dirPath)
    return st.isDirectory()
  } catch {
    return false
  }
}

async function buildFlatManifest() {
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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function buildTreeManifest() {
  await fs.mkdir(LIBRARIES_DIR, { recursive: true })
  const entries = await fs.readdir(LIBRARIES_DIR, { withFileTypes: true })
  const libraries = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('_')) continue

    const libraryId = entry.name
    const libraryDir = path.join(LIBRARIES_DIR, libraryId)
    const libraryMetaPath = path.join(libraryDir, 'library.json')
    const packagesDir = path.join(libraryDir, 'packages')

    let libraryMeta = null
    try {
      libraryMeta = await readJson(libraryMetaPath)
    } catch {
      continue
    }

    let packageFiles = []
    try {
      const packageEntries = await fs.readdir(packagesDir, { withFileTypes: true })
      packageFiles = packageEntries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => n.toLowerCase().endsWith('.json'))
        .sort(sortCaseInsensitive)
    } catch {
      packageFiles = []
    }

    const packageEntries = []
    for (const file of packageFiles) {
      const relPath = `libraries/${libraryId}/packages/${file}`
      const fullPath = path.join(PACKAGES_DIR, relPath)
      try {
        const pkg = await readJson(fullPath)
        packageEntries.push({
          file,
          name: pkg?.name ?? file.replace(/\.json$/i, ''),
          type: pkg?.type ?? '',
          aliases: Array.isArray(pkg?.aliases) ? pkg.aliases : [],
        })
      } catch {
        // Keep malformed files out of manifest, checker will report them.
      }
    }

    libraries.push({
      id: libraryId,
      path: `libraries/${libraryId}`,
      packageCount: packageEntries.length,
      library: libraryMeta,
      packages: packageEntries,
    })
  }

  libraries.sort((a, b) => sortCaseInsensitive(a.id, b.id))
  const payload = {
    generatedAt: null,
    root: 'public/packages/libraries',
    libraries,
  }

  // Only rewrite the file when the data (ignoring generatedAt) actually changed.
  const nextJson = JSON.stringify(payload, null, 2) + '\n'
  let prevJson = ''
  try {
    prevJson = await fs.readFile(TREE_MANIFEST_PATH, 'utf8')
  } catch { /* first run */ }

  const strip = (s) => s.replace(/"generatedAt":\s*"[^"]*"/, '"generatedAt": null')
  if (strip(prevJson) === strip(nextJson)) return

  payload.generatedAt = new Date().toISOString()
  await fs.writeFile(TREE_MANIFEST_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

async function main() {
  // Backward compatible flat manifest (legacy workflows still reference it)
  await buildFlatManifest()

  // New tree manifest for library-aware runtime loader
  if (await existsDir(LIBRARIES_DIR)) {
    await buildTreeManifest()
  }
}

main().catch((err) => {
  console.error('[build-packages-manifest] Failed:', err)
  process.exitCode = 1
})


import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const PACKAGES_DIR = path.resolve(process.cwd(), 'public', 'packages')
const MANIFEST_PATH = path.join(PACKAGES_DIR, '_manifest.json')
const LIBRARIES_DIR = path.join(PACKAGES_DIR, 'libraries')
const TREE_MANIFEST_PATH = path.join(LIBRARIES_DIR, '_tree.json')

function normalise(name) {
  // Must match `app/composables/usePackageLibrary.ts`
  const trimmed = String(name ?? '').trim()
  const withoutLibPrefix = trimmed.includes(':') ? (trimmed.split(':').pop() || trimmed) : trimmed
  return withoutLibPrefix.trim().toLowerCase()
}

function fmtWhere(pkgFile, field, value) {
  return `${pkgFile} (${field}: "${value}")`
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function listPackageJsonFiles() {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => n.toLowerCase().endsWith('.json'))
    .filter((n) => n !== '_manifest.json')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

/** Expected flat manifest entries: root-level JSON files + library package paths (matches build-packages-manifest) */
async function listExpectedFlatManifestPaths() {
  const rootFiles = await listPackageJsonFiles()
  const paths = [...rootFiles]
  if (!(await existsDir(LIBRARIES_DIR))) return paths
  const libraryIds = await listLibraryIds()
  const sort = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
  for (const id of libraryIds) {
    const packagesDir = path.join(LIBRARIES_DIR, id, 'packages')
    let files = []
    try {
      const entries = await fs.readdir(packagesDir, { withFileTypes: true })
      files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => n.toLowerCase().endsWith('.json'))
        .sort(sort)
    } catch {
      continue
    }
    for (const file of files) {
      paths.push(`libraries/${id}/packages/${file}`)
    }
  }
  paths.sort(sort)
  return paths
}

async function existsDir(dirPath) {
  try {
    const st = await fs.stat(dirPath)
    return st.isDirectory()
  } catch {
    return false
  }
}

async function listLibraryIds() {
  const entries = await fs.readdir(LIBRARIES_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

async function checkManifestMatchesDir() {
  const expected = await listExpectedFlatManifestPaths()

  let manifest
  try {
    manifest = await readJson(MANIFEST_PATH)
  } catch {
    throw new Error('Missing /public/packages/_manifest.json (run manifest builder)')
  }

  if (!Array.isArray(manifest)) {
    throw new Error('Invalid /public/packages/_manifest.json (expected JSON array)')
  }

  const actual = manifest.slice().sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()))

  const expStr = JSON.stringify(expected)
  const actStr = JSON.stringify(actual)
  if (expStr !== actStr) {
    const missing = expected.filter((f) => !actual.includes(f))
    const extra = actual.filter((f) => !expected.includes(f))
    const parts = []
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`)
    if (extra.length) parts.push(`extra: ${extra.join(', ')}`)
    throw new Error(`_manifest.json out of date (${parts.join(' | ') || 'mismatch'})`)
  }
}

async function checkNamesAndAliasesUnique() {
  const files = await listPackageJsonFiles()

  /** @type {Map<string, {kind:'name'|'alias', pkgFile:string, field:string, value:string, ownerNameNorm:string}>} */
  const keyOwner = new Map()
  /** @type {Map<string, {pkgFile:string, field:string, value:string, ownerNameNorm:string}[]>} */
  const keyAll = new Map()

  /** @type {Set<string>} */
  const allNameKeys = new Set()

  // First pass: collect package names (for “alias must not equal real package name” rule)
  for (const fname of files) {
    const fp = path.join(PACKAGES_DIR, fname)
    const pkg = await readJson(fp)
    const nm = pkg?.name
    if (!nm || typeof nm !== 'string') {
      throw new Error(`${fname} missing valid "name"`)
    }
    const nameKey = normalise(nm)
    allNameKeys.add(nameKey)
  }

  const errors = []

  function remember(key, rec) {
    const prev = keyOwner.get(key)
    if (prev) {
      errors.push(
        [
          `Key collision: "${key}"`,
          `- ${fmtWhere(prev.pkgFile, prev.field, prev.value)}`,
          `- ${fmtWhere(rec.pkgFile, rec.field, rec.value)}`,
        ].join('\n'),
      )
    } else {
      keyOwner.set(key, rec)
    }
    const arr = keyAll.get(key) ?? []
    arr.push(rec)
    keyAll.set(key, arr)
  }

  // Second pass: enforce uniqueness + alias->name collision rule
  for (const fname of files) {
    const fp = path.join(PACKAGES_DIR, fname)
    const pkg = await readJson(fp)

    const pkgName = pkg.name
    const ownerNameNorm = normalise(pkgName)

    // Name key must be unique across packages
    remember(normalise(pkgName), { kind: 'name', pkgFile: fname, field: 'name', value: pkgName, ownerNameNorm })

    const aliases = pkg.aliases ?? []
    if (aliases != null && !Array.isArray(aliases)) {
      errors.push(`${fname} has non-array "aliases"`)
      continue
    }

    for (const alias of aliases) {
      if (typeof alias !== 'string' || !alias.trim()) {
        errors.push(`${fname} has invalid alias value (${JSON.stringify(alias)})`)
        continue
      }

      const key = normalise(alias)

      // Single source of truth: an alias may not be the *name* of any (other) package.
      if (allNameKeys.has(key) && key !== ownerNameNorm) {
        errors.push(
          [
            `Alias collides with a real package name key: "${key}"`,
            `- ${fmtWhere(fname, 'aliases[]', alias)}`,
            `- (this key is also a package "name" elsewhere)`,
          ].join('\n'),
        )
      }

      // Aliases must not collide with any other alias or name keys (except own name, which is redundant but still ambiguous in map).
      if (key === ownerNameNorm) {
        errors.push(`Redundant alias equals its own name key: ${fmtWhere(fname, 'aliases[]', alias)}`)
      }

      remember(key, { kind: 'alias', pkgFile: fname, field: 'aliases[]', value: alias, ownerNameNorm })
    }
  }

  if (errors.length) {
    const msg =
      `Package library check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n\n` +
      errors.map((e) => `- ${e.replaceAll('\n', '\n  ')}`).join('\n\n')
    throw new Error(msg)
  }
}

async function checkTreeManifestMatchesDir() {
  let tree
  try {
    tree = await readJson(TREE_MANIFEST_PATH)
  } catch {
    throw new Error('Missing /public/packages/libraries/_tree.json (run manifest builder)')
  }

  if (!tree || !Array.isArray(tree.libraries)) {
    throw new Error('Invalid /public/packages/libraries/_tree.json (expected object with libraries[])')
  }

  const libraryIds = await listLibraryIds()
  const manifestIds = tree.libraries.map((l) => l?.id).filter((v) => typeof v === 'string')
  const missing = libraryIds.filter((id) => !manifestIds.includes(id))
  const extra = manifestIds.filter((id) => !libraryIds.includes(id))
  if (missing.length || extra.length) {
    throw new Error(`_tree.json out of date (library mismatch: missing=${missing.join(', ') || '-'} extra=${extra.join(', ') || '-'})`)
  }

  for (const id of libraryIds) {
    const pkgDir = path.join(LIBRARIES_DIR, id, 'packages')
    const item = tree.libraries.find((l) => l.id === id)
    if (!item) continue
    let expectedFiles = []
    try {
      const entries = await fs.readdir(pkgDir, { withFileTypes: true })
      expectedFiles = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => n.toLowerCase().endsWith('.json'))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    } catch {
      expectedFiles = []
    }
    const actualFiles = Array.isArray(item.packages)
      ? item.packages
        .map((p) => p?.file)
        .filter((v) => typeof v === 'string')
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      : []

    const miss = expectedFiles.filter((f) => !actualFiles.includes(f))
    const ext = actualFiles.filter((f) => !expectedFiles.includes(f))
    if (miss.length || ext.length) {
      throw new Error(`_tree.json out of date for library "${id}" (missing=${miss.join(', ') || '-'} extra=${ext.join(', ') || '-'})`)
    }
  }
}

async function checkTreeNamesAndAliasesUnique() {
  const libraryIds = await listLibraryIds()

  /** @type {Set<string>} */
  const globalNameKeys = new Set()
  /** @type {Map<string, string>} */
  const globalOwner = new Map()
  const errors = []

  for (const libraryId of libraryIds) {
    const pkgDir = path.join(LIBRARIES_DIR, libraryId, 'packages')
    let files = []
    try {
      const entries = await fs.readdir(pkgDir, { withFileTypes: true })
      files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => n.toLowerCase().endsWith('.json'))
    } catch {
      continue
    }

    /** @type {Set<string>} */
    const localNameKeys = new Set()
    /** @type {Set<string>} */
    const localAnyKeys = new Set()

    for (const fname of files) {
      const fp = path.join(pkgDir, fname)
      const pkg = await readJson(fp)
      const pkgName = pkg?.name
      if (!pkgName || typeof pkgName !== 'string') {
        errors.push(`[${libraryId}] ${fname} missing valid "name"`)
        continue
      }

      const nKey = normalise(pkgName)
      if (localNameKeys.has(nKey)) {
        errors.push(`[${libraryId}] duplicate package name key "${nKey}" (${fname})`)
      }
      localNameKeys.add(nKey)

      if (globalOwner.has(nKey)) {
        errors.push(`Global name collision "${nKey}" between ${globalOwner.get(nKey)} and ${libraryId}/${fname}`)
      } else {
        globalOwner.set(nKey, `${libraryId}/${fname}`)
      }
      globalNameKeys.add(nKey)
    }

    for (const fname of files) {
      const fp = path.join(pkgDir, fname)
      const pkg = await readJson(fp)
      const pkgName = pkg?.name
      if (!pkgName || typeof pkgName !== 'string') continue
      const ownerKey = normalise(pkgName)

      if (localAnyKeys.has(ownerKey)) {
        errors.push(`[${libraryId}] key collision for name "${ownerKey}" in ${fname}`)
      } else {
        localAnyKeys.add(ownerKey)
      }

      const aliases = pkg.aliases ?? []
      if (aliases != null && !Array.isArray(aliases)) {
        errors.push(`[${libraryId}] ${fname} has non-array "aliases"`)
        continue
      }

      for (const alias of aliases) {
        if (typeof alias !== 'string' || !alias.trim()) {
          errors.push(`[${libraryId}] ${fname} has invalid alias ${JSON.stringify(alias)}`)
          continue
        }
        const aKey = normalise(alias)
        if (aKey === ownerKey) {
          errors.push(`[${libraryId}] redundant alias equals own name key (${fname}: "${alias}")`)
          continue
        }
        if (localAnyKeys.has(aKey)) {
          errors.push(`[${libraryId}] key collision "${aKey}" (${fname})`)
        }
        if (globalNameKeys.has(aKey) && !localNameKeys.has(aKey)) {
          errors.push(`[${libraryId}] alias "${alias}" collides with package name key "${aKey}" in another package`)
        }
        localAnyKeys.add(aKey)
      }
    }
  }

  if (errors.length) {
    throw new Error(`Package library tree check failed (${errors.length} issues)\n\n- ${errors.join('\n- ')}`)
  }
}

async function main() {
  // Ensure folder exists
  try {
    const st = await fs.stat(PACKAGES_DIR)
    if (!st.isDirectory()) throw new Error('not a directory')
  } catch {
    throw new Error(`Missing packages dir: ${PACKAGES_DIR}`)
  }

  await checkManifestMatchesDir()
  await checkNamesAndAliasesUnique()

  if (await existsDir(LIBRARIES_DIR)) {
    await checkTreeManifestMatchesDir()
    await checkTreeNamesAndAliasesUnique()
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exitCode = 1
})


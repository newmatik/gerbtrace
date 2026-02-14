import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const PACKAGES_DIR = path.resolve(process.cwd(), 'public', 'packages')
const MANIFEST_PATH = path.join(PACKAGES_DIR, '_manifest.json')

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

async function checkManifestMatchesDir() {
  const expected = await listPackageJsonFiles()

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
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exitCode = 1
})


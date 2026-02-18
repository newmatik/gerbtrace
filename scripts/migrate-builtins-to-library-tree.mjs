import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const PACKAGES_DIR = path.join(ROOT, 'public', 'packages')
const NEWMATIK_DIR = path.join(PACKAGES_DIR, 'libraries', 'newmatik')
const NEWMATIK_PACKAGES_DIR = path.join(NEWMATIK_DIR, 'packages')

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function existsDir(dirPath) {
  try {
    const st = await fs.stat(dirPath)
    return st.isDirectory()
  } catch {
    return false
  }
}

async function main() {
  await fs.mkdir(NEWMATIK_PACKAGES_DIR, { recursive: true })

  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true })
  const packageFiles = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => n.toLowerCase().endsWith('.json'))
    .filter((n) => n !== '_manifest.json')

  const allNameKeys = new Set()
  for (const file of packageFiles) {
    const srcPath = path.join(PACKAGES_DIR, file)
    const pkg = await readJson(srcPath)
    const key = String(pkg?.name ?? '').trim().toLowerCase()
    if (key) allNameKeys.add(key)
  }

  const migrated = []
  for (const file of packageFiles) {
    const srcPath = path.join(PACKAGES_DIR, file)
    const dstPath = path.join(NEWMATIK_PACKAGES_DIR, file)
    const pkg = await readJson(srcPath)
    const ownNameKey = String(pkg?.name ?? '').trim().toLowerCase()
    const cleanedAliases = Array.isArray(pkg.aliases)
      ? pkg.aliases.filter((a) => {
        const aliasKey = String(a ?? '').trim().toLowerCase()
        return !!aliasKey && (aliasKey === ownNameKey || !allNameKeys.has(aliasKey))
      })
      : pkg.aliases

    const out = {
      ...pkg,
      aliases: cleanedAliases,
      provenance: pkg.provenance ?? {
        owner: 'newmatik',
        sourceLibrary: 'newmatik',
        sourceType: 'TPSys',
        sourceFile: `public/packages/${file}`,
        sourceFootprint: pkg.name ?? file.replace(/\.json$/i, ''),
      },
    }
    await fs.writeFile(dstPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
    migrated.push(file)
  }

  const libraryMeta = {
    id: 'newmatik',
    displayName: 'Gerbtrace',
    owner: 'newmatik',
    sourceType: 'TPSys',
    license: 'Proprietary/Newmatik internal dataset',
    redistribution: 'allowed',
    attribution: {
      upstreamOwner: 'Newmatik GmbH',
      upstreamRepo: 'gerber-compare',
      upstreamUrl: 'https://github.com/newmatik/gerber-compare',
      notice: 'Canonical built-in package set maintained by Newmatik.',
    },
    source: {
      id: 'newmatik-builtins',
      path: 'public/packages',
    },
    packageCount: migrated.length,
  }
  await fs.writeFile(path.join(NEWMATIK_DIR, 'library.json'), JSON.stringify(libraryMeta, null, 2) + '\n', 'utf8')

  // Keep legacy root files for now, but ensure directory exists for tree runtime.
  if (!(await existsDir(path.join(PACKAGES_DIR, 'libraries')))) {
    throw new Error('Failed to create public/packages/libraries')
  }

  console.log(`Migrated ${migrated.length} built-in package files to libraries/newmatik/packages`)
}

main().catch((err) => {
  console.error('[migrate-builtins-to-library-tree] Failed:', err)
  process.exitCode = 1
})

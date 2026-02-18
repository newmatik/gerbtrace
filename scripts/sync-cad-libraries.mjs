import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const LIB_ROOT = path.join(ROOT, '.local', 'libraries')
const INDEX_DIR = path.join(LIB_ROOT, '_index')
const SOURCES_PATH = path.join(ROOT, 'scripts', 'cad-library-sources.json')
const LOCK_PATH = path.join(INDEX_DIR, 'sources-lock.json')

function runGit(args, cwd, allowFailure = false) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0 && !allowFailure) {
    const stderr = result.stderr?.trim() || '(no stderr)'
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${stderr}`)
  }
  return result
}

function parseFlags(argv) {
  const flags = {
    includeLarge: false,
    includeDisabled: false,
    dryRun: false,
  }

  for (const arg of argv) {
    if (arg === '--include-large') flags.includeLarge = true
    else if (arg === '--include-disabled') flags.includeDisabled = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--help' || arg === '-h') {
      flags.help = true
    } else {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }

  return flags
}

async function readSources() {
  const raw = await fs.readFile(SOURCES_PATH, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed?.sources)) {
    throw new Error('scripts/cad-library-sources.json must contain a "sources" array')
  }
  return parsed.sources
}

async function ensureDirs() {
  await fs.mkdir(LIB_ROOT, { recursive: true })
  await fs.mkdir(INDEX_DIR, { recursive: true })
}

async function existsDir(dirPath) {
  try {
    const st = await fs.stat(dirPath)
    return st.isDirectory()
  } catch {
    return false
  }
}

async function syncSource(source, dryRun = false) {
  const owner = source.owner
  const repo = source.repo
  const licenseBucket = source.licenseBucket
  const repoDir = path.join(LIB_ROOT, licenseBucket, owner, repo)
  const repoParent = path.dirname(repoDir)

  const operation = {
    id: source.id,
    owner,
    repo,
    url: source.url,
    tool: source.tool,
    license: source.license,
    licenseBucket,
    redistribution: source.redistribution,
    path: repoDir,
    action: 'none',
    commit: '',
    defaultBranch: '',
    status: 'ok',
    error: '',
    syncedAt: new Date().toISOString(),
  }

  if (dryRun) {
    operation.action = (await existsDir(repoDir)) ? 'would-update' : 'would-clone'
    return operation
  }

  await fs.mkdir(repoParent, { recursive: true })
  const hasRepo = await existsDir(path.join(repoDir, '.git'))

  try {
    if (!hasRepo) {
      operation.action = 'clone'
      runGit(['clone', '--depth', '1', source.url, repoDir], ROOT)
    } else {
      operation.action = 'update'
      runGit(['-C', repoDir, 'fetch', '--depth', '1', 'origin'], ROOT)
      runGit(['-C', repoDir, 'reset', '--hard', 'origin/HEAD'], ROOT)
      runGit(['-C', repoDir, 'clean', '-fdx'], ROOT)
    }

    const branchRes = runGit(['-C', repoDir, 'rev-parse', '--abbrev-ref', 'origin/HEAD'], ROOT)
    const defaultBranch = branchRes.stdout.trim().replace('origin/', '')
    if (defaultBranch && defaultBranch !== 'HEAD') {
      runGit(['-C', repoDir, 'checkout', defaultBranch], ROOT, true)
      runGit(['-C', repoDir, 'reset', '--hard', `origin/${defaultBranch}`], ROOT)
    }

    const commitRes = runGit(['-C', repoDir, 'rev-parse', 'HEAD'], ROOT)
    operation.commit = commitRes.stdout.trim()
    operation.defaultBranch = defaultBranch
    return operation
  } catch (error) {
    operation.status = 'error'
    operation.error = String(error?.message || error)
    return operation
  }
}

function shouldSync(source, flags) {
  if (!flags.includeDisabled && source.enabled === false) return false
  if (!flags.includeLarge && source.large === true) return false
  return true
}

async function writeLock(results, skipped, flags) {
  const payload = {
    syncedAt: new Date().toISOString(),
    root: '.local/libraries',
    flags,
    results,
    skipped,
  }
  await fs.writeFile(LOCK_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function printUsage() {
  console.log('Sync curated open/free CAD libraries into .local/libraries/')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/sync-cad-libraries.mjs [--include-large] [--include-disabled] [--dry-run]')
  console.log('')
  console.log('Flags:')
  console.log('  --include-large      Include very large repositories (e.g. 3D model libraries)')
  console.log('  --include-disabled   Include sources marked disabled in cad-library-sources.json')
  console.log('  --dry-run            Do not clone/update, just show what would happen')
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  if (flags.help) {
    printUsage()
    return
  }

  const sources = await readSources()
  await ensureDirs()

  const selected = sources.filter((s) => shouldSync(s, flags))
  const skipped = sources
    .filter((s) => !shouldSync(s, flags))
    .map((s) => ({
      id: s.id,
      reason: s.enabled === false ? 'disabled' : 'large',
    }))

  const results = []
  for (const source of selected) {
    console.log(`→ ${source.id}: ${source.url}`)
    const result = await syncSource(source, flags.dryRun)
    results.push(result)
    if (result.status === 'ok') {
      console.log(`  ✓ ${result.action} ${result.owner}/${result.repo} @ ${result.commit || '(dry-run)'}`)
    } else {
      console.error(`  ✗ ${result.owner}/${result.repo}: ${result.error}`)
    }
  }

  await writeLock(results, skipped, flags)

  const failures = results.filter((r) => r.status !== 'ok')
  console.log('')
  console.log(`Completed: ${results.length - failures.length}/${results.length} succeeded`)
  console.log(`Index written: ${path.relative(ROOT, LOCK_PATH)}`)
  if (skipped.length) {
    console.log(`Skipped: ${skipped.length} source(s) (use --include-large / --include-disabled to include)`)
  }

  if (failures.length) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exitCode = 1
})


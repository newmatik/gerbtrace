#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0'
const DEFAULT_PROJECT_GID = '1213295870034201'
const DEFAULT_CONCURRENCY = 5
const MAX_RETRIES = 4
const DEFAULT_OUTPUT_DIR = '.local/asana'
const EXCLUDED_SECTION_NAMES = new Set(['onboarding', 'for user testing'])
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

const FULL_TASK_OPT_FIELDS = [
  'gid',
  'name',
  'resource_type',
  'resource_subtype',
  'permalink_url',
  'created_at',
  'modified_at',
  'completed',
  'completed_at',
  'completed_by.gid',
  'completed_by.name',
  'assignee.gid',
  'assignee.name',
  'assignee_status',
  'due_on',
  'due_at',
  'start_on',
  'start_at',
  'actual_time_minutes',
  'approval_status',
  'num_subtasks',
  'notes',
  'html_notes',
  'tags.gid',
  'tags.name',
  'memberships.project.gid',
  'memberships.project.name',
  'memberships.section.gid',
  'memberships.section.name',
  'projects.gid',
  'projects.name',
  'parent.gid',
  'parent.name',
  'custom_fields.gid',
  'custom_fields.name',
  'custom_fields.resource_subtype',
  'custom_fields.display_value',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.enum_value.gid',
  'custom_fields.enum_value.name',
  'custom_fields.multi_enum_values.gid',
  'custom_fields.multi_enum_values.name',
  'custom_fields.people_value.gid',
  'custom_fields.people_value.name',
  'custom_fields.date_value.date',
  'custom_fields.date_value.date_time',
  'followers.gid',
  'followers.name',
  'workspace.gid',
  'workspace.name',
].join(',')

const FULL_COMMENT_OPT_FIELDS = [
  'gid',
  'type',
  'resource_subtype',
  'created_at',
  'created_by.gid',
  'created_by.name',
  'text',
  'html_text',
].join(',')

const COMPACT_TASK_OPT_FIELDS = [
  'gid',
  'name',
  'notes',
  'created_by.name',
  'completed',
  'tags.name',
  'memberships.section.name',
  'custom_fields.name',
  'custom_fields.display_value',
].join(',')

const COMPACT_COMMENT_OPT_FIELDS = [
  'type',
  'resource_subtype',
  'created_by.name',
  'text',
].join(',')

function parseArgs(argv) {
  const args = {
    projectGid: process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID,
    output: process.env.ASANA_OUTPUT || '',
    includeStories: true,
    full: false,
    concurrency: Number.parseInt(process.env.ASANA_CONCURRENCY || `${DEFAULT_CONCURRENCY}`, 10),
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--project' && argv[i + 1]) {
      args.projectGid = argv[i + 1]
      i += 1
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[i + 1]
      i += 1
    } else if (arg === '--no-comments') {
      args.includeStories = false
    } else if (arg === '--full') {
      args.full = true
    } else if (arg === '--concurrency' && argv[i + 1]) {
      args.concurrency = Number.parseInt(argv[i + 1], 10)
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
    throw new Error(`Invalid concurrency: ${args.concurrency}`)
  }

  return args
}

function formatTimestampForFilename(date = new Date()) {
  const year = `${date.getUTCFullYear()}`
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  const hours = `${date.getUTCHours()}`.padStart(2, '0')
  const minutes = `${date.getUTCMinutes()}`.padStart(2, '0')
  const seconds = `${date.getUTCSeconds()}`.padStart(2, '0')
  return `${year}${month}${day}-${hours}${minutes}${seconds}Z`
}

function getDefaultOutputPath() {
  return `${DEFAULT_OUTPUT_DIR}/asana-project-tasks-${formatTimestampForFilename()}.json`
}

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
  const separator = normalized.indexOf('=')
  if (separator <= 0) return null

  const key = normalized.slice(0, separator).trim()
  let value = normalized.slice(separator + 1).trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

async function loadSingleEnvFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    if (typeof process.env[parsed.key] === 'undefined') {
      process.env[parsed.key] = parsed.value
    }
  }
}

async function loadLocalEnvFile(fileName = '.env.asana') {
  const candidatePaths = [
    path.resolve(process.cwd(), fileName),
    path.resolve(REPO_ROOT, fileName),
  ]

  for (const filePath of candidatePaths) {
    try {
      await loadSingleEnvFile(filePath)
      return
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}

function printHelp() {
  console.log('Asana project task manager — export, tag, move, and comment on tasks')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/export-asana-project-tasks.mjs [export] [options]')
  console.log('  node scripts/export-asana-project-tasks.mjs list-sections [--project <gid>]')
  console.log('  node scripts/export-asana-project-tasks.mjs create-tag <name> [--project <gid>]')
  console.log('  node scripts/export-asana-project-tasks.mjs add-tag <task-gid> <tag-gid>')
  console.log('  node scripts/export-asana-project-tasks.mjs move <task-gid> <section-name-or-gid> [--project <gid>]')
  console.log('  node scripts/export-asana-project-tasks.mjs comment <task-gid> <text>')
  console.log('')
  console.log('Subcommands:')
  console.log('  export (default)    Export project tasks as JSON')
  console.log('  list-sections       List all sections (columns) in the project')
  console.log('  create-tag          Create a tag in the project workspace (prints tag GID to stdout)')
  console.log('  add-tag             Add an existing tag to a task')
  console.log('  move                Move a task to a section (by GID or name)')
  console.log('  comment             Add a comment to a task')
  console.log('')
  console.log('Export options:')
  console.log('  --project <gid>     Project GID (default: ASANA_PROJECT_GID or built-in)')
  console.log('  --output <file>     Output file path')
  console.log('  --concurrency <n>   Parallel request limit')
  console.log('  --no-comments       Skip fetching task comments')
  console.log('  --full              Include all Asana fields (verbose)')
  console.log('')
  console.log('The script auto-loads .env.asana from current working directory, then repo root.')
  console.log('')
  console.log('Auth environment (choose one):')
  console.log('  1) ASANA_ACCESS_TOKEN=<token>')
  console.log('  2) ASANA_REFRESH_TOKEN=<refresh_token> plus:')
  console.log('     ASANA_CLIENT_ID=<client_id>')
  console.log('     ASANA_CLIENT_SECRET=<client_secret>')
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getAccessToken() {
  if (process.env.ASANA_ACCESS_TOKEN) return process.env.ASANA_ACCESS_TOKEN

  const refreshToken = process.env.ASANA_REFRESH_TOKEN
  const clientId = process.env.ASANA_CLIENT_ID
  const clientSecret = process.env.ASANA_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    const available = [
      process.env.ASANA_ACCESS_TOKEN ? 'ASANA_ACCESS_TOKEN' : null,
      process.env.ASANA_REFRESH_TOKEN ? 'ASANA_REFRESH_TOKEN' : null,
      process.env.ASANA_CLIENT_ID ? 'ASANA_CLIENT_ID' : null,
      process.env.ASANA_CLIENT_SECRET ? 'ASANA_CLIENT_SECRET' : null,
    ].filter(Boolean)

    throw new Error(
      `Missing Asana auth. Asana requires either ASANA_ACCESS_TOKEN, or ASANA_REFRESH_TOKEN with ASANA_CLIENT_ID and ASANA_CLIENT_SECRET. ` +
      `Client ID/secret alone are not sufficient. Found: ${available.length ? available.join(', ') : 'none'}.`
    )
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(`${ASANA_BASE_URL}/oauth_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(`Failed to refresh Asana token: ${response.status} ${JSON.stringify(payload)}`)
  }
  if (!payload?.access_token) {
    throw new Error('Asana token refresh succeeded but no access_token returned.')
  }

  return payload.access_token
}

async function asanaGet(apiPath, accessToken) {
  let attempt = 0
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(`${ASANA_BASE_URL}${apiPath}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('retry-after') || '1', 10)
      await sleep(Math.max(1, retryAfter) * 1000)
      attempt += 1
      continue
    }

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(`Asana API error on ${apiPath}: ${response.status} ${JSON.stringify(payload)}`)
    }
    return payload
  }

  throw new Error(`Exceeded retries for ${apiPath}`)
}

async function asanaPost(apiPath, body, accessToken) {
  let attempt = 0
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(`${ASANA_BASE_URL}${apiPath}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('retry-after') || '1', 10)
      await sleep(Math.max(1, retryAfter) * 1000)
      attempt += 1
      continue
    }

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(`Asana API error on POST ${apiPath}: ${response.status} ${JSON.stringify(payload)}`)
    }
    return payload
  }

  throw new Error(`Exceeded retries for POST ${apiPath}`)
}

async function paginate(pathWithQuery, accessToken) {
  const all = []
  let path = pathWithQuery

  while (path) {
    const payload = await asanaGet(path, accessToken)
    if (Array.isArray(payload?.data)) {
      all.push(...payload.data)
    }
    const nextPath = payload?.next_page?.path
    path = typeof nextPath === 'string' && nextPath.length > 0 ? nextPath : ''
  }

  return all
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0

  async function run() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await worker(items[current], current)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run())
  await Promise.all(workers)
  return results
}

function toCompactTask(task) {
  const customFields = Array.isArray(task?.custom_fields)
    ? task.custom_fields.reduce((acc, field) => {
        const fieldName = field?.name
        const value = field?.display_value
        if (!fieldName || value === null || value === '') return acc
        if (!Array.isArray(acc[fieldName])) acc[fieldName] = []
        if (!acc[fieldName].includes(value)) acc[fieldName].push(value)
        return acc
      }, {})
    : []

  const tags = Array.isArray(task?.tags)
    ? task.tags
        .map((tag) => tag?.name)
        .filter((tagName) => typeof tagName === 'string' && tagName.length > 0)
    : []

  const section = Array.isArray(task?.memberships)
    ? (
        task.memberships
          .map((membership) => membership?.section?.name)
          .find((name) => typeof name === 'string' && name.length > 0) || null
      )
    : null

  const normalizedFields = Object.entries(customFields).reduce((acc, [fieldName, values]) => {
    if (!Array.isArray(values) || values.length === 0) return acc
    acc[fieldName] = values.length === 1 ? values[0] : values
    return acc
  }, {})

  return stripEmpty({
    id: task?.gid || null,
    title: task?.name || '',
    content: task?.notes || '',
    createdBy: task?.created_by?.name || null,
    section,
    tags,
    additionalFields: normalizedFields,
  })
}

function toCompactComment(comment) {
  const author = comment?.created_by?.name
  const text = `${comment?.text || ''}`.trim()
  if (!text) return null
  return author ? `${author}: ${text}` : text
}

function getPrimarySectionName(task) {
  if (!Array.isArray(task?.memberships)) return null
  return (
    task.memberships
      .map((membership) => membership?.section?.name)
      .find((name) => typeof name === 'string' && name.length > 0) || null
  )
}

function shouldExcludeTask(task) {
  if (task?.completed) return true
  const sectionName = getPrimarySectionName(task)
  if (!sectionName) return false
  return EXCLUDED_SECTION_NAMES.has(sectionName.trim().toLowerCase())
}

function stripEmpty(value) {
  if (Array.isArray(value)) {
    const cleaned = value.map(stripEmpty).filter((item) => item !== null)
    return cleaned.length ? cleaned : null
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, val]) => [key, stripEmpty(val)])
      .filter(([, val]) => val !== null)
    return entries.length ? Object.fromEntries(entries) : null
  }

  if (value === null || typeof value === 'undefined') return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

async function getTaskWithComments(taskStub, accessToken, includeStories, full) {
  const taskGid = taskStub.gid
  const taskFields = full ? FULL_TASK_OPT_FIELDS : COMPACT_TASK_OPT_FIELDS
  const commentFields = full ? FULL_COMMENT_OPT_FIELDS : COMPACT_COMMENT_OPT_FIELDS
  const taskDetailPayload = await asanaGet(`/tasks/${taskGid}?opt_fields=${encodeURIComponent(taskFields)}`, accessToken)
  const rawTask = taskDetailPayload?.data || taskStub
  if (shouldExcludeTask(rawTask)) return null
  const task = full ? rawTask : toCompactTask(rawTask)

  if (!includeStories) {
    return { ...task, comments: [] }
  }

  const stories = await paginate(
    `/tasks/${taskGid}/stories?limit=100&opt_fields=${encodeURIComponent(commentFields)}`,
    accessToken
  )
  const comments = stories.filter((story) => story?.type === 'comment' || story?.resource_subtype === 'comment_added')
  if (full) return { ...task, comments }

  const compactComments = comments.map(toCompactComment).filter(Boolean)
  return stripEmpty({ ...task, comments: compactComments })
}

async function writeOutput(outputPath, payload) {
  const finalPath = outputPath || getDefaultOutputPath()
  const parentDir = finalPath.includes('/') ? finalPath.slice(0, finalPath.lastIndexOf('/')) : ''
  if (parentDir) {
    await fs.mkdir(parentDir, { recursive: true })
  }
  await fs.writeFile(finalPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  process.stdout.write(`Wrote ${finalPath}\n`)
}

function extractProjectGid(argv) {
  const idx = argv.indexOf('--project')
  if (idx >= 0 && argv[idx + 1]) {
    const gid = argv[idx + 1]
    argv.splice(idx, 2)
    return gid
  }
  return process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID
}

async function getWorkspaceGid(projectGid, accessToken) {
  const payload = await asanaGet(
    `/projects/${projectGid}?opt_fields=workspace.gid`,
    accessToken,
  )
  const gid = payload?.data?.workspace?.gid
  if (!gid) throw new Error('Could not resolve workspace GID from project')
  return gid
}

async function findSectionByName(projectGid, name, accessToken) {
  const sections = await paginate(
    `/projects/${projectGid}/sections?opt_fields=gid,name&limit=100`,
    accessToken,
  )
  const normalized = name.trim().toLowerCase()
  const match = sections.find((s) => s.name.trim().toLowerCase() === normalized)
  if (!match) {
    const available = sections.map((s) => `  ${s.gid}\t${s.name}`).join('\n')
    throw new Error(`Section "${name}" not found. Available sections:\n${available}`)
  }
  return match
}

async function runExport(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    printHelp()
    return
  }

  const accessToken = await getAccessToken()
  const taskStubs = await paginate(
    `/projects/${args.projectGid}/tasks?limit=100&opt_fields=gid,name,resource_subtype`,
    accessToken,
  )

  const tasks = await mapWithConcurrency(taskStubs, args.concurrency, (taskStub) =>
    getTaskWithComments(taskStub, accessToken, args.includeStories, args.full),
  )
  const filteredTasks = tasks.filter(Boolean)
  await writeOutput(args.output, { tasks: filteredTasks })
}

async function runListSections(argv) {
  const projectGid = extractProjectGid(argv)
  const accessToken = await getAccessToken()
  const sections = await paginate(
    `/projects/${projectGid}/sections?opt_fields=gid,name&limit=100`,
    accessToken,
  )
  for (const section of sections) {
    process.stdout.write(`${section.gid}\t${section.name}\n`)
  }
}

async function runCreateTag(argv) {
  const remaining = [...argv]
  const projectGid = extractProjectGid(remaining)
  const name = remaining[0]
  if (!name) throw new Error('Usage: create-tag <name> [--project <gid>]')

  const accessToken = await getAccessToken()
  const workspaceGid = await getWorkspaceGid(projectGid, accessToken)
  const payload = await asanaPost(
    '/tags',
    { data: { name, workspace: workspaceGid } },
    accessToken,
  )
  const tagGid = payload?.data?.gid
  process.stdout.write(`${tagGid}\n`)
  process.stderr.write(`Created tag "${name}" → ${tagGid}\n`)
}

async function runAddTag(argv) {
  const [taskGid, tagGid] = argv
  if (!taskGid || !tagGid) throw new Error('Usage: add-tag <task-gid> <tag-gid>')

  const accessToken = await getAccessToken()
  await asanaPost(`/tasks/${taskGid}/addTag`, { data: { tag: tagGid } }, accessToken)
  process.stderr.write(`Tagged task ${taskGid} with ${tagGid}\n`)
}

async function runMove(argv) {
  const remaining = [...argv]
  const projectGid = extractProjectGid(remaining)
  const taskGid = remaining[0]

  if (!taskGid) throw new Error('Usage: move <task-gid> <section-gid-or-name> [--project <gid>]')

  const sectionArg = remaining.slice(1).join(' ')
  if (!sectionArg) throw new Error('Usage: move <task-gid> <section-gid-or-name> [--project <gid>]')

  const accessToken = await getAccessToken()
  const isGid = /^\d+$/.test(sectionArg)
  const sectionGid = isGid
    ? sectionArg
    : (await findSectionByName(projectGid, sectionArg, accessToken)).gid

  await asanaPost(
    `/sections/${sectionGid}/addTask`,
    { data: { task: taskGid } },
    accessToken,
  )
  process.stderr.write(`Moved task ${taskGid} → section ${sectionGid}\n`)
}

async function runComment(argv) {
  const taskGid = argv[0]
  const text = argv.slice(1).join(' ')
  if (!taskGid || !text) throw new Error('Usage: comment <task-gid> <text>')

  const accessToken = await getAccessToken()
  await asanaPost(
    `/tasks/${taskGid}/stories`,
    { data: { text } },
    accessToken,
  )
  process.stderr.write(`Commented on task ${taskGid}\n`)
}

const SUBCOMMANDS = new Set(['export', 'list-sections', 'create-tag', 'add-tag', 'move', 'comment'])

async function main() {
  await loadLocalEnvFile()

  const argv = process.argv.slice(2)
  let subcommand = 'export'
  let subArgv = argv

  if (argv.length > 0 && SUBCOMMANDS.has(argv[0])) {
    subcommand = argv[0]
    subArgv = argv.slice(1)
  }

  switch (subcommand) {
    case 'export': return runExport(subArgv)
    case 'list-sections': return runListSections(subArgv)
    case 'create-tag': return runCreateTag(subArgv)
    case 'add-tag': return runAddTag(subArgv)
    case 'move': return runMove(subArgv)
    case 'comment': return runComment(subArgv)
    default: throw new Error(`Unknown subcommand: ${subcommand}`)
  }
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})

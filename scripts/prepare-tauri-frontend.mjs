import { access, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { execSync } from 'node:child_process'

const OUTPUT_DIR = '.output/public'
const EXCLUDED_DIR = `${OUTPUT_DIR}/mycenter-packages`

async function pathExists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log('[tauri] generating static frontend...')
  execSync('npx nuxt generate', { stdio: 'inherit', shell: true })

  if (await pathExists(EXCLUDED_DIR)) {
    await rm(EXCLUDED_DIR, { recursive: true, force: true })
    console.log(`[tauri] excluded '${EXCLUDED_DIR}' from desktop bundle`)
  } else {
    console.log(`[tauri] nothing to exclude: '${EXCLUDED_DIR}' not found`)
  }
}

main().catch((error) => {
  console.error('[tauri] failed to prepare frontend:', error)
  process.exit(1)
})

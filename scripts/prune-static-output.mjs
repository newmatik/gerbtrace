import { access, rm } from 'node:fs/promises'
import { constants } from 'node:fs'

const EXCLUDED_DIR = '.output/public/mycenter-packages'

async function pathExists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (await pathExists(EXCLUDED_DIR)) {
    await rm(EXCLUDED_DIR, { recursive: true, force: true })
    console.log(`[build] excluded '${EXCLUDED_DIR}' from static output`)
  }
}

main().catch((error) => {
  console.error('[build] failed to prune static output:', error)
  process.exit(1)
})

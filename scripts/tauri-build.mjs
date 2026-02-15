import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

/**
 * Local-friendly wrapper for `tauri build`.
 *
 * Why:
 * - In some environments (like IDE terminals), `CI=1` can be set, which Tauri
 *   maps to `--ci 1` and fails because it expects a boolean.
 * - If updater signing keys are configured but the password is not available
 *   (non-interactive runs), `tauri build` can fail while still being able to
 *   compile the app successfully.
 *
 * Behavior:
 * - Forces `CI=false` unless explicitly set to `true`/`false`.
 * - If `src-tauri/.tauri-private-key` exists and `TAURI_SIGNING_PRIVATE_KEY`
 *   is not set, loads it into the environment (never printed).
 * - If no signing password is available and stdout is not a TTY, runs with
 *   `--no-bundle` so local build gates can still verify compilation.
 */

const userArgs = process.argv.slice(2)

// Normalize CI to avoid `--ci 1` issues.
if (process.env.CI === '1' || process.env.CI === '0' || process.env.CI === '') {
  process.env.CI = 'false'
}

// Load local signing key if present (gitignored).
if (!process.env.TAURI_SIGNING_PRIVATE_KEY && existsSync('src-tauri/.tauri-private-key')) {
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync('src-tauri/.tauri-private-key', 'utf8')
}

const hasSigningPassword = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD)
const isTty = Boolean(process.stdout.isTTY)

const args = [
  'tauri',
  'build',
  ...(!hasSigningPassword && !isTty ? ['--no-bundle'] : []),
  ...userArgs,
]

const res = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  env: process.env,
})

process.exit(res.status ?? 1)


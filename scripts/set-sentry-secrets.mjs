#!/usr/bin/env node
/**
 * Set Sentry-related GitHub Actions secrets for this repo using `gh secret set`.
 * Run from repo root. Requires: gh auth login (with repo scope).
 *
 * Usage:
 *   SENTRY_DSN=... SENTRY_AUTH_TOKEN=... node scripts/set-sentry-secrets.mjs
 *   node scripts/set-sentry-secrets.mjs   # prompts for values
 */

import { execSync } from 'child_process'
import * as readline from 'readline'

const SECRETS = [
  {
    name: 'SENTRY_DSN',
    description: 'Sentry project DSN (Project → Settings → Client Keys)',
    url: 'https://sentry.io/settings/newmatik/projects/gerbtrace/keys/',
  },
  {
    name: 'SENTRY_AUTH_TOKEN',
    description: 'Sentry auth token for source maps (optional; Settings → Auth Tokens, scope project:releases)',
    url: 'https://sentry.io/settings/account/api/auth-tokens/',
    optional: true,
  },
]

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve((answer || '').trim())
    })
  })
}

async function main() {
  const values = {}
  for (const s of SECRETS) {
    values[s.name] = process.env[s.name] || (await prompt(`${s.description}\n  ${s.name}${s.optional ? ' (optional, press Enter to skip)' : ''}: `))
    if (!values[s.name] && !s.optional) {
      console.error(`Error: ${s.name} is required. Get it from: ${s.url}`)
      process.exit(1)
    }
  }

  for (const s of SECRETS) {
    if (!values[s.name]) continue
    console.log(`Setting GitHub secret: ${s.name}...`)
    try {
      execSync(`gh secret set ${s.name}`, {
        input: values[s.name],
        stdio: ['pipe', 'inherit', 'inherit'],
      })
      console.log(`  ${s.name} set.`)
    } catch (e) {
      console.error(`  Failed to set ${s.name}. Ensure 'gh' is installed and you have admin access to the repo.`)
      process.exit(1)
    }
  }

  console.log('Done. Web deploy and desktop build will use these secrets when running in GitHub Actions.')
}

main()

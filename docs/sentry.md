# Sentry setup (Gerbtrace)

Error reporting and user feedback are wired to Sentry (org: **newmatik**, project: **gerbtrace**).

## One-time setup: wizard + GitHub secrets

### 1. Run the Sentry wizard (optional; config is already in repo)

To re-run or complete the official setup:

```bash
npx @sentry/wizard@latest -i nuxt --saas --org newmatik --project gerbtrace
```

- Open the login link in the browser when prompted and complete Sentry auth.
- When asked “Do you want to add an override for @vercel/nft?”, choose **Yes** (or it’s already in `package.json`).

### 2. Get Sentry DSN and auth token

- **DSN** (required):  
  [Sentry → gerbtrace project → Settings → Client Keys (DSN)](https://sentry.io/settings/newmatik/projects/gerbtrace/keys/)  
  Copy the **DSN** value.

- **Auth token** (optional, for source map uploads):  
  [Sentry → Settings → Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/)  
  Create a token with scope **`project:releases`** (and **`org:read`** if required). Copy the token.

### 3. Set GitHub Actions secrets

From the repo root, with [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`):

```bash
# Interactive: script will prompt for each value
node scripts/set-sentry-secrets.mjs
```

Or set them yourself:

```bash
# Paste your DSN when prompted (or use - to read from stdin)
echo -n "YOUR_SENTRY_DSN" | gh secret set SENTRY_DSN

# Optional: for source map uploads
echo -n "YOUR_SENTRY_AUTH_TOKEN" | gh secret set SENTRY_AUTH_TOKEN
```

Or in the GitHub UI: **Repo → Settings → Secrets and variables → Actions → New repository secret** for `SENTRY_DSN` and (optionally) `SENTRY_AUTH_TOKEN`.

---

## Web app

- **Nuxt** uses `@sentry/nuxt`. Config: `sentry.client.config.ts`, `sentry.server.config.ts`, and `nuxt.config.ts` (module + `runtimeConfig.public.sentry`).
- Set **`SENTRY_DSN`** in the environment when building (e.g. in GitHub Actions for deploy). Optional: **`SENTRY_AUTH_TOKEN`** for source map uploads.
- Deploy workflow (`.github/workflows/deploy.yml`) uses secrets: **`SENTRY_DSN`**, **`SENTRY_AUTH_TOKEN`** (optional).

## Desktop app (Tauri)

- **Rust** uses the `sentry` crate with the **panic** feature so native panics are sent to Sentry.
- **DSN**: Set **`SENTRY_DSN`** at build time (e.g. in CI) or at runtime; the binary uses `option_env!("SENTRY_DSN")` and `std::env::var("SENTRY_DSN")`.
- Desktop build workflow (`.github/workflows/build-desktop.yml`) passes **`SENTRY_DSN`** from secrets to the Tauri build.

## User bug reports

- **Report a bug** in the header (bug icon) or under **Settings → Report a bug** opens a modal (web and desktop).
- Submissions are sent as Sentry messages (tag: `type: user_report`) with optional email and description.

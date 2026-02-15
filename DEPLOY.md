# Deployment & Operations

This document describes how Gerbtrace is deployed (web + desktop + API), which environment variables are required, and how the Supabase API server is set up on the DigitalOcean droplet.

## Overview

Gerbtrace has three deployable surfaces:

- **Web app**: a static Nuxt SPA hosted on **DigitalOcean Spaces** (`gerbtrace.com`).
- **Desktop app**: Tauri 2 builds for macOS/Windows shipped via **GitHub Releases** with the Tauri updater.
- **API server**: a **self-hosted Supabase** stack on a DigitalOcean droplet (`api.gerbtrace.com`), including Postgres, Storage, Realtime, and Edge Functions.

## Environment variables (local)

The Nuxt app reads Supabase settings via runtime config. For local development, copy `.env.example` to `.env` and set:

- **`SUPABASE_URL`**: Supabase API base URL
  - local dev: `http://localhost:54321`
  - production: `https://api.gerbtrace.com`
- **`SUPABASE_ANON_KEY`**: Supabase anon key (JWT)

You can also use Nuxt’s explicit public env vars (same values):

- **`NUXT_PUBLIC_SUPABASE_URL`**
- **`NUXT_PUBLIC_SUPABASE_ANON_KEY`**

Important:
- **Never commit `.env`** (it is gitignored).
- Treat service-role keys and SMTP credentials as secrets and keep them off the client.

## CI/CD workflows

Workflows live in `.github/workflows/`:

- **`ci.yml`** (PRs to `main`)
  - Runs `npm ci`, `nuxi typecheck`, and `nuxt generate`.
- **`deploy.yml`** (pushes to `main`)
  - Runs `nuxt generate` and uploads `.output/public` to DigitalOcean Spaces.
  - Optionally purges the DO CDN cache if configured.
- **`deploy-supabase.yml`** (pushes to `main` changing `supabase/**` and manual dispatch)
  - Uploads `supabase/**` to the droplet via SSH/SCP.
  - Applies SQL migrations (idempotently) and syncs edge functions.
- **`build-desktop.yml`** (tag pushes `v*`)
  - Builds macOS and Windows installers.
  - Creates/publishes a GitHub Release and `latest.json` for the updater.

## GitHub secrets required

### Web deploy (`deploy.yml`)

- **`DO_SPACES_ACCESS_KEY`**
- **`DO_SPACES_SECRET_KEY`**
- **`DO_SPACES_BUCKET`**
- **`DO_SPACES_REGION`**
- **(optional)** `DO_API_TOKEN`, `DO_CDN_ENDPOINT_ID` for CDN purge

### Desktop builds (`build-desktop.yml`)

Updater signing (required for updater artifacts):

- **`TAURI_SIGNING_PRIVATE_KEY`**
- **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`** (may be empty depending on how the key was generated)

Runtime Supabase config passed to builds:

- **`SUPABASE_URL`**
- **`SUPABASE_ANON_KEY`**

Apple signing / notarization (macOS builds):

- **`APPLE_CERTIFICATE`**, **`APPLE_CERTIFICATE_PASSWORD`**, **`KEYCHAIN_PASSWORD`**
- **`APPLE_SIGNING_IDENTITY`**
- **`APPLE_API_ISSUER`**, **`APPLE_API_KEY`**, **`APPLE_API_KEY_CONTENT`**

### Droplet API deploy (`deploy-supabase.yml`)

- **`DROPLET_HOST`** (e.g. `api.gerbtrace.com`)
- **`DROPLET_USER`** (e.g. `root`)
- **`DROPLET_SSH_KEY`** (private key used by GitHub Actions)

Security note:
- Use a **dedicated deploy key** with minimal scope.
- Do not reuse personal SSH keys for CI.

## Web deploy (DigitalOcean Spaces)

On push to `main`, GitHub Actions:

1. Runs `npx nuxt generate`
2. Uploads `.output/public` to the configured DO Spaces bucket
3. Optionally purges CDN cache

Verification:
- Check the “Deploy Web to DigitalOcean Spaces” workflow run in GitHub Actions.
- Confirm the footer version matches `runtimeConfig.public.appVersion` in `nuxt.config.ts`.

## Desktop release (GitHub Releases + updater)

Desktop releases are tag-driven:

1. Ensure versions are aligned:
   - `package.json`
   - `nuxt.config.ts` (`runtimeConfig.public.appVersion`)
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
2. Push tag `vX.Y.Z`:
   - `git tag -a vX.Y.Z -m "vX.Y.Z"`
   - `git push origin vX.Y.Z`
3. GitHub Actions builds installers and publishes a Release with updater metadata.

Local build gate:
- `npm run tauri:build`
  - This repo includes a small wrapper (`scripts/tauri-build.mjs`) to avoid CI env quirks and to allow compilation checks even when signing secrets are not available locally.

## API server (Supabase on DigitalOcean droplet)

### Initial droplet provisioning

The repository includes a provisioning script:

- `scripts/setup-supabase-droplet.sh`

What it does (high level):
- Installs Docker
- Clones Supabase docker setup under `/opt/supabase`
- Writes a droplet-local `.env` for Supabase (JWT secret, DB password, anon/service keys, redirect URLs)
- Sets up nginx + optional Let’s Encrypt

After provisioning, ensure DNS points:
- `api.gerbtrace.com` → droplet IP

### Migrations and edge functions

Source of truth in this repo:

- SQL migrations: `supabase/migrations/*.sql`
- Edge functions: `supabase/functions/**`

How CI deploys them (`deploy-supabase.yml`):

- Copies `supabase/**` to the droplet (temporary directory under `/tmp/gerbtrace-supabase-<sha>`).
- Applies migrations **in timestamp order**.
- Records applied migrations in `public.schema_migrations` (created if missing).
- Syncs edge function code into the droplet’s functions volume directory:
  - default path used: `/opt/supabase/docker/volumes/functions`
- Restarts the Supabase **functions** service (or falls back to restarting all services).

Important caveats:
- If the droplet was already provisioned with an existing schema, the baseline migration may be skipped and recorded to avoid failing on “already exists”.
- SQL is executed inside the Supabase Postgres container via `docker compose exec -T db psql ...`.

### Manual deployment (break-glass)

If GitHub Actions is unavailable, you can run the equivalent steps on the droplet:

```bash
cd /opt/supabase/docker

# Apply migrations (example: run in order)
for f in /path/to/repo/supabase/migrations/*.sql; do
  docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done

# Sync functions (example path)
rm -rf /opt/supabase/docker/volumes/functions/*
cp -R /path/to/repo/supabase/functions/* /opt/supabase/docker/volumes/functions/

docker compose restart functions
```

## Operational safety

- **Never paste private keys into PRs/issues/chat**. Treat pasted keys as compromised and rotate them.
- Keep deploy keys scoped and rotate periodically.
- Confirm Actions logs do not contain secret material (they should not).


# Deployment & Operations

This document describes how Gerbtrace is deployed (web + desktop + API), which environment variables are required, and how production Supabase is operated after the cloud migration.

## Overview

Gerbtrace has three deployable surfaces:

- **Web app**: a static Nuxt SPA hosted on **DigitalOcean Spaces** (`gerbtrace.com`).
- **Desktop app**: Tauri 2 builds for macOS/Windows shipped via **GitHub Releases** with the Tauri updater.
- **API server**: **Supabase Cloud** project `gqrnlnlfidighosujpdb` served through `api.gerbtrace.com` reverse proxy.

## Environment variables (local)

The Nuxt app reads Supabase settings via runtime config. For local development, copy `.env.example` to `.env` and set:

- **`SUPABASE_URL`**: Supabase API base URL
  - local dev: `http://localhost:54321`
- production: `https://api.gerbtrace.com` (proxying Supabase Cloud)
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
- **`deploy-supabase.yml`**
  - Legacy self-hosted deploy workflow, intentionally disabled.
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

### Legacy droplet deploy

- Legacy self-hosted deploy secrets are no longer part of the active production path.
- Keep them only for emergency rollback operations.

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

## API server (Supabase Cloud)

Production database/auth/storage/functions live in Supabase Cloud project `gqrnlnlfidighosujpdb`.

Source of truth remains in this repository:

- SQL migrations: `supabase/migrations/*.sql`
- Edge functions: `supabase/functions/**`

Operational model:

- Apply schema/function changes to Supabase Cloud first.
- Keep `api.gerbtrace.com` as the public endpoint via droplet nginx reverse proxy to `https://gqrnlnlfidighosujpdb.supabase.co`.
- Keep the old self-hosted droplet stack as rollback standby; do not treat it as active production.

## Operational safety

- **Never paste private keys into PRs/issues/chat**. Treat pasted keys as compromised and rotate them.
- Keep deploy keys scoped and rotate periodically.
- Confirm Actions logs do not contain secret material (they should not).


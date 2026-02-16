# Release Checklist

Step-by-step checklist for shipping a Gerbtrace release. Covers version bumps,
CI verification, and the recurring Supabase pitfalls that have caused deploy
failures in every release since v1.0.6.

---

## 1. Version bump

- [ ] `package.json` `version`
- [ ] `nuxt.config.ts` `runtimeConfig.public.appVersion`
- [ ] `src-tauri/tauri.conf.json` `version`
- [ ] `src-tauri/Cargo.toml` `version`

All four must match.

## 2. Supabase migration review

If the release includes new SQL migrations:

- [ ] Every `CREATE TABLE` uses `IF NOT EXISTS`
- [ ] Every `CREATE FUNCTION` uses `CREATE OR REPLACE`
- [ ] Every `ALTER TABLE ADD COLUMN` uses `IF NOT EXISTS`
- [ ] Every `ALTER TABLE ADD CONSTRAINT` checks `pg_constraint` before adding
- [ ] Every `CREATE POLICY` is guarded against re-creation (or the "already exists"
      error is in the deploy script's allow list)
- [ ] Dedup `DELETE` statements use `row_number()` with a stable tiebreaker (not just `created_at`)
- [ ] No statement depends on `postgres` being able to `SET ROLE supabase_admin`
      (it cannot on the production droplet)
- [ ] No statement requires table/function ownership that `supabase_admin` does not have

## 3. Merge to main

- [ ] Create PR from release branch to main
- [ ] Squash merge with title `Release vX.Y.Z`

## 4. Verify CI workflows

After merge to main, two workflows trigger:

- [ ] **Deploy Web to DigitalOcean Spaces** — succeeds
- [ ] **Deploy Supabase (Droplet)** — succeeds

If the Supabase deploy fails:

1. Read the failed run logs: `gh run view <id> --log-failed`
2. Common errors and fixes:
   - `must be owner of table/function` — the migration is running as the wrong
     role. Check that `deploy-supabase.yml` uses `-U supabase_admin` for the
     migration SQL.
   - `permission denied to set role` — a migration tried `SET ROLE` to a role
     the current user is not a member of. Remove the `SET ROLE` and ensure the
     deploy script runs as the correct user.
   - `already exists` / `duplicate key` — non-idempotent migration. Add
     `IF NOT EXISTS` / `CREATE OR REPLACE` / `pg_constraint` checks.
3. Fix on a branch, merge via PR, and verify the re-triggered deploy succeeds.

## 5. Verify website version

```bash
curl -s https://www.gerbtrace.com/index.html | grep -o 'appVersion[^,]*'
```

- [ ] Output shows the new version string

If it shows the old version, flush the CDN:

```bash
doctl compute cdn list
doctl compute cdn flush <cdn-id> --files '*'
```

## 6. Tag and release

- [ ] `git tag vX.Y.Z` on the main branch (after all fix commits are merged)
- [ ] `git push origin vX.Y.Z`
- [ ] Verify **Build Desktop App** workflow triggers and runs for both macOS and Windows
- [ ] Create GitHub Release with `gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."`
- [ ] Release notes follow the style in `.cursor/rules/release-notes-style.mdc`:
      flat bullet list, no headings, no emojis, user-facing changes only

## 7. Desktop build verification

- [ ] `build-desktop.yml` succeeds for `macos-latest`
- [ ] `build-desktop.yml` succeeds for `windows-latest`

If a desktop build fails with `incorrect updater private key password`:

- Rotate `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  secrets in GitHub, then re-run.

---

## Historical failure log

| Release | Failure | Root cause | Fix |
|---------|---------|------------|-----|
| v1.0.6  | Deploy workflow YAML invalid | Syntax error in new workflow | `b6d5d4d` |
| v1.0.6  | Initial schema fails on provisioned DB | Migration not idempotent | `31dba88`, `59a83c7` |
| v1.0.6  | `set -e` kills script on expected errors | Error handling too strict | `fb6241c` |
| v1.0.6  | Grep quoting breaks detection | Shell quoting in deploy script | `ada003f`, `4e69fc5` |
| v1.0.6  | Edge functions not restarted | Missing restart step | `0aa289c` |
| v1.0.9  | `must be owner of function` | postgres cannot replace function owned by supabase_admin | `98d278f`, `763de7a` |
| v1.0.10 | `must be owner of table` | postgres cannot ALTER tables owned by supabase_admin | `19c5e94` |
| v1.0.10 | `permission denied to set role` | postgres cannot SET ROLE to supabase_admin | `2904ffe` |

# CAD library ingestion (external sources)

This project can sync a curated set of free/open CAD libraries into `.local/libraries/` for TPSys package research and normalization.

## Why this exists

- Keep all third-party library downloads reproducible
- Keep provenance and license metadata together with each source
- Make periodic refresh easy (`npm run libraries:sync`)

## Command

```bash
npm run libraries:sync
```

Then parse synced libraries into the built-in package tree:

```bash
npm run libraries:parse
npm run packages:tree:manifest
npm run packages:tree:check
```

Parse THT libraries as well:

```bash
npm run libraries:parse:tht
npm run packages:tht:manifest
```

Optional flags:

- `--include-large` includes very large repositories
- `--include-disabled` includes sources marked disabled in the source list
- `--dry-run` prints planned actions without downloading

Example:

```bash
node scripts/sync-cad-libraries.mjs --include-large --include-disabled
```

## Source list

Edit `scripts/cad-library-sources.json` to add/remove sources.

Each source record includes:

- repo URL (`url`)
- target classification (`licenseBucket`, `tool`)
- licensing notes (`license`, `redistribution`)
- toggle flags (`enabled`, `large`)
- UI label (`displayName`) used by the Package Manager library list

Current user-facing labels:

- `newmatik` -> `Gerbtrace`
- `kicad-footprints` -> `KiCad`
- `digikey-kicad-atomic` -> `DigiKey KiCad`

## Output structure

The sync script creates this structure:

```text
.local/libraries/
  <licenseBucket>/
    <owner>/
      <repo>/
  _index/
    sources-lock.json
```

`sources-lock.json` captures:

- sync timestamp
- selected flags
- path and commit hash for each downloaded source
- skipped sources and reason

The parser script writes:

```text
public/packages/libraries/
  _tree.json
  _reports/
  <library-id>/
    library.json
    packages/*.json
```

THT parser output:

```text
public/packages/tht-libraries/
  _tree.json
  _reports/
  <library-id>/
    library.json
    packages/*.json
```

The runtime loader consumes `public/packages/libraries/_tree.json` and loads
selected libraries on demand.

## Parsing/filtering behavior (important)

The current ingestion pipeline applies these filters/rules during parse:

- Skip KiCad `MOUNTING-HOLE` footprints.
- Drop `-THERMAL-VIAS` variants when a non-thermal base package exists.
- Keep canonical names deterministic and KLC-inspired for KiCad imports.
- Record skip reasons and collisions in `_reports/*.json`.

## Coverage note for DigiKey

For `digikey-kicad-atomic`, raw footprint count is much higher than emitted SMD
package count because many footprints are not translatable to current TPSys
parametric models (`not_translatable_tpsys`) or have no SMD pads for SMD parser
purposes (`no_pads`). THT coverage is higher because the THT parser accepts
through-hole pad-driven conversion.

## License hygiene reminder

Using third-party library data in PCB designs is not the same as redistributing library collections.  
Before publishing derived libraries, verify each upstream license and keep attribution/share-alike obligations where required.


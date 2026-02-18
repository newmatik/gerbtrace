# CAD Library Parser

This document describes both parser pipelines:

- `scripts/parse-cad-libraries-to-tpsys.mjs` (SMD/TPSys parametric output)
- `scripts/parse-cad-libraries-to-tht.mjs` (THT primitive-shape output)

## Goal

Convert curated external CAD libraries from `.local/libraries/**` into:

- SMD: TPSys-compatible `PackageDefinition` JSON under
  `public/packages/libraries/<library-id>/packages/*.json`
- THT: `THTPackageDefinition` JSON under
  `public/packages/tht-libraries/<library-id>/packages/*.json`

and emit manifests/reports:

- `public/packages/libraries/<library-id>/library.json`
- `public/packages/libraries/_reports/<library-id>.json`
- `public/packages/tht-libraries/<library-id>/library.json`
- `public/packages/tht-libraries/_reports/<library-id>.json`

## Inputs

- `scripts/cad-library-sources.json` (source registry + license metadata)
- Downloaded repos from `npm run libraries:sync`

## Adapters (SMD parser)

- **KiCad**: parses `.kicad_mod` files and extracts pad geometry from pad/at/size
- **LibrePCB**: parses `.lp`/`.lplib` package text and extracts position/size
- **Eagle**: parses `.lbr` XML and extracts `<smd .../>` pads
- **Digi-Key KiCad**: handled by KiCad adapter, separate source metadata

## Adapters (THT parser)

- **KiCad**: parses `.kicad_mod` through-hole pads and graphics:
  - pads: position, size, shape, drill
  - body/detail graphics: `fp_line`, `fp_rect`, `fp_circle` on `F.Fab`/`F.SilkS`
  - output shapes: `rect`, `roundedRect`, `circle`, `line`

## Mapping policy (SMD)

- Enforce runtime package types already supported by `PackageDefinition`
- Use `PT_GENERIC` fallback when geometry cannot be mapped confidently
- Never introduce custom package type identifiers
- For KiCad footprints, translate only package families that map reliably to
  current TPSys runtime models (QFN/DFN/SO*/QFP/PLCC/BGA/LGA/SOT variants).
- Skip footprints that are mechanical or not directly translatable (connectors,
  templates, potentiometers, etc.) and record them in report files.
- When exposed-pad variants (`*EP*`) are present, prefer preserving outer lead
  geometry; center EP rendering is not represented by current simplified models.

## Mapping policy (THT)

- Convert through-hole pads into visual pin primitives while preserving shape
  class where possible:
  - `rect` -> rectangular pin
  - `oval` / `roundrect` -> rounded-rect pin
  - otherwise -> circular pin
- Render drill as an inner dark circle for better realism.
- Preserve footprint body/detail from Fab/Silk primitives when available.
- Add explicit polarity marker near pin 1.

## Naming policy (KiCad-derived names)

Naming is now KLC-inspired:

- `<PKG>-<PINCOUNT>[-<SPECIAL>]_<FIELD>_<FIELD>...`
- Family normalization:
  - `SO-*` / `SOP-*` -> `SOIC-*`
  - `SOIC-0n` -> `SOIC-n`
- Keep special pad count in head (`1EP`, `1SH`, `1MP`).
- Compact common options:
  - `THERMAL-VIAS` -> `THERMALVIAS`
  - `TOP-TENTED` -> `TOPTENTED`
  - `HAND-SOLDERING` -> `HANDSOLDERING`

## Filtering policy

- Skip `MOUNTING-HOLE` footprints.
- Drop `-THERMAL-VIAS` variants when base package exists.

## Conflict policy (SMD)

- Canonical key: normalized package name (uppercase + separator normalization)
- Deduplicate globally across emitted libraries
- Seed global keys with Newmatik built-ins (including aliases)
- On same-name/different-geometry conflicts in one source library, keep first
  deterministic match and record conflict in the report

## Quality gates

- `npm run packages:tree:manifest` regenerates `_tree.json`
- `npm run packages:tree:check` validates:
  - manifest/tree consistency
  - per-library unique keys
  - global name/alias collision safety
- `npm run packages:tht:manifest` regenerates THT `_tree.json`

## Typical workflow

```bash
npm run libraries:sync
npm run packages:migrate:newmatik
npm run libraries:parse
npm run packages:tree:manifest
npm run packages:tree:check
npm run libraries:parse:tht
npm run packages:tht:manifest
```

# Package Canonical Naming Rules

This document defines the authoritative package naming system used by Gerbtrace
for imported and curated package libraries.

It combines:

- KiCad KLC naming structure (for broad ecosystem compatibility)
- our internal stability and lookup requirements
- practical migration/alias rules for existing package data

---

## 1) Scope and objectives

These rules apply to:

- Built-in package libraries under `public/packages/libraries/*`
- THT built-in libraries under `public/packages/tht-libraries/*`
- Parser outputs from `scripts/parse-cad-libraries-to-tpsys.mjs`
- Name matching in `usePackageLibrary` lookup logic

Primary objectives:

1. Deterministic, stable canonical names
2. High interoperability with KiCad ecosystem naming
3. Reduced ambiguity for families with many dimensional variants
4. Backward compatibility via aliases and lookup normalization

---

## 2) Core naming principles

1. **Uppercase canonical names**
   - Canonical names are uppercase.
   - Use `-` and `_` only (no spaces).

2. **Structured head + fields**
   - Head encodes package family and pin-count semantics.
   - Tail fields encode dimensions/pitch/modifiers/options.

3. **Do not invent new package families**
   - Reuse industry/KiCad family tokens where possible.
   - Do not create project-specific package family prefixes.

4. **Be specific when ambiguity is likely**
   - QFN/DFN/LGA families should include body + pitch when available.
   - Keep EP information (`1EP`, `EP...`) when present.

5. **Canonical key stability**
   - Once a package name is published, avoid renaming unless absolutely necessary.
   - If renamed, maintain compatibility through aliases/normalization.

---

## 3) Canonical grammar

For KiCad-derived packages, canonical naming follows:

`<PKG>-<PINCOUNT>[-<SPECIAL>]_<FIELD>_<FIELD>...`

### 3.1 Head section

- `<PKG>`: package family token (examples: `SOIC`, `QFN`, `DFN`, `DIP`, `TO`, `SOT`)
- `<PINCOUNT>`: primary pin count token
- Optional additional head tokens:
  - non-standard numbering style (for KLC F2.4 patterns), e.g. `MSOP-12-16`
  - special pad-count tokens like `1EP`, `1SH`, `1MP`

### 3.2 Tail fields

Underscore-separated, KLC-style parameter fields, for example:

- body dimensions: `3.9X9.9MM`, `5X5MM`, `4X4X1.1MM`
- pitch: `P1.27MM`, `P0.5MM`
- exposed pad dimensions: `EP3.3X3.3MM`
- width/lead span fields: `W7.62MM`
- options/modifiers: `SOCKET`, `HANDSOLDERING`, `THERMALVIAS`, `TOPTENTED`

---

## 4) KiCad KLC alignment and project decisions

These choices align with KLC F2/F3 while remaining practical for our pipeline:

### 4.1 SO family canonicalization

Canonical family token is **`SOIC`**.

Normalize:

- `SO-8` -> `SOIC-8`
- `SOP-8` -> `SOIC-8`
- `SOIC-08` -> `SOIC-8`

This avoids split inventories (`SO-*` vs `SOIC-*`) and matches common KLC examples.

### 4.2 Non-standard pin numbering (KLC F2.4)

When source uses non-standard pad numbering patterns:

- preserve dual-count head style, e.g. `MSOP-12-16_...`

### 4.3 Special pad-count tokens (KLC F2.1)

Retain explicit special pad count in head where present:

- `-1EP`, `-1SH`, `-1MP`

### 4.4 THT naming compatibility (KLC F3.5)

For DIP/TO/THT IC families, use the same structured style:

- `DIP-14_W7.62MM`
- `TO-220-5_VERTICAL`

---

## 5) Parser normalization rules (implemented)

The parser applies deterministic normalization in this order:

1. Trim and uppercase
2. Normalize separators
3. Family normalization for SO variants (`SO`/`SOP` -> `SOIC`)
4. Build KLC-style head and underscore-tail structure
5. Compact known option phrases:
   - `THERMAL-VIAS` -> `THERMALVIAS`
   - `TOP-TENTED` -> `TOPTENTED`
   - `HAND-SOLDERING` -> `HANDSOLDERING`

### 5.1 Tokenization behavior

- Head keeps package and pin semantics
- Tail fields become underscore-separated parameters/options
- If no tail exists, canonical name may remain head-only

---

## 6) Alias and lookup compatibility policy

Canonical names are strict. Lookup remains permissive.

### 6.1 Common equivalent inputs

Examples resolved to same canonical target:

- `SOIC-8`, `SOIC8`, `SO-8`, `SO8`, `SOP-8`
- `R0603`, `C0603`, `L0603`, `0603`

### 6.2 Alias safeguards

- Aliases must not collide with another package canonical key.
- Duplicate/ambiguous aliases should be removed during migration/check.
- Prefer deterministic pattern-based normalization over large ad-hoc alias lists.

---

## 7) Family-specific recommendations

### 7.1 Chip passives

- Canonical: bare size code when truly generic (`0402`, `0603`, `0805`)
- Prefix-specific variants (`R0603`, `C0603`) should map via aliases/lookup

### 7.2 Gullwing ICs

Examples:

- `SOIC-16_3.9X9.9MM_P1.27MM`
- `TSSOP-20_4.4X6.5MM_P0.65MM`
- `SSOP-28_5.3X10.2MM_P0.65MM`

### 7.3 No-lead ICs

Examples:

- `QFN-32-1EP_5X5MM_P0.5MM_EP3.3X3.3MM`
- `DFN-8_2X3MM_P0.5MM`
- `LGA-14_2X2MM`

### 7.4 THT IC families

Examples:

- `DIP-8_W7.62MM`
- `DIP-14_W7.62MM_SOCKET`
- `TO-220-5_VERTICAL`

---

## 8) Migration and change management

When changing naming logic:

1. Update parser normalization rules
2. Regenerate package outputs and manifests
3. Run tree checks for collisions and alias conflicts
4. Ensure lookup compatibility remains intact
5. Update this document and parser docs

Commands:

```bash
npm run libraries:parse
npm run packages:tree:manifest
npm run packages:tree:check
npm run libraries:parse:tht
npm run packages:tht:manifest
```

---

## 9) Examples: before -> canonical

- `SO-8-3.9X4.9MM-P1.27MM` -> `SOIC-8_3.9X4.9MM_P1.27MM`
- `SOP-8-3.9X4.9MM-P1.27MM` -> `SOIC-8_3.9X4.9MM_P1.27MM`
- `SOIC-08-3.9X4.9MM-P1.27MM` -> `SOIC-8_3.9X4.9MM_P1.27MM`
- `QFN-32-1EP-5X5MM-P0.5MM-EP3.3X3.3MM` -> `QFN-32-1EP_5X5MM_P0.5MM_EP3.3X3.3MM`
- `DIP-14-W7.62MM-SOCKET` -> `DIP-14_W7.62MM_SOCKET`
- `MSOP-12-16-3X4MM-P0.5MM` -> `MSOP-12-16_3X4MM_P0.5MM`

---

## 10) Package type discriminator

Every package JSON file has a `"type"` field that uses the official TPSys technical name.
This is separate from the package *name* (which follows the KLC-style rules above).

| `type` value | Family |
|---|---|
| `PT_TWO_POLE` | Chip passives (0402, 0603, etc.) |
| `PT_THREE_POLE` | SOT-23 family |
| `PT_TWO_SYM` | SOIC, SSOP, TSSOP, DFN |
| `PT_FOUR_SYM` | QFP, QFN, LQFP |
| `PT_TWO_PLUS_TWO` | Asymmetric quad |
| `PT_FOUR_ON_TWO` | 4-on-2 |
| `PT_BGA` | BGA |
| `PT_OUTLINE` | Outline only |
| `PT_GENERIC` | Generic (explicit lead groups) |

See `app/utils/package-types.ts` for the authoritative type definitions and
`PACKAGE_TYPE_LABELS` for the human-readable UI labels.

---

## 11) References

- KiCad KLC F2.1 General footprint naming conventions
- KiCad KLC F2.2 Footprint naming field prefixes
- KiCad KLC F2.3 Manufacturer specific version of generic footprints
- KiCad KLC F2.4 Footprint naming for non-standard pin numbering
- KiCad KLC F2.5 Footprint naming conventions for specific components
- KiCad KLC F3.4 SMD IC package naming conventions
- KiCad KLC F3.5 THT IC package naming conventions
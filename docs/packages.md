# Package Definitions — Mycronic/TPSys Baseline (Authoritative)

Built-in package definitions are now organized as a library tree under
`public/packages/libraries/`.

At runtime we still load `PackageDefinition` JSON records, but each package is
resolved through library metadata in `public/packages/libraries/_tree.json`.

## Library tree layout

```text
public/packages/
  libraries/
    _tree.json
    _reports/
      <library-id>.json
    newmatik/
      library.json
      packages/*.json
    <external-library-id>/
      library.json
      packages/*.json
```

`library.json` stores attribution and provenance:

- display name, source type, owner
- license and redistribution policy
- upstream repo URL + notice text

The package JSON format remains `PackageDefinition` (same schema as before).
Provenance metadata may be attached as extra fields for traceability.

---

All package definitions are used by the viewer to render:

- package body outlines
- pads/balls
- **pin-1 highlighting** (pad/ball 1 is rendered in red)

**Authoritative rule:** every package is defined in **Mycronic / MYDATA TPSys** 0° orientation.
The Pick & Place (PnP) dropdown (**Mycronic / IPC-7351 / IEC 61188-7**) only changes how we
**interpret and display the imported PnP rotations**. It does **not** modify the imported PnP file.

---

## Package type discriminators (TPSys naming)

Every package JSON has a `"type"` field using the official TPSys technical name:

| Type | Description | UI Label |
|------|-------------|----------|
| `PT_TWO_POLE` | Two-terminal passives (chip R/C/L, diodes) | Chip (2-pole) |
| `PT_THREE_POLE` | Three-terminal (SOT-23 family) | SOT (3-pole) |
| `PT_TWO_SYM` | Two symmetric lead groups (SOIC, SSOP, TSSOP) | SOIC / SSOP (2-sym) |
| `PT_FOUR_SYM` | Four symmetric lead groups (QFP, QFN, LQFP) | QFP / QFN (4-sym) |
| `PT_TWO_PLUS_TWO` | Asymmetric quad (different counts per side pair) | Asymmetric Quad (2+2) |
| `PT_FOUR_ON_TWO` | Four lead groups on two sides | 4-on-2 |
| `PT_BGA` | Ball Grid Array | BGA |
| `PT_OUTLINE` | Outline only (no lead geometry) | Outline |
| `PT_GENERIC` | Generic (explicit lead-group geometry from P051+P055) | Generic |

The label map is defined once in `app/utils/package-types.ts` → `PACKAGE_TYPE_LABELS`.

---

## Coordinate system

All geometry is in **mm**, centered at the component origin:

```
        +Y (up)
         │
         │
  ───────┼───────→ +X (right)
         │
         │
```

- +X right, −X left
- +Y up, −Y down
- component center at (0, 0)

---

## What "0°" means in this repo (Mycronic/TPSys baseline)

Derived from the MYCenter screenshots (golden reference).

### PT_TWO_POLE (Chip, two-terminal)

At **Mycronic 0°**:

- body is **vertical** (length along Y)
- **pad/terminal 1 is TOP** (+Y)
- **pad/terminal 2 is BOTTOM** (−Y)

```
        +Y
         ▲
         │   pad1 (1)
         │   ┌───┐
         │   └───┘
         │   ┌─────┐
         │   │BODY │
         │   └─────┘
         │   ┌───┐
         │   └───┘
         │   pad2 (2)
         └──────────► +X
```

Pad/terminal 1 (TOP) is rendered in **red**.

### Multi-pin (3+ pins): PT_THREE_POLE / PT_TWO_SYM / PT_FOUR_SYM / PT_BGA

At **Mycronic 0°**:

- **pin 1 / A1 is UPPER-LEFT** (−X, +Y)
- pin numbering proceeds **counter-clockwise** around the package

```
pin1/A1 = red pad/ball (upper-left)
         ┌─────────┐
         │  BODY   │
         └─────────┘
```

---

## PnP convention selector (Mycronic vs IPC vs IEC)

Different PnP sources use different:

- **rotation direction** (CCW-positive vs CW-positive)
- **0° reference orientation** (notably for PT_TWO_POLE and IEC multi-pin)

We always convert the imported rotation into a single "renderer angle":

\[
rotationCCW = direction * pnpRotation + offsetDeg
\]

Where:

- `pnpRotation` is the raw number read from the PnP file
- `rotationCCW` is the CCW rotation applied to our Mycronic-baseline footprint

### Rotation direction

- **Mycronic PnP**: positive rotation is **clockwise (CW)** → `direction = -1`
- **IPC-7351 PnP**: positive rotation is **counter-clockwise (CCW)** → `direction = +1`
- **IEC 61188-7 PnP**: positive rotation is **counter-clockwise (CCW)** → `direction = +1`

### Offsets (to align 0° to the Mycronic baseline)

Offsets are **package-type specific** and are configured in one authoritative place:

- `app/utils/pnp-conventions.ts` (`PNP_CONVENTIONS[convention].offsetDegByType`)

This is the file to edit when you discover a CAD-export quirk (e.g. Eagle "IEC" vs KiCad "IPC").

### Where this is implemented

- `app/utils/pnp-conventions.ts` (authoritative config: conventions, CW/CCW, offsets)
- `app/utils/package-types.ts`
  - `computeFootprint()` generates shapes in **Mycronic/TPSys 0°**
  - `getConventionRotationTransform()` defines `direction` + `offsetDeg`
  - `PACKAGE_TYPE_LABELS` — authoritative UI labels for all types
- `app/components/viewer/BoardCanvas.vue`
  - applies the transform before rotating shapes

---

## JSON format

Each JSON file defines one package:

```json
{
  "name": "SOIC8",
  "type": "PT_TWO_SYM",
  "aliases": ["SO-8", "SOIC-8"],
  "body": { "length": 4.9, "width": 3.9 },
  "twoSymmetric": {
    "numberOfLeads": 8,
    "widthOverLeads": 6,
    "leadPitch": 1.27,
    "leadWidth": 0.4,
    "leadLength": 0.6
  }
}
```

Notes:

- all dimensions are **mm**
- `name` and `aliases` are used to match PnP package names
- the **pin-1 marker is generated in code**, not stored in JSON
- `type` MUST be one of the TPSys names listed above

---

## Adding packages (rules)

- Create a new JSON file in `public/packages/libraries/newmatik/packages/`
- Regenerate manifests with `npm run packages:tree:manifest`
- Validate with `npm run packages:tree:check`
- Ensure the geometry corresponds to **Mycronic/TPSys 0°** (as defined above)
- Add enough `aliases` to match your CAD/PnP package names (KiCad and Eagle often differ)

---

## TPSys `pck.pck` reference

Deep reference for TPSys package databases:

- `docs/tpsys-format.md`

# Package Definitions — Mycronic/TPSys Baseline (Authoritative)

This folder (`public/packages/`) contains JSON package definitions used by the viewer to render:

- package body outlines
- pads/balls
- **pin‑1 highlighting** (pad/ball 1 is rendered in red)

**Authoritative rule:** every package is defined in **Mycronic / MYDATA TPSys** 0° orientation.
The Pick & Place (PnP) dropdown (**Mycronic / IPC‑7351 / IEC 61188‑7**) only changes how we
**interpret and display the imported PnP rotations**. It does **not** modify the imported PnP file.

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

## What “0°” means in this repo (Mycronic/TPSys baseline)

Derived from the MYCenter screenshots (golden reference).

### Chip (two-terminal)

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

### Multi-pin (3+ pins): ThreePole / TwoSymmetric / FourSymmetric / BGA

At **Mycronic 0°**:

- **pin 1 / A1 is UPPER‑LEFT** (−X, +Y)
- pin numbering proceeds **counter‑clockwise** around the package

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
- **0° reference orientation** (notably for Chip and IEC multi-pin)

We always convert the imported rotation into a single “renderer angle”:

\[
rotationCCW = direction * pnpRotation + offsetDeg
\]

Where:

- `pnpRotation` is the raw number read from the PnP file
- `rotationCCW` is the CCW rotation applied to our Mycronic-baseline footprint

### Rotation direction

- **Mycronic PnP**: positive rotation is **clockwise (CW)** → `direction = -1`
- **IPC‑7351 PnP**: positive rotation is **counter‑clockwise (CCW)** → `direction = +1`
- **IEC 61188‑7 PnP**: positive rotation is **counter‑clockwise (CCW)** → `direction = +1`

### Offsets (to align 0° to the Mycronic baseline)

Offsets are **package-type specific** and are configured in one authoritative place:

- `app/utils/pnp-conventions.ts` (`PNP_CONVENTIONS[convention].offsetDegByType`)

This is the file to edit when you discover a CAD-export quirk (e.g. Eagle “IEC” vs KiCad “IPC”).

### Where this is implemented

- `app/utils/pnp-conventions.ts` (authoritative config: conventions, CW/CCW, offsets)
- `app/utils/package-types.ts`
  - `computeFootprint()` generates shapes in **Mycronic/TPSys 0°**
  - `getConventionRotationTransform()` defines `direction` + `offsetDeg`
- `app/components/viewer/BoardCanvas.vue`
  - applies the transform before rotating shapes

---

## JSON format

Each JSON file defines one package:

```json
{
  "name": "SOIC8",
  "type": "TwoSymmetricLeadGroups",
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
- the **pin‑1 marker is generated in code**, not stored in JSON

---

## Adding packages (rules)

- Create a new JSON file in `public/packages/`
- Add it to `public/packages/_manifest.json`
- Ensure the geometry corresponds to **Mycronic/TPSys 0°** (as defined above)
- Add enough `aliases` to match your CAD/PnP package names (KiCad and Eagle often differ)

---

## TPSys `pck.pck` reference

Deep reference for TPSys package databases:

- `public/packages/TPSYS-FORMAT.md`


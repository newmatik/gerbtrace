# TPSys Package Database Format (pck.pck)

This document describes the binary/text format of the **MYDATA/Mycronic TPSys** package
database file (`pck.pck`), as reverse-engineered from a production TPSys 5.x server export.

> **Audience**: Engineers maintaining package definitions, debugging PnP alignment, or
> importing/exporting data between TPSys and other systems.

## Table of Contents

- [Overview](#overview)
- [File Structure](#file-structure)
- [Record Fields](#record-fields)
  - [P00 — Package Name](#p00--package-name)
  - [P000 — Package Type](#p000--package-type)
  - [P01 — Body Dimensions](#p01--body-dimensions)
  - [P011 — Center Offset](#p011--center-offset)
  - [P022 — Nozzle Configuration](#p022--nozzle-configuration)
  - [P03 — Accuracy Settings](#p03--accuracy-settings)
  - [P032 — Mount Head Assignment](#p032--mount-head-assignment)
  - [P04 — Pin Numbering Configuration](#p04--pin-numbering-configuration)
  - [P051 — Lead Definition](#p051--lead-definition)
  - [P054 — Vision Lighting](#p054--vision-lighting)
  - [P055 — Lead Search Parameters](#p055--lead-search-parameters)
  - [P061 — Centering Method](#p061--centering-method)
  - [P062-M — Mechanical Centering](#p062-m--mechanical-centering)
  - [P063 — Jaw Dimensions](#p063--jaw-dimensions)
  - [P064-O — Optical Centering Tool](#p064-o--optical-centering-tool)
  - [P07 — Coplanarity Check](#p07--coplanarity-check)
  - [P071/P073 — Vision Mode](#p071p073--vision-mode)
  - [P08 — Glue Configuration](#p08--glue-configuration)
  - [P09 — Marking Position](#p09--marking-position)
  - [P11 — Reference Points](#p11--reference-points)
  - [P12 — Image Metadata](#p12--image-metadata)
  - [P121/P122 — Image Data](#p121p122--image-data)
- [Coordinate System](#coordinate-system)
- [Lead Shape Types](#lead-shape-types)
- [Package Type Details](#package-type-details)
  - [PT_TWO_POLE — Chip Components](#pt_two_pole--chip-components)
  - [PT_THREE_POLE — SOT-23 Family](#pt_three_pole--sot-23-family)
  - [PT_TWO_SYM — Dual-Inline ICs](#pt_two_sym--dual-inline-ics)
  - [PT_FOUR_SYM — Quad-Flat ICs](#pt_four_sym--quad-flat-ics)
  - [PT_TWO_PLUS_TWO — Asymmetric Quad](#pt_two_plus_two--asymmetric-quad)
  - [PT_BGA — Ball Grid Array](#pt_bga--ball-grid-array)
  - [PT_GENERIC_BGA — Generic BGA](#pt_generic_bga--generic-bga)
  - [PT_OUTLINE — Outline Only](#pt_outline--outline-only)
  - [PT_GENERIC — Generic Package](#pt_generic--generic-package)
  - [PT_FOUR_ON_TWO — 4 Leads on 2 Sides](#pt_four_on_two--4-leads-on-2-sides)
- [TPSys vs IPC-7351B Orientation Convention](#tpsys-vs-ipc-7351b-orientation-convention)
- [Using pck.pck as a Reference](#using-pckpck-as-a-reference)

---

## Overview

The `pck.pck` file is a text-based package library exported from a MYDATA/Mycronic TPSys
server. It contains definitions for all component packages known to the pick-and-place
machine, including:

- Physical dimensions (body, leads)
- Lead shape and position geometry
- Vision/centering parameters
- Nozzle and tool assignments
- Component images (base64-encoded)

All dimensional values in the file are in **micrometers (µm)** unless noted otherwise.
Angles are in **millidegrees** (e.g., 90000 = 90°, -90000 = −90°).

## File Structure

The file consists of sequential **package records**, each separated by a `#` delimiter:

```
P00 <package_name> [variant_id]
P000 <package_type>
P01 <dimensions...>
...field lines...
P11 <x> <y> <type>
P12 <resolution...>
P121 <base64_image_data>
P122 <image_offset_x> <image_offset_y> <image_size>
#
P00 <next_package>
...
```

Each line starts with a field identifier (P00, P000, P01, P051, etc.).
Some fields can appear multiple times within a record (e.g., P051 for each lead group,
P11 for each reference point).

## Record Fields

### P00 — Package Name

```
P00 <name> [variant_id]
```

- `name` — Package identifier (e.g., `0603`, `SOT-23`, `SOIC-8`, `QFP100 AUT-0078`)
- `variant_id` — Optional numeric ID or variant suffix (e.g., `330032`, `2x1.4x1.2`, `Langsam`)

A package name with an asterisk (`*`) suffix (e.g., `0102*`) indicates a template/default entry.

### P000 — Package Type

```
P000 <type>
```

Defines the structural classification. See [Package Type Details](#package-type-details) for each type.

| Type | Count¹ | Description |
|------|--------|-------------|
| `PT_TWO_POLE` | 1230 | Two-terminal passives (chip resistors/caps, diodes) |
| `PT_GENERIC` | 1040 | Generic packages (no specific lead model) |
| `PT_TWO_SYM` | 1029 | Two symmetric lead groups (SOIC, SSOP, etc.) |
| `PT_FOUR_SYM` | 221 | Four symmetric lead groups (QFP, QFN, etc.) |
| `PT_GENERIC_BGA` | 112 | Generic BGA variant |
| `PT_BGA` | 97 | Ball Grid Array |
| `PT_OUTLINE` | 78 | Outline-defined (no lead geometry) |
| `PT_TWO_PLUS_TWO` | 63 | Asymmetric quad (different lead counts per side pair) |
| `PT_THREE_POLE` | 62 | Three-terminal (SOT-23 family) |
| `PT_FOUR_ON_TWO` | 23 | Four leads distributed on two sides |

¹ Counts from a representative production database.

### P01 — Body Dimensions

```
P01 <bodyX> <bodyY> <searchX> <searchY> <height> <heightMax> <heightMin>
```

All values in µm.

| Field | Description |
|-------|-------------|
| `bodyX` | Body extent in X direction |
| `bodyY` | Body extent in Y direction |
| `searchX` | Vision search area width (X) |
| `searchY` | Vision search area height (Y) |
| `height` | Nominal component height |
| `heightMax` | Maximum acceptable height |
| `heightMin` | Minimum acceptable height |

**Note**: For PT_TWO_POLE (Chip), the bodyX/bodyY values reflect the body dimensions
**in the TPSys internal orientation** (see [Coordinate System](#coordinate-system)).
These may differ from IPC convention body dimensions.

### P011 — Center Offset

```
P011 <offsetX> <offsetY>
```

Offset from the geometric center to the pick-up center, in µm. Usually `0 0`.

### P022 — Nozzle Configuration

```
P022 <nozzle> <param1> <param2> <param3> <param4> <param5> <param6> <param7> <flag1> <flag2> <flag3>
```

- `nozzle` — Nozzle type identifier (e.g., `A12`, `A13`, `A14`, `A23`, `B34`, `C14`, `C23`)

### P03 — Accuracy Settings

```
P03 <flag> <acc1> <acc2> <acc3> <flag2> <acc4> <acc5> <acc6> <param> <param2> <acc7> <flag3>
```

Accuracy level keywords: `ACC_LOWEST`, `ACC_LOW`, `ACC_HIGH`, `ACC_HIGHEST`.

### P032 — Mount Head Assignment

```
P032-1 AUTO
P032-2 <head_id>
```

- `P032-1` — Head selection mode (usually `AUTO`)
- `P032-2` — Specific head assignment (e.g., `H01`, `H02`, `H03`, `H04`, `H06`)

### P04 — Pin Numbering Configuration

```
P04 <startPin1> <endPin1> [<startPin2> <endPin2>] 0
```

Defines the pin numbering ranges for each lead group. The trailing `0` terminates the list.

**Examples**:
- `P04 1 2 0` — 2 pins total (PT_TWO_POLE)
- `P04 1 3 0` — 3 pins total (PT_THREE_POLE)
- `P04 1 4 5 8 0` — Pins 1–4 on side 1, pins 5–8 on side 2 (PT_TWO_SYM with 8 leads)
- `P04 1 31 51 81 0` — Pins 1–31 + 51–81 (PT_TWO_PLUS_TWO, 100-pin QFP variant)

### P051 — Lead Definition

```
P051 <leadShape> <numLeads> <param1> <param2> <angle> <type>
```

This is the most important field for understanding package geometry. The format varies
by lead shape. See [Lead Shape Types](#lead-shape-types) for details.

| Field | Description |
|-------|-------------|
| `leadShape` | Lead shape type: `CHIP`, `FLAT`, `GULLWING`, `J_LEAD`, `BGAB`, `OUTLINE` |
| `numLeads` | Number of leads in this group |
| `param1` | Shape-dependent (see below) |
| `param2` | Shape-dependent (see below) |
| `angle` | Lead orientation in millidegrees |
| `type` | Usually `NORMAL` |

**For CHIP** (PT_TWO_POLE):
```
P051 CHIP <numLeads> <unused(0)> <distFromCenter> <angle_millideg> <type>
```
- `distFromCenter` — Distance from component center to lead center (signed, in µm)
- `angle` — Direction of the lead from center (millidegrees)

**For GULLWING / FLAT / J_LEAD** (PT_THREE_POLE, PT_TWO_SYM, PT_FOUR_SYM):
```
P051 GULLWING <numLeads> <distFromCenter> <ccHalf> <angle_millideg> <type>
```
- `distFromCenter` — Perpendicular distance from center to the lead row (signed, µm)
- `ccHalf` — Half of the total span of leads in this group (= (numLeads−1) × pitch / 2).
  Signed: positive/negative indicates pin numbering direction.
- `angle` — Rotation of the lead group in millidegrees

**For BGAB** (PT_BGA):
```
P051 BGAB <numBalls> <rowStartX> <rowY> <angle_millideg> <type>
```
- `numBalls` — Number of balls in this row
- `rowStartX` — X position of the first ball in the row (µm)
- `rowY` — Y position of this row (µm)
- `angle` — Row orientation (typically 90000)

**For OUTLINE** (PT_OUTLINE):
```
P051 OUTLINE 0 0 0 <angle_millideg> <type>
```
- No lead geometry; body is defined by P01 dimensions only.

### P054 — Vision Lighting

```
P054 <brightness> <mode1> <mode2>
```

- `brightness` — `BRIGHT` or `DARK`
- `mode1`, `mode2` — `AUTO` or specific lighting configuration

### P055 — Lead Search Parameters

```
P055 <padW> <padWmax> <padWmin> <padL> <padLmax> <padLmin> <ccDist> <leadW> <leadWmax> <param>
```

All values in µm.

| Field | Description |
|-------|-------------|
| `padW` | Pad width (nominal) |
| `padWmax` | Pad width (maximum) |
| `padWmin` | Pad width (minimum) |
| `padL` | Pad length (nominal) |
| `padLmax` | Pad length (maximum) |
| `padLmin` | Pad length (minimum) |
| `ccDist` | Center-to-center distance between adjacent leads (= pitch) |
| `leadW` | Lead/termination width |
| `leadWmax` | Lead width (maximum) |
| `param` | Additional parameter (often 0) |

**Example**: For 0603 chip → `P055 350 350 350 800 1200 400 0 400 400 0`
- Pad: 350µm × 800µm (width × length)
- CC distance: 0 (single lead per group)
- Lead width: 400µm

**Example**: For SOT-23 → `P055 550 550 550 400 400 400 1900 500 500 200`
- Pad: 550µm × 400µm
- CC distance: 1900µm (1.9mm between the two left-side leads)
- Lead width: 500µm

### P061 — Centering Method

```
P061 <method>
```

- `OPTICAL` — Camera-based centering
- `MECHANICAL` — Jaw-based mechanical centering

Multiple P061 blocks can appear for different centering strategies.

### P062-M — Mechanical Centering

```
P062-M <angle> <param> <position> <force>
```

- `angle` — Jaw rotation in millidegrees (e.g., 90000 = 90°)
- `position` — `POS_UPPER`, `POS_LOWER`, `POS_MIDDLE`
- `force` — `MIDDLE_FORCE`, `NO_FORCE`

### P063 — Jaw Dimensions

```
P063 <nominal> <max> <min> <flag>
```

Jaw opening dimensions in µm.

### P064-O — Optical Centering Tool

```
P064-O <tool>
P064-O2 <mode> <param1> <param2> <param3>
P064-O5 <mode1> <mode2> <param1> <param2> <param3>
```

- `tool` — Tool identifier: `Z_TOOL`, `HYDRA_TOOL`
- `mode` — `AUTO` or `CUSTOM`

### P07 — Coplanarity Check

```
P07 <enabled>
```

- `true` / `false` — Whether coplanarity checking is enabled for this package

### P071/P073 — Vision Mode

```
P071 "<mode>"
P073 "<mode>"
```

Vision inspection mode, quoted string:
- `"standard"` — Standard vision
- `"linescan"` — Linescan camera
- `"hydra"` — Hydra multi-nozzle vision
- `"NONE"` — No vision

### P08 — Glue Configuration

```
P08 <mode>
P083 <matching>
P084 <x> <y> <param1> <param2>
```

- `mode` — `NONE`, or glue dispense mode
- `matching` — `STANDARD` or `MATCHING`

### P09 — Marking Position

```
P09 <x> <y> <dotType>
```

- `x`, `y` — Marking position offset in µm
- `dotType` — Dot type: `DOT0.5mm`, `DOT0.8mm`, etc.

### P11 — Reference Points

```
P11 <x> <y> <type>
```

Reference/inspection points for lead verification, in µm relative to component center.

- `x`, `y` — Position in the TPSys internal coordinate system
- `type` — Usually `CUSTOM`

**Multiple P11 lines** appear per package — one per lead or inspection point.
The order typically follows the P051 lead group scanning order:
group1-lead1, group2-lead1, group1-lead2, group2-lead2, ...

**Example**: SOT-23 with 3 leads:
```
P11 -907 970 CUSTOM     ← Pin 1 (upper-left, first of 2-lead group)
P11 970 0 CUSTOM        ← Pin 3 (right, single-lead group)
P11 -907 -907 CUSTOM    ← Pin 2 (lower-left, second of 2-lead group)
```

### P12 — Image Metadata

```
P12 <resX> <resY> <scaleX> <scaleY>
```

Image resolution and scale parameters.

### P121/P122 — Image Data

```
P121 <base64_encoded_image_data>
P122 <offsetX> <offsetY> <size>
```

- `P121` — Base64-encoded component image (used for visual reference in TPSys UI)
- `P122` — Image position offset and size

---

## Coordinate System

TPSys uses the following internal coordinate system:

```
         +Y (up)
          │
          │
  −X ─────┼─────→ +X (right)
          │
          │
         −Y (down)
```

- **+X** = right, **−X** = left
- **+Y** = up, **−Y** = down
- All coordinates are in **micrometers (µm)**
- Component center is at **(0, 0)**

### Angle Convention

TPSys angles in P051 and P062-M are in **millidegrees** and represent the direction
a lead group faces (outward from the component body):

| Angle (millideg) | Degrees | Direction | Used For |
|-------------------|---------|-----------|----------|
| `0` | 0° | Right (+X) | Right-side leads |
| `90000` | 90° | Down (−Y)* | Bottom-side leads |
| `180000` | 180° | Left (−X) | Left-side leads |
| `-90000` | −90° | Up (+Y)* | Top-side leads |

*\*Important: The 90° and −90° angle assignment may appear counter-intuitive. The P051
angle represents the **lead protrusion direction** when viewed from the component body.
For QFP/BGA, this creates the pattern: Left(180°) → Bottom(90°) → Right(0°) → Top(−90°),
which follows CCW pin numbering.*

---

## Lead Shape Types

| Shape | Used For | Description |
|-------|----------|-------------|
| `CHIP` | Chip resistors, capacitors | Flat rectangular terminations |
| `FLAT` | Flat-lead or J-lead passives | Flat contact pads |
| `GULLWING` | SOT, SOIC, QFP | Gullwing (outward-bent) leads |
| `J_LEAD` | PLCC, SOJ | J-shaped (under-body) leads |
| `BGAB` | BGA | Solder ball (Ball Grid Array) |
| `OUTLINE` | Generic | No lead geometry, outline only |

---

## Package Type Details

### PT_TWO_POLE — Chip Components

Two-terminal passive components (resistors, capacitors, inductors, diodes).

```
P00 0603
P000 PT_TWO_POLE
P01 1600 800 1600 800 600 675 570
P04 1 2 0
P051 CHIP 1 0 800 -90000 NORMAL      ← Lead 1 at +Y (top)
P051 CHIP 1 0 -800 90000 NORMAL      ← Lead 2 at −Y (bottom)
P055 350 350 350 800 1200 400 0 400 400 0
```

**TPSys internal 0° orientation**: Leads at **top and bottom** (±Y).
Body longer dimension along X.

**Key observation**: This differs from IPC-7351B where leads are at left/right (±X).
See [TPSys vs IPC-7351B](#tpsys-vs-ipc-7351b-orientation-convention).

**Dimensional interpretation**:
- P01 bodyX = 1600µm → body extent along X = 1.6mm
- P01 bodyY = 800µm → body extent along Y = 0.8mm
- P051 `800` → lead at 800µm from center along Y = 0.8mm → lead-to-lead = 1.6mm

### PT_THREE_POLE — SOT-23 Family

Three-terminal devices: 2 leads on one side, 1 lead on the opposite side.

```
P00 SOT-23 330032
P000 PT_THREE_POLE
P01 2316 2347 2316 2347 1000 1200 800
P04 1 3 0
P051 GULLWING 2 -1200 950 180000 NORMAL   ← 2 leads on LEFT, cc half-span=950µm
P051 GULLWING 1 1200 0 0 NORMAL           ← 1 lead on RIGHT
P055 550 550 550 400 400 400 1900 500 500 200
```

**0° orientation**: 2 leads on LEFT (−X), 1 lead on RIGHT (+X). Pin 1 at upper-left.
**Matches IPC-7351B** ✓

**P051 field interpretation**:
- Group 1: 2 gullwing leads at X=−1200µm from center, spanning ±950µm in Y, facing 180° (left)
  - Lead 1 at (−1200, +950) = upper-left → Pin 1
  - Lead 2 at (−1200, −950) = lower-left → Pin 2
- Group 2: 1 gullwing lead at X=+1200µm, Y=0, facing 0° (right) → Pin 3

**P055 field interpretation**:
- CC distance = 1900µm → distance between pins 1 and 2 = 1.9mm
- Lead width = 500µm

### PT_TWO_SYM — Dual-Inline ICs

Dual-inline packages with symmetric lead groups on two sides (SOIC, SSOP, TSSOP).

```
P00 SOIC-8
P000 PT_TWO_SYM
P01 6000 11856 6000 11856 2700 2835 2565
P051 GULLWING 4 -5750 1905 180000 NORMAL   ← 4 leads on LEFT
P051 GULLWING 4 5750 -1905 0 NORMAL        ← 4 leads on RIGHT
P055 2030 2030 2030 380 380 380 1270 190 380 0
```

**0° orientation**: Leads on LEFT and RIGHT. Pin 1 at upper-left.
**Matches IPC-7351B** ✓

**P051 field interpretation**:
- Left group: 4 leads at X=−5750µm, spanning ±1905µm in Y, facing 180° (left)
  - CC half-span positive → numbering from +Y to −Y (top to bottom)
- Right group: 4 leads at X=+5750µm, spanning ±1905µm in Y, facing 0° (right)
  - CC half-span negative → numbering from −Y to +Y (bottom to top) = CCW continuation

**P055 pitch**: CC distance = 1270µm = 1.27mm (standard SOIC pitch) ✓

### PT_FOUR_SYM — Quad-Flat ICs

Four-sided symmetric packages (QFP, QFN, LQFP).

```
P00 chiphalter iot-0002
P000 PT_FOUR_SYM
P01 15586 15586 15586 15586 6000 6300 5700
P051 GULLWING 1 -5715 0 180000 NORMAL     ← LEFT
P051 GULLWING 1 0 -5715 90000 NORMAL      ← BOTTOM
P051 GULLWING 1 5715 0 0 NORMAL           ← RIGHT
P051 GULLWING 1 0 5715 -90000 NORMAL      ← TOP
```

**0° orientation**: Leads on all 4 sides. Pin 1 at upper-left. CCW numbering.
**Matches IPC-7351B** ✓

**P051 group order** (CCW numbering):
1. LEFT (180°) → pins start top, go down
2. BOTTOM (90°) → pins start left, go right
3. RIGHT (0°) → pins start bottom, go up
4. TOP (−90°) → pins start right, go left

### PT_TWO_PLUS_TWO — Asymmetric Quad

Like PT_FOUR_SYM but with different lead counts on the X-sides vs Y-sides.

```
P00 QFP100 AUT-0078
P000 PT_TWO_PLUS_TWO
P04 1 31 51 81 0
P051 GULLWING 30 -8400 9425 180000 NORMAL   ← 30 leads LEFT
P051 GULLWING 20 -6175 -11350 90000 NORMAL  ← 20 leads BOTTOM
P051 GULLWING 30 8400 -9425 0 NORMAL        ← 30 leads RIGHT
P051 GULLWING 20 6175 11350 -90000 NORMAL   ← 20 leads TOP
P055 1850 1850 1850 300 300 300 650 150 260 0
```

Total: 30+20+30+20 = 100 leads.  Lead pitch = 650µm.
Pin numbering follows standard CCW: Left(1-30) → Bottom(31-50) → Right(51-80) → Top(81-100).

### PT_BGA — Ball Grid Array

Standard BGA with row-by-row ball definitions.

```
P00 BGA 523805
P000 PT_BGA
P01 2935 2967 2935 2967 1760 1848 1672
P051 BGAB 10 -3600 3600 90000 NORMAL    ← Row A (top, Y=+3600)
P051 BGAB 10 -3600 2800 90000 NORMAL    ← Row B (Y=+2800)
P051 BGAB 10 -3600 2000 90000 NORMAL    ← Row C (Y=+2000)
P051 BGAB 10 -3600 1200 90000 NORMAL    ← Row D
P051 BGAB 10 -3600 400 90000 NORMAL     ← Row E
P051 BGAB 10 -3600 -400 90000 NORMAL    ← Row F
P051 BGAB 10 -3600 -1200 90000 NORMAL   ← Row G
P051 BGAB 10 -3600 -2000 90000 NORMAL   ← Row H
P051 BGAB 10 -3600 -2800 90000 NORMAL   ← Row J
P051 BGAB 10 -3600 -3600 90000 NORMAL   ← Row K (bottom, Y=−3600)
P055 500 500 500 500 500 500 800 50 50 250
```

**0° orientation**: Ball A1 at upper-left (−X, +Y).
**Matches IPC-7351B** ✓

**P051 field interpretation**:
- Each line = one row of the BGA grid
- 10 balls per row, starting at X=−3600µm
- Rows defined from top (+Y) to bottom (−Y): 3600, 2800, ..., −3600
- Ball pitch = 800µm (from P055 ccDist)

### PT_GENERIC_BGA — Generic BGA

Similar to PT_BGA but with a more flexible ball layout definition.
Used when the grid is not perfectly regular.

### PT_OUTLINE — Outline Only

Generic body outline with no lead geometry. Used for non-standard components.

```
P00 0201-025 141385
P000 PT_OUTLINE
P01 688 344 688 344 250 300 200
P051 OUTLINE 0 0 0 180000 NORMAL
P055 700 770 630 400 440 360 0 0 0 0
```

The P051 OUTLINE line has no meaningful lead parameters. Vision centering
uses the body outline dimensions from P01 and P055.

### PT_GENERIC — Generic Package

Catch-all type for packages that don't fit the standard type models.
Used for odd-shaped components or components with unusual lead layouts.

**TPSys 5.3 manual mapping:** PT_GENERIC corresponds to the TPSys **Generic** package type
(manual section 6.6 “Package Types”). Example given by Mycronic: **SOT-223**.

### PT_FOUR_ON_TWO — 4 Leads on 2 Sides

Four leads distributed across two sides (non-symmetric), such as DO-214AA diode packages.

```
P00 DO-214AA
P000 PT_FOUR_ON_TWO
P051 GULLWING 1 -1000 1905 180000 NORMAL    ← 1 lead upper-left
P051 GULLWING 1 -1000 -1905 180000 NORMAL   ← 1 lead lower-left
P051 GULLWING 1 1000 -1905 0 NORMAL         ← 1 lead lower-right
P051 GULLWING 1 1000 1905 0 NORMAL          ← 1 lead upper-right
```

Four individual leads, each defined separately by their (X, Y) position.

---

## TPSys vs IPC-7351B Orientation Convention

**This is the most important section for understanding cross-system compatibility.**

### Where They Agree (IC packages)

For all **gullwing/IC packages** (SOT, SOIC, QFP, BGA), TPSys and IPC-7351B use the
**same 0° orientation**:

| Package | TPSys 0° | IPC 0° | Match? |
|---------|----------|--------|--------|
| SOT-23 (ThreePole) | 2 leads LEFT, 1 RIGHT | 2 leads LEFT, 1 RIGHT | ✓ |
| SOIC-8 (TwoSym) | Leads LEFT + RIGHT | Leads LEFT + RIGHT | ✓ |
| QFP (FourSym) | Leads all 4 sides, Pin 1 UL | Leads all 4 sides, Pin 1 UL | ✓ |
| BGA | Ball A1 upper-left | Ball A1 upper-left | ✓ |

### Where They Differ (Chip packages)

For **Chip** (PT_TWO_POLE), TPSys uses a different 0° orientation than IPC-7351B:

```
TPSys Internal 0°:              IPC-7351B 0°:

     Lead 1 (+Y)                      ┌──┐        ┌──┐
       ┌──┐                           │L1│  BODY  │L2│
       │  │                           └──┘        └──┘
  ┌────┴──┴────┐                   Lead 1 (-X)  Lead 2 (+X)
  │            │
  │    BODY    │
  │            │
  └────┬──┬────┘
       │  │
       └──┘
     Lead 2 (-Y)
```

| Convention | Lead 1 | Lead 2 | Body Long Axis |
|-----------|--------|--------|----------------|
| **TPSys Internal** | Top (+Y) | Bottom (−Y) | X (horizontal) |
| **IPC-7351B** | Left (−X) | Right (+X) | X (horizontal) |

**The offset is exactly 90°**: TPSys Chip 0° = IPC Chip 90° (CCW).

### Why This Doesn't Affect PnP File Processing

Standard **PnP files** (CSV/TXT) exported from EDA tools (KiCad, Altium, Eagle, OrCAD)
use **IPC-7351B orientation**, NOT TPSys internal orientation.

The MYDATA machine handles the conversion internally:
- The machine knows the tape orientation of each component (C10 field in component data)
- When reading a PnP/CAD file, the machine adds the tape orientation offset
- For chip packages in tape, the tape orientation is typically 90° (compensating for the
  TPSys vs IPC difference)

**For any software rendering PnP data** (like Gerbtrace), use IPC-7351B orientation.
The TPSys internal convention is only relevant for direct TPSys database manipulation.

---

## Using pck.pck as a Reference

The pck.pck database is a valuable reference for component dimensions, even if some
entries are duplicates or incorrectly configured. When looking up a package:

1. **Search by name**: Look for `P00 <package_name>` lines
2. **Check the type**: `P000` tells you the structural classification
3. **Read dimensions**: P01 gives body dimensions, P055 gives lead dimensions
4. **Cross-reference with P11**: The reference points give actual measured lead positions

### Extracting Dimensions for Package Definitions

To create a JSON package definition from pck.pck data:

**For a Chip (PT_TWO_POLE)**:
```
P01 1600 800 → bodyX=1.6mm, bodyY=0.8mm
P051 CHIP 1 0 800 → lead distance = 800µm → chipLength = 2 × 800 = 1600µm = 1.6mm
P055 350 350 350 800 → leadWidth=350µm=0.35mm (pad width), leadLength≈800µm=0.8mm (pad length)
```

**Remember**: TPSys Chip body dimensions need to be **rotated 90°** when converting to IPC:
- TPSys bodyX (long axis along X) → IPC body.length (along X) ← same axis, but lead direction differs
- For our JSON: `body.length` = chipLength direction (X in IPC), `body.width` = perpendicular (Y in IPC)

**For a TwoSymmetric (PT_TWO_SYM)**:
```
P051 GULLWING 4 -5750 1905 → dist=5750µm → widthOverLeads ≈ 2 × 5750 = 11.5mm
P055 ... 1270 → leadPitch = 1270µm = 1.27mm
P055 ... 190 380 → leadWidth=190µm, leadLength ≈ from P055 pad dimensions
```

### Caveats

- **Duplicate entries**: Many packages have multiple variants (e.g., `0603`, `0603 2x1.4x1.2`,
  `0603 Langsam`). The base name without suffix is usually the standard version.
- **PT_GENERIC entries**: These may use FLAT leads with the same P051 format as CHIP.
  The lead shape doesn't change the position calculation.
- **Measured P11 values**: P11 reference points are actual measured positions from the
  vision system, so they may not be perfectly symmetric. Use P051 for theoretical positions.
- **Non-standard packages**: Some entries have unusual configurations (custom tooling,
  modified centering). Always cross-reference with the actual component datasheet.

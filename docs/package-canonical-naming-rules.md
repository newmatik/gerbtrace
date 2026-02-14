# Canonical naming rules

### A. Chip passives (2-pin)

**Canonical:** `0603` (or optionally `R0603` / `C0603` as aliases only---see below)

-   Use the **industry size code** as the canonical key: `01005, 0201, 0402, 0603, 0805, 1206, ...`
-   No prefixes in the canonical name (no `R`, `C`, `L`) → those belong in aliases.

### B. Leaded ICs (SOIC/TSSOP/MSOP...)

**Canonical:** use the **most common shop-floor term**:

-   `SO-8`, `SO-14`, `SO-16`
-   `TSSOP-16`, `TSSOP-20`
-   `MSOP-8`, `MSOP-10`

(You explicitly want `SO-8` canonical and `SOIC-8` as alias --- good call.)

### C. No-lead ICs

**Canonical:** `QFN-32-5x5-P0.50` style (pins + body + pitch)

-   Always include **pitch** and **body** for QFN/DFN because names are ambiguous otherwise.

-   If you don't want the pitch in the visible name, keep it in a structured variant tag (below), but I'd strongly recommend including it in canonical for QFN/DFN.

### D. Diodes / power packages

**Canonical:** use JEDEC package when it's stable:

-   `SOD-123`, `SOD-323`
-   `SMA`, `SMB`, `SMC` (DO-214 variants)
-   `SOT-223`, `DPAK`, `D2PAK`, etc.

* * * * *

2) Variant handling (height, tolerance, special vision/nozzle, etc.)
--------------------------------------------------------------------

You gave the example: **"0603-05 = 0.5mm high."**\
That's a great pattern, but make it systematic and extensible.

### Variant code format

Use a short, parseable suffix after a dash:

**`<CANON>-H<height_mm>`** where height is **two digits = tenths of a mm**

-   `0603-H05` = 0.5 mm height
-   `0603-H10` = 1.0 mm height
-   `SO-8-H17` = 1.7 mm height

If you really want the exact style you wrote, you can keep `0603-05`, but I recommend `-H05` so it can't be confused with other meanings.

### Optional extra variant tags (only when needed)

Append additional tags separated by underscores:

`<CANON>-H05_VS` / `_VM` / `_NOZ-A14` / `_SLOW` etc.

Examples:

-   `0603-H05` (standard)
-   `0603-H05_SLOW` (different vision/acceleration tuning)
-   `QFN-32-5x5-P0.50-H10_EP` (exposed pad variant note)
-   `SOD-123-H15_NOZ-A13` (if you truly need nozzle split)

**Rule of thumb:** only create variants when something in TPSys must differ materially (P01 height window, centering strategy P061, nozzle P022, vision params P055/P071...).

TPSYS-FORMAT

* * * * *

3) Alias system
---------------

You want:

-   `R0603`, `C0603` → resolve to canonical `0603`
-   `SOIC-8` → resolve to canonical `SO-8`

### A. Alias resolution rules (recommended)

1.  **Normalize input**:

    -   uppercase
    -   strip spaces/underscores
    -   normalize separators: treat `SOIC8`, `SOIC-8`, `SOIC_8` same

2.  **Direct alias table**: exact mappings first

3.  **Pattern aliases**: regex-like rules for common prefixes:

    -   `^(R|C|L)(01005|0201|0402|0603|0805|1206|1210|1812|2010|2512)$` → `$2`
    -   `^SOIC-?(\d+)$` → `SO-$1`

4.  If still ambiguous (QFN/DFN), require body/pitch or map to a default *only if your org agrees.*

### B. Alias table examples (starter set)

**Chip passives**

-   `R0603` → `0603`
-   `C0603` → `0603`
-   `L0603` → `0603`
-   `RES0603` → `0603`
-   `CAP0603` → `0603`

**SO packages**

-   `SOIC-8` → `SO-8`
-   `SOIC8` → `SO-8`
-   `SO-08` → `SO-8`
-   `SO8` → `SO-8`
-   `SOP-8` → `SO-8` (only if you treat SOP and SOIC the same in your library)

**TSSOP/MSOP**

-   `TSSOP16` → `TSSOP-16`
-   `MSOP10` → `MSOP-10`
-   `VSSOP-10` → `MSOP-10` (only if your footprints truly match; often they don't---be careful)

**Diodes**

-   `DO214AC` → `SMA`
-   `DO214AA` → `SMB`
-   `DO214AB` → `SMC`
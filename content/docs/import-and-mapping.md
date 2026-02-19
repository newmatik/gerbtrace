---
title: Import and Mapping
description: How to handle file typing, PnP/BOM mapping, and import warnings.
---

# Import and Mapping

## Import checks

After import, Gerbtrace surfaces warnings when critical manufacturing data is missing or inconsistent:

- No copper layer detected
- No drill layer detected
- No outline/keep-out detected
- Only one outer copper side detected
- Configured multilayer count without detected inner copper

These checks are informational and should be resolved before production handover.

## PnP mapping

- Confirm required columns: designator, X, Y, rotation.
- If customer format is non-standard, map columns in the file preview/mapping UI.
- Validate side handling for top/bottom and mixed files.

## BOM mapping

- Confirm references, quantity, and part identification fields.
- Ensure quantity parsing is correct when decimal and delimiter formats differ.
- Resolve DNP and customer-provided flags before quoting.

## BOM ↔ PnP mismatch handling

- Use the BOM mismatch summary and row-level warnings.
- Fix missing references by correcting import mapping or file content.

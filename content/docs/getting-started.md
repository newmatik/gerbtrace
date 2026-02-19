---
title: Getting Started
description: First-time workflow from project creation to validation.
---

# Getting Started

## 1) Create a project

- Open the home page and create a new Viewer or Compare project.
- Name the project based on the assembly or order reference.

## 2) Import data

- Use the `Files` tab import panel.
- Supported essentials:
  - Gerber + Drill
  - Pick and Place (SMD/THT)
  - BOM
  - PDF docs

## 3) Confirm file classification

- Verify copper, mask, silk, drill, and outline types.
- Fix any `Unmatched` files by manually assigning the correct type.

## 4) Validate board parameters

- In `PCB`, confirm:
  - `Size X / Size Y`
  - layer count
  - solder mask and finish defaults

## 5) Validate process data

- In `SMD`/`THT`, verify placement visibility and orientation.
- In `BOM`, check missing part metadata and PnP reference mismatches.

## 6) Panel and export

- Configure panelization in `Panel`.
- Export the required images and Gerber package.

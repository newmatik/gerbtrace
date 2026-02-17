# Sidebar Design System

This document defines the sidebar UX pattern used in the panel editor so it can be reused across other screens.

## Goals

- Fit all important controls in a compact panel without long scrolling.
- Keep labels explicit so fields are understandable at a glance.
- Separate concerns using tabs instead of one long vertical form.
- Keep behavior predictable: edits update immediately and preserve canvas context.
- Reuse Nuxt UI components for consistency, theming, and accessibility.

## Information Architecture

Use a 3-level structure:

1. **Global quick actions (top row)**
   - Binary toggles and frequently used actions.
   - Example: component overlay, danger zone.
2. **Status strip**
   - Compact computed info and warnings.
   - Example: panel size and max-limit warning.
3. **Tabbed content**
   - Group related settings by user intent, not by implementation detail.
   - Current pattern:
     - `General Info`: overall layout and fabrication setup.
     - `Panel Connections`: separation and tab/connection behavior.

## Nuxt UI Component Principles

Prefer Nuxt UI primitives for consistency:

- `UTabs` for major grouping.
- `UButton` for actions and segmented option sets.
- `USwitch` for on/off features.
- `UInput` for numeric/text fields.
- `USelect` for short enumerations.
- `UIcon` for recognition, never as the only label.

Avoid mixing too many custom styles when a Nuxt UI variant already covers the use case.

## Density and Layout Rules

- Use compact controls (`size="xs"` or `size="sm"`).
- Prefer **2-column grids** for related numeric inputs.
- Use **4-column grids** for side-based values (`Top/Bottom/Left/Right`).
- Wrap logically related controls in bordered "cards":
  - `rounded border ... p-2 space-y-2`
- Use labels before inputs, even in compact layouts.
- Keep helper text short and contextual.

## Labeling Rules

- Every input must have visible context.
- Keep labels short, unit-explicit, and consistent:
  - `Routing tool (mm)`, `Hole dia (mm)`, `Corner R (mm)`.
- Use sentence case for inline labels, uppercase only for section titles.

## Behavioral Rules

- **Immediate feedback:** input updates should reflect in canvas quickly.
- **No view disruption:** sidebar edits must not reset zoom/pan.
- **Feature gating:** if a mode disables a feature, show disabled state with explanation.
  - Example: tabs disabled in V-Cut mode.
- **Sane defaults:** new projects start with practical defaults.
- **Safe migration:** new config fields must preserve old projects.

## Config and Persistence Principles

- Sidebar controls map directly to persisted config fields.
- New feature toggles require:
  1. Type update in config schema.
  2. Default in factory function.
  3. Migration fallback for existing saved data.
  4. UI control wiring.
  5. Geometry/render logic wiring.

This keeps local storage and Supabase JSON behavior aligned.

## Visual Hierarchy

Use this order inside each tab:

1. Core controls first (high-frequency edits).
2. Secondary controls next (fine-tuning).
3. Optional/advanced controls in subcards.
4. Explanatory helper line at the end if needed.

Warnings should be visible but non-blocking (subtle accent background and border).

## Reuse Checklist

When implementing a new sidebar with this pattern:

1. Define quick actions and status strip first.
2. Split large forms into 2-3 intent-based tabs.
3. Add explicit labels and units for every field.
4. Use bordered cards for each logical group.
5. Ensure toggles disable/hide dependent controls cleanly.
6. Keep canvas context stable while editing.
7. Add migration for every new persisted field.
8. Validate with small viewport and dark mode.

## Anti-patterns to Avoid

- One long ungrouped scroll form.
- Icon-only controls with no text.
- Unlabeled numeric inputs.
- Mixing persistent and local-only settings without clear boundaries.
- Resetting canvas zoom/pan on every config change.


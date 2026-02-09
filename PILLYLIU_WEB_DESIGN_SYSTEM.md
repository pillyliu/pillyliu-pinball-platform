# Pillyliu.com Design System Contract

This document defines the current shared web design language and implementation rules for `pillyliu.com` apps.
Use this as the default for all new pages/features unless there is a deliberate product reason to diverge.

## 1) Scope

Applies to:

- `pillyliu-landing`
- `lpl-stats`
- `lpl-standings`
- `lpl-targets`
- `lpl-library`

Core shared sources:

- `shared/ui/siteShell.tsx`
- `shared/ui/navLinks.ts`
- `shared/ui/tableLayout.css`

## 2) Global Visual Language

### Background

- Dark base with radial blue accents.
- Use `SiteShell` default background where possible.
- If not using `SiteShell`, match the same radial treatment and dark base tone.

### Typography

- Base stack: `Inter`, `Segoe UI`, system fallbacks.
- Header title style should match shell: compact, bold, neutral-100.
- Body copy defaults to neutral gray for secondary text (`text-neutral-400/500`).

### Shape + Surfaces

- Primary panel radius: `rounded-2xl`.
- Inputs/chips: `rounded-xl` or `rounded-full` (for nav chips).
- Border/ring tone: neutral-700/800 family.

## 3) Header and Navigation

### Primary Header Contract

- Use `SiteShell` for app-level pages whenever possible.
- Header behavior:
  - sticky
  - translucent background (`bg-neutral-950/80`)
  - blur backdrop
  - bottom border

### Nav Chip Contract

- Pill chips (`rounded-full`), ring outline, neutral inactive state.
- Active state uses sky tint (`bg-sky-500/15`, `text-sky-200`, `ring-sky-400/40`).
- Inactive hover should increase contrast (`hover:text-neutral-100`, stronger ring).

### Link Source

- Pinball nav links are sourced from `shared/ui/navLinks.ts`.
- If a page needs extra local section links (`About`, `Projects`), place them in `controls` under the primary nav row.

## 4) Form Controls Contract

Shared from `shared/ui/siteShell.tsx` and mirrored in library UI:

- Input class baseline:
  - dark background
  - neutral ring
  - `text-sm`
  - `py-2.5`
- Select class baseline:
  - same sizing as input
  - custom right-side caret area (`pr-10`)
  - `appearance-none`

Rule: any new input/select should start from the shared control classes, not bespoke CSS.

## 5) Table Contract (Stats/Standings/Targets)

All table primitives are centralized in:

- `shared/ui/tableLayout.css`

### Required classes

- Container: `table-scroll-panel`
- Top offset alignment: `table-start-offset`
- Header cells: `table-head-cell`
- Body rows: `table-body-row`
- Body cells: `table-body-cell`
- Optional shared inset wrappers: `table-content-inset`
- Optional note block under tables: `table-note`

### Behavior

- Sticky table header row.
- Scroll container with hidden desktop scrollbar chrome.
- Mobile/landscape/desktop heights controlled by shared CSS variables in `tableLayout.css`.

Rule: do not redefine table heights/row spacing in per-page CSS unless there is a documented exception.

## 6) Library Controls Bar Contract

Library uses a fixed filter/search bar to stabilize portrait behavior.

Key rules:

- Position controlled via CSS vars in `lpl-library/src/index.css`:
  - `--library-controls-top`
  - `--library-controls-top-sm`
  - `--library-controls-top-portrait`
- Keep the invisible spacer block in flow to prevent content overlap/jump.

If header geometry changes, update these vars, not ad hoc inline offsets.

## 7) Page Composition Rules

### Section rhythm

- Prefer shared shell spacing + panel gaps.
- Avoid arbitrary pixel nudges in JSX (`-mt-[x]`, `mt-[x]`) unless added as named shared classes/vars.

### Callout/Method blocks

- Default to plain text below data tables unless card treatment is semantically needed.
- Keep explanatory blocks visually subordinate to data.

## 8) Tooling and Build Standards

- All apps should use Tailwind + PostCSS setup.
- Avoid page-local styling systems that bypass shared shell/control contracts.
- Validate with per-app build after visual/layout changes:
  - `npm --prefix <app> run build`

## 9) Allowed Variation

Variation is allowed for:

- content structure (cards vs tables vs prose)
- unique domain visuals (e.g., hero layout on landing)

Variation is not allowed (without explicit design decision):

- changing nav chip behavior/style per page
- changing input/select sizing per page
- custom table spacing/height per table page outside shared contract

## 10) Change Checklist for New Pages

1. Use `SiteShell` unless there is a hard blocker.
2. Use shared nav links or explicitly document additions.
3. Use shared control classes for filters/inputs.
4. If page has tables, import and use `shared/ui/tableLayout.css` classes.
5. Keep offsets and sizes in named CSS variables/classes, not inline magic values.
6. Build and verify desktop + mobile portrait + mobile landscape.

## 11) Current Exceptions (Documented)

- Landing top nav includes local section links (`About`, `Projects`) mixed with app links.
- Contact anchor button was intentionally removed for now.

When these are revisited, update this file first, then code.

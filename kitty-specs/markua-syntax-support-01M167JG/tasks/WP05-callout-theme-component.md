---
work_package_id: WP05
title: Callout theme styling (--dk-callout-* tokens + CSS + a11y)
dependencies:
- WP04
requirement_refs:
- FR-003
- NFR-004
- NFR-005
- C-004
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
- T020
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/styles/theme.css
create_intent: []
execution_mode: code_change
owned_files:
- src/styles/theme.css
agent_profile: frontend-freddy
agent: claude
model: sonnet
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-003;
NFR-004, NFR-005; C-004), **the pinned contract**
[../contracts/callout-mapping.md](../contracts/callout-mapping.md) — the **"Emitted
theme-callout hast"** section (the exact `dk-callout` / `dk-callout--{variant}` /
`dk-callout__{icon,title,body}` DOM WP04 emits, and the **`--dk-callout-*` token family** this
WP defines) and the **"Why hast, not an `.astro` component"** note — plus
[../contracts/figure-render.md](../contracts/figure-render.md) (the `dk-figure` class names this
WP styles), `docs/adr/0008-swappable-theme-layer.md` and
`docs/adr/0009-finalize-metadata-contract.md` (the theme-surface / token governance), and
`src/lib/rehype/diagram-figure.ts` (the raw-hast emission WP04 mirrors — so you style the same
kind of plugin-emitted DOM). Read `src/styles/theme.css` (the `--dk-*` catalog + the
`--dk-* → --sl-*` bridge, and the existing `--dk-diagram-*` light/dark + `dk-diagram`/`dk-figure`
rules) — it is the **single file** this WP owns, and the model for the `--dk-callout-*` tokens.

> **There is no `Callout.astro`.** WP04 emits the callout DOM as raw hast (the four-carrier
> `components` lock, ADR-0013/0015, forecloses a component render). This WP styles that emitted
> DOM; it does **not** create a component. Do not add a `.astro` file.

## Objective

Own the **markua theme styling** — the single owner of `src/styles/theme.css` for markua. This
WP delivers the `--dk-callout-*` token family + the `.dk-callout*` CSS that style **WP04's
emitted callout hast** (there is **no** `Callout.astro`; the DOM is plugin-emitted raw hast, the
`diagram-figure.ts` pattern — see the contract's "Why hast, not an `.astro` component"), the
`dk-figure` figure styling (the layout classes WP07's figure rehype emits), and the
**accessibility verification of the emitted DOM** reviewed **as a theme-surface change, not a
plugin detail** (the reason IC-02 split it out). Consolidating all markua global CSS in one file
keeps `theme.css` single-owned (WP04 emits class *names*, WP07 emits figure class *names*;
neither edits CSS).

The token family + class scheme are **contract-fixed** (`callout-mapping.md` "Emitted
theme-callout hast"): base `dk-callout` + modifier `dk-callout--{variant}` for the six theme
variants (`aside`, `discussion`, `question`, `exercise`, `generic`, `center`) plus the four
mapped-name fallback variants (`tip`, `caution`, `danger`, `note`) used when an attribute-bearing
mapped callout is routed to hast; sub-elements `dk-callout__icon` / `__title` / `__body`.

This WP is **dormant** until WP04 emits theme-callout hast and WP07 emits figures, and until
WP10 flips the preset: the new CSS selectors are **unused** (they add bytes to the shared sheet
but change **no Markua-free page's HTML** — additive and justified per NFR-001; the visual
baseline may need a container regen, flagged in WP10). The styling introduces **no client
JavaScript** (NFR-005) and the emitted DOM meets **WCAG 2.2 AA** (NFR-004).

> **Boundaries.** This WP does **not** map classes, emit callout DOM, or resolve icons (WP04
> does, emitting the hast with an already-resolved `icon` name); it does **not** emit figures
> (WP07) — it only **styles** them; it does **not** touch `config.ts` (WP08); it does **not**
> create any `.astro` component. Its only owned file is `theme.css`. The class names it styles
> must match WP04's emitted hast (both cite `callout-mapping.md`).

## Subtasks

### T017 — Confirm the emitted-hast contract + landmark semantics (no component)
- **Do not create a component.** Instead, pin the styling target against WP04's emitted hast so
  the CSS and the DOM agree:
  - Confirm the exact emitted structure from `callout-mapping.md` "Emitted theme-callout hast":
    `<aside class="dk-callout dk-callout--{variant}" id?>` › optional `<span class="dk-callout__icon">`
    › optional `<p class="dk-callout__title">` › `<div class="dk-callout__body">…</div>`.
  - Verify the **landmark semantics** the contract promises are carried by the emitted `<aside>`
    (a complementary landmark). If WP04's `<aside>` needs an accessible name/`role` refinement for
    the a11y bar, that is a **WP04 emission** concern — coordinate; this WP does not add DOM. Note
    the styling must not rely on a wrapper element WP04 does not emit.
  - Record (a `theme.css` comment) that the callout DOM is plugin-emitted hast (WP04), not a
    component, and that these selectors are its only styling.
- **Files**: none created; findings feed T018/T020 and (if a DOM refinement is needed) a WP04
  coordination note.
- **Validation**: the class names in T018 match the contract's hast exactly; WP10 asserts the
  rendered DOM.

### T018 — `--dk-callout-*` tokens + per-variant callout rules in `theme.css`
- Edit `src/styles/theme.css` (additive). Token family (contract-fixed):
  - **Role tokens**: `--dk-callout-bg`, `--dk-callout-border`, `--dk-callout-text`,
    `--dk-callout-title`, `--dk-callout-icon`.
  - **Per-variant accents (six theme)**: `--dk-callout-aside-accent`,
    `--dk-callout-discussion-accent`, `--dk-callout-question-accent`,
    `--dk-callout-exercise-accent`, `--dk-callout-generic-accent`, `--dk-callout-center-accent`.
  - **Mapped-name fallback accents (four)**: `--dk-callout-tip-accent`,
    `--dk-callout-caution-accent`, `--dk-callout-danger-accent`, `--dk-callout-note-accent`
    (may alias the `--sl-*` aside colours so the attribute-bearing mapped fallback echoes the
    native aside).
  - Add these to the `--dk-*` catalog (light) and redeclare the **colour** tokens under the
    existing dark selector (mirror how `--dk-diagram-*` colour tokens are handled — type/spacing
    tokens are shared, only colour is redeclared).
  - Add class-specific rules: the base `.dk-callout` (surface, border, `__icon`/`__title`/`__body`
    layout), each `.dk-callout--{variant}` setting `--dk-callout-border`/`-title`/`-icon` from its
    variant accent — for the **six** theme variants (`aside`, `discussion`, `question`,
    `exercise`, `generic`, `center`) **and** the **four** mapped-name fallbacks (`tip`, `caution`,
    `danger`, `note`) — plus the `center` variant's centered layout. Keep styling token-driven so
    ADR-0008 themes can override `--dk-callout-*` only (the M2 override pattern).
- **Additivity**: these selectors are unused on a Markua-free page, so no page HTML changes
  (NFR-001). Note in a comment that they belong to the markua theme surface.
- **Files**: `theme.css` (callout section, ~70 lines).
- **Validation**: `astro check` clean; existing pages visually unchanged (WP10 base-fidelity).

### T019 — `dk-figure` figure styling in `theme.css` (for WP07's rehype output)
- Edit `src/styles/theme.css` (additive) to style the figure classes the **WP07 figure rehype
  emits** per [`figure-render.md`](../contracts/figure-render.md): `.dk-figure`,
  `.dk-figure--left` / `--right` / `--center` (the `{align:}` layout classes), and
  `.dk-figure__caption`. Reuse `--dk-figure-*`/existing figure tokens where the diagram figure
  already defines them; add only what markua figures additionally need (alignment layout,
  caption styling). Do **not** duplicate rules the `dk-diagram`/existing `dk-figure` styling
  already provides — extend, don't fork.
- The class **names** are contract-fixed (WP07 emits them; this WP styles them) — no dependency
  on WP07's code, only on the shared contract.
- **Files**: `theme.css` (figure section, ~40 lines).
- **Validation**: WP07 unit tests assert the class names; WP10's a11y/render lane asserts the
  rendered figure looks right (75% width, alignment).

### T020 — A11y bar of the emitted DOM + CSS
- Verify the **emitted callout DOM + CSS** meet **WCAG 2.2 AA** (NFR-004): the `<aside>` is
  announced correctly (complementary landmark), the optional `dk-callout__icon` is decorative or
  labelled appropriately, colour contrast on each variant's tokens (the six theme **and** four
  mapped-name fallback) passes in **both** colour modes, and `dk-callout--center` layout does not
  break reading order.
- Confirm **no client JS** is introduced by the CSS (NFR-005) — this WP touches only `theme.css`.
- Document (a `theme.css` comment) the interaction with **WP06 ToC-demotion**: a heading inside a
  callout is demoted to a `role="heading"` + `aria-level` element by WP06's rehype pass so it
  stays out of the ToC while remaining a heading to assistive tech — the callout CSS must not
  visually hide or fight the demoted node (style `dk-callout__title` and any in-body heading
  consistently).
- **Files**: `theme.css` (a11y refinements + comments).
- **Validation**: WP10 runs axe on the fixture corpus in both modes (the authoritative gate);
  this subtask ensures the surface is ready for it.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP04** (the callout plugin emits the callout hast this WP styles; the class names
must match `callout-mapping.md`). Figure class **names** come from the `figure-render.md` contract
(no code dep on WP07). Implement with `spec-kitty agent action implement WP05 --agent claude`.

## Definition of Done

- `theme.css` carries additive `--dk-callout-*` tokens (role tokens + six theme accents + four
  mapped-name fallback accents) + `.dk-callout*` rules for all ten variants and the
  `dk-callout__icon`/`__title`/`__body` sub-elements — matching WP04's emitted hast and
  `callout-mapping.md` exactly — **and** the `dk-figure`/alignment/caption figure styling; all
  token-driven and overridable (ADR-0008).
- **No `.astro` component is created** — the callout DOM is WP04's plugin-emitted hast; this WP
  owns **only** `theme.css`.
- WCAG 2.2 AA holds in both colour modes on the emitted DOM; Markua-free pages are visually
  unchanged (additive CSS only). `ci-ok` green.

## Risks / Reviewer guidance

- **Theme-surface review, not a plugin detail** — the token discipline and the a11y bar of the
  emitted callout DOM are reviewed as an ADR-0008/0009 theme change (the reason IC-02 split it
  out), even though this WP ships no component.
- **No `Callout.astro`** — creating a component is a finding: the four-carrier `components` lock
  (ADR-0013/0015) forecloses a component render, so it would be dead code / a split-brain second
  DOM copy. Style WP04's emitted hast instead.
- **Single owner of `theme.css`** — all markua CSS (callouts **and** figures) lands here so no
  other WP edits `theme.css`. WP07 emits figure class names but must not add CSS; a figure-CSS
  diff in WP07 is a finding.
- **No client JS (NFR-005)** — this WP ships CSS only; any `<script>` or client directive is a
  finding.
- **Class-name agreement with WP04** — the `.dk-callout*` selectors must match the classes WP04
  emits (both cite `callout-mapping.md`'s pinned hast); a mismatch renders the callout **unstyled**
  (not broken). Verify against WP04's emission.
- **Additive CSS** — new selectors are unused when no markua is present; confirm no Markua-free
  page HTML changes (NFR-001). A visual-baseline regen (if any) is owned by WP10 in the pinned
  container.

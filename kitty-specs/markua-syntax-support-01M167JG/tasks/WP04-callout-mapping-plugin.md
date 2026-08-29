---
work_package_id: WP04
title: Callout-mapping plugin (directive → Starlight aside | theme callout)
dependencies:
- WP02
- WP03
requirement_refs:
- FR-002
- FR-003
- FR-004
- FR-009
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T012
- T013
- T014
- T015
- T016
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/lib/remark/markua-callouts
create_intent:
- src/lib/remark/markua-callouts.internal.ts
- src/lib/remark/markua-callouts.ts
- src/tests/markua-callouts.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/markua-callouts.internal.ts
- src/lib/remark/markua-callouts.ts
- src/tests/markua-callouts.test.ts
agent_profile: frontend-freddy
agent: claude
model: opus
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-002,
FR-003, FR-004, FR-009; US1), **the pinned contract**
[../contracts/callout-mapping.md](../contracts/callout-mapping.md) (this WP implements the
class→target half + the emission owner), [../data-model.md](../data-model.md) (the callout-class
→ target table + the attribute tradeoff), [../contracts/icon-map.md](../contracts/icon-map.md)
(the `resolveIcon` call + placement rule), and `docs/adr/0030-markua-preprocess-to-directive.md`
(D-03, native-aside consumption, attribute tradeoff). The normaliser (WP02) produces the
`containerDirective` nodes this plugin maps; the icon map (WP03) supplies `resolveIcon`.

## Objective

Build the **single emission owner** for callouts: the `markua-callouts` remark plugin that
resolves each normalised `containerDirective` to its rendered target, per
[`contracts/callout-mapping.md`](../contracts/callout-mapping.md). It emits **every** directive:

- the **four Starlight-mapped classes** (`tip`→`tip`, `warning`→`caution`, `error`→`danger`,
  `information`→`note`) emit a `containerDirective` whose name is exactly `note`/`tip`/`caution`/
  `danger` that **Starlight's own `remarkAsides` renders natively** — doc-kitty does **not**
  reimplement aside markup;
- the **six theme classes** (`aside` from `A>`/`{aside}`, `discussion`, `question`, `exercise`,
  `center`, generic `blurb`) emit **raw hast directly** — an
  `<aside class="dk-callout dk-callout--{variant}">` element (optional `dk-callout__icon` child,
  optional `dk-callout__title`, and the compiled body under `dk-callout__body`), mirroring
  `rehype/diagram-figure.ts`'s `type: 'element'` emission. This is **NOT** a `.astro` component —
  the Starlight `components` map is frozen at four carriers (ADR-0013/0015) and doc-kitty has no
  directive→component seam, so a `Callout.astro` would be dead code and a split-brain second DOM
  copy. WP05 styles the emitted hast via `--dk-callout-*` tokens in `theme.css`.

The directive/hast schema **carries an optional `icon` (and `id`/`class`) from the start** so
WP03's icon map is the *only* icon plumbing added later — this plugin **calls `resolveIcon` now**.
The pinned **attribute tradeoff** is load-bearing: `remarkAsides` **discards a mapped directive's
attributes**, so a mapped-class callout carrying **`{#id}` or `{icon: …}` routes to the
theme-callout hast** (`dk-callout--{mapped-name}` fallback variant) instead of the native aside
(so the id/icon survives on the `<aside>`); an attribute-free mapped callout keeps the
native-aside path. The three input forms of a class produce **identical output** (FR-004) because
WP02 already normalised them to one directive per class.

This WP is **dormant** until WP08 registers it (in the pinned order, **before** `remarkAsides`)
and WP10 flips the preset — it imports into no pipeline here and changes no rendering, so the
corpus stays byte-identical. Its **class→target logic lives in `markua-callouts.internal.ts`**
(pure, vitest-covered); the thin `markua-callouts.ts` is the remark-plugin wrapper.

> **Boundaries.** This plugin does **not** render aside markup for the four mapped classes
> (Starlight does). It **owns** the theme-callout hast structure (the `dk-callout` DOM) but does
> **not** own its **styling** — `theme.css` / `--dk-callout-*` is WP05; it does **not** own
> `icon-map.ts` (WP03). It does **not** parse `{…}` attribute lists (WP08) — it *reads* the
> `icon`/`id`/`class` already present on the directive. It does **not** demote in-callout headings
> (WP06). There is **no `Callout.astro`** to own.

## Subtasks

### T012 — Pure class → target mapping (`markua-callouts.internal.ts`)
- Create `src/lib/remark/markua-callouts.internal.ts` (Astro-free):
  - `resolveCalloutTarget(class): { target: 'starlight-aside' | 'theme-callout';
    starlightName?: 'note'|'tip'|'caution'|'danger'; variant?: ThemeVariant }` implementing the
    full class→target table:
    - `tip`→starlight `tip`, `warning`→starlight `caution`, `error`→starlight `danger`,
      `information`→starlight `note`;
    - `aside`→theme `aside`, `discussion`→theme `discussion`, `question`→theme `question`,
      `exercise`→theme `exercise`, `center`→theme `center`, generic/`blurb`→theme `generic`.
  - **Class normalisation** (FR-004 support): fold synonyms so the three input forms map to one
    class (`W>`, `{class: warning}`+`B>`, `{blurb, class: warning}` → `warning`). Reuse WP02's
    exported family/letter constants where possible rather than re-deriving.
  - **Unknown `{class: …}` value** → degrade to the **generic** (`blurb`/theme `generic`)
    variant, **never error** (FR-012, contract Guarantee).
- **Files**: `markua-callouts.internal.ts` (mapping section, ~70 lines).
- **Validation**: T016 (class→target table + unknown-class→generic).

### T013 — Attribute-aware routing: mapped-class-with-attribute → theme callout
- In `markua-callouts.internal.ts`, implement the **attribute tradeoff** decision:
  - `chooseEmission(directive)` reads the directive's `icon`/`id`/`class` attributes (already
    attached — synthetic in tests, WP08 at runtime) and:
    - a **mapped class with NO `{#id}` and NO `{icon:}`** → emit for the **native aside path**
      (name = `note`/`tip`/`caution`/`danger`);
    - a **mapped class carrying `{#id}` or `{icon:}`** → emit **theme-callout hast** with the
      `dk-callout--{mapped-name}` fallback variant (`tip`/`caution`/`danger`/`note`, styled by
      WP05 to echo the native aside) so the attribute survives (`remarkAsides` would discard it);
    - a **theme class** → always the theme-callout hast (`dk-callout--{variant}`).
  - Define the directive-schema fields the plugin honours: `icon?`, `id?`, `title?` (from a
    `{title:}` or the callout's first heading), plus the resolved `class`. Document that this
    schema **carries `icon` from the start** so WP03/WP05 add no re-plumbing.
- **Files**: `markua-callouts.internal.ts` (routing section, ~60 lines).
- **Validation**: T016 (mapped+`{#id}`→theme; mapped+`{icon:}`→theme; mapped bare→native;
  matches data-model coverage row 15).

### T014 — Emission + icon resolution (`resolveIcon` call site)
- In `markua-callouts.internal.ts` / the plugin:
  - **Native-aside emission**: for the mapped bare case, emit the `containerDirective` named
    `note`/`tip`/`caution`/`danger` and **stop** — leave rendering to Starlight's `remarkAsides`
    (downstream). Do not add classes or markup.
  - **Theme-callout emission (decided — raw hast, not a component)**: emit an
    `<aside class="dk-callout dk-callout--{variant}">` element directly, exactly the way
    `rehype/diagram-figure.ts` builds its `<figure>` via `{ type: 'element', tagName, properties,
    children }`. The pinned DOM (`callout-mapping.md` "Emitted theme-callout hast"):
    - `<aside class="dk-callout dk-callout--{variant}" id?="{id}">`;
    - an optional `<span class="dk-callout__icon">` child **only when** an icon resolved;
    - an optional `<p class="dk-callout__title">{title}</p>` **only when** a title exists;
    - a `<div class="dk-callout__body">` wrapping the compiled body children.
    There is **no `Callout.astro`** and **no per-kind component seam** to use — the four-carrier
    `components` lock forecloses it, so a component would be dead code / a split-brain DOM copy.
    WP05 owns only the `--dk-callout-*` tokens + `.dk-callout*` CSS that style this hast; the DOM
    shape here and WP05's selectors must name the **same** classes (they do — both cite the
    contract).
  - **Icon resolution**: `import { resolveIcon } from '../markua/icon-map'` (WP03) and resolve
    the raw `{icon: fa-name}` **here**, passing the resolved Starlight name (or `undefined` after
    graceful drop) onto the theme-callout `icon`. This is the single icon call site; the build
    warning for an unmapped name fires inside `resolveIcon` (WP03), build exits 0 (NFR-002).
- Create the thin `src/lib/remark/markua-callouts.ts` remark-plugin wrapper: a hand-rolled walk
  (no `unist-util-visit`) that visits `containerDirective` nodes and applies the internal logic.
- **Files**: `markua-callouts.internal.ts` (emission section, ~70 lines), `markua-callouts.ts`
  (~60 lines).
- **Validation**: T016 (icon mapped→prop set; icon unmapped→prop absent + warning; native vs
  theme emission shape).

### T015 — First-heading title + no client JS + totality
- Handle the callout **title**: if the callout body opens with an ATX heading, emit it as the
  `<p class="dk-callout__title">` child of the emitted hast (per the pinned DOM), or leave it in
  the body — pick one and keep it consistent across variants. Note the interaction with **WP06
  ToC-demotion**: an in-callout heading is demoted by WP06's rehype pass so it stays out of the
  ToC; this plugin does **not** demote — it only maps/emits.
- Guarantee **totality**: every directive resolves to exactly one target; no input throws; the
  plugin adds **no client JavaScript** (build-time only, NFR-005).
- **Files**: `markua-callouts.internal.ts` / `markua-callouts.ts` (title + totality, ~40 lines).
- **Validation**: T016 (title extraction; unknown-class totality).

### T016 — Vitest (`markua-callouts.test.ts`)
- Create `src/tests/markua-callouts.test.ts` on **synthetic `containerDirective` mdast** (do not
  depend on WP02's plugin output — construct directive nodes directly):
  - **Class→target table**: each of the ten classes → its correct target/name/variant.
  - **Three-way equivalence output** (FR-004): three synthetic directives representing `W>`,
    `{class: warning}`+`B>`, `{blurb, class: warning}` (all already normalised to `warning`) emit
    the **identical** `caution` result.
  - **Attribute routing** (coverage row 15): mapped class + `{#id}` → theme-callout hast
    (`dk-callout--tip` fallback, `id` on the `<aside>`); mapped + `{icon:}` → theme-callout hast
    (icon child present); mapped bare → native `caution`/`tip`/… `containerDirective` name.
  - **Icons**: `{icon: fa-lightbulb}` → resolved Starlight name on the emitted `dk-callout__icon`
    child; `{icon: fa-obscure}` → no icon child + a warning (spy `console.warn`), no throw.
  - **Unknown class** → generic theme variant (`dk-callout--generic`), no throw (FR-012).
  - **Emitted hast shape**: theme-class emission is `<aside class="dk-callout dk-callout--{variant}">`
    with the `dk-callout__body` wrapper (and `dk-callout__title`/`__icon` when present).
  - **Title**: a body-leading heading surfaces as the `dk-callout__title` child per the pinned hast.
- **Files**: `markua-callouts.test.ts` (~120 lines).
- **Validation**: `pnpm test` green; `astro check`/`tsc` clean.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP02** (consumes normalised directives) **and WP03** (imports `resolveIcon`).
Implement with `spec-kitty agent action implement WP04 --agent claude`.

## Definition of Done

- `markua-callouts.internal.ts` implements the full class→target table, class normalisation,
  unknown-class→generic, and the attribute-aware routing (mapped+`{#id}`/`{icon:}`→theme).
- `markua-callouts.ts` is the remark-plugin wrapper (hand-rolled walk); it emits the four native
  aside names for bare mapped callouts and the theme-callout **hast**
  (`<aside class="dk-callout dk-callout--{variant}">`, mirroring `diagram-figure.ts`) for the
  rest, resolving icons via WP03's `resolveIcon` (the single icon call site). **No `Callout.astro`
  is created.**
- The directive/hast schema carries `icon`/`id`/`title` from the start; no re-plumbing is left for
  WP03/WP05.
- `markua-callouts.test.ts` covers the table, three-way equivalence, attribute routing, icons,
  unknown-class, and title.
- **No wiring** (`config.ts` untouched — WP08), no aside markup reimplemented, no client JS;
  corpus byte-identical. `ci-ok` green on unit tests.

## Risks / Reviewer guidance

- **Native aside reuse, not reimplementation** — the four mapped classes must emit exactly the
  `note`/`tip`/`caution`/`danger` `containerDirective` names for `remarkAsides` to render; emit
  nothing else on that path and add no aside markup. Emitting handmade aside HTML is a finding.
- **Attribute tradeoff routing** — a mapped class carrying `{#id}`/`{icon:}` MUST route to the
  theme-callout **hast** (`dk-callout--{mapped-name}` fallback); letting it ride the native aside
  silently drops the attribute (the exact pinned failure — data-model / icon-map / ADR
  Consequences).
- **Hast, not a component** — emit `<aside class="dk-callout …">` directly (the `diagram-figure.ts`
  pattern). Creating a `Callout.astro` is a finding: the four-carrier `components` lock forecloses
  a component render, so it would be dead code / a split-brain second DOM copy.
- **Single icon call site** — resolve icons here via WP03's `resolveIcon`; do not add a second
  lookup anywhere else. A duplicate icon resolver is a finding.
- **Class-name agreement with WP05** — the emitted `dk-callout` / `dk-callout--{variant}` /
  `dk-callout__{icon,title,body}` classes must match WP05's CSS selectors (both cite
  `callout-mapping.md`'s pinned hast); a class-name mismatch renders the callout **unstyled**, not
  broken.
- **No `{…}` parsing here** — attributes are read off the directive; parsing them is WP08.

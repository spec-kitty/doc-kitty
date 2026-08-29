---
work_package_id: WP07
title: Figure images rehype (img → figure + astro:assets, before rehypeImages)
dependencies:
- WP01
requirement_refs:
- FR-005
- FR-006
- NFR-004
- NFR-005
- C-006
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T025
- T026
- T027
- T028
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/lib/rehype/markua-figure.ts
create_intent:
- src/lib/rehype/markua-figure.ts
- src/tests/markua-figure.test.ts
execution_mode: code_change
owned_files:
- src/lib/rehype/markua-figure.ts
- src/tests/markua-figure.test.ts
agent_profile: frontend-freddy
agent: claude
model: opus
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-005,
FR-006; US2; C-006 scope-out attrs), **the pinned contract**
[../contracts/figure-render.md](../contracts/figure-render.md) (this WP implements it), the
attribute source in [../contracts/attribute-list-plugin.md](../contracts/attribute-list-plugin.md)
(the `{…}` values this pass consumes), [../research.md](../research.md) (D-05 + the rehype-order
divergence), `docs/adr/0030-markua-preprocess-to-directive.md`, and **the file this mirrors**:
`src/lib/rehype/diagram-figure.ts` (hand-rolled walk + the exported `safeHref` allowlist — reuse
it, do not reinvent).

## Objective

Build the **markua figure rehype pass** that rewrites a Markua image into an accessible,
optimised `<figure>`, per [`figure-render.md`](../contracts/figure-render.md). It consumes the
attributes the attribute-list plugin (WP08) attached to the image (`{alt:}`, `{caption:}`,
`{title:}`, `{width:}`, `{height:}`, `{align:}`, `{class:}`, `{#id}`) and produces:

```html
<figure class="dk-figure {align-class} {extra-classes}">
  <img src="{optimised-or-passthrough src}" alt="{alt}" title="{title?}" style="{sizing?}" />
  <figcaption class="dk-figure__caption">{caption}</figcaption>
</figure>
```

The **load-bearing ordering** (research divergence, contract §Ordering): this is a **user rehype
plugin**, so it runs **BEFORE `rehypeImages`**. It wraps the `<img>` **keeping `src` intact** and
setting the markua-derived `alt`/`title`/`style` on the nested `<img>`; `rehypeImages` (later)
then folds those into the `__ASTRO_IMAGE_` optimisation marker. Running **before** is
**required, not optional** — wrapping after optimisation would fight the marker and lose the
alt/sizing. Local paths optimise through `astro:assets`; `http(s)` URLs pass through (validated
by the shared `safeHref` allowlist so `javascript:`/`data:` can never reach the DOM as an image
source). The **caption is the bracket text** of `![caption](src)` (the Markua semantic — *not*
the alt); `alt` comes only from `{alt:}`, else the empty-safe fallback.

This WP is **dormant** until WP08 registers it (in the user rehype stage, before `rehypeImages`)
and WP10 flips the preset — it changes no rendering here and keeps the corpus byte-identical. It
is a **pure hand-rolled hast pass** in `markua-figure.ts`, unit-tested on synthetic hast. Its
CSS is **not** owned here — the `dk-figure*` classes it emits are styled in `theme.css` by WP05.

> **Boundaries.** This WP does **not** parse `{…}` (WP08 attaches them; this pass *reads*
> `hProperties`), does **not** own figure CSS (WP05 owns `theme.css`), and does **not** wire the
> pipeline (WP08). The `__ASTRO_IMAGE_` round-trip **build assertion** (that `style="width:75%"`
> and `alt` survive into the optimised `<img>`) lands in WP10 — this WP proves the pre-`rehypeImages`
> wrap shape at unit level.

## Subtasks

### T025 — The figure rehype pass skeleton + `safeHref` reuse (`markua-figure.ts`)
- Create `src/lib/rehype/markua-figure.ts` mirroring `diagram-figure.ts`:
  - A hand-rolled hast walk (no `unist-util-visit`) that finds `img` element nodes produced from
    Markua `![caption](src)`.
  - **Import and reuse the exported `safeHref` allowlist from `rehype/diagram-figure.ts`** (do
    **not** reinvent a scheme check — reuse guards against drift). Validate every `src`:
    `http:`/`https:`/`mailto:`/relative only; a rejected scheme drops the image safely (degrade,
    never a broken `javascript:`/`data:` image).
  - Wrap each qualifying `<img>` in `<figure class="dk-figure …">` with an optional
    `<figcaption class="dk-figure__caption">`. The `<figcaption>` is **omitted when there is no
    caption text** (empty-safe, the same rule the diagram figure uses).
- **Files**: `markua-figure.ts` (skeleton + walk, ~90 lines).
- **Validation**: T028 (figure shape, empty-safe caption, safeHref rejection).

### T026 — Field mapping (caption vs alt, sizing, align, class, title)
- Implement the field sources per the contract table:
  - **caption** (`<figcaption>`): `{caption:}` if present, else the **bracket text** of
    `![caption](src)` (US2 sc.1–2). The bracket text is the caption, **not** the alt.
  - **alt**: `{alt:}` if present, else the **empty-safe fallback** — `alt=""` when the figure has
    a caption naming it (so a screen reader is not told the name twice), and `alt=""` **plus a
    build warning naming the file** for a captionless image with no `{alt:}` (accessibility
    nudge, **never a build failure** — NFR-002/NFR-004).
  - **title**: `{title:}` → `<img title>` pass-through.
  - **sizing**: `{width:}`/`{height:}` percentages → inline `style` (e.g. `width: 75%`; US2
    sc.3).
  - **layout**: `{align:}` = `left`|`right`|`middle` → `dk-figure--left`/`--right`/`--center`
    class (styled by WP05).
  - **extra classes**: `{class:}` appended to the `<figure>` class list; **`{#id}`** → the
    figure's `id`.
  - **Unsupported attrs** (`fullbleed`, `float`, `type`, `format`, `column-widths`) are already
    dropped by WP08 and never reach this pass (C-006, FR-012) — assert this pass ignores anything
    it does not honour.
- **Files**: `markua-figure.ts` (field mapping, ~90 lines).
- **Validation**: T028 (caption-vs-alt, empty-safe fallback+warn, sizing, align, class, id).

### T027 — Ordering: run BEFORE rehypeImages, keep `src` intact
- Ensure the pass is written **as a user rehype plugin that runs before `rehypeImages`**:
  - It wraps the `<img>` **keeping `src` intact** and sets `alt`/`title`/`style` on the nested
    `<img>`; it must **not** pre-optimise or rewrite `src` into a marker itself.
  - Document (file-top comment) the fixed Astro rehype order (USER rehype → `rehypeImages` →
    `rehypeHeadingIds` → `rehypeRaw`) and **why before is required**: `rehypeImages` folds the
    nested `<img>`'s existing `alt`/`title`/`style` into the `__ASTRO_IMAGE_` marker only if they
    are already present when it visits. WP08 registers this pass in the user rehype stage; a
    reorder that puts it after `rehypeImages` loses the markua alt/sizing — the exact failure the
    WP10 round-trip assertion guards.
  - **Local vs web**: a local path stays a local `<img src>` for `rehypeImages`/`astro:assets`
    to optimise page-relative (the native glob loader already resolves page-relative images,
    research D-05 — do **not** re-implement resolution); a `http(s)` URL passes through as a
    plain `<img src>` (matched by `remoteImagePaths`, unoptimised unless configured).
- **Files**: `markua-figure.ts` (ordering comment + wrap semantics).
- **Validation**: T028 asserts the wrapped `<img>` keeps `src` and carries `alt`/`title`/`style`
  (the pre-`rehypeImages` contract); the real `__ASTRO_IMAGE_` round-trip is WP10.

### T028 — Vitest (`markua-figure.test.ts`)
- Create `src/tests/markua-figure.test.ts` on **synthetic hast** (`img` nodes with
  `hProperties` as WP08 would attach):
  - **Figure shape**: `![Palm Trees](palm-trees.jpg)` → `<figure class="dk-figure">` with
    `<figcaption>Palm Trees</figcaption>` and a nested `<img src="palm-trees.jpg">` (US2 sc.1).
  - **Caption vs alt**: `{alt: "a red apple"}` + `![The original Mac](mac.jpg)` → caption "The
    original Mac", `alt="a red apple"` (US2 sc.2).
  - **Empty-safe fallback**: captioned image with no `{alt:}` → `alt=""`; captionless image with
    no `{alt:}` → `alt=""` **and** a warning naming the file (spy `console.warn`), no throw.
  - **Sizing**: `{width: "75%"}` → nested `<img style="width: 75%">` (US2 sc.3).
  - **Align**: `{align: right}` → `dk-figure--right` on the `<figure>` (US2 sc.4).
  - **Class + id**: `{class: hero}` appended; `{#fig1}` → figure `id="fig1"`.
  - **safeHref**: `![](javascript:alert(1))` / `![](data:…)` → dropped/degraded, never emitted as
    an image `src`.
  - **Src intact**: the wrapped nested `<img>` keeps its original `src` (pre-`rehypeImages`
    contract).
- **Files**: `markua-figure.test.ts` (~120 lines).
- **Validation**: `pnpm test` green; `astro check`/`tsc` clean.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP01**. Authored on synthetic hast; WP08 registers it before `rehypeImages`, WP10
proves the `__ASTRO_IMAGE_` round-trip + optimisation in a real build. Implement with
`spec-kitty agent action implement WP07 --agent claude`.

## Definition of Done

- `markua-figure.ts` rewrites `![caption](src)` into `<figure>`+`<figcaption>` with the pinned
  field mapping (caption=bracket text, alt from `{alt:}`/empty-safe, sizing/align/class/id/title),
  reusing the shared `safeHref` allowlist; caption omitted when empty.
- The pass wraps **keeping `src` intact** and is documented to run **before `rehypeImages`** (WP08
  registers it there); it never fails the build (empty-safe fallback warns, exit 0).
- `markua-figure.test.ts` covers shape, caption-vs-alt, empty-safe+warn, sizing, align, class/id,
  safeHref rejection, and src-intact.
- **No wiring** (`config.ts` untouched — WP08), **no CSS** (WP05 owns `theme.css`), no client JS
  (NFR-005); corpus byte-identical. `ci-ok` green on units.

## Risks / Reviewer guidance

- **Before `rehypeImages` is required** — the pass must be a *user* rehype plugin that wraps the
  `<img>` keeping `src` intact; optimising or marker-rewriting here loses alt/sizing. The WP10
  `style="width:75%"` `__ASTRO_IMAGE_` round-trip assertion guards this — do not undermine it.
- **Caption is the bracket text, alt is `{alt:}`** — swapping them is the exact Markua-vs-Markdown
  semantic error (US2). Reviewer: verify the field sources.
- **Reuse `safeHref`** — import the allowlist from `rehype/diagram-figure.ts`; a re-implemented
  scheme check is a drift finding.
- **No figure CSS here** — `dk-figure*` classes are styled in `theme.css` by WP05; a CSS diff in
  this WP is a finding.
- **Never fail the build** — a missing alt warns (exit 0), a bad scheme degrades; a throw is a
  NFR-002 violation.

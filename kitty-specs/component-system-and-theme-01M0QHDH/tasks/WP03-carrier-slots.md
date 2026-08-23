---
work_package_id: WP03
title: Per-carrier slot resolution
dependencies:
- WP02
requirement_refs:
- FR-006
- FR-008
- FR-018
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T011
- T012
- T013
- T014
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
role: implementer
authoritative_surface: src/components/
create_intent: []
execution_mode: code_change
owned_files:
- src/components/Head.astro
- src/components/PageTitle.astro
- src/components/MarkdownContent.astro
- src/components/Footer.astro
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile so your identity, boundaries,
and governance scope are active:

```
/ad-hoc-profile-load frontend-freddy
```

You are **frontend-freddy**, the browser-side implementer. This WP is Astro component
work (`.astro` carriers) with a hard constraint: you must NOT change the Starlight
`components` map or the `MarkdownContent` layout-resolution body. Read the whole file
before touching code.

## Objective

Wire each of the four doc-kitty carriers to read its own `dk:` slots from the merged
virtual manifest (`virtual:doc-kitty/manifest`, built in WP02), so a theme can override
those slots — **per-carrier**, not from one central site (ADR-0015 decision 2). The
Starlight `components` map stays exactly the four carriers (ADR-0015 decision 3/4), and
every M1 chrome element renders byte-identically.

## Context

- **Settled design**: [ADR-0011](../../../docs/adr/0011-theme-slot-surface-and-per-kind-layouts.md)
  (the slot surface), [ADR-0015](../../../docs/adr/0015-m2-slot-resolution-and-components-map-seam.md)
  (layouts resolve at the single `MarkdownContent` site; **slots resolve per-carrier**;
  the components map is exactly the four carriers; non-carrier pass-through overrides are
  sequenced past M2), and [theming.md](../../../docs/architecture/theming.md) §"The slot
  surface".
- **The M1 surface you extend**: the four carriers already exist and read
  `Astro.locals.starlightRoute` (C-008). `Head.astro` hosts share metadata + `dk:head`;
  `PageTitle.astro` hosts `dk:page-hero` + `dk:metadata-band` (the M1 chrome, WP03 of
  M1); `MarkdownContent.astro` hosts the layout resolution (do not touch that body) plus
  the `dk:audience`/`dk:related`/`dk:external-references` host points; `Footer.astro`
  hosts `dk:site-footer`.
- **WP02 provides** `virtual:doc-kitty/manifest` exporting `slotComponents:
  Partial<Record<DkSlotName, Component>>` (and the synchronous `resolveLayout`). A carrier
  imports `slotComponents`, and for each `dk:` slot it owns, renders the theme's component
  when present, else its doc-kitty default.
- **Scope guard (C-010)**: the `dk:audience` / `dk:related` / `dk:external-references`
  slots are the **M3** content blocks. In M2 their host points may consult the manifest,
  but they stay **unwired to resolved data** — render nothing (or a themed pass-through)
  and never resolve `audience[]`/`related[]`/`external_references[]`.

## Subtasks

### T011 — Head carrier: manifest slots for `dk:head` + share metadata

**Purpose**: Let a theme override the `dk:head` slot while every M1 share-metadata tag
(og:*, twitter:*, canonical) still renders.

**Steps**:
1. In `src/components/Head.astro`, import `slotComponents` from
   `virtual:doc-kitty/manifest`.
2. For the `dk:head` slot: if `slotComponents['dk:head']` is set, render it; otherwise
   render the existing doc-kitty default (`socialImage` → share metadata path per FR-009).
3. Leave the M1 share-metadata computation (og:image fallback chain
   `social_thumb → hero_image.src → site default`) unchanged — it is proven by the
   three-distinct-og:image assertion.
4. Keep the `<meta name="dk-chrome" content="doc-kitty-carriers">` marker the M1
   assertion checks (`assert-chrome-artifacts.mjs` §4).

**Files**: `src/components/Head.astro`.

**Validation**:
- `pnpm build` then the head-share assertion block still passes (og:title/description/
  image/image:alt, twitter:card/image, canonical present; three distinct og:image).
- The `dk-chrome` marker meta is present on a built page.

**Edge cases**: no theme → `slotComponents` is empty → the default share path renders,
byte-identical to M1.

### T012 — PageTitle carrier: manifest slots for `dk:page-hero` + `dk:metadata-band`

**Purpose**: Route the two M1 metadata slots through the manifest without changing what
they render by default.

**Steps**:
1. In `src/components/PageTitle.astro`, import `slotComponents`.
2. For `dk:page-hero` and `dk:metadata-band`: render the theme override when present,
   else the existing M1 slot components (`PageHero.astro`, `MetadataBand.astro`).
3. Preserve the `data-dk-slot="dk:page-hero"` and `data-dk-slot="dk:metadata-band"`
   host attributes the M1 assertion checks (§4), and the rendered
   `dk-metadata-band` / `dk-band__status` markers.

**Files**: `src/components/PageTitle.astro`.

**Validation**:
- Metadata band renders with a TEXT-labelled `doc_status` pill on a published page
  (M1 assertion §1).
- Optimized hero `<img>` with non-empty `alt` on the hero demonstrator page (§2).
- `data-dk-slot` host attributes present (§4).

**Edge cases**: no theme → M1 slot components render unchanged.

### T013 — MarkdownContent carrier: layout body byte-unchanged, M3 host points wired-but-unwired

**Purpose**: Keep the single layout-resolution site intact (ADR-0015 seam 1) while the
M3 slot host points consult the manifest without resolving M3 data.

**Steps**:
1. In `src/components/MarkdownContent.astro`, do **not** change the layout-resolution
   body: the `resolveLayout(kind)` call and the `<Layout {...route}>` wrapper stay as
   WP02 left them (synchronous, byte-stable).
2. For the `dk:audience` (before content), `dk:related` and `dk:external-references`
   (after content) host points: if the manifest supplies a themed component, host it;
   otherwise render nothing. Do **not** read or resolve `entry.data.audience`,
   `entry.data.related`, or `entry.data.external_references` — that resolution is M3.
3. Keep the M1 Hub-list rendering path working (the layout resolves `Hub` via the
   manifest, produced by WP02).

**Files**: `src/components/MarkdownContent.astro`.

**Validation**:
- The Hub demonstrator page still renders `dk-hub__list` (M1 assertion §4).
- `git diff` shows the layout-resolution lines unchanged versus WP02's output.
- No reference to `entry.data.audience/related/external_references` is introduced.

**Edge cases**: a theme that registers a `dk:related` component renders that component
as a passthrough shell — still no resolved M3 data.

### T014 — Footer carrier: `dk:site-footer` + components-map attestation

**Purpose**: Make `dk:site-footer` themeable and give the build a non-fakeable signal
that the components map is exactly the four carriers (the WP08 assertion consumes this).

**Steps**:
1. In `src/components/Footer.astro`, import `slotComponents`; render the theme's
   `dk:site-footer` when present, else the doc-kitty default footer. The brand footer
   organism (WP05) carries an override-UNIQUE class `dk-site-footer--brand` that the
   doc-kitty default footer never emits; that class in the branded `example/dist` is the
   observable proving `slotComponents` actually resolved through this carrier (a stub that
   imports `slotComponents` but always renders the default would NOT emit it). WP08 (T047)
   asserts it — the `data-dk-slot` host attribute alone is not enough, since the default
   path emits it too.
2. Emit a stable, build-visible attestation the components map is four carriers — e.g.
   the Head carrier already emits `dk-chrome`; add a footer marker
   (`data-dk-slot="dk:site-footer"`) so WP08 can prove the Footer carrier is the one
   rendering (and that no extra Starlight override was registered).
3. Confirm (in the WP prompt notes for the reviewer) that no `Header`/`SiteTitle`/
   `Banner` override was added anywhere — the brand header rides native `logo`/`title`
   config (WP04), not a carrier (ADR-0015 decision 4/5).

**Files**: `src/components/Footer.astro`.

**Validation**:
- `data-dk-slot="dk:site-footer"` host present on a built page.
- `grep` of the toolkit config shows the Starlight `components` map has exactly the four
  keys (`Head`, `PageTitle`, `MarkdownContent`, `Footer`).

**Edge cases**: no theme → default footer renders.

## Branch Strategy

Planning branch and final merge target are both `feat/component-system-and-theme`.
During `/spec-kitty.implement` this WP branches from its dependency lane (WP02) as
computed in `lanes.json`; completed work merges back into
`feat/component-system-and-theme` unless the human redirects it.

## Definition of Done

- All four carriers import `slotComponents` and render theme overrides for the `dk:`
  slots they own; no theme → M1-identical rendering.
- The slot-override capability is bound to an observable: the branded Footer emits the
  override-unique `dk-site-footer--brand` class (from WP05's footer organism) that the
  default footer never emits, so a stub that ignores `slotComponents` fails WP08's T047
  assertion.
- The `MarkdownContent` layout-resolution body is byte-unchanged from WP02 (`git diff`).
- The `dk:audience`/`dk:related`/`dk:external-references` host points do not resolve any
  M3 data (grep-verified).
- The Starlight `components` map is exactly the four carriers (no new overrides).
- `pnpm build` + `pnpm assert:artifacts example/dist` stay green (all M1 chrome checks).
- `astro check` (typecheck) passes.

## Risks

- Accidentally reading M3 frontmatter to "fill in" a block — this crosses into M3.
  Keep the host points inert.
- Reordering or rewriting the `MarkdownContent` layout body — breaks ADR-0015 seam 1.
- Adding a `Header`/`SiteTitle` override to satisfy a theme header — breaks seam 3;
  the header is native config in WP04.

## Reviewer Guidance

Verify: `git diff` on `MarkdownContent.astro` touches only slot host points, never the
layout-resolution lines; the components map still has four keys; the M1 assertion suite
is green on the branded and no-theme builds; and no carrier references
`entry.data.audience/related/external_references`.

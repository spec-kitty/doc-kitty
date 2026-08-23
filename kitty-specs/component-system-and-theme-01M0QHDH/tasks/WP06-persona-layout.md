---
work_package_id: WP06
title: Persona per-kind layout shell and fixture
dependencies:
- WP05
- WP03
requirement_refs:
- FR-013
- NFR-004
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
role: implementer
authoritative_surface: src/layouts/
create_intent:
- src/layouts/Persona.astro
- example/docs/personas/example-persona.md
execution_mode: code_change
owned_files:
- src/layouts/Persona.astro
- example/docs/personas/example-persona.md
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your implementing profile:

```
/ad-hoc-profile-load frontend-freddy
```

Adopt Freddy's identity, boundaries, and browser-side implementation discipline
(accessible HTML, semantic structure, CSS token usage, WCAG 2.2 AA). Then read this
prompt, `spec.md`, `plan.md`, and `data-model.md` for this mission.

## Objective

Ship the `Persona` per-kind layout **shell** — the passport / character-sheet card — as
an in-frame layout resolved through the merged manifest, and prove manifest-driven
per-kind-layout override with a **second** bespoke layout (Hub was the first). The shell
renders **only existing generic frontmatter**; it introduces no new schema. A draft
fixture page demonstrates it without changing any pinned build count.

This is the mission's proof that the manifest generalises beyond `Hub` (SC-004) and the
brand's signature organism (theming-spec-kitty-brand.md §Organisms).

## Context

- `Persona` is **already** in the `KINDS` vocabulary (`src/lib/schema.ts`), so no schema
  change is needed — this WP must not touch `schema.ts` (that would re-open the M1
  contract, forbidden by C-010).
- The layout is resolved through the merged manifest at the single `MarkdownContent`
  import site (WP02) and rendered **in-frame** — it keeps the sidebar, TOC, search, and
  pagination, exactly like `Hub` (ADR-0011: `Persona` is in-frame, not `splash`).
- The passport structure and token usage are specified in
  `docs/architecture/theming.md` §"The per-kind layouts" and
  `docs/architecture/theming-spec-kitty-brand.md` §Organisms ("Persona passport").
- **Scope line (C-010)**: this WP renders generic frontmatter fields only
  (`title`, `hero_image.alt`, `doc_status`, `updated`, `type`, `authors`, `tags`).
  Persona-*attribute* fields (role, goals, responsibilities), audience resolution, and
  the audience/related/reference blocks are **M3** — do not add them.
- Depends on WP05 (brand atoms: eyebrow label + field row it composes) and WP03 (the
  per-carrier slot surface / manifest is live).

## Subtasks

### T026 — Persona.astro passport shell

**Purpose**: Render the persona passport card with a layout-unique marker so a
non-fakeable assertion (WP08) can bind to it.

**Steps**:
1. Create `src/layouts/Persona.astro`. It receives the Starlight route props the other
   layouts receive (mirror `src/layouts/Hub.astro`'s prop signature and its in-frame
   wrapper so the sidebar/TOC/search/pagination are preserved).
2. Read page state from the route (`entry.data`), consistent with the M1 carrier
   pattern (`Astro.locals.starlightRoute` upstream; the layout receives resolved props).
3. Render the passport as a bounded card:
   - outer element `<section class="dk-passport">` at `--dk-width-passport`,
     `--dk-radius-lg`, `--dk-shadow-lg`;
   - a top **accent identity strip** (the brand "bow-tie" motif) using
     `--dk-color-accent`;
   - the persona **name as `<h1>`** in `--dk-font-display` (from `entry.data.title`);
   - an **avatar** whose `alt` comes from `hero_image.alt` (reuse the M1 image pipeline
     approach; if no `hero_image`, render an accessible placeholder with a non-empty
     `alt` or omit the `<img>` entirely — never an empty `alt` on a present image);
   - a **`<dl>` field grid** with one `.dk-passport__field` row per present generic
     field (`doc_status`, `updated`, `type`, `authors`, `tags`), each row an
     eyebrow-label `<dt>` + `<dd>` value, composing the WP05 eyebrow/field-row atoms.
4. Render `<slot />` (the page's Markdown body) **inside** the searchable content region
   so Pagefind indexes it (NFR-004 / C-007).
5. Ensure every interactive element (if any) is ≥24px and shows a visible focus ring
   (reuse the brand focus-ring atom).

**Files**: `src/layouts/Persona.astro` (new).

**Validation**:
- The rendered page contains `class="dk-passport"` and at least one
  `class="dk-passport__field"`.
- The `<h1>` holds the page title; the `<dl>`/`<dt>`/`<dd>` structure is present and
  programmatic.
- The Markdown body is inside the searchable content region.

**Edge cases**: missing `hero_image` → no broken/empty-alt image; a field absent from
frontmatter → its `<dl>` row is omitted, not rendered empty.

### T027 — Verify Persona is registered in the theme's layouts map (verification-only)

**Purpose**: Confirm `kind: Persona → Persona.astro` is wired through the manifest so the
carrier resolves it — without editing another WP's owned file.

**Steps**:
1. Confirm the brand theme (`src/themes/spec-kitty/index.ts`, **owned by WP04**, wired in
   WP04 T015) contains `layouts: { Persona: '../../layouts/Persona.astro' }` pointing at
   this WP's file. **Do NOT edit `src/themes/spec-kitty/index.ts`** — there is no "add if
   missing" fallback here; if the entry is absent, that is a WP04 gap to flag, not an edit
   this WP makes.
2. Confirm the manifest resolves `Persona` for a `kind: Persona` page and that an
   unregistered kind still falls back to `Default`.

**Files**: none (verification only; the registration lives in WP04's file).

**Validation**: a `kind: Persona` page resolves the passport layout through the manifest;
an unregistered kind falls back to `Default` (drives T029 / SC-004).

**Edge cases**: if the WP04 `layouts.Persona` entry is missing or points elsewhere, report
it as a WP04 defect rather than editing WP04's file here.

### T028 — Draft Persona fixture page

**Purpose**: A demonstrator that renders and is Pagefind-indexed but does **not** change
the pinned agent-index/sitemap count (12).

**Steps**:
1. Create `example/docs/personas/example-persona.md` with frontmatter:
   - `doc_status: draft` (excluded from agent-index + sitemap → pinned counts unchanged;
     the page still renders to HTML and is Pagefind-indexed);
   - `kind: Persona`;
   - `title:` a persona name;
   - `description:` short;
   - `hero_image: { src: <an existing example asset or a new one under this path>, alt: <non-empty> }`;
   - a few generic fields (`type`, `tags`, `authors`) to populate the `<dl>`.
2. In the body, include a **persona-unique searchable string** (a distinctive phrase not
   present elsewhere in the corpus) that the WP08 Pagefind assertion will bind to. Record
   that exact string in this WP's notes so WP08 can pin it.

**Files**: `example/docs/personas/example-persona.md` (new).

**Validation**:
- `pnpm build` renders `example/dist/personas/example-persona/index.html`.
- The agent-index count stays 12 and the sitemap page-URL count stays 12 (the draft is
  excluded) — `pnpm assert:artifacts example/dist` stays green.
- The persona-unique string appears in the page's own Pagefind fragment.

**Edge cases**: if the fixture were published (not draft) the count would become 13 and
break the pinned baseline — keep it `draft`.

### T029 — Layout verification via a themed render harness

**Purpose**: Prove the passport layout + `.dk-passport` marker render correctly, given
that `example/dist` stays **UNBRANDED until WP07** (so the fixture there falls back to
`Default` and cannot exercise the passport on this WP's build).

**Steps**:
1. Verify the passport layout and its `.dk-passport` / `.dk-passport__field` markers by
   rendering `Persona.astro` **directly** with persona-shaped props via a themed render
   harness (a vitest / Astro component render), NOT against `example/dist`.
2. Confirm the render keeps the in-frame wrapper (sidebar/TOC region preserved) and the
   body inside the searchable region.
3. The on-branded-example proof — `.dk-passport` present on the fixture route, and the
   fallback-to-`Default` (marker vanishes) when the layout is unregistered — is owned by
   **WP08** on the branded build (SC-004, T047); this WP records the expected markers and
   the persona-unique string for WP08 to pin.

**Files**: none (verification only).

**Validation**: the render harness shows `.dk-passport` + `.dk-passport__field`; the
markers and persona-unique string are recorded for WP08's branded-build assertions.

## Branch Strategy

Planning artifacts were generated on `feat/component-system-and-theme`; the final merge
target is `feat/component-system-and-theme` (which lands into `origin/main` via the
mission PR at the landing sequence). During `/spec-kitty.implement` this WP runs in the
execution worktree allocated for its lane in `lanes.json`; do not create branches by
hand. This WP depends on WP05 and WP03 — implement after both are green.

## Definition of Done

- `src/layouts/Persona.astro` renders the passport with `.dk-passport` +
  `.dk-passport__field` markers, name `<h1>`, generic-field `<dl>`, avatar alt from
  `hero_image.alt`, in-frame (sidebar kept), body in the searchable region.
- `kind: Persona` resolves the layout via the manifest; unknown kind → `Default`.
- The draft fixture renders, is Pagefind-indexed, and leaves the pinned counts at 12
  (`pnpm assert:artifacts example/dist` green).
- No new frontmatter field is introduced; `src/lib/schema.ts` untouched.
- The stub-and-fail behaviour (marker vanishes when unregistered) is recorded for WP08.

## Risks

- **M3 drift**: rendering invented persona attributes would re-open the metadata
  contract. Mitigation: generic fields only; `schema.ts` untouched.
- **Search regression**: rendering the body outside the searchable region breaks NFR-004.
  Mitigation: mirror Hub's in-frame content placement.
- **Count drift**: a published fixture breaks the pinned baseline. Mitigation: `draft`.

## Reviewer Guidance

Verify: the `.dk-passport` marker is layout-unique (not present on ordinary pages); the
`<dl>` uses real `<dt>`/`<dd>` semantics; the sidebar is present on the fixture route;
the persona-unique string is in the page's own Pagefind fragment; the pinned counts are
unchanged; and `schema.ts` is not in the diff.

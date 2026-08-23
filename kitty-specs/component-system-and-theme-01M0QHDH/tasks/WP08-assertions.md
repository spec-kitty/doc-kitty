---
work_package_id: WP08
title: Themed-surface assertions and invariants
dependencies:
- WP06
- WP07
requirement_refs:
- FR-017
- NFR-001
- NFR-002
- NFR-004
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T033
- T034
- T035
- T036
- T037
- T046
- T047
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: node-norris
role: implementer
authoritative_surface: src/scripts/
create_intent:
- src/tests/config-invariants.test.ts
execution_mode: code_change
owned_files:
- src/scripts/assert-chrome-artifacts.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/config-invariants.test.ts
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your implementing profile:

```
/ad-hoc-profile-load node-norris
```

Adopt Norris's identity and boundaries (Node scripting, zero-runtime-dep assertions,
honest string/`node:zlib`-level checks). Then read this prompt, `spec.md`, the two
existing scripts you own, and WP06's recorded persona-unique string.

## Objective

Extend the non-fakeable gates to cover the themed surface, and add the config-level
invariants, **without weakening any M1 assertion**. Every new or touched assertion must
be proven by stub-and-fail: break the element it guards → the gate goes red; restore →
green. This is the mission's anti-laziness contract (C-004, SC-003/SC-004, FR-017). This
WP also owns the brand AA construction checks (NFR-001 target-size/focus, which axe cannot
machine-verify — T046) and re-proves the Hub layout non-fakeably **through the manifest**
now that WP02 replaced the static module (SC-004 Hub half — T047).

## Context

- `src/scripts/assert-chrome-artifacts.mjs` already enforces token-catalog completeness,
  the `--dk-*→--sl-*` bridge, the four carriers, the metadata band (text-labelled
  status), the hero `<img>`, three distinct share images, the Hub Pagefind cards, and
  the AA rules (`.dk-hub__card` ≥24px, dk `:focus-visible`). It reads
  `example/dist` and exits non-zero on the first failure. Keep every one of these.
- `src/scripts/assert-build-artifacts.mjs` pins the agent-index shape/count (12), the
  sitemap URL count (12), draft exclusion, README-as-index, and a rendered known page,
  then calls the chrome assertions. Keep these.
- Both scripts are **zero-runtime-dependency** (string search + `node:zlib`). Do not add
  a dependency (NFR-005).
- WP06 shipped the Persona fixture (draft, a `.dk-passport` marker, a persona-unique
  string) and WP07 rebranded the example, so `example/dist` is the branded build with the
  fixture present.

## Subtasks

### T033 — Persona layout + Pagefind assertion

**Purpose**: A non-fakeable proof the Persona layout resolved (SC-004) and its content is
searchable (NFR-004).

**Steps**:
1. In `assert-chrome-artifacts.mjs`, add a check that the Persona fixture HTML
   (`personas/example-persona/index.html`) contains the layout-unique `dk-passport`
   marker. Bind to `.dk-passport` (not generic `<h1>`/`<dl>`), so a fallback-to-Default
   regression flips it red.
2. Add a URL-scoped Pagefind fragment check mirroring the existing Hub pattern
   (`HUB_FRAGMENT_URL` + gunzip + string search): locate the fragment whose `url` is the
   fixture route and assert it contains WP06's recorded persona-unique string.

**Files**: `src/scripts/assert-chrome-artifacts.mjs`.

**Validation**: passes on the real build; fails when the Persona layout is unregistered
(marker absent) or when the body leaves the searchable region (string missing from the
fixture fragment).

**Edge cases**: the fixture is a draft — confirm it still renders to HTML and is
Pagefind-indexed (drafts are excluded only from the agent-index/sitemap, not Pagefind).

### T034 — Cascade-order assertion

**Purpose**: Guard ADR-0013 seam 2 in the multi-layer case (brand/consumer CSS after the
token sheet).

**Steps**:
1. In `assert-chrome-artifacts.mjs`, identify the TOKEN sheet by a **Default-only token
   declaration** (a value/name only the base token sheet carries) and the BRAND sheet by a
   **brand-only declaration** (a value only the brand sheet carries), then read a rendered
   page's `<head>` and assert the token sheet's `<link>` appears **before** the brand
   sheet's `<link>`.
2. **Fail explicitly if Astro collapses both into a single bundled stylesheet** (no two
   distinguishable `<link>`s), so the check cannot vacuously pass — a single-bundle build
   must make the assertion error, not silently succeed.

**Files**: `src/scripts/assert-chrome-artifacts.mjs`.

**Validation**: passes on the real build; fails if the brand sheet is emitted before the
token sheet (the edge case in `spec.md`); errors (not passes) if the two sheets collapse
into one bundle.

**Edge cases**: hashed filenames — match by the per-sheet content discriminator, not exact
filename, as the existing token checks do.

### T035 — Mode-varying completeness + `--dk-*`-only

**Purpose**: Guard FR-011 (both-mode overrides) and FR-004 (`--dk-*`-only) non-fakeably.

**Steps**:
1. Enumerate the mode-varying `--dk-*` colour tokens (the colour subset — mirror the
   grouping in `REQUIRED_DK_TOKENS`) in a `REQUIRED_MODE_VARYING` list, and assert each
   is re-declared under the brand's dark selector in the emitted CSS (a dropped dark
   re-declaration flips it red).
2. Assert the brand/consumer emitted sheet(s) contain **zero** `--sl-*:` declarations
   (the bridge owns `--sl-*`; a theme setting `--sl-*` directly is forbidden).

**Files**: `src/scripts/assert-chrome-artifacts.mjs`.

**Validation**: passes on the real build; fails if any listed mode-varying token lacks a
dark re-declaration, or if a brand sheet declares an `--sl-*` variable.

**Edge cases**: keep the list in the same grouped order as `theme.css` so a reviewer can
diff by eye (the existing `REQUIRED_DK_TOKENS` convention).

### T036 — Components-map invariant (vitest)

**Purpose**: Guard ADR-0013 seam 3 (components map = exactly four carriers) at config
level, where it is actually decided.

**Steps**:
1. Create `src/tests/config-invariants.test.ts`. Call `defineDocKittyIntegrations` both
   with no theme and with a brand-like fixture theme; extract the Starlight integration's
   `components` map; assert it has **exactly** the four keys `Head`, `PageTitle`,
   `MarkdownContent`, `Footer` in both cases (no pass-through override expands it —
   ADR-0015 decision 3/4).

**Files**: `src/tests/config-invariants.test.ts` (new, vitest).

**Validation**: passes today; fails if a fifth component key is registered.

**Edge cases**: the integration array shape — locate the Starlight integration entry
robustly (by the config it carries), not by array index.

### T046 — Brand AA construction assertions (NFR-001)

**Purpose**: Guard the WCAG 2.2 AA properties axe cannot machine-verify — target-size
(2.5.8) and a visible focus indicator — for the brand's interactive components.

**Steps**:
1. In `assert-chrome-artifacts.mjs`, extend the scoped `ruleBlocksFor` + `hasMinTarget24`
   checks (today bound only to `.dk-hub__card`) to the brand interactive target classes
   named in WP05 T025: `.dk-related-card`, `.dk-reference-item`, `.dk-passport__field a`,
   and the brand footer/nav interactive targets. Assert each carries a `min-height`/
   `min-width` ≥24px rule in the emitted CSS.
2. Assert a brand `.dk-*:focus-visible` ring rule exists (scoped to the brand selectors,
   not merely somewhere in Starlight's bundled CSS).
3. These are CSS **construction** checks: axe does not verify target-size or visible focus,
   so this WP owns them (WP09's axe lane covers contrast/roles).

**Files**: `src/scripts/assert-chrome-artifacts.mjs`.

**Validation**: passes on the real build; fails when a brand interactive class ships with
no ≥24px target rule or no focus ring.

**Edge cases**: keep the class list in sync with WP05 T025's named classes — a rename there
must update this list (that coupling is the point).

### T047 — Slot-override + Hub stub-fail proofs (SC-004 Hub half)

**Purpose**: Prove the slot-override capability actually resolved, and re-prove the Hub
layout non-fakeably **through the manifest** (WP02 changed static-module → manifest, so the
M1 Hub assertion must be re-proven under the new mechanism).

**Steps**:
1. Assert `dk-site-footer--brand` (the override-unique class from WP05's footer organism,
   rendered via WP03's Footer carrier) is present in the branded `example/dist`. This
   proves `slotComponents` resolved through the carrier — a stub that imports
   `slotComponents` but renders the default footer would NOT emit it, so this flips red.
2. Add a Hub stub-and-fail proof through the manifest: temporarily unregister `Hub` in the
   manifest so the Hub page falls back to `Default` → the existing `dk-hub__list` assertion
   goes red → revert and confirm green. Record the proof (this closes SC-004's Hub half,
   which T037's "keep M1 green" alone does not, since `dk-hub__list` is an untouched M1
   assertion).

**Files**: `src/scripts/assert-chrome-artifacts.mjs` (the `dk-site-footer--brand` check);
the Hub manifest stub-fail is a recorded proof, not a new persistent assertion.

**Validation**: `dk-site-footer--brand` present on the branded build; the recorded Hub
manifest stub-fail shows `dk-hub__list` red-on-unregister / green-on-revert.

**Edge cases**: the Hub stub must be applied at the manifest layer (unregister the layout),
not by deleting `Hub.astro`, to prove the resolution mechanism, not the file's existence.

### T037 — Keep M1 green + stub-and-fail proof

**Purpose**: The anti-laziness contract — assertions strengthened, never weakened.

**Steps**:
1. Run the full `pnpm assert:artifacts example/dist` on the branded build; every M1
   assertion must stay green.
2. For **each** new/touched assertion (T033, T034, T035, T036, T046, T047), perform and
   record a stub-and-fail proof: temporarily break the guarded element (unregister Persona;
   emit brand CSS before tokens; drop a dark re-declaration; register a fifth component;
   drop a brand ≥24px target rule; render the default footer instead of the brand override;
   unregister Hub in the manifest) → confirm the specific gate goes red with a precise
   message → revert → confirm green. Record the proofs in this WP's history/notes (mirror
   the M1 acceptance.md discipline).
3. If the branded surface legitimately changed a marker an M1 assertion bound to,
   **strengthen** the assertion to the new non-fakeable marker — do not relax it.

**Files**: `src/scripts/assert-chrome-artifacts.mjs`, `src/scripts/assert-build-artifacts.mjs` (only if a marker moved).

**Validation**: full assertion suite green on the branded build; every new/touched
assertion has a recorded red-on-stub proof.

**Edge cases**: never add a runtime dependency to the scripts (NFR-005); keep checks
string/`node:zlib`-level.

## Branch Strategy

Planning artifacts were generated on `feat/component-system-and-theme`; the final merge
target is `feat/component-system-and-theme` (landing into `origin/main` via the mission
PR). This WP runs in its lane's execution worktree from `lanes.json`. Depends on WP06
(fixture + marker) and WP07 (branded build) — implement after both are green.

## Definition of Done

- New assertions cover: Persona `.dk-passport` marker + persona-unique Pagefind text;
  cascade order (with the single-bundle-collapse guard); mode-varying completeness;
  `--dk-*`-only; components-map = four carriers; brand AA target-size + focus construction
  checks (NFR-001, T046); the `dk-site-footer--brand` slot-override observable and the Hub
  manifest stub-fail re-proof (SC-004 Hub half, T047).
- Every M1 assertion stays green on the branded build; no assertion is weakened.
- Each new/touched assertion (T033, T034, T035, T036, T046, T047) has a recorded
  stub-and-fail proof.
- No runtime dependency added to the scripts.

## Risks

- **Fakeable assertion**: binding to generic markers (`<h1>`/`<dl>`) instead of
  `.dk-passport` would pass on a Default fallback. Mitigation: bind to layout-unique
  markers; prove stub-and-fail.
- **Silent weakening**: relaxing an M1 check to make the brand pass. Mitigation: strengthen
  to a new non-fakeable marker; reviewer diffs the assertion changes.

## Reviewer Guidance

Diff every assertion change and confirm none is a weakening. For each new assertion,
require the recorded red-on-stub evidence. Confirm the scripts remain zero-runtime-dep.
Re-run `pnpm assert:artifacts example/dist` and the vitest suite; both green.

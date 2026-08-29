---
work_package_id: WP10
title: Verification corpus + gates (the atomic preset on-switch)
dependencies:
- WP04
- WP05
- WP06
- WP07
- WP08
- WP09
requirement_refs:
- C-003
- FR-011
- FR-014
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-005
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T039
- T040
- T041
- T042
- T043
- T044
history:
- '2026-08-29: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: example/docs/guides/
create_intent:
- example/docs/guides/markua-showcase.md
- example/docs/guides/markua-malformed.md
- example/docs/guides/palm-trees.svg
- tests/a11y/markua.spec.ts
execution_mode: code_change
model: opus
owned_files:
- example/docs/guides/markua-showcase.md
- example/docs/guides/markua-malformed.md
- example/docs/guides/palm-trees.svg
- example/astro.config.mjs
- tests/a11y/routes.ts
- tests/a11y/markua.spec.ts
- src/scripts/assert-build-artifacts.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (NFR-001–005,
SC-001–005, FR-011, FR-014), [../plan.md](../plan.md) (IC-06 named non-fakeable gates),
[../data-model.md](../data-model.md#coverage-matrix) (**the authoritative coverage matrix — the
SC-005 denominator**), [../quickstart.md](../quickstart.md) (the showcase example + the verify /
portability steps — the fixture mirrors it), and all six contracts. Study the gate shapes to
extend: `tests/a11y/routes.ts` (`AXE_PAGES` + `guardRoots`), `tests/a11y/axe.spec.ts`,
`tests/a11y/glossary.spec.ts` / `diagram.spec.ts` (direct behavioural specs), and
`src/scripts/assert-build-artifacts.mjs` (the build-artifact assertion the diagram/deck lanes
use). Note the lane-hygiene rule: regenerate a11y **visual** baselines only in the pinned
`mcr.microsoft.com/playwright:v1.62.1-noble` container.

## Objective

**The atomic on-switch.** Every prior WP (WP01–WP09) is dormant and green; **this WP flips
activation** by setting `markua: true` on the example and landing, in one mission-approved
package: the **showcase fixture** exercising the **full coverage matrix**, the
**deliberately-malformed fixture**, the **Playwright a11y/render specs**, and the **build
assertions** — including the named **non-fakeable gates** the plan (IC-06) pins. After this WP,
the **full seam is live** and `ci-ok` (code-quality, doc-sanity, build-example browser-free,
a11y) is green. Coverage is measured against the **construct × input-form coverage matrix in
`data-model.md`** as the explicit denominator (NFR-003, SC-005 — 100% is **not gameable**).

Named gates this WP owns (each chosen to be non-fakeable):

- **Ordering lock** — a build/render assertion that a `T>` renders `starlight-aside--tip` (locks
  the WP08 plugin order against a future array reorder — ADR-0030 Risk).
- **Figure round-trip** — assert `style="width:75%"` (and the `alt`) **survive the
  `__ASTRO_IMAGE_` round-trip** into the final optimised `<img>` (proves WP07 runs before
  `rehypeImages`).
- **SC-003 preset-off portability** — render the corpus through the **preset-off build** and
  assert **no raw `:::` directive and no `{…}` attribute list leaks** as broken markup.
- **NFR-002 build-exits-0** — the deliberately-malformed fixture (unknown icon, unsupported
  attr, unbalanced wrapper) leaves the **build succeeding** (assert the build *result*, not just
  the page) with the expected warnings.
- **ToC exclusion** — headings inside an aside/callout are **absent from the on-this-page nav**
  (proves WP06 in the real pipeline).

> **Boundaries.** This WP owns the fixtures, the example config on-switch, the a11y specs +
> routes, and the build assertion. It does **not** edit any `src/lib/**` plugin, `config.ts`
> (WP08), the callout/figure `theme.css` (WP05), or the docs of record (WP11). Per the pinned
> scheme there is **no `Callout.astro`** — theme callouts are emitted **hast**
> (`<aside class="dk-callout dk-callout--{variant}">`, sub-elements `dk-callout__icon` /
> `__title` / `__body`), so every assertion below names the **hast class scheme**, never a
> component. The showcase page **doubles as the FR-014 author-facing page** (it documents every
> construct); WP11 owns the separate architecture doc-of-record.

## Subtasks

### T039 — Full-surface showcase fixture (doubles as the FR-014 author page)
- Create `example/docs/guides/markua-showcase.md` (mirror [../quickstart.md](../quickstart.md)'s
  example) exercising **every coverage-matrix row (1–35)**: the aside forms (`A>` single/multi +
  internal heading, `{aside}` wrapper, `{aside}` with a fenced `>` body, **and a nested
  `{aside}`-inside-`{aside}`** — row 3 "nestable", see below); the **ten callout classes × three
  input forms** (shorthand, `{class:}`+`B>`, `{blurb, class:}`); a **mapped class carrying
  `{#id}`/`{icon:}`** (row 15) that routes to the **theme-callout hast**
  (`<aside class="dk-callout dk-callout--tip">` — the mapped-name fallback variant — **not** the
  native Starlight aside, because `remarkAsides` would discard the attribute); figures (local +
  web, the eight attributes, an ignored `{fullbleed:}`); crosslink ids (heading `{#id}`,
  collision, auto, both span forms); icons (mapped + unmapped); attr-above-wrapper. Frontmatter
  `doc_status: active`, a real `type`/`kind`, in the sidebar. The prose should read as **author
  documentation** (it is the FR-014 page) while covering the matrix.
- **Live nested-aside (row 3, MANDATORY — closes a wiring-level gap)**: include a real
  `{aside}` whose body contains a nested `{aside}…{/aside}`, so the **built page** proves
  nesting end-to-end. Row 3 "nestable" is otherwise proven **only** by WP02's Astro-free unit
  test, which cannot catch a WP04/WP08 wiring-level nesting regression; assert the nested
  structure in the built HTML / Playwright spec (T042).
- Create `example/docs/guides/palm-trees.svg` — a small self-contained local SVG so the **local
  image optimisation** path is exercised without a binary asset. Reference it from the showcase
  (`![Palm Trees](palm-trees.svg)` with `{alt:}`/`{width:}`), plus a web-URL image
  (`![…](https://…)`) for the passthrough path.
- **Files**: `markua-showcase.md`, `palm-trees.svg`.
- **Validation**: `pnpm --filter example build` (browser-free) exits 0 and renders the page.
- **FR-014 hook (pinned, PUBLICATION-scoped)**: the machine gate here checks **publication only**
  — `markua-showcase.md` is present with `doc_status: active`, appears in the sidebar, and passes
  `doc-sanity` (link-checkable / build-checkable facts). The obligation that the page **documents
  every in-scope construct + its limits** is **human judgment, not link-checkable**, so it is
  routed to **WP11's reconciliation (T047) as a named reviewer check** — do **not** encode
  "documents every construct" as a build gate here (it would be vacuous or brittle).

### T040 — Deliberately-malformed fixture (NFR-002)
- Create `example/docs/guides/markua-malformed.md` deliberately triggering each
  cannot-fail-the-build case: an **unbalanced wrapper** (`{aside}` with no `{/aside}`), an
  **unknown icon** (`{icon: fa-obscure-name}` on a callout), and an **unsupported attribute**
  (`{fullbleed: true}` above an image). The page must **degrade to readable text / render without
  the icon**, never broken markup.
- **Files**: `markua-malformed.md`.
- **Validation**: the build assertion (T043) proves the build **exits 0** with this page present
  and emits the expected warnings.

### T041 — Turn the preset ON (`example/astro.config.mjs`)
- Edit `example/astro.config.mjs` to enable `markua: true` in `defineDocKittyIntegrations({ … })`
  (the same shape as `diagrams: true`; see [../quickstart.md](../quickstart.md) "Enable the
  feature"). This is the **only** activation edit — every prior WP was dormant until here.
- **Files**: `example/astro.config.mjs`.
- **Validation**: the example build now wires the markua pipeline; the showcase renders each
  construct as intended.

### T042 — Playwright a11y/render specs + per-variant discriminators + FR-004 render equivalence
- Add the showcase (and the malformed page) routes to `AXE_PAGES` in `tests/a11y/routes.ts`,
  scanned in **both** colour modes (mirror the diagram/glossary entries).
- Create `tests/a11y/markua.spec.ts` (mirror `diagram.spec.ts`/`glossary.spec.ts`) with **direct
  behavioural** assertions, each locating its subject by **identity** (route + a stable
  selector), never a `.first()`/substring scan:
  - **`markua-three-form-equivalence` (FR-004 — the AUTHORITATIVE proof, named)**: for **each**
    callout class, assert the three input forms (`W>` shorthand, `{class: warning}`+`B>`,
    `{blurb, class: warning}`) produce **byte-identical rendered callout markup**. Cover **both**
    families: each of the **four Starlight-mapped classes** (tip/warning/error/information → the
    identical `starlight-aside--{tip,caution,danger,note}` block ×3 forms) **and** each of the
    **six theme classes** (aside/discussion/question/exercise/generic/center → the identical
    `<aside class="dk-callout dk-callout--{variant}">` markup ×3 forms). Compare the **normalised
    rendered fragment** of the three forms per class and assert equality. This is the **named
    assertion the SC-005 manifest maps rows 5–14 to** (T044). **WP04's mdast-level unit check
    (T016) is supplementary** — as authored it constructs already-normalised directives, an
    `f(x)==f(x)` tautology; the **only** path that exercises the real chain (WP02 blurb-carry →
    WP08 `{class:}`-fold → WP04 synonym-fold) is this **live-render** equivalence, so this is the
    authoritative FR-004 gate.
  - **`markua-theme-variant-discriminators` (per-variant, named)**: each of the **six**
    `dk-callout--{variant}` theme classes (`aside`, `discussion`, `question`, `exercise`,
    `generic`, `center`) is **present and correct** in the built HTML — an `<aside class="dk-callout
    dk-callout--{variant}">` with the expected `dk-callout__body` — so a **single broken variant
    goes red**, not manifest-vacuously-green.
  - **`markua-icon-render` (FR-009 positive render, named)**: `{icon: fa-lightbulb}` (a mapped
    seed name) **emits the icon** — a `dk-callout__icon` child on a theme callout (or the resolved
    Starlight `<Icon>` on a mapped class routed to hast) — in the built HTML. (FR-010's
    unmapped-drop warning is named separately in T043; this names FR-009's positive half, which
    was otherwise unasserted.)
  - **`markua-nested-aside` (row 3, named)**: the nested `{aside}`-inside-`{aside}` from T039
    renders as an aside **containing** a nested aside in the built HTML (wiring-level nesting proof
    beyond WP02's unit test).
  - **figures** carry the correct `alt` (from `{alt:}`) and a `<figcaption>` = bracket text; the
    local figure is optimised, the `{width:}` applied (US2);
  - **callouts/asides mapped target** — a `T>` (attribute-free) yields a Starlight
    `starlight-aside--tip` (the **ordering lock**, non-vacuity discriminator #1); a `D>` yields a
    **theme** `dk-callout--discussion` (discriminator #2, proving the theme-hast path, not a
    vacuous aside);
  - **heading-in-aside absent from the ToC** — assert an internal aside heading is **not** in the
    on-this-page nav while still present (demoted `role="heading"`) in the document (proves WP06);
  - **crosslink resolution** — `[go](#intro)`/`[span](#ipsum)` reach their targets (coverage rows
    27–31, the render half WP09 handed off);
  - **axe** reports **zero new violations** on the fixture pages in both modes (NFR-004).
- **Non-vacuity `guardRoots`**: wire selectors a construct-free page could not satisfy (the
  `starlight-aside--tip`, each `dk-callout--{variant}` theme class, and a `figure.dk-figure`
  discriminator) so a regression goes **red**, not vacuously green (the M5/glossary lesson).
- **Files**: `tests/a11y/routes.ts`, `tests/a11y/markua.spec.ts`.
- **Validation**: `pnpm test:a11y` green **in the pinned container** for the visual baseline; the
  named `markua-three-form-equivalence`, per-variant, icon-render, and nested-aside assertions and
  the non-vacuity guards all fire.

### T043 — Build assertions in `assert-build-artifacts.mjs` (the named non-fakeable gates)
- Extend `src/scripts/assert-build-artifacts.mjs` (browser-free, over the built `dist`):
  - **Ordering lock**: a `T>` in the showcase renders `starlight-aside--tip` in the built HTML
    (fails loudly on a plugin reorder).
  - **Figure round-trip (identity-anchored, not a substring scan)**: locate the **specific**
    palm-trees figure by its **identity** — the `<img>` whose enclosing `<figure>` has the
    `figcaption` "Palm Trees" (or its `src` ends `palm-trees.svg`) — mirroring
    `tests/a11y/diagram.spec.ts`'s identity-based-locator convention (no `.first()`, no scanning
    the whole built HTML for the substring `"width:75%"` anywhere). On **that same** final
    optimised `<img>` assert **both** `style="width:75%"` (or the folded equivalent) **and** the
    `{alt:}` value — proving the markua figure ran **before** `rehypeImages` and both properties
    survived the `__ASTRO_IMAGE_` marker together (NFR-004; contract IC-03 spike).
  - **No new client script (NFR-005)**: assert the showcase adds **no new client-side JavaScript**
    beyond the baseline (asides/callouts/figures/ids ship none) — mirror how the diagram lane
    checks footprint.
  - **SC-003 preset-off portability (the REAL gate = literal-text)**: build/render the **same
    corpus with `markua` off** (the defined "plain Markdown host" surface) and assert every Markua
    line renders as **sensible literal text** — `A>`/`{blurb}`/`{…}`/line-prefix lines read as
    plain text, never broken markup. **This literal-text assertion is the load-bearing SC-003
    gate.** Also grep that no raw `:::` directive leaks — **but note this grep is vacuous on its
    own**: with the preset off the normaliser never runs, so `:::` is never emitted regardless, so
    the `:::`-leak grep proves nothing about portability. Keep it as a cheap belt-and-braces, but
    portability rests on the **literal-text** assertion, not the `:::` grep.
  - **NFR-002 build-exits-0**: with `markua-malformed.md` present, assert the build **exits 0**
    (assert the build *result*), and that the expected warnings appear (the unknown-icon warning
    naming `fa-obscure-name`; an unbalanced-wrapper degradation).
- **Files**: `src/scripts/assert-build-artifacts.mjs`.
- **Validation**: `pnpm build && pnpm assert:artifacts` green; each named gate present and
  failing-red on a deliberate regression (spot-check one).

### T044 — Coverage-matrix denominator (SC-005) + base-render fidelity (NFR-001)
- **SC-005 (non-gameable, per-row specificity)**: a machine-checkable **manifest** maps **each of
  the 35 coverage-matrix rows** → (a) its fixture occurrence **and** (b) the **specific named
  assertion that would FAIL if that row's behaviour regressed** — not merely "a test exists". Rows
  5–14 map to the named `markua-three-form-equivalence` assertion (T042); row 3 to
  `markua-nested-aside`; row 15 to the mapped-attribute→`dk-callout--tip`-hast assertion; row 28
  to the WP09 explicit-id-wins run; row 32 to `markua-icon-render`; row 33 to the unmapped-icon
  build warning (T043); etc. Measured against `data-model.md`'s matrix as the **explicit
  denominator** so "100%" is auditable, not self-declared.
- **Fail-RED spot-check (mirrors the T043 gate spot-check)**: prove that **at least rows 5–14,
  15, 28, and 33** each go **RED** under a deliberate regression (e.g. break one input-form's
  normalisation → the three-form equivalence assertion fails; strip the mapped-attribute routing →
  row 15 fails; disable explicit-id precedence → row 28 fails; remove the unmapped-icon warning →
  row 33 fails). A row whose "assertion" cannot be made to fail is a manifest-vacuity finding.
- Route the **FR-014 publication** check from T039 here (publication facts only — see T039);
  the "documents every construct" obligation is WP11 T047's reviewer check, not a build gate.
- **NFR-001 base-render fidelity**: confirm the existing **Markua-free** render + a11y baselines
  stay **green with zero regressions**; a Markua-free page is byte-identical (the additive
  `theme.css` selectors are unused on such pages). If the additive CSS shifts a **visual**
  baseline, regenerate the affected snapshot **only** in the pinned
  `mcr.microsoft.com/playwright:v1.62.1-noble` container (host font-AA drift), chown back +
  `pnpm install --frozen-lockfile` after — and justify the additive change (NFR-001 allows
  additive, justified baseline changes).
- **Files**: the coverage manifest/check within the a11y/e2e suite + `tests/a11y/routes.ts`.
- **Validation**: the coverage check is green and would go red if a matrix row lost its fixture or
  assertion; Markua-free baselines green.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP04, WP05, WP06, WP07, WP08, WP09** (the full render + integration seam; WP02/WP03
arrive transitively). Land every approved dep lane onto `feat/markua-syntax-support` first, then
cut this lane so the whole pipeline is present — this is the integration point; expect to run the
full `ci-ok` here with the seam live. Implement with
`spec-kitty agent action implement WP10 --agent claude`.

## Definition of Done

- `markua-showcase.md` (+ `palm-trees.svg`) exercises **every coverage-matrix row (1–35)** and
  doubles as the FR-014 author page; `markua-malformed.md` triggers each cannot-fail case.
- `example/astro.config.mjs` has `markua: true` — the atomic on-switch; every earlier WP stayed
  dormant until here.
- `tests/a11y/markua.spec.ts` + `AXE_PAGES` scan both modes with the named assertions:
  **`markua-three-form-equivalence`** (FR-004 authoritative render proof, per class, both
  families), **per-variant** `dk-callout--{variant}` discriminators (all six), **`markua-icon-render`**
  (FR-009 positive), **`markua-nested-aside`** (row 3), plus ToC-exclusion, figure alt/caption,
  crosslink resolution, and **non-vacuity** guards (`starlight-aside--tip`, each theme variant,
  `figure.dk-figure`); axe zero new violations (NFR-004).
- `assert-build-artifacts.mjs` carries the named gates: `T>`→`starlight-aside--tip` ordering lock,
  the **identity-anchored** `width:75%`-AND-`alt` `__ASTRO_IMAGE_` round-trip on the palm-trees
  `<img>` (no substring scan), no-new-client-JS, **SC-003 preset-off literal-text portability**
  (the `:::`-grep noted as vacuous), and the malformed-fixture **build-exits-0** (NFR-002).
- SC-005 manifest maps **all 35 rows → a specific failing-on-regression assertion** (not "a test
  exists"), with a **fail-RED spot-check on rows 5–14, 15, 28, 33**; FR-014 **publication** check
  green (the "documents every construct" check is WP11 T047); NFR-001 Markua-free baselines green
  (any visual regen done in the pinned container, justified).
- **Full `ci-ok` green** with the seam live.

## Risks / Reviewer guidance

- **This is the only WP that turns the feature on** — confirm no earlier WP shipped a
  `markua: true` or a fixture (each earlier WP stayed dormant; the corpus was byte-identical until
  here).
- **FR-004 is proven by live render here, not by WP04's unit test** — `markua-three-form-equivalence`
  is the authoritative proof (WP02 blurb-carry → WP08 `{class:}`-fold → WP04 synonym-fold is only
  exercised live); WP04 T016 constructs already-normalised directives (an `f(x)==f(x)` tautology)
  and is supplementary. A missing per-class render-equivalence assertion is a finding.
- **Non-vacuity (the M5/glossary lesson)** — the a11y guards must go **red** on a construct-free
  page; the `T>`→`starlight-aside--tip` mapped path and the **six** `dk-callout--{variant}` theme
  discriminators prove the distinct render paths, not a vacuous aside count. Locate every subject
  by **identity** (route + stable selector), never `.first()`/substring.
- **SC-005 manifest must fail-RED per row** — a row mapped to "a test exists" that cannot be made
  to fail is vacuous; the rows 5–14/15/28/33 fail-RED spot-check is the guard.
- **SC-003 rests on literal-text, not the `:::` grep** — the `:::`-leak grep is vacuous in the
  preset-off build (the normaliser never runs); the load-bearing gate is that Markua lines render
  as sensible literal text.
- **Assert the build RESULT for NFR-002** — the malformed fixture must prove the build **exits 0**
  (not merely that the page renders); a page-only check misses a build that failed elsewhere.
- **Before-`rehypeImages` proof** — the `width:75%` `__ASTRO_IMAGE_` round-trip is the concrete
  proof WP07 ran before optimisation; a missing `style`/`alt` on the final `<img>` is the exact
  ordering regression.
- **SC-005 denominator is `data-model.md`** — measure against the 35-row matrix, not a
  self-declared percentage; a row without a fixture+assertion is an SC-005 gap.
- **Container baselines** — regenerate visual snapshots only in the pinned Playwright container;
  chown back + `pnpm install --frozen-lockfile` after (lane-hygiene).

## Activity Log

- 2026-08-29T13:00:27Z – claude – shell_pid=3778266 – BLOCKED by WP02 integration defect found at the on-switch. Building the example with markua:true (exit 0) surfaced that src/lib/remark/markua-normalise.ts corrupts any page carrying a callout/aside/wrapper marker: renderRaw re-parses the LOSSY reconstructParagraphText output for every raw paragraph, so (D1) lone image nodes (no text children) reconstruct to empty and are DROPPED -> figures vanish (US2 rows 16-26); (D2) inline links lose their URL ([t](#id)->plain text), and **bold**/`code` lose their markers -> crosslink resolution (US3 rows 27-31) and prose fidelity break. Isolation proven: a marker-FREE page renders figures (dk-figure, width:75% survives the __ASTRO_IMAGE_ round-trip) and links correctly; adding one T> to the same page drops the figure and kills the links. This violates normaliser-block-detection.md ('only Markua line-prefix and wrapper-marker paragraphs are candidates for conversion' -> non-marker paragraphs must pass through verbatim). Callouts themselves render correctly (10 classes x 3 forms byte-identical, nested aside, icon, ToC-exclusion, T>->starlight-aside--tip all verified). Coverage matrix (callouts+figures+crosslinks on one showcase page, SC-005) is UNSATISFIABLE and honest green ci-ok is unreachable until WP02 is fixed. Recommended fix (WP02 surface, outside frontend-freddy/WP10): in markua-normalise.ts treat every non-marker paragraph as OPAQUE (store+placeholder the original mdast node like non-paragraph nodes) instead of reconstruct+reparse, so only marker-bearing paragraphs are converted. Committed: verification corpus (markua-showcase.md full matrix + nested aside, markua-malformed.md, palm-trees.svg) + example on-switch (a90400c). NOT moved to for_review; a11y specs + build gates authored-pending the WP02 fix. Also fixed a self-inflicted fixture nit (figure {attrs} needs a blank line above the image).
- 2026-08-29T13:27:00Z – claude – shell_pid=3778266 – RESOLVED via authorized OUT-OF-MAP integration fix (owned by WP10, not by reopening WP02). Fixed src/lib/remark/markua-normalise.ts buildLineStream: every NON-marker paragraph is now OPAQUE (original mdast node stored + placeholder, like code/blockquote/heading), instead of reconstruct-to-text-and-reparse. Only a paragraph that actually bears a Markua marker (line-prefix ^([A-Z])>(\s|$) with a recognised letter, or a {aside}/{blurb…}/{/…} wrapper line) is reconstructed and run through the state machine — matching normaliser-block-detection.md line 20. Exported API/types unchanged (RECOGNISED_LETTERS/LETTER_TO_CLASS/CLASS_TO_DIRECTIVE + plugin signature intact; WP04/WP08 unaffected). Regression test added (src/tests/markua-normalise.test.ts, 'non-marker paragraphs survive verbatim on a callout page (D1/D2)'): a page with an A> aside + a lone image + a prose paragraph with [x](#y)+**bold**+`code` — asserts the image node survives (D1) and the link/strong/inlineCode survive verbatim (D2) while the aside still converts. VERIFIED: 526/526 vitest pass; example builds markua ON (exit 0) with figures rendering on the callout showcase (dk-figure, width:75% __ASTRO_IMAGE_ round-trip, alt preserved) and in-content crosslinks resolving; assert:artifacts PASS (markua gates + 19 SC-005 groups, rows 5-14/15/28/33 fail-RED spot-checked); assert:markua PASS (NFR-002 cold-build warning + SC-003 preset-off literal-text portability); markua.spec.ts 48/48 (both modes); axe on both markua pages clean (both modes); eslint clean. NFR-001 base fidelity: markua-free pages early-return unchanged (byte-identical no-op vitest test green); theme.css untouched. Deferred to CI/pinned container: full test:a11y visual baselines (host font-AA drift; my specs carry NO visual snapshots) — a pre-existing local Deck axe discrepancy is unrelated (deck code/route untouched).

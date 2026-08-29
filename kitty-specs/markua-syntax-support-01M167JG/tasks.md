# Tasks: Markua syntax support (subset)

**Branch**: `feat/markua-syntax-support` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

11 work packages across the plan's 8 implementation concerns (IC-00…IC-07). One gating
content WP (ADR), five foundational plugin/substrate WPs, a theme-surface WP, an icon WP, a
verification-only crosslink WP, one terminal atomic on-switch, and one docs-of-record WP.
**Every WP before WP10 is dormant** — the markua preset is **OFF by default**, no plugin is
registered into a live pipeline until WP08 wires it (still off) and WP10 flips `markua: true`
on the example, so the corpus is **byte-identical** and `ci-ok` stays green at every boundary
(FR-011, NFR-001). The attribute-list plugin is owned **whole** by WP08 (parse + span + id
write); WP09 (crosslink) is **test-only** and never re-edits it. `config.ts` is a **single-owner**
seam in WP08. `theme.css` is single-owned by WP05.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Land ADR-0030 to `docs/adr/`; flip Status Proposed→Accepted; `doc_status: active` | WP01 | |
| T002 | Repoint the `normaliser-block-detection.md` back-link to the `docs/adr/` path | WP01 | |
| T003 | Doc-sanity gate + no-code guarantee (ADR number consistency if shifted) | WP01 | |
| T004 | Line classifier + fence-state machine (`markua-normalise.internal.ts`) | WP02 | [P] |
| T005 | Line-prefix run recognition + termination + inner-content compile | WP02 | |
| T006 | Wrapper recognition: balanced nesting, attr-above-wrapper, unbalanced degradation | WP02 | |
| T007 | The mdast remark-plugin wrapper (`markua-normalise.ts`) + fence/blockquote safety | WP02 | |
| T008 | Non-fakeable vitest matrix (fence-suppresses-line-prefix, unterminated-fence-at-EOF, …) | WP02 | |
| T009 | `icon-map.ts` entry shape + curated seed set (~18 rows, targets verified vs Starlight 0.32.6) | WP03 | [P] |
| T010 | `resolveIcon` lookup + graceful-drop + build warning (build exits 0) | WP03 | |
| T011 | Icon vitest: mapped-hit, unmapped-miss-with-warning, purity | WP03 | |
| T012 | Pure class → target mapping (`markua-callouts.internal.ts`), unknown-class→generic | WP04 | |
| T013 | Attribute-aware routing: mapped-class-with-`{#id}`/`{icon:}` → theme callout | WP04 | |
| T014 | Emission (native aside vs theme callout) + `resolveIcon` call site | WP04 | |
| T015 | First-heading title + no-client-JS + totality | WP04 | |
| T016 | Callout vitest: class table, three-way equivalence, attr routing, icons, unknown-class | WP04 | |
| T017 | A11y of emitted callout hast (role/aria/contrast; no client JS) | WP05 | |
| T018 | `--dk-callout-*` tokens + per-variant callout rules in `theme.css` | WP05 | |
| T019 | `dk-figure` figure styling in `theme.css` (align/caption classes WP07 emits) | WP05 | |
| T020 | A11y bar (WCAG 2.2 AA both modes) + ToC-demotion interaction note | WP05 | |
| T021 | The demotion rehype pass (`markua-toc-demote.ts`) | WP06 | [P] |
| T022 | Ordering (before rehypeHeadingIds/CollectHeadings) + a11y preservation (role/aria-level) | WP06 | |
| T023 | Spike disposition: prove-early-enough + non-ATX-heading fallback note | WP06 | |
| T024 | ToC-demote vitest: in-callout demoted, outside untouched, nested, id-preserved | WP06 | |
| T025 | Figure rehype skeleton + `safeHref` reuse (`markua-figure.ts`) | WP07 | [P] |
| T026 | Field mapping (caption vs alt, sizing, align, class, title, empty-safe fallback) | WP07 | |
| T027 | Ordering: run BEFORE rehypeImages, wrap keeping `src` intact | WP07 | |
| T028 | Figure vitest: shape, caption-vs-alt, sizing, align, safeHref rejection, src-intact | WP07 | |
| T029 | `{…}` grammar parse (`markua-attributes.internal.ts`); non-parsing → text | WP08 | |
| T030 | Block-form attach + keys-honoured-per-target; consumed paragraph removed | WP08 | |
| T031 | Span forms (`[text]{#id}`, `word{#id}`) → `<span id>` | WP08 | |
| T032 | Attr-above-wrapper-container + three-way-equivalence reconciliation | WP08 | |
| T033 | `config.ts`: markua flag + single directive owner + prepend + pinned order | WP08 | |
| T034 | `createPageProcessor`/`OnThisPage` markua-unaware forward-rule note | WP08 | |
| T035 | Attribute vitest + committed config byte-identical-when-off assertion | WP08 | |
| T036 | Span-form + block-id shape unit tests (imports WP08 plugin) | WP09 | |
| T037 | Explicit-id-wins: RUN real rehypeHeadingIds over a colliding `{#overview}` tree — explicit survives + sibling gets auto-slug (no citation-only proof) | WP09 | |
| T038 | Resolution-scope note + hand-off to WP10 render lane | WP09 | |
| T039 | Full-surface showcase fixture (doubles as FR-014 author page) + local SVG | WP10 | |
| T040 | Deliberately-malformed fixture (unbalanced wrapper, unknown icon, unsupported attr) | WP10 | |
| T041 | Turn the preset ON (`example/astro.config.mjs` `markua: true`) | WP10 | |
| T042 | Playwright a11y/render specs + `AXE_PAGES` non-vacuity gate (both modes) | WP10 | |
| T043 | Build/render gates: three-form equivalence, per-variant + icon discriminators, ordering lock, identity-anchored figure round-trip, no-new-JS, SC-003 literal-text portability, malformed-exits-0 | WP10 | |
| T044 | SC-005 per-row fail-RED assertion manifest (spot-check rows 5–14/15/28/33) + nested-`{aside}` fixture + NFR-001 base-render fidelity | WP10 | |
| T045 | `docs/architecture/markua.md` (supported subset + limits) | WP11 | [P] |
| T046 | Close design-readiness item 7 | WP11 | |
| T047 | Reconcile docs of record + doc-sanity + FR-014/SC-006 close | WP11 | |

## Work Packages

### WP01 — Land ADR-0030 into docs of record  *(IC-00 · ~110 lines)*
- **Goal**: Land the drafted ADR-0030 to `docs/adr/`, flip Status to **Accepted**
  (`doc_status: active`), and repoint the block-detection back-link — recording the ratified
  approach + pinned rules before code (FR-013, SC-006).
- **Priority**: P1 (gating). **Depends on**: none.
- **Independent test**: `doc-sanity` green on the new ADR + edited contract; `git diff --stat`
  shows only the two owned files (no code).
- **Implementation sketch**: copy the `contracts/` draft → `docs/adr/0030-…`, flip Status, drop
  the draft-placement note, fix relative links from the new depth; repoint the contract back-link.
- **Included subtasks**: T001 Land ADR + flip Status (WP01) · T002 Repoint back-link (WP01) ·
  T003 Doc-sanity + no-code (WP01).
- **Parallel/Dependencies/Risks**: precedes all; runs in parallel with nothing (root). Risk: the
  ADR number may shift from `0030` — keep filename/heading/title/back-link consistent.

### WP02 — Block-detection normaliser  *(IC-01 core · ~180 lines)*
- **Goal**: Compile Markua line-prefix runs + `{aside}`/`{blurb}` wrappers into `containerDirective`
  nodes per the pinned block-detection contract; an mdast-level remark plugin, total (never throws).
- **Priority**: P1 (substrate). **Depends on**: WP01.
- **Independent test**: vitest — the nine named contract cases incl. `fence-suppresses-line-prefix`
  and `unterminated-fence-at-EOF` (letter-prefix, not bare `>`); Markua-free tree passes unchanged.
- **Implementation sketch**: pure classifier + run/wrapper state machine in `*.internal.ts`; thin
  hand-rolled mdast walk in `.ts`; inner Markdown re-compiled with pinned `unified`/`remark-parse`.
- **Included subtasks**: T004 Classifier + fence state (WP02) · T005 Line-prefix run (WP02) ·
  T006 Wrappers/nesting/degradation (WP02) · T007 mdast plugin wrapper (WP02) · T008 Non-fakeable
  vitest (WP02).
- **Parallel/Dependencies/Risks**: parallel with WP03/WP06/WP07 after WP01. Risk: fence suppression
  + attribute-boundary correctness; **no attribute parsing here** (WP08 owns `{…}`).

### WP03 — Icon seed map + graceful-drop lookup  *(IC-05 · ~120 lines)*
- **Goal**: Curated FA→Starlight seed map + `resolveIcon` with graceful-drop-plus-build-warning
  (build exits 0). Pure standalone module; the single icon plumbing added later.
- **Priority**: P3 (cosmetic) but lands **early** — WP04 imports `resolveIcon`.
- **Independent test**: vitest — mapped hit; unmapped miss → `undefined` + warning, no throw;
  no-`fa-`-prefix → unmapped; purity.
- **Implementation sketch**: `IconMapEntry` + ~18-row map (targets verified vs Starlight 0.32.6) +
  `lookup`/`resolveIcon` in `src/lib/markua/icon-map.ts`.
- **Included subtasks**: T009 Entry shape + seed set (WP03) · T010 `resolveIcon` + graceful drop
  (WP03) · T011 Icon vitest (WP03).
- **Parallel/Dependencies/Risks**: parallel with WP02/WP06/WP07 after WP01. Risk: a seed row
  pointing at a non-existent Starlight icon — drop/correct it. **Owns only `icon-map.ts`.**

### WP04 — Callout-mapping plugin  *(IC-02a · ~180 lines)*
- **Goal**: The single emission owner — resolve each directive to a Starlight native aside (4 mapped
  classes) or emitted `dk-callout--{variant}` hast (6 theme classes, mirroring `diagram-figure.ts`);
  attribute-tradeoff routing; carry `icon` from the start and resolve it via WP03.
- **Priority**: P1 (US1 flagship). **Depends on**: WP02 (directives) + WP03 (`resolveIcon`).
- **Independent test**: vitest on synthetic directives — class→target table, three-way equivalence
  output, mapped+`{#id}`/`{icon:}`→theme routing, icons, unknown-class→generic.
- **Implementation sketch**: pure `*.internal.ts` mapping + routing + emission; thin hand-rolled
  walk in `.ts`; `resolveIcon` the single icon call site; native path emits `note/tip/caution/danger`
  only.
- **Included subtasks**: T012 Class→target (WP04) · T013 Attr-aware routing (WP04) · T014 Emission +
  icon (WP04) · T015 Title + totality (WP04) · T016 Callout vitest (WP04).
- **Parallel/Dependencies/Risks**: after WP02+WP03. Risk: mapped+attr **must** route to the
  `dk-callout` hast (else `remarkAsides` discards it); pin the `dk-callout--{variant}` DOM contract WP05 styles.

### WP05 — Callout theme styling (--dk-callout-* tokens + CSS + a11y)  *(IC-02b · ~150 lines)*
- **Goal**: All markua `theme.css` — the `--dk-callout-*` token family + `.dk-callout*` rules for
  the **emitted** theme-callout hast (there is **no** `Callout.astro`; the four-carrier
  `components` lock forecloses a component — WP04 emits the DOM as raw hast) **and** the
  `dk-figure` figure styling (single owner of `theme.css`), with the a11y bar of the emitted DOM.
- **Priority**: P1. **Depends on**: WP04 (emitted `dk-callout--{variant}` DOM contract). Figure
  class names are contract-fixed (no code dep on WP07).
- **Independent test**: `astro check` clean; the six `dk-callout--{variant}` rules present; WP10 runs
  axe on the live corpus in both modes (authoritative a11y gate).
- **Implementation sketch**: additive `theme.css` `--dk-callout-*` tokens + `.dk-callout*` rules for
  callouts and figures; a11y verification of WP04's emitted hast (role/aria/contrast). No `.astro`.
- **Included subtasks**: T017 A11y of emitted callout hast (WP05) · T018 Callout tokens/rules (WP05) · T019 Figure CSS
  (WP05) · T020 A11y bar + demotion note (WP05).
- **Parallel/Dependencies/Risks**: after WP04. Risk: NFR-005 (no client JS); additive CSS may need
  a visual-baseline regen (owned by WP10, pinned container). **Only WP editing `theme.css`.**

### WP06 — ToC heading-exclusion demotion pass  *(IC-02c bounded spike · ~150 lines)*
- **Goal**: A user rehype pass (before `rehypeHeadingIds`/`rehypeCollectHeadings`) that demotes
  in-callout/aside ATX headings to `role="heading"` + `aria-level` non-heading elements — out of
  the ToC, still a heading to assistive tech (FR-001, NFR-004).
- **Priority**: P1. **Depends on**: WP01 (authored on synthetic hast).
- **Independent test**: vitest — in-container demoted (role/aria-level/level/children/id preserved);
  outside untouched (FR-008); nested. Integration proof (real ToC omission) is WP10.
- **Implementation sketch**: hand-rolled hast walk matching Starlight-aside + `dk-callout`
  containers; document the before-collection ordering; record the spike disposition + fallback.
- **Included subtasks**: T021 Demotion pass (WP06) · T022 Ordering + a11y (WP06) · T023 Spike
  disposition + fallback (WP06) · T024 ToC-demote vitest (WP06).
- **Parallel/Dependencies/Risks**: parallel with WP02/WP03/WP07 after WP01. Risk: the pass must
  precede heading collection (else vacuous); match the real container classes; fallback = restrict
  aside bodies to non-ATX-headings if demotion proves fragile.

### WP07 — Figure images rehype  *(IC-03 · ~180 lines)*
- **Goal**: Rewrite `![caption](src)` → accessible `<figure>` via `astro:assets`; caption = bracket
  text, alt from `{alt:}`/empty-safe, sizing/align/class/id; runs **before `rehypeImages`** keeping
  `src` intact; `safeHref`-guarded (FR-005, FR-006).
- **Priority**: P1 (US2). **Depends on**: WP01 (authored on synthetic hast).
- **Independent test**: vitest — figure shape, caption-vs-alt, empty-safe fallback+warn, sizing,
  align, class/id, safeHref rejection, src-intact. `__ASTRO_IMAGE_` round-trip proof is WP10.
- **Implementation sketch**: hand-rolled hast walk mirroring `rehype/diagram-figure.ts`, reusing
  its exported `safeHref`; consumes WP08's `hProperties`.
- **Included subtasks**: T025 Skeleton + safeHref (WP07) · T026 Field mapping (WP07) · T027 Ordering
  before rehypeImages (WP07) · T028 Figure vitest (WP07).
- **Parallel/Dependencies/Risks**: parallel with WP02/WP03/WP06 after WP01. Risk: before-`rehypeImages`
  is required (else alt/sizing lost); **no figure CSS here** (WP05); caption≠alt semantic.

### WP08 — Attribute-list plugin (whole) + config.ts wiring seam  *(IC-01 rest · ~200 lines)*
- **Goal**: The attribute-list plugin **whole** (`{…}` parse + `hProperties` for images, spans,
  ids) **plus** the single-owner `config.ts` seam — markua flag OFF by default, single
  `remark-directive` owner (glossary OR markua), prepend before `starlight()`, pinned plugin order.
- **Priority**: P1 (substrate + integration). **Depends on**: WP02, WP04, WP06, WP07 (`config.ts`
  imports every markua plugin; WP03 transitive via WP04).
- **Independent test**: vitest — `{…}` parse matrix, per-target honour, span forms, id write,
  attr-above-wrapper; **committed config byte-identical-when-off** assertion (the `diagrams:false`
  twin).
- **Implementation sketch**: pure `{…}` parse in `*.internal.ts`; hand-rolled mdast walk in `.ts`;
  hoist `remarkDirective` out of glossary into a shared gated owner; `markuaIntegration` prepended;
  pinned remark (`normalise→attributes→callouts`) + user-rehype (`figure`,`toc-demote`) order.
- **Included subtasks**: T029 `{…}` parse (WP08) · T030 Block-form attach + honour (WP08) · T031 Span
  forms (WP08) · T032 Attr-above-wrapper (WP08) · T033 `config.ts` seam (WP08) · T034
  `createPageProcessor` forward-rule note (WP08) · T035 Attribute vitest + config assertion (WP08).
- **Parallel/Dependencies/Risks**: the integration convergence point — land approved deps first,
  then cut this lane. Risk: single directive owner (no double/none registration); prepend order;
  preset-OFF byte-identity; attribute plugin owned WHOLE (WP09 must not re-edit it). **Only WP
  editing `config.ts`.** *(7 subtasks — the largest WP; within the 10/700 cap.)*

### WP09 — Crosslink ids verification (test-only)  *(IC-04 · ~110 lines)*
- **Goal**: Verify explicit-id-wins precedence (native), the span forms, and auto-id preservation —
  **no source edit** (the parser is WP08's).
- **Priority**: P2. **Depends on**: WP08 (imports the attribute plugin it verifies).
- **Independent test**: vitest — span/block-id shapes; explicit-id-wins via the real
  `rehypeHeadingIds` rule (cited to `rehype-collect-headings.js:52`); auto-id preserved (FR-008).
- **Implementation sketch**: one test file exercising WP08's plugin; render-time resolution
  (DOM rows 27–31) handed to WP10.
- **Included subtasks**: T036 Span/block-id tests (WP09) · T037 Precedence + auto-id (WP09) · T038
  Resolution-scope note + WP10 hand-off (WP09).
- **Parallel/Dependencies/Risks**: after WP08. Risk: prove precedence against the **real** pass, not
  a hand-rolled slugger; **must not** edit `markua-attributes*.ts` (the IC-01/IC-04 overlap fix).

### WP10 — Verification corpus + gates (atomic on-switch)  *(IC-06 · ~210 lines)*
- **Goal**: Flip `markua: true`; land the full-matrix showcase (doubles as FR-014 page) + malformed
  fixture; Playwright a11y/render specs with non-vacuity guards; the named build gates. Coverage
  measured against the `data-model.md` 35-row matrix (SC-005 non-gameable).
- **Priority**: P1 (terminal). **Depends on**: WP04, WP05, WP06, WP07, WP08, WP09.
- **Independent test**: full `ci-ok` with the seam live — ordering lock (`T>`→`starlight-aside--tip`),
  figure `width:75%` `__ASTRO_IMAGE_` round-trip, SC-003 preset-off no-leak, malformed
  build-exits-0, ToC exclusion, axe zero-new-violations; SC-005 denominator green.
- **Implementation sketch**: showcase + malformed fixtures + local SVG; `astro.config.mjs` on;
  `markua.spec.ts` + `AXE_PAGES`; assertions in `assert-build-artifacts.mjs`; coverage manifest.
- **Included subtasks**: T039 Showcase fixture (WP10) · T040 Malformed fixture (WP10) · T041 Preset
  on (WP10) · T042 A11y/render specs + non-vacuity (WP10) · T043 Build gates (WP10) · T044 SC-005
  denominator + NFR-001 fidelity (WP10).
- **Parallel/Dependencies/Risks**: the integration + activation point (after the full seam). Risk:
  the only WP that turns the feature on; assert the build **result** for NFR-002; non-vacuity guards
  must go red on a construct-free page; regen visual baselines only in the pinned container.

### WP11 — Author subset doc + docs of record  *(IC-07 · ~130 lines)*
- **Goal**: `docs/architecture/markua.md` (supported subset + **limits**, C-006) + close
  design-readiness item 7; records the decision alongside ADR-0030 (FR-014, SC-006). Content-only.
- **Priority**: P2. **Depends on**: WP01 (links the ADR). Runs in parallel with the render concerns.
- **Independent test**: `doc-sanity` green; `git diff --stat` shows only the two owned files.
- **Implementation sketch**: architecture doc-of-record from the data-model/contracts; mark
  design-readiness item 7 closed; reconcile with the shipped design (incl. any WP06 fallback).
- **Included subtasks**: T045 `markua.md` (WP11) · T046 Close design-readiness (WP11) · T047
  Reconcile + FR-014/SC-006 close (WP11).
- **Parallel/Dependencies/Risks**: parallel with everything after WP01. Risk: document the **limits**
  not just features; agree with shipped design; the FR-014 author *page* is the WP10 showcase (this
  WP does not edit it).

## Dependencies

```
WP01 (ADR)
 ├─ WP02 (normalise) ─┐
 ├─ WP03 (icon-map) ──┴─ WP04 (callouts) ─ WP05 (theme.css styling + a11y) ─┐
 ├─ WP06 (toc-demote) ───────────────────────────────────────────────────────┤
 ├─ WP07 (figure) ───────────────────────────────────────────────────────────┤
 ├─ WP08 (attributes + config seam) ← WP02, WP04, WP06, WP07                  │
 │        └─ WP09 (crosslink ids, test-only) ─────────────────────────────────┤
 └─ WP11 (docs of record)                                                     │
                                              WP10 (verify + on-switch) ← WP04, WP05, WP06, WP07, WP08, WP09
```

- **WP01** is the gating ADR (no code deps) and precedes everything.
- **Foundational layer (parallel after WP01)**: WP02 (normalise), WP03 (icon-map), WP06
  (toc-demote), WP07 (figure). WP04 (callouts) follows WP02+WP03; WP05 (theme surface) follows WP04.
- **WP08** is the single-owner integration seam — it depends on every plugin `config.ts` imports
  (WP02, WP04, WP06, WP07; WP03 transitively) and hoists the shared `remark-directive` owner.
- **WP09** (crosslink, test-only) follows WP08. **WP11** (docs) parallels the render concerns after
  WP01.
- **WP10** is the terminal atomic on-switch — it flips `markua: true` and runs the full `ci-ok`
  with the live seam, after the entire render + integration surface (WP04–WP09).
- **Dormancy invariant**: nothing renders differently until WP10; the preset is OFF and every prior
  WP keeps the corpus byte-identical (FR-011, NFR-001).

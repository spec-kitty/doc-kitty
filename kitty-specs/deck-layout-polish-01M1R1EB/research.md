# Research — Deck & Layout Polish (Phase 0)

All three defects were re-verified reproducing on `main` @ 7531919 with a Playwright +
chromium pixel pass (evidence: `scratchpad/before/*.png`, harness `scratchpad/shots.mjs`).
Key measurements: demo slide ~1.05:1 (identical in light and dark emulation → deck has no
theme mechanism); title slide content 817px on a ~700px stage; `.main-pane` grows to
1312/1632/2272px at 1600/1920/2560 while the reading column stays ~720px pinned left.

## D-01 — How to give the out-of-frame deck a theme mechanism

**Decision**: Add a `@media (prefers-color-scheme: dark)` block to the **deck-only**
sheet `src/styles/dk-reveal-theme.css` that re-declares the dark `--dk-color-*` palette
(and thus the `--dk→--r` map resolves to dark). The deck follows the OS/browser scheme;
no toggle in v1.

**Rationale**:
- `dk-reveal-theme.css` is imported with `?url` **only** by `DeckLayout` (route-import
  isolation, ADR-0022 D5). A rule added here reaches the deck route and nothing else →
  satisfies **C-001** (route-isolated, separable from chrome) and **C-002** (in-frame
  Starlight pages never load this sheet, so their Light/Dark/Auto is untouched).
- Pure-CSS (no script) means the deck themes correctly on first paint with **no FOUC** and
  works for no-JS readers — better than a data-theme-setting head script.
- The deck's existing `--dk→--r` map already reads `--dk-color-*`; redeclaring those under
  the media query flips the whole deck (background, text, headings, links, surfaces,
  diagrams) for free.

**Alternatives considered**:
- *Head script sets `:root[data-theme='dark']` from `matchMedia`* — DRYer (reuses
  theme.css's dark block verbatim, zero duplication) but adds a blocking script, risks
  FOUC, fails no-JS, and couples deck theming to a script rather than the deck sheet.
  Rejected in favour of the CSS approach; separability is better served by the sheet.
- *Add `prefers-color-scheme` to the shared `theme.css`* — violates C-001 (would live in
  the chrome layer) and risks in-frame regressions. Rejected.

## D-02 — Reconciling C-001 (route-isolated) with C-003 (single-source dark tokens)

**Tension**: D-01 duplicates the dark `--dk-color-*` values into `dk-reveal-theme.css`,
while C-003 says "reuse the existing dark catalog; do not fork a second colour source."

**Decision**: Keep the duplication but make it **parity-guarded** — add
`src/tests/deck-theme-parity.test.ts` that parses both sheets and asserts the deck's
`@media (prefers-color-scheme: dark)` `--dk-color-*` values are byte-identical to
`theme.css`'s `:root[data-theme='dark']` values. A drift fails the build.

**Rationale**: This is the established house pattern in this repo (the `.mjs`/`.ts` twin
parity guards, memory `doc-kitty-metadata-vocab-hub-outcome` / `adopter-loader-migration`).
It gives effectively one source of truth (enforced), satisfies C-003's intent, and keeps
C-001's route isolation. CSS has no native cross-selector mixin, so enforced parity beats
either silent duplication or a build-time preprocessor.

**Alternatives considered**: CSS `@import` of a shared dark-only partial into both sheets —
would re-introduce the shared-layer coupling C-001 forbids (the partial would be linked on
in-frame pages too). Rejected.

## D-03 — Making the demo slide legible while keeping its demonstrative purpose

**Decision**: In `showcase-deck.md`, change
`<!-- .slide: data-background-color="#101828" -->` to a theme-flipping brand **surface**
token, e.g. `data-background-color="var(--dk-color-surface-2)"`. Once the deck is
theme-aware (D-01) this surface is light in light mode / dark in dark mode, and always
pairs with the theme text token → legible both ways (FR-003, C-004, NFR-001).

**Open risk to settle in implementation**: reveal applies `data-background-color` as an
inline style on the slide-background element (`el.style.backgroundColor = value`). Modern
browsers accept a `var(...)` there and resolve it against `:root`, but this MUST be
confirmed in the AFTER pixel pass. **Fallback** if it does not resolve: give the slide a
class via `<!-- .slide: class="dk-slide-surface" -->` and define
`.dk-slide-surface, .reveal .slides section.dk-slide-surface { background: var(--dk-color-surface-2) }`
in the deck sheet (and, for reveal's separate background layer, target
`.slide-background.dk-slide-surface`). The contract (`contracts/deck-theme.md`) is written
against the *observable* outcome (legible in both schemes) so either mechanism satisfies it.

## D-04 — Stage-bounded slide content (replace the `65vh` img cap)

**Decision**: Replace `.reveal .slides section img { max-block-size: 65vh }` with a
**stage-relative** cap. reveal gives each `.slides > section` a definite pixel height (the
configured logical stage, ~700px) and centers content, so a percentage resolves against
the stage: use `max-block-size: 60%` (of the stage-sized section) — optionally
`min(60%, 65vh)` as a belt-and-suspenders bound. Combined with the title-slide reshape
(D-05) this keeps every slide within the stage (NFR-002). Exact percentage tuned in the
pixel pass; the assertion is "title-slide content height ≤ stage height, nothing clipped."

**Rationale**: `vh` is the browser viewport, not reveal's transform-scaled stage — the
root cause of the overflow. A percentage of the definite-height section tracks the stage.

## D-05 — Title-slide reshape

**Decision**: In `showcase-deck.md`, insert a `##` heading (e.g. `## Out-of-frame deck
pipeline`) immediately BEFORE the current intro paragraph. The deck-split transform
(`deck-split.internal.ts`) appends only pre-`##` content to the synthesized title slide,
so after this edit the title slide = `h1 + hero` and the intro paragraph (carrying the
`quokka showcase sentinel`) + the first pipeline diagram become their own following
horizontal slide. No transform code change is needed; the sentinel stays inside the
published `data-pagefind-body` region (FR-004, FR-008).

## D-06 — Vertical-stack affordance

**Decision**: Add an up/down control pair to `.dk-deck-controls` in `DeckLayout.astro`
(labelled `<button>`s, matching the existing AX-2 ‹/› pattern), and extend the
`DeckController` facade in `reveal-init.client.ts` to expose reveal's `availableRoutes()`
(`{left,right,up,down}`) so the client can show/hide up/down on `slidechanged` and for the
initial slide (deep-link safe). Keyboard nav is reveal's and stays on. The buttons are
wired to `deck.up()`/`deck.down()`; when no vertical route exists, up/down are hidden so no
misleading cue appears (FR-006, SC-003).

**Rationale**: reveal `controls:false` is deliberate (avoids the duplicate unlabelled
cluster). Extending our own labelled control set keeps the a11y contract and gives the
missing affordance. `availableRoutes()` is reveal 6's supported query for navigability.

**Risk**: must not disturb the `slidechanged`→diagram-render ordering (NFR-004) — the
affordance subscription is additive and reads only route availability.

## D-07 — Wide-screen cap location and selector

**Decision**: `@media (min-width: 100rem) { .main-frame { max-width: 90rem;
margin-inline: auto } }`, targeting Starlight's real `.main-frame` (verified in the built
DOM: `class="main-frame astro-…"`, full-bleed at all widths). Place the rule in a **base
global sheet** (`theme.css` or `dk-components.css`) — **NOT** `brand-components.css` as the
issue suggested.

**Rationale**: page-width capping is a base layout concern, not brand identity; a brand
swap replaces the `brand-components.css` slot entirely (memory
`doc-kitty-diagram-component-css-outcome`: component CSS was moved to a global sheet
precisely so it survives branding). Putting the cap in the base layer means an unbranded
consumer also gets it. `.main-frame` wraps `[sidebar-pane | main-pane]`, so capping +
centering the band centers sidebar+content together (the intended fix). Below 100rem the
layout is byte-unchanged.

**Risk to verify in pixel pass**: Starlight's top header may be fixed full-width; confirm
it stays visually aligned with the centered band, and if not, cap the header's inner
container to match. "Not resizable" is expected Starlight behaviour and out of scope
(C-007).

## Supply-chain (DIRECTIVE_051)

**N/A — recorded, not skipped**: this mission adds/upgrades/removes **no** dependency
(pure CSS + example content + client wiring against already-present `reveal.js`). No
registry, freshness, or lifecycle-script review is triggered. No adversarial supply-chain
evidence pass required.

## Adversarial evidence

No security-impacting dependency decision → no contested supply-chain findings to record.
The mission's own pre-PR adversarial squad (post-implementation) covers design/a11y
challenge per the mission plan.

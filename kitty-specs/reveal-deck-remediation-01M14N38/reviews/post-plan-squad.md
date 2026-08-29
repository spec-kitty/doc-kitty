# Post-Plan Brownfield Adversarial Squad — reveal-deck-remediation-01M14N38

**Point-cut**: after `/spec-kitty.plan`, before `/spec-kitty.tasks`.
**Question**: Are the plan's root-cause claims and the #15 slide-aware design correct and regression-safe against the shipped code, and does the plan account for every test/deck that must change?
**Lenses (profile-loaded, read-only)**: debugger-debbie (live-evidence / regression-catchability), reviewer-renata (anti-laziness / fakeable acceptance), paula-patterns (boundaries / seams).
**Squad verdict**: Architecture sound — **proceed to tasks with the constraints below folded in**. No release blocker; every gap is closable in the tasks phase by promoting floating contract assertions to mandatory, tightening four assertions, adding two fixtures, and pinning the reveal-init seam shape. Three lenses converged (no adjudication needed).

## Convergent findings → required fold-ins

### A. Seam shape for IC-04 (Paula HIGH ×3, mechanism confirmed by Renata)
- **A1** `initDeck()` currently returns `void` and keeps the reveal instance private (`reveal-init.client.ts:53,75`); DeckLayout renders diagrams in a separate `whenRevealReady → renderDeckDiagrams` that never receives the deck handle (`DeckLayout.astro:166-169`). The wiring genuinely needs a public-shape change.
- **A2** Export a **narrow `DeckController` facade**, NOT the raw `Reveal` object (reveal-init is deliberately the sole reveal importer; `DeckInstance` at `:39-43` is already an anti-corruption facade). Target surface: `{ onSlideChange(cb:(currentSlide:Element)=>void):void; isPrintView:boolean; currentSlide():Element|null }`.
- **A3** reveal-init is the **single owner of print state** — expose `isPrintView`; the renderer must NOT recompute `/print-pdf/gi.test(location.search)` (currently `reveal-init.client.ts:65`). Removes a whack-a-field drift hazard (DIRECTIVE_044).
- **A4** DeckLayout stays a **pure wire**: `initDeck() → controller → initDiagrams(controller)`. No slide-tracking state in DeckLayout. Initial render still gates on `.reveal.ready`; only subsequent renders ride `onSlideChange`.
- **A5** Record a short decision note (DIRECTIVE_003) for the DeckController surface and update the `reveal-init.client.ts` "private by design / only reveal importer" header comment in the same change (DIRECTIVE_037).

### B. Render-scope invariant — theme-toggle can re-open #15 (Debbie HIGH, Paula MEDIUM, Renata MEDIUM — strongest convergence)
- **B1** Today `render()` restores source + clears `data-processed` over the **whole** `nodes` set then runs once (`diagram-render.client.ts:109-117`), and the `[data-theme]` observer (`:132-135`) re-runs the whole set. In deck mode that re-runs mermaid over hidden (`display:none`, zero-box) slides → the exact #15 mis-render.
- **B2** Named invariant for tasks: **`render(scope)` restores+runs EXACTLY `scope`**; the theme observer passes the **rendered/visited set**, never `allCachedNodes`. Cache-all-sources-up-front and run-only-active-scope are two different sets and must not be conflated in one variable.
- **B3** Add contract INV + a test: toggle theme while a slide-2 diagram is **unvisited**, then navigate to it and assert a correct (non-zero, sane) render.

### C. Fakeable / missing acceptance criteria (Renata HIGH ×3 + Debbie HIGH)
- **C1 FR-004 "box>0" is a fakeable proxy** (Debbie HIGH): mermaid may emit `width="100%"`+viewBox → non-zero on BOTH buggy and fixed builds. Required: (i) prove the FR-004 test **red against the pre-fix build** (DIRECTIVE_034/041); (ii) strengthen beyond box>0 — assert a sane aspect ratio / an internal `<g>`/`<text>` node has non-zero geometry, or compare to the correctly-rendered title-slide diagram.
- **C2 FR-004 can pass vacuously on the already-working title diagram** (Renata MEDIUM): after IC-04 the deck has ≥2 `pre.mermaid`. The non-first diagram needs a **distinguishable identity**; the test must select THAT node after navigating to it.
- **C3 Print-pdf completeness has ZERO assertion** (Renata HIGH, Debbie LOW-MED): a guaranteed contract behaviour + distinct code path. Add a **mandatory** assertion: load deck with `?print-pdf`, wait for layout, assert EVERY `pre.mermaid` (title + non-first + inner-stack) has an `<svg>` with box>0 in one pass.
- **C4 Theme re-render is fakeable by a no-op** (Renata MEDIUM): "exactly one `<svg>`" passes if the toggle does nothing. Add: a palette-bearing attribute inside the `<svg>` changed to the other mode's `--dk-diagram-*` value (or `data-processed` cleared-and-reset). Do NOT copy the doc-page twin's weak assertion (`diagram.spec.ts:135`).
- **C5 Footer criterion fakeable by empty/invisible element** (Renata MEDIUM): use Playwright `toBeVisible()` + assert **non-empty textContent contains `entry.data.title`** + keep the "top edge near frame bottom" geometry check.
- **C6 FR-001 theme-applied is manual-only, excluded from FR-008, actively un-asserted** (Renata HIGH): for a P1 "first thing an adopter sees" defect. Add non-visual computed-style assertions (NO screenshots, respects C-001): viewport `backgroundColor` **equals resolved `--dk-color-bg`** (read from `:root` in the same evaluate, not merely "≠ #000"); active-slide heading `color` equals resolved text-strong token; `.reveal` `font-family` contains the brand sans; `.dk-deck-footer` background resolves to a brand surface token; title-slide `img` height ≤ reveal stage height (the R4 "hero overflow"). **Empirically confirm R4's "underdeveloped look rules" diagnosis** against the built deck first — `deck.interaction.spec.ts:237-239` comments the deck is "currently unthemed (transparent viewport)", which if still true with the sheet linked means token-map non-resolution, a different root cause.
- **C7 NFR-002 diagram-free deck footprint has no deck-level test** (Renata HIGH, Debbie LOW): existing FP-1 (`diagram.spec.ts:190-222`) covers doc-page routes only; citing the production footprint guard is circular. Make the network assertion **mandatory** and provision a **diagram-free PUBLISHED deck fixture** (showcase gains diagrams; `draft-preview.md` is a draft = different treatment, so none exists after IC-04). Assert no request URL matches `/mermaid/i` on that route.

### D. Forced edits / collisions the plan under-specifies (Debbie MEDIUM ×, Paula MEDIUM)
- **D1 `deck-split.test.ts` positional index break** (Debbie + Paula, both cite it): removing the description paragraph in `titleChildren()` (`deck-split.internal.ts:176-178`) shifts hero from `title.children[2]` → `[1]`; the FR-003 hero test at `deck-split.test.ts:59-60` breaks even though it's about hero, not description. IC-02 must update **both** the description assertion AND the positional index. (Unaffected: no-`##` test :113-127, B-05 :277-287.)
- **D2 `routes.ts` `renderCount` must stay 1** (Debbie MEDIUM): a slide-2 diagram is `display:none` at load, renders only on `slidechanged`, so it does NOT add to the load-time count. The deck axe gate `renderCount:1` (`routes.ts:191-192`) MUST stay 1 — a naive bump to 2 hangs the axe gate forever.
- **D3 `diagram.spec.ts` is the existing home of the deck-diagram / theme-toggle / footprint idioms** (Debbie MEDIUM, Renata): IC-06 names only `deck.interaction.spec.ts`. Reference `diagram.spec.ts` too (it already has `gotoDeckInMode`, the deck first-slide `toHaveCount(1)` at :115, footprint helpers) to avoid duplicated helpers and a missed constraint.
- **D4 Hash deep-link initial slide** (Debbie MEDIUM): `hash:true` (`reveal-init.client.ts:68`) means a deep-link (`…/#/2`) makes the initially-active slide NOT slide 1, and `slidechanged` does not fire for it. Ready-render must resolve `deck.getCurrentSlide()`/the `.present` leaf, not assume slide 1. Add to IC-04 edge cases.
- **D5 Vertical/nested diagram branch untested** (Renata MEDIUM, Debbie): place a diagram on an **inner stack slide** of `showcase-deck.md` (it already has a stack) and assert navigating into the stack renders that node.
- **D6 IX-3a `slideSentinels`** (Debbie): the hardcoded ordered array (`deck.interaction.spec.ts:186-192`) needs updating if a new slide is added.

### E. Lower-severity / advisory
- **E1** IC-01 CSS-leak risk mis-located (Paula LOW): `dk-reveal-theme.css` is route-only + BA-4-guarded (`assert-chrome-artifacts.mjs`); the real leak vector is `theme.css` (globally injected, also linked on deck). Restate: deck look-rules go ONLY in `dk-reveal-theme.css`, NEVER `theme.css`.
- **E2** Hub guidance (FR-006/007) — cheap DOM `toContainText` for the banner + its three topics so SC-004 isn't purely manual (Renata LOW).
- **E3** Rapid-nav coalescing (DR-4, spec edge case) asserted nowhere — a rapid-paging test that still leaves exactly one `<svg>` per node (Renata LOW).
- **E4** INV-SINGLE-OWNER (one `mermaid.run` call site) is unobservable from the DOM — enforced by code review + the (now-mandatory C7) footprint assertion (Renata/Paula).

## Preserved invariants the squad independently CONFIRMED sound
- Single `mermaid.run` call site (`diagram-render.client.ts:117`) — parameterizing *scope* is not a second entry point (Paula).
- No doc-page/deck split-brain: `config.ts:438` skips page-injected `initDiagrams()` when `main.reveal` exists (Paula).
- CSS route-isolation via `?url` + BA-4 build assertion intact (Paula).
- #15 root cause TRUE in shipped code (Debbie, cited lines).
- Supply-chain N/A — no dependency change (all three).

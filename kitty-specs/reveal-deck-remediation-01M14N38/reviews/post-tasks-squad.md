# Post-Tasks Anti-Laziness Brownfield Squad — reveal-deck-remediation-01M14N38

**Point-cut**: after `/spec-kitty.tasks` (finalized), before `/spec-kitty.analyze` + implement.
**Question**: Are the WP DoDs non-fakeable (did the post-plan hardening reach the WP prompts, not just the contracts), is the decomposition realistic, and is every WP buildable-as-written?
**Lenses (profile-loaded, read-only)**: reviewer-renata (anti-laziness / fakeable DoD), paula-patterns (decomposition realism / ownership), frontend-freddy (implementer feasibility, incl. reveal 6.0.1 API + env).
**Squad verdict**: Decomposition SOUND, WPs BUILDABLE — proceed to implement after folding the fixes below. Renata: request-changes (narrow, WP05). Paula: proceed (2 MEDIUM fold-ins). Freddy: buildable-as-written (bounded clarifications). All 12 mandated post-plan assertions were verified present in the WP DoDs (Renata's matrix). Reveal API confirmed real (Freddy): `slidechanged` carries top-level `event.currentSlide`; instance exposes `on`/`off`/`getCurrentSlide`.

## Convergent fixes to fold into the WP prompts (body/DoD only — NOT owned_files or dependencies; no re-finalize)

### F1 — WP05 T019 + `contracts/slide-aware-diagram-render.md` C1: kill the residual fakeable proxy (Renata M1 + Freddy M3-adjacent, STRONG convergence)
- STRIKE the "sane **aspect ratio**" OR-branch — a viewBox-derived aspect ratio is intrinsic to the SVG and non-zero on BOTH buggy and fixed builds (the exact C1 defect). Make **measured internal-node geometry MANDATORY**: `getBoundingClientRect()`/`getBBox()` on an internal `<g>`/`<text>` node (via `page.evaluate`), OR the title-slide-box comparison. "aspect ratio" is allowed ONLY as *rendered/measured* aspect, never viewBox-derived. Fix the same OR-list in the contract.

### F2 — WP05 RED-before-green: make it reproducible, not honor-system (Renata M2 + Paula M2 + Freddy M2, STRONGEST convergence — all three)
- The RED proof cannot be witnessed by the normal local-then-CI flow: WP05 branches downstream of WP01's fix (tree is already green), and the env's `node_modules` is broken (no `astro`/`mermaid`/`vitest`; Playwright root-owned) so no local red is possible, and CI only runs the merged (green) code.
- Specify the MECHANIC in WP05 DoD: produce red via a **throwaway CI run on a scratch branch that reverts ONLY WP01's `render(scope)` change**, and paste that job's failure into the PR/commit note — OR land the FR-004 test one commit BEFORE the WP01 fix so the red is in git history. The DoD is discharged by a *captured/reproducible* red artifact, not a prose claim. Flag to the operator that this line cannot be closed by local run.

### F3 — WP02 T006 empirical fork + WP05 T023 ordering & normalization (Paula M1 + Freddy M2, convergence)
- WP02 T006 root-cause fork (thin look-rules vs token-map non-resolution): add an **escalation clause** — "if the fix would require editing `theme.css`, STOP and escalate; it is out of every WP's ownership and mission-forbidden (E1)." (Shipped wiring suggests cause #1 / stale `deck.interaction.spec.ts:237-239` comment is the likely reality — `theme.css` `:root` tokens already cascade to the deck viewport — but the clause guards the fork.)
- WP02 must **run + record T006 against the BUILT deck first** (computed `background-color`/heading `color`); WP05 T023 then asserts equality against those recorded resolved values, **normalizing hex↔`rgb()`** (`getComputedStyle` returns `rgb()`, `getPropertyValue('--dk-color-bg')` returns `#ffffff`). Note the hard intra-mission ordering: WP05 T023 targets cannot be finalized until WP02 records T006.

### F4 — WP05 T021 theme-toggle palette assertion: use a directly-mapped attribute (Freddy M3)
- Mermaid derives some stroke/label colors via internal color math, so not every inlined attribute is byte-equal to a `--dk-diagram-*` token. Assert equality ONLY on a **directly-mapped** attribute — the node `<rect>`/`.node` `fill` (= `mainBkg`/`primaryColor` = `--dk-diagram-node-fill`), normalized; treat other attributes as "changed", not "equals". Floor to strengthen is the weak `diagram.spec.ts:135` check.

### F5 — Lower-severity buildability clarifications (fold as one-line pins)
- **WP01** (Freddy L): pin mixed-scope coalescing — pending re-render scope = **union of requested node sets** (safe superset); and extend the hand-declared `DeckInstance` interface (`reveal-init.client.ts:39-43`) to include `on`/`getCurrentSlide`.
- **WP01/WP02** (Paula L): add one sentence that the reveal-failure `.finally` fallback deliberately renders the whole document once via `initDiagrams(undefined)` — degraded-case only, NOT a #15 regression.
- **WP02** (Freddy L): pin the wiring shape — outer `let controller: DeckController | undefined; try { controller = await initDeck() } catch {} … await initDiagrams(controller)`.
- **WP01** (Renata L): add DoD line — the 3 render-behaviour items (slide-2+ first-`slidechanged`, hash deep-link via `currentSlide()`, nested-stack leaf) are NOT discharged on manual attestation; a Wave-1 reviewer approving WP01 in isolation defers their proof to WP05 T019/T020.
- **WP02** (Renata L): drop "presentable/legible" as a *checkable* DoD criterion (keep the objective token/hero checks); optionally add one structural assertion (computed `padding`/`max-inline-size` on `.reveal .slides section` non-zero).
- **WP05** (Freddy L): print-pdf T020 — poll `expect(svg).toHaveCount(n)` with timeout ≥ the 3s `whenRevealReady` fallback + layout; never read synchronously.
- **WP06** (Renata L): bind the hub `toContainText` assertions to **distinctive phrases** (the banner sentence, "Background graphics"), not short tokens ("Esc"/"S"/"print") that can match hub chrome vacuously.
- **WP04** (Freddy L): trim the `roadmap-deck.md` `description` to `validate-frontmatter.mjs` length bounds.

### F6 — Review-time verification checklist (for the implement/review loop, not WP edits)
- WP04 review: grep the built showcase deck to confirm the two new fences are on non-first/nested `<section>`s and no new top-level slide appeared (protects `routes.ts` `renderCount:1`, D2).
- WP04 review: confirm `assert-build-artifacts.mjs` has no OTHER published-set-derived assertion beyond the two `25→26` pins, and `roadmap-deck.md` `sidebar:{hidden:true}` keeps it out of BA-10 sidebar assertions.
- WP01 review: confirm the module-header decision note is a sufficient DIRECTIVE_003 record for the `DeckController` seam (or escalate to an ADR).
- WP05 is the critical-path bottleneck (8 subtasks, terminal, all-upstream fan-in): land its subtasks as separately-reviewable commits; a WP05 rejection stalls the whole terminal wave.

## Independently CONFIRMED sound (no action)
- All 6 `owned_files` file-disjoint; WP06's read-only `BASE` import is non-owning; the `/presentations/` hub route already exists in the baseline (Paula).
- Dependency graph correct + minimal: WP02→WP01 is the one real coordination seam (consumes `initDeck(): Promise<DeckController>` + `initDiagrams(controller?)`); no WP05↔WP06 dep needed (Paula + Freddy).
- `initDiagrams` optional-param is backward compatible; doc-page no-arg path + `config.ts:438` split-brain guard intact (Paula).
- Build-count pin `25→26` atomically co-owned with `roadmap-deck.md` in WP04 → no hidden cross-lane ordering; BA-4/BA-5 sentinels each localized to one owning WP (Paula).
- WP03, WP04, WP06 buildable exactly as written; reveal 6.0.1 API matches the DeckController design (Freddy).

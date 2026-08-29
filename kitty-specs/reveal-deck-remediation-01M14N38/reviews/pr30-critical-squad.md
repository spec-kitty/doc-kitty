# Fresh Critical Pre-Merge Squad — PR #30 (independent, no prior-squad input)

**Point-cut**: post-merge, pre-PR-merge, on the shipped diff `main..fix/reveal-deck-remediation`.
**Question**: do the changes actually fix #12/#15 without regressions or hollow proofs?
**Lenses (profile-loaded, read-only, barred from reading prior reviews/*)**: reviewer-renata (hollow/fakeable proofs), paula-patterns (seams/invariants), debugger-debbie (runtime/races), frontend-freddy (a11y + user-visible fix).
**Squad verdict**: product fix SOUND and all four non-blocking on the product; but the #15 **verification is hollow** (two blockers from renata, HIGH from debbie) and there are latent correctness gaps that re-arm #15 on slow/consumer paths. Merge-with-fixes.

## CONFIRMED findings → fixes

### V1 [BLOCKER, renata] T019 deep-links to the target slide → cannot reproduce #15
`diagram.spec.ts` T019 navigates `#/1` and `#/2/1` — reveal makes the deep-linked slide present/visible at ready, so the pre-fix whole-doc-at-ready render draws it correctly too. box>0 passes on BOTH builds. FIX: load at slide 0 (target hidden), then NAVIGATE to it, then assert. (T021 toggle-while-unvisited→navigate already has the correct setup.)

> **OUTCOME**: `getBBox()` was tried and CI proved it ALSO reads 0 in the headless lane
> (both APIs read 0 for a correct deck diagram — internal geometry is genuinely infeasible
> there, confirming the original #31 conclusion). Resolved instead **structurally**: T019
> reworked to load-then-navigate with an "unrendered WHILE HIDDEN" assert + T021's
> toggle-while-unvisited — both fail on the pre-fix build (which renders all diagrams at
> load) without any internal measurement. Internal-geometry stays deferred to #31.

### V2 [BLOCKER renata / HIGH debbie] the only non-fakeable check (measured internal geometry) is commented out
T019 (367-376, 402-404) and T021 (561-564) removed the measured-internal-node-geometry assertion, leaving `svg` outer-box>0 which the file's own `measuredInnerBox` docstring + `diagram-render.client.ts:190-191` declare non-zero on the broken build. #15 has NO verified non-fakeable proof. FIX: the removed check used `getBoundingClientRect()` (screen px → 0 under reveal's `transform:scale()` in headless). Switch to `getBBox()` (SVG user-space, transform-INVARIANT) — a collapsed internal node reads 0, a correct one reads >0, regardless of reveal scale. Re-enable the assertion (T019 + T021) with getBBox. This likely resolves #31 outright.

### V3 [HIGH, renata] changelog overclaims
`docs/changelog/2026-08-29-…:` "keep the svg-box check that still catches the zero-box defect" contradicts `diagram-render.client.ts:190-191`. FIX: if V2 restores the getBBox proof, reword to state the proof IS restored; else claim only "a diagram that fails to render at all is caught". (V2 chosen → reword to restored-proof.)

> **OUTCOME (local a11y run, env repaired)**: the first class-closure cut used
> `getBoundingClientRect().width > 0`, which skipped *visible-but-settling* diagrams in
> a slower local Chromium — it broke deck navigation (T019) AND print (T020) locally
> (CI's pinned container masked it). Fixed: the skip predicate is now
> `getClientRects().length > 0` (empty ONLY for `display:none`, so a hidden slide is
> skipped but a visible-but-0-width one still renders). Also found (debbie's print-clone
> prediction, confirmed): reveal adds a print-page clone AFTER our single print pass, so
> T020 saw 4 nodes / 3 svg — fixed with a bounded print re-pass loop. Full a11y lane now
> 66/66 green locally.

### C1 [MEDIUM debbie ×2 / paula LOW-MED] whenBoxed timeout + never-retry re-arms #15
`whenBoxed` proceeds after `MAX_SETTLE_FRAMES=30` even if unboxed; `render()` then marks the node `data-processed` + visited → `unprocessedIn` filters it out → NEVER retried. Same root cause as the rapid-nav resolve-after-hide race (render() runs after the node is hidden again). FIX (class-closure, DIRECTIVE_043): in `render()`, filter scope to nodes currently boxed (`getBoundingClientRect().width>0`) at run time; skip zero-box nodes (leave them unprocessed) so a later slidechanged retries. One change closes both races.

### C2 [MEDIUM, paula] theme-observer re-render is the one path NOT gated
`new MutationObserver(() => render(Array.from(visited)))` re-renders hidden (display:none, zero-box) visited slides on a `[data-theme]` toggle → collapse, no recovery. Dormant on the shipped deck (nothing mutates data-theme on the out-of-frame route) but live for a consumer deck theme toggle. FIX: the C1 in-render box-filter closes this too (hidden visited nodes are zero-box → skipped).

### A1 [MINOR, freddy — CONFIRMED by orchestrator] code-block CSS not scoped :not(.mermaid)
`.reveal .slides section pre` (dk-reveal-theme.css:153) applies inset card + border + radius + `overflow:auto` to the persistent `<pre class="mermaid">` after render → every diagram gets an unintended card AND the mermaid pre becomes a scrollable region the `tabindex` remedy (which excludes .mermaid) won't cover. showcase-deck has ONLY mermaid fences (verified) so the tabindex enhancement matches zero elements today. FIX: scope the code rule to `pre:not(.mermaid)`.

## Low-cost hardening (fold in)
- L1 [paula] `whenBoxed([])` burns 30 frames on a diagram-free-slide nav — early-resolve when the list is empty.
- L2 [paula] inert controller for a missing `.reveal` is worse than `undefined` (takes the deck branch, renders nothing). Return `undefined` on missing root so `initDiagrams` hits the whole-doc fallback.
- L3 [renata] axe present-slide guard can pass vacuously if `.present` has no `pre.mermaid` — add a non-vacuity assert.
- L4 [debbie] stale `mode.ts` "KNOWN DECK THEMING GAP" comment now contradicts shipped DeckLayout (theme.css IS linked). Update.

## DEFERRED (out of scope / pre-existing / needs fixtures — follow-up)
- SSR-vs-JS tabindex layering + adding a code-block deck fixture to exercise it (freddy) — no shipped deck has a non-mermaid code block; the CSS:not(.mermaid) + tabindex:not(.mermaid) pair is now consistent. Track as follow-up.
- Deck effectively light-only: DeckLayout has no theme-persistence script, nothing sets data-theme on a real deck (freddy INFO) — pre-existing, separate from #12.
- Footer band can occlude the bottom of an overflowing slide (freddy LOW); role=region+aria-label on scrollable pre (freddy) — best-practice hardening.

## Invariants the squad independently RE-VERIFIED (grep, not comments)
Single `mermaid.run` site; footprint guard before `import('mermaid')` (roadmap-deck proves 0-chunk diagram-free deck); `isPrintView` single-owned; reveal instance never escapes reveal-init; config.ts:438 split-brain gate; BA-9 route-isolated chunk + degraded fallback; BA-4 no doc-page CSS leak; count-pin localized; description-suppression correct. (paula, freddy)

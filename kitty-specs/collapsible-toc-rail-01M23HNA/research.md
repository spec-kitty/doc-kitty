# Research: Collapsible on-this-page TOC side rail

Phase 0 decisions, grounded in a brownfield seam-map of the toolkit (src/lib/config.ts,
src/lib/theme.ts, src/components/**, src/lib/*/*.client.ts, tests/a11y/**, and the pinned
@astrojs/starlight@0.32.6 internals).

## D1 — Client-side DOM augmentation, NOT a PageSidebar component override

- **Decision**: Implement the rail as a client island that augments Starlight's rendered
  `.right-sidebar` DOM (inject the toggle, flip `html[data-toc-collapsed]`) + a token CSS
  sheet + a pre-paint head script. Do **not** override Starlight's `PageSidebar` component.
- **Rationale**: `src/lib/config.ts` locks the Starlight `components` map to exactly four
  carriers (`Head`, `PageTitle`, `MarkdownContent`, `Footer`) and applies it AFTER any
  consumer overrides so a 5th carrier cannot be added (ADR-0013/0015; the invariant is
  restated in `src/styles/dk-components.css`). The theme's `DkSlotName` declares `dk:toc`
  / `dk:toc-mobile` but **no carrier reads them** (only `dk:head` is wired) — so the theme
  slot cannot carry a TOC override either. Spec C-001 explicitly permits "the Kitty
  equivalent component slot"; the client-augmentation seam (the same `injectScript('page')`
  path diagrams + glossary use) IS that equivalent and keeps the lock intact.
- **Alternatives considered**: (a) add a 5th `PageSidebar` carrier — rejected, breaks the
  documented lock; (b) wire the dormant `dk:toc` theme slot — larger blast radius (new render
  plumbing across manifest + carriers) for no user-visible gain. **Disposition: accepted.**

## D2 — Always-on chrome, runtime-gated (not an opt-in config flag)

- **Decision**: The rail ships always-on for doc-kitty docsites, gated at runtime (only acts
  when `.right-sidebar` exists and the viewport ≥ the 72rem breakpoint). No `DocKittyOptions`
  opt-in flag.
- **Rationale**: it is the toolkit's own chrome UX and degrades to nothing on no-TOC/mobile
  pages; a flag adds surface for zero benefit. Diagrams/markua are opt-in because they change
  content rendering + add cost; this is pure chrome with near-zero idle cost.
- **Alternative**: a `tocCollapse: boolean` option — deferred; revisit only if an adopter
  wants to suppress it. **Disposition: accepted (squad may challenge).**

## D3 — FR-006 "rebind on client nav": fresh loads + idempotent injection

- **Decision**: The client module is idempotent (bails if the toggle already exists / `<html>`
  marked hooked); it also attaches a harmless defensive `astro:page-load` re-init.
- **Rationale**: the repo ships **no** ViewTransitions/ClientRouter (grep = 0 hits), so every
  in-site navigation is a full reload that re-runs the injected page script from scratch —
  FR-006's double-binding hazard does not exist today. Idempotency + the defensive listener
  make it correct now and future-proof if a router is ever added. **Disposition: accepted.**
- **Post-squad refinement**: the defensive `astro:page-load` listener is **inert today** (only a
  ClientRouter emits it), so it is not a live FR-006 path and not a test target — label it as such.
  Register it **once at module top-level** (never inside the re-run init, or listeners accumulate per
  navigation under a future router). The active rebind today is the fresh full-page load; id-based
  idempotency is what actually prevents double buttons.

## D4 — Dedicated `data-toc-collapsed` attribute (do not reuse `data-has-toc`)

- **Decision**: Use a NEW `html[data-toc-collapsed]` attribute for collapse state; keep
  Starlight's `data-has-toc` untouched.
- **Rationale**: `html:not([data-has-toc])` also zeroes `--sl-mobile-toc-height` and shifts
  scroll-padding math (Starlight Page.astro); toggling `data-has-toc` at runtime to recenter
  would cause mobile-TOC/scroll side effects. A dedicated attribute + explicit width overrides
  isolate the change (NFR-003). **Disposition: accepted.**

## D5 — CSS home: a separate `toc-rail.css` in GLOBAL_COMPONENT_SHEETS

- **Decision**: New `src/styles/toc-rail.css`, registered in `GLOBAL_COMPONENT_SHEETS`
  (`src/lib/theme.ts`) so it survives the branded token-sheet replacement, with the matching
  `?url` import added to `src/layouts/DeckLayout.astro` (the documented build coupling — the
  layout iterates the list and throws if an entry lacks a `?url` import; inert on decks).
- **Rationale**: locality/reviewability over stuffing rules into `dk-components.css`. Rules in
  `src/styles/theme.css` would be DROPPED on branded builds (its slot is swapped for a
  generated tokens-only sheet), so that file is NOT an option.
- **Alternative**: append to `dk-components.css` (already listed + already imported by Deck)
  — simpler, avoids the coupling, but mixes concerns; **deferred to squad judgment.**
  **Disposition: accepted (kept separate).** Post-squad: the architect noted the append is
  lower-blast-radius (0 wiring files vs 3). We keep the separate `toc-rail.css` for locality/
  reviewability, and accept the coupling specifically because it is **build-enforced** — DeckLayout
  iterates `GLOBAL_COMPONENT_SHEETS` and *throws at build* on a missing `?url` import, so the footgun
  is self-correcting (cannot ship broken) rather than a silent hazard. An implementer who forgets the
  DeckLayout import gets an immediate build failure.

## Supply-chain (DIRECTIVE_051)

No dependency added. The feature is vanilla client JS + CSS over Starlight tokens. Node/pnpm
unchanged. Advisory posture: nothing to examine.

## Adversarial evidence (brownfield point-cut)

A brownfield squad runs post-plan (and pre-PR). Contested findings + disposition
(accepted/changed/deferred_with_rationale) recorded below; none silently dropped.

### Post-plan squad — dispositions

Squad: `architect-alphonso`, `frontend-freddy`, `debugger-debbie` (profile-loaded, read-only).
**Three lenses converged** on the recenter cascade bug (verified against the compiled `:where()`-scoped CSS).

| # | Finding (lens) | Sev | Disposition |
|---|----------------|-----|-------------|
| 1 | Recenter override `html[data-toc-collapsed] .main-pane` (0,2,1) LOSES to Starlight `[data-has-sidebar][data-has-toc] .main-pane` (0,3,0) → article stays narrow with dead right space; my "load order wins" rationale was a cascade error (all 3 lenses) | MAJOR | **accepted** — contract C-2 requires ≥(0,3,0): `html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane` (or override the calc inputs); IC-02 rationale corrected; test asserts computed full width |
| 2 | Hairline via 0-width container relies on the off-screen fixed `.right-sidebar` border at ~100vw → clipped/invisible (frontend) | MAJOR | **accepted** — 1px hairline column (`width:1px; background:var(--sl-color-hairline)`); also makes recenter exact (100%−1px) |
| 3 | Blocked-storage: don't copy ThemeProvider's bare `typeof` guard — private mode has localStorage that *throws*; need real try/catch on read AND write (debugger) | MINOR | **accepted** — contract C-1 hardened; IC-01 says not to reuse the `typeof` pattern |
| 4 | NFR-001 "attribute present" check too weak to prove zero-flash (debugger) | MINOR | **accepted** — contract C-5 adds a structural build-HTML assertion (sync classic inline head `<script>` before `<body>`, no async attrs; toc-rail.css render-blocking `<link>`) |
| 5 | `overflow:visible` on the rail unnecessary/harmful; Starlight already hides the TOC scrollbar; fixed button not clipped (frontend) | MINOR | **accepted** — dropped; mount toggle as sibling of `.right-sidebar-panel`/on body; `display:none` the panel |
| 6 | `astro:page-load` listener inert today; must register once at module scope (architect + debugger) | MINOR | **accepted** — IC-03/D3 labeled inert + module-scope registration |
| 7 | `tocRailIntegration` must be added UNCONDITIONALLY (not gated like diagrams) (architect) | MINOR | **accepted** — IC-04 explicit |
| 8 | Test viability: name a stable has-TOC route + guardRoot; jsdom for attribute behavior (not node/string-only); fresh-load below 72rem; assert computed recenter width (debugger) | MINOR | **accepted** — contract C-5 + IC-05 |
| 9 | IC-06 docs should enumerate the depended-on Starlight selectors + pinned 0.32.6 as an upgrade tripwire (architect) | MINOR | **accepted** — IC-06 |
| 10 | Toggle placement FR-001 ("rail's left hairline") vs FR-003 ("viewport edge") tension (frontend) | NIT | **accepted** — contract C-3: CSS-calc anchor from rail width (expanded) → right:0 (collapsed), no JS |
| 11 | Consumer `starlight.head` override would clobber the pre-paint script (architect NIT); D5 append is lower-blast-radius (architect MINOR) | NIT/MINOR | **deferred_with_rationale** — pre-existing seam limitation (not introduced here); separate sheet kept because the coupling is build-enforced (D5) |

Conceded-clean by the squad: the four-carrier-lock / client-augmentation seam choice (D1 — the *only*
open seam, fully upheld), D2 always-on, D4 dedicated attribute, no-flash soundness by construction,
NFR-002 token coverage (all `--sl-*`/`--dk-*` tokens exist, both modes), and the a11y gate satisfiability
(native `<button>` at 1280px is non-vacuously scanned). No contested finding dropped.

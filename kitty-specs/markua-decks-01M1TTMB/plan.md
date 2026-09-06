# Implementation Plan: Markua-capable decks

**Branch**: `feat/markua-decks` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/markua-decks-01M1TTMB/spec.md`

## Summary

Make the four Markua **content** passes act on deck slide content instead of no-opping, so `W>`/`{aside}`/`{blurb}` asides, `{…}` attribute lists, and `![](…){alt:}` figures render their intended, accessible constructs on a slide. The chosen composition **keeps the Markua remark passes running before `deckSplit`** (option a): at that point the deck body is still flat `root.children`, so `markuaNormalise` finds its markers and `deckSplit` still detects slide boundaries by node `type`+`depth`. The one real hazard — an `{aside}`/`{blurb}` wrapper straddling a `##`/`###`/`---` boundary, which `consumeWrapper` would swallow — is closed by making the wrapper terminate at a slide boundary on decks (with a build warning). `markuaFigure` is unblocked by tagging the synthesized title-slide hero image so the pass skips only the hero. Callouts are forced onto the self-contained `dk-callout` theme path on decks (the deck route loads no `starlight-aside` CSS). `markuaTocDemote` stays deck-guarded (a deck has no on-page ToC). Proven by a shipped `example/docs/presentations/markua-deck.md` fixture and a new Playwright+axe deck-route gate; recorded in `architecture/markua.md`, `architecture/slide-decks.md`, and a new **ADR-0038** superseding ADR-0030's 2026-08-30 amendment (option a).

## Technical Context

**Language/Version**: TypeScript 5.x, ESM, Node Active LTS (20/22); Astro 5 + Starlight integration
**Primary Dependencies**: unified / remark / rehype (mdast + hast transforms), Astro `astro:content` render pipeline, reveal.js (out-of-frame deck route via `DeckLayout.astro`), Playwright 1.62.1 + `@axe-core/playwright` (a11y/behaviour gate), vitest (unit). **No new dependency is added or upgraded** — all of the above are already present, so the supply-chain-install-safety check is satisfied by "no dependency change" (see research.md §Supply chain).
**Storage**: N/A — pure build-time AST transforms producing static output
**Testing**: vitest unit (serial, `fileParallelism:false`); Playwright+chromium deck-route gate at preview `http://localhost:4321/doc-kitty/` (CI-serial); `validate:docs`, `validate:example`, `assert:artifacts`, `assert:no-broken-links`, `test:a11y`
**Target Platform**: static Astro build + browser (reveal.js) for the deck route
**Project Type**: single — toolkit library under `src/lib/` consumed by the `example/` docsite
**Performance Goals**: build-time transforms remain O(document nodes); no new runtime cost on the deck route beyond existing reveal.js enhancement
**Constraints**: off-deck corpus renders byte-identical to pre-mission `main` (NFR-002); a Markua-free deck keeps its exact slide count/structure (NFR-003); **no `##`/`###`/`---` boundary swallowed and no slide line emitted as literal text**; deck a11y gate reports zero violations in light **and** dark schemes (NFR-001)
**Scale/Scope**: 4 content passes made deck-capable; 1 hero tag in `deck-split.internal.ts`; forced-theme flag in `markuaCallouts`; wrapper-boundary termination in `markuaNormalise`; 1 fixture deck; 1 new gate spec + route registration; `deck-guard.test.ts` expectation flips; docs ×2 + ADR-0038

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/doctrine`, software-dev-default). Relevant directives and how this plan satisfies them:

- **DIRECTIVE_001 (Architectural Integrity) / DIRECTIVE_024 (Locality of Change)**: deck knowledge enters a Markua pass only by **delegation** through the neutral `src/lib/deck/is-presentation.ts` predicate (the sanctioned pattern already used by `markua-figure` and `glossary-autolink`), never by importing deck-splitting concepts into a transformer. `deckSplit`/`remarkDirective` stay untouched (C-002). Blast radius is confined to the four content passes + the hero tag + wiring.
- **DIRECTIVE_003 (Decision Documentation) / DIRECTIVE_018 (Doctrine Versioning)**: the option-(a)→(b) scope change is recorded as **ADR-0038** superseding ADR-0030's amendment, cross-referenced not silently contradicted (C-003).
- **DIRECTIVE_010 (Specification Fidelity)**: FR-003 pins the ordering with an automated assertion; the deck gate (FR-008) proves the rendered constructs.
- **DIRECTIVE_025 (Boy Scout Rule)**: touched tests (`deck-guard.test.ts`) are brought into agreement with shipped behaviour rather than left contradictory.
- **DIRECTIVE_051 (Supply-chain install safety)**: no dependency change — advisory check passes by construction.

No charter violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this mission)

```
kitty-specs/markua-decks-01M1TTMB/
├── plan.md              # This file
├── research.md          # Phase 0 — mechanism decisions (ordering, hero, callout a11y, tests)
├── data-model.md        # Phase 1 — AST node/flag model + state (wrapper/boundary) transitions
├── quickstart.md        # Phase 1 — how to author + verify a Markua deck locally
├── contracts/           # Phase 1 — deck-markua-composition + deck a11y gate contracts
└── tasks.md             # Phase 2 output (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
src/lib/
├── remark/
│   ├── markua-normalise.ts / .internal.ts   # IC-01: wrapper terminates at a deck slide boundary (warn)
│   ├── markua-attributes.ts / .internal.ts  # verified safe (attaches hProperties, never changes type/depth)
│   ├── markua-callouts.ts / .internal.ts    # IC-02: force dk-callout theme path on decks
│   └── deck-split.internal.ts               # IC-03: tag synthesized hero <img> (data-deck-hero)
├── rehype/
│   └── markua-figure.ts                     # IC-03: process decks, skip hero-marked <img> only
├── markua/deck-guard.ts                     # IC-04: wrap only markuaTocDemote (predicate retained)
├── deck/is-presentation.ts                  # unchanged — delegation home
└── config.ts                                # IC-04: :683/:685 registration arrays adjusted

src/tests/
└── deck-guard.test.ts                        # IC-06: membership + inertness expectations flip

example/docs/presentations/
└── markua-deck.md                            # IC-05: shipped fixture ({…}/W>/{aside}/figure + hero)

tests/a11y/
├── routes.ts                                 # IC-05: register out-of-frame markua deck route
└── deck-markua.spec.ts                       # IC-05: new Playwright+axe behaviour/a11y gate

docs/
├── architecture/markua.md                    # IC-07: decks now Markua-capable
├── architecture/slide-decks.md               # IC-07: remove "Markua-agnostic" section
└── adr/0038-decks-markua-capable.md          # IC-07: supersedes ADR-0030 amendment
```

**Structure Decision**: Single-project toolkit. Library transforms live in `src/lib/{remark,rehype}`; the consuming docsite and its published fixtures live in `example/`; unit tests in `src/tests/`, browser a11y/behaviour gates in `tests/a11y/`. No new top-level directories.

## Implementation Concern Map

> Concerns are not work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Ordering composition & wrapper-boundary safety

- **Purpose**: Compose the Markua remark passes with `deckSplit` under the decided ordering (Markua **before** split) and guarantee no slide boundary is swallowed by an `{aside}`/`{blurb}` wrapper.
- **Relevant requirements**: FR-002, FR-003, FR-005; NFR-003.
- **Affected surfaces**: `src/lib/remark/markua-normalise.internal.ts` (`consumeWrapper` terminates at a deck slide-boundary placeholder + `file.message` warning), `src/lib/remark/deck-split.internal.ts` (boundary predicate is the reference), `src/lib/config.ts` (registration order stays Markua→…→`deckSplit`).
- **Sequencing/depends-on**: none (foundational). IC-04 wiring depends on this.
- **Risks**: the wrapper-crossing case is incoherent authoring but must be actively handled (default `consumeWrapper` swallows it). Enforcement assertion (FR-003) must pin *both* "structure preserved for non-crossing markers" and "wrapper cannot cross a boundary".

### IC-02 — Callout emission on decks (forced theme path)

- **Purpose**: Make `W>`/mapped callouts render as the self-contained, deck-styled `dk-callout` aside rather than a native `starlight-aside` the deck route cannot style.
- **Relevant requirements**: FR-001, FR-005; NFR-001.
- **Affected surfaces**: `src/lib/remark/markua-callouts.ts` (`isPresentationFile(file)` awareness), `src/lib/remark/markua-callouts.internal.ts` (`forceTheme` bypasses the `mode:'native'` branch); confirm accessible name on `<aside class="dk-callout">`.
- **Sequencing/depends-on**: none; independent of IC-01.
- **Risks**: `dk-callout` currently carries no explicit `role`/`aria-label`; the deck a11y gate (IC-05) must confirm axe-clean and, if needed, add an accessible name.

### IC-03 — Figure hero-exclusion

- **Purpose**: Wrap body slide images as accessible `<figure>` while never wrapping the synthesized title-slide hero (which would empty its `<img alt>` — the PR #33 regression).
- **Relevant requirements**: FR-004; NFR-001.
- **Affected surfaces**: `src/lib/remark/deck-split.internal.ts` (`titleChildren` tags the hero image `data.hProperties['data-deck-hero']`), `src/lib/rehype/markua-figure.ts` (remove the blanket `isPresentationFile` early-return; skip only the hero-marked `<img>` and its lone-image `<p>`).
- **Sequencing/depends-on**: none; independent of IC-01/IC-02.
- **Risks**: hero and a plain body image are structurally identical — the explicit tag is the only reliable discriminator. Must verify the tag survives mdast→hast (`hProperties` → `properties`).

### IC-04 — Guard removal & registration wiring

- **Purpose**: Remove `guardDeck` from the four content passes; keep it (and the predicate) for `markuaTocDemote`.
- **Relevant requirements**: FR-006, FR-009; C-002.
- **Affected surfaces**: `src/lib/config.ts:683` (remark array — three passes bare), `:685` (rehype array — `markuaFigure` bare, `markuaTocDemote` wrapped), `src/lib/markua/deck-guard.ts` (unchanged mechanism, narrowed usage).
- **Sequencing/depends-on**: IC-01, IC-02, IC-03 (the passes must be deck-safe before unguarding).
- **Risks**: partial unguarding must not reintroduce the N-1 guard-hole framing; document that the four passes are now *intentionally* deck-capable and only `markuaTocDemote` remains guarded.

### IC-05 — Deck-Markua fixture + a11y/behaviour gate

- **Purpose**: Ship a real deck exercising `{…}`/`W>`/`{aside}`/figure on slides (plus a hero) and a new gate proving each renders with correct roles/accessible names and no boundary swallowed, in both colour schemes.
- **Relevant requirements**: FR-007, FR-008; NFR-001, NFR-004; SC-001..003.
- **Affected surfaces**: `example/docs/presentations/markua-deck.md`, `tests/a11y/routes.ts` (register the out-of-frame deck route + `AXE_PAGES` deck-shell entry), `tests/a11y/deck-markua.spec.ts` (new; mirrors `deck.interaction.spec.ts` harness).
- **Sequencing/depends-on**: IC-01..IC-04 (needs the capability live).
- **Risks**: fixture must live under `presentations/` with `kind: Presentation` to hit the out-of-frame route; gate must run CI-serial. Rebuild `example/dist` before artifact/link asserts.

### IC-06 — Parity/inertness test updates

- **Purpose**: Flip the `deck-guard.test.ts` expectations from "every Markua pass no-ops on a deck" to the new posture (four passes deck-capable, only `markuaTocDemote` guarded).
- **Relevant requirements**: FR-009.
- **Affected surfaces**: `src/tests/deck-guard.test.ts` — membership assertions (`:199-220`), per-pass no-op matrix (`:143-150`), C36a inertness block (`:289-343`), verify markua-figure guard string (`:260`/`:266-267`). **No change** to `glossary-substrate-parity.test.ts` or `helpers/remark-stack.ts` (identity-keyed, tolerate bare entries).
- **Sequencing/depends-on**: IC-04.
- **Risks**: the inverted C36a fixture (unguarded markers previously *changed* slide count) must be retargeted to pin the wrapper-boundary constraint, not deleted.

### IC-07 — Docs of record & ADR-0038

- **Purpose**: Record decks as Markua-capable and supersede option (a).
- **Relevant requirements**: FR-010; C-003; SC-005.
- **Affected surfaces**: `docs/architecture/markua.md` (`:197-205`), `docs/architecture/slide-decks.md` (`:53-60`), new `docs/adr/0038-decks-markua-capable.md` (Status: supersedes ADR-0030 amendment 2026-08-30). Changelog entry (≤180-char description for `validate:docs`).
- **Sequencing/depends-on**: IC-01..IC-05 (docs describe shipped behaviour).
- **Risks**: `validate:docs` enforces changelog description ≤180 chars; ADR index generation (ADR-0032) may need the new entry registered.

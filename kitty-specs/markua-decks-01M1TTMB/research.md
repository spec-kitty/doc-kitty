# Research: Markua-capable decks (#47)

Phase 0 mechanism resolution. Evidence gathered by reading the pass internals, the deck route, and the a11y harness on `feat/markua-decks` (from `main`). Each decision is stated as Decision / Rationale / Alternatives.

## D1 — Pass/`deckSplit` ordering: keep Markua BEFORE `deckSplit`

**Decision**: Keep the three Markua remark passes running **before** `deckSplit` (the current registration order: `markuaIntegration` prepended at `config.ts:826`, `deckSplitIntegration` at `:836`). Do **not** move Markua after split.

**Rationale**:
- When the Markua passes run, the deck body is still **flat** `root.children`. `markuaNormalise` scans `root.children` only (`buildLineStream`/`hasMarkuaMarker`, `markua-normalise.ts:236-274`) — it finds the markers there. After `deckSplit`, `root.children` are `deckSection` nodes and the markers are nested, so `markuaNormalise` would **no-op** unless taught to descend into `deckSection` subtrees (a real behavioural change to a deck-agnostic module).
- `markuaAttributes` block-form recurses only into `containerDirective` (`markua-attributes.ts:231`), not `deckSection` — same problem under option (b).
- `deckSplit`'s boundary predicate keys on `node.type`+`node.depth` only (`deck-split.internal.ts:360/368/372`), ignoring `data`/`hProperties`. So a heading that `markuaAttributes` decorated with `hProperties.id` is **still** detected as a slide boundary (verified — see D2). Running Markua first does not blind `deckSplit`.
- Line-prefix runs (`A>`…`W>`) can **never** cross a boundary: `consumeLinePrefixRun` breaks on any non-line-prefix line (`markua-normalise.internal.ts:279-284`), and headings/`thematicBreak`s are always separate block nodes rendered as opaque placeholder lines with a blank line between (`markua-normalise.ts:261-275`).

**Alternatives considered**:
- **Option (b), Markua after `deckSplit`**: rejected. Requires teaching `markuaNormalise` and `markuaAttributes` to recurse into `deckSection` subtrees (per-section line streams, blank-line reconstruction), enlarging the change and the edge-case surface for no boundary-safety benefit.

## D2 — `markuaAttributes` does not corrupt boundary detection

**Decision**: No special handling needed for `{…}` attribute lines adjacent to slide headings.

**Rationale**: For a heading target, `markuaAttributes` writes only `data.hProperties.id` (`markua-attributes.ts:151-152`); it never changes `node.type` or `node.depth`. Block-form attaches to the **following** block and splices out the attribute paragraph (`markua-attributes.ts:195-238`). Because `deckSplit` matches boundaries on type+depth (D1), the decorated heading is still a boundary. A `{…}` line is consumed as a directive, never left as literal text (satisfies "no slide line silently consumed").

**Alternatives considered**: Guarding `markuaAttributes` on decks — rejected as unnecessary; it is provably boundary-safe.

## D3 — Wrapper-boundary hazard: terminate `{aside}`/`{blurb}` at a slide boundary (warn)

**Decision**: Make `markuaNormalise` deck-aware **for wrappers only**: when normalising a `kind: Presentation` file, `consumeWrapper` treats a slide-boundary placeholder (a `heading` of depth ≤ 3, or a `thematicBreak`) as an implicit terminator — it closes the wrapper **before** the boundary and emits a `file.message` warning ("Markua `{aside}`/`{blurb}` cannot span a slide boundary; closed at the boundary"). The boundary node stays in `root.children`, so `deckSplit` still splits on it.

**Rationale**: This is the **only** authored shape that can swallow a boundary. `consumeWrapper` (`markua-normalise.internal.ts:306-361`) otherwise scans across the whole flattened stream — including heading placeholders — until it finds the matching close, re-parenting a swallowed `### Slide` into the `containerDirective` (which then disappears from `root.children`, and `deckSplit` never sees the boundary). Terminating at the boundary preserves the boundary (acceptance: "no slide boundary swallowed") and degrades gracefully rather than throwing. Delegation via `isPresentationFile` keeps deck knowledge out of the transformer body proper.

**Alternatives considered**:
- **Hard error on a crossing wrapper**: rejected — decks warn, never fail the build (consistent with `deckSplit`/Markua warning discipline, FR-008 precedent).
- **Detect in `deckSplit`** (heading nested in a `containerDirective`): rejected — by the time `deckSplit` runs the heading is already re-parented and its boundary intent is lost; detecting at wrapper-formation time is the correct point-cut.
- **Document-only constraint (no code)**: rejected — the acceptance criterion is behavioural ("no boundary swallowed"), so it must be enforced, not just documented.

## D4 — Figure hero-exclusion via an explicit hero tag

**Decision**: `deck-split.internal.ts` `titleChildren` tags the synthesized hero image node with `data.hProperties['data-deck-hero'] = ''` (flows to hast `properties['data-deck-hero']`). `markuaFigure` drops its blanket `isPresentationFile` early-return (`markua-figure.ts:238`) and instead, during its walk, skips any `<img>` whose `properties['data-deck-hero']` is set (and its enclosing lone-image `<p>`). All other slide images are wrapped as `dk-figure`.

**Rationale**: The hero is emitted as a plain `paragraph > image` with `url`/`alt` only and **no** distinguishing class/data (`deck-split.internal.ts:170-201`). It is structurally identical to a plain body `![cap](src)` image, which *should* be wrapped. `markuaFigure` matches by structure (`loneImageParagraph`/`isImg`, `markua-figure.ts:122-143`), not by Markua `hProperties`, so "lacks Markua attributes" cannot distinguish them. An explicit hero tag is the only reliable discriminator. Skipping the hero keeps its `alt` on the `<img>` (no `image-alt` violation) and adds no caption to the title slide, resolving the PR #33 conflict without skipping the pass on body images.

**Alternatives considered**:
- **Keep `markuaFigure` deck-guarded** (option a status quo): rejected — that is exactly what #47 requires reversing.
- **Distinguish by title-slide section class**: rejected — more brittle than tagging the image node directly; the hero is the only image in the title slide but body images can also appear on a title-like first slide.

## D5 — Callouts on decks: force the `dk-callout` theme path

**Decision**: `markuaCallouts` gains `isPresentationFile(file)` awareness and passes a `forceTheme` flag into `decideEmission` so a deck callout never takes the `mode:'native'` branch (`markua-callouts.internal.ts:180`); it always emits the self-contained `dk-callout` hast. Confirm (and, if axe flags it, add) an accessible name on `<aside class="dk-callout">` in the deck gate.

**Rationale**: `remarkAsides` **does** run on decks — the deck route renders through the global markdown chain (`DeckLayout.astro` `render(entry)` → `<Content/>`, `:47/114/186`), and the effective remark order is `…markuaCallouts → remarkAsides → deckSplit`. **But** `DeckLayout` is a standalone document that links only reveal core, `theme.css`, brand tokens, `dk-components.css`, and `dk-reveal-theme.css` (`DeckLayout.astro:53-176`) — it does **not** inject Starlight's `starlight-aside` CSS. So a native aside would render **unstyled** on a slide. The `dk-callout` markup (`markua-callouts.ts:89-135`) is fully self-contained and styled by `dk-components.css`, which the deck already loads.

**Alternatives considered**:
- **Leave the native path**: rejected — produces unstyled asides on slides (poor UX; the "renders the intended construct" acceptance would be weakly met).
- **Inject `starlight-aside` CSS into `DeckLayout`**: rejected — couples the deck to Starlight's internal aside stylesheet and duplicates styling the toolkit already owns via `dk-callout`.

## D6 — `markuaTocDemote` stays deck-guarded

**Decision**: Keep `guardDeck` on `markuaTocDemote` only; remove it from the four content passes.

**Rationale**: `markuaTocDemote` keeps figure/aside headings out of the on-page table of contents — a docs-page concern. The out-of-frame deck route has no on-page ToC, so the pass has nothing to do on a deck; guarding it is the correct, precise use of the retained predicate. This keeps the predicate/wrapper alive (FR-006) for exactly the pass that stays deck-agnostic.

**Alternatives considered**: Unguard all five — rejected; `markuaTocDemote` on a deck is a pure no-op at best and a needless traversal at worst.

## D7 — Tests to flip (localized to `deck-guard.test.ts`)

**Decision**: Update `src/tests/deck-guard.test.ts`: membership assertions (`:199-220` → only `markuaTocDemote` wrapped), per-pass no-op matrix (`:143-150` → only `markuaTocDemote` deck-guarded; the four content passes get "runs on a deck" assertions), C36a inertness block (`:289-343` → FR-003 "renders on decks, non-crossing structure preserved" + the D3 wrapper-boundary constraint), and verify the markua-figure guard-string check (`:260`/`:266-267`) against the new hero-skip predicate. **No change** to `glossary-substrate-parity.test.ts` (its `CONSCIOUS_EXCLUSIONS` are identity-keyed and resolve through `.__inner ?? raw`; the docs-page re-derive fixture has no Markua syntax) or `helpers/remark-stack.ts` (`unwrapEntry` already tolerates bare entries).

**Rationale**: Removing the wrap changes array membership and the deck-inertness intent, both asserted only in `deck-guard.test.ts`. The parity guard keys on plugin identity, unaffected by wrapping.

## Supply-chain security check (advisory, DIRECTIVE_051)

**No dependency is added, upgraded, or removed.** reveal.js, `@axe-core/playwright`, Playwright 1.62.1, vitest, and the unified stack are all already in the lockfile. Registry authenticity, package-freshness, and lifecycle-script posture are therefore unchanged by this mission — the advisory check passes with no new exposure. If task breakdown later surfaces a need for a new dev dependency, re-run this check before adding it.

## Adversarial evidence (plan-readiness)

The mission's pre-PR adversarial squad (a11y/contract + architecture/boundary + correctness) runs over the integrated diff before the PR (per the mission's delivery discipline). At plan stage the contested-finding ledger is empty; the standing hazards to challenge there are: (1) the D3 wrapper-boundary termination actually prevents a swallow under nested/fenced wrappers; (2) the D4 hero tag survives the mdast→hast round-trip and the image pipeline; (3) D5 `dk-callout` on a slide is axe-clean for accessible name/role in both schemes. No contested finding is dropped — each disposition (`accepted`/`changed`/`deferred_with_rationale`) will be recorded when the squad runs.

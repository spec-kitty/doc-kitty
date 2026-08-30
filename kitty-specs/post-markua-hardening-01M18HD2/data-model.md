# Seam Model: Post-Markua Hardening

This is a hardening mission — the "data model" is the set of **seams** the fixes introduce and the invariants they enforce. No persistent data or schema changes.

## S-01 — `isPresentationFile()` / `isPresentationEntry()` predicate

- **Home**: `src/lib/deck/is-presentation.ts` (neutral — not inside `markua/`, so Markua modules don't gain deck-knowledge).
- **Shapes** (two real access contexts observed in the tree):
  - `isPresentationFile(file)` → reads `file?.data?.astro?.frontmatter?.kind === 'Presentation'` (remark/rehype plugin VFile shape — used by `markua-figure`, `glossary-autolink`).
  - `isPresentationEntry(entry)` → reads `entry?.data?.kind === 'Presentation'` (Astro content-collection entry shape — used by the RSS predicate `metadata.ts:428`).
- **Invariant**: exactly one definition of the Presentation test per access shape; no third copy.

## S-02 — `guardDeck(plugin)` registration-site wrapper

- **Home**: `src/lib/markua/deck-guard.ts`.
- **Contract**: `guardDeck(plugin)` returns a unified plugin that, when the current file is a Presentation page (`isPresentationFile`, using the **defensive optional-chain** `file?.data?.astro?.frontmatter?.kind` — throws on non-Astro VFiles otherwise), returns the tree untouched; otherwise delegates to `plugin`. It **preserves** the wrapped plugin's `name`/display identity and exposes `wrapped.__inner === plugin` so the #35 parity enumerator can see through the wrap (C-006).
- **Applied at**: `config.ts:604` (`remarkPlugins: [...].map(guardDeck)`) and `config.ts:606` (`rehypePlugins: [...].map(guardDeck)`).
- **Never applied to**: `deckSplit` / `deckSplitIntegration` (`config.ts:350/:746`) — it is the deck processor itself. Note `remarkDirective` (`config.ts:567`) is also unwrapped and out of scope (parses native `:::` before deckSplit — a pre-existing directive/deck interaction, not this mission's class).
- **Invariant (SC-003)**: for a Presentation page, every one of the five Markua passes is a no-op.
- **Invariant (C36f, post-plan)**: EVERY member of the `:604`/`:606` arrays exposes `__inner` — this is asserted by a test, so a 6th pass added *outside* `.map(guardDeck)` reds immediately. This is what makes "a 6th pass is auto-guarded" a checked invariant, not a claim.

## S-03 — build remark-stack enumerator

- **Home**: `src/tests/helpers/remark-stack.ts` (extracted from `markua-attributes.test.ts:334` `combinedRemark`).
- **Contract**: given the built integrations, returns the ordered remark plugin list, selecting integrations by the `doc-kitty:` **name prefix** (not a hardcoded literal list) so a new `doc-kitty:*` integration cannot be silently skipped. The `SetupHook` shim (`markua-attributes.test.ts:315`) is loosened/annotated so an integration whose hook reads a param the shim omits does not silently register nothing.
- **Invariant**: enumeration is non-empty when built with `markua:true, diagrams:true` + glossary active (a stage-count floor guards against vacuous enumeration); each selected integration must register ≥1 plugin (guards the SetupHook-shim false-green).

## S-04 — parity classification (`MIRRORED` / `CONSCIOUS_EXCLUSIONS`)

- **Home**: `src/tests/glossary-substrate-parity.test.ts`.
- **Contract**: every enumerated build remark stage (via S-03, looking through `guardDeck.__inner`) must be classified as either:
  - `MIRRORED` — **derived from `page-processor.ts`'s real plugin list** (not hand-listed), so it cannot disagree with what the substrate actually replays, or
  - `CONSCIOUS_EXCLUSIONS[name] = "<justification>"` — a keyed, justified exclusion (e.g. `deckSplit`: deck-only; `markuaNormalise/Attributes/Callouts`: opt-in Markua, inert for re-derive today).
- **Behavioural golden-tree (post-plan)**: a fixture rendered through the build substrate and the re-derive substrate must produce identical mdast for the mirrored set — this catches a **wrong** exclusion (excluding a should-be-mirrored stage), which the name-classification alone cannot.
- **Version-parity (post-plan)**: assert the resolved `remark-gfm`/`remark-smartypants` versions equal Astro's (or centralise one pin); fallback = a tracked follow-up. Not a comment.
- **Invariant (SC-002)**: an unclassified stage → test fails naming the stage. The allow-list's red-on-unclassified stops silent drift (C-004); the golden-tree stops wrong exclusion.
- **Scope (DIRECTIVE_043)**: closes silent-drift by construction + wrong-exclusion behaviourally; version axis closed by version-parity or a tracked issue. Not overclaimed beyond that.

## S-05 — empty-tolerant a11y colour helper

- **Home**: `tests/a11y/helpers/colour.ts`.
- **Contract**: `nodeFill(figure)` returns the computed fill or `''` (never throws); `toRgbTriple(value)` returns a normalized `r,g,b` triple, tolerating `''` by signalling not-ready to the caller's `toPass`. Shared by `diagram.spec.ts` and `deck.interaction.spec.ts`; the local throwing copies are removed.
- **Invariant (SC-001)**: a theme-toggle colour-equality read retries through the flush window and never aborts the test on an empty-colour parse.

## S-06 — stacked attribute-list coalescing (behaviour rule)

- **Where**: `src/lib/remark/markua-attributes.ts` `applyBlockFormsToChildren`.
- **Rule**: consecutive lone `{…}` attribute paragraphs above one target are coalesced; their `entries` and hoisted `id` merge with nearest-wins precedence; the merged list attaches to the first non-attribute block; the child index advances past the whole run.
- **Invariant (FR-007)**: no stacked attribute list is silently dropped.

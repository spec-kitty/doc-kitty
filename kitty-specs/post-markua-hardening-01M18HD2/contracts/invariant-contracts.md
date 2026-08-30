# Invariant / Test Contracts: Post-Markua Hardening

Each contract is a black-box assertion (DIRECTIVE_036) that a regression test must encode. "Fails when" is the mutation-equivalent check (NFR-004): revert the fix and the test must go red.

## C34 — theme-toggle colour read is flush-tolerant WITHOUT weakening the invariant (FR-001/FR-002)

- **Given** a deck-diagram page under headless a11y, **when** the theme is toggled while the Mermaid re-render is flushing, **then** the colour-equality read retries within 10 s (`expect(async()=>{…}).toPass({timeout:10_000})`) and never throws `Cannot parse colour ''`.
- **Both** toggle directions and the pre-toggle baseline read use the shared empty-tolerant helper.
- **INVARIANT NOT WEAKENED (post-plan pin)**: `toRgbTriple('')` must return a sentinel that can **never** equal a real triple. The pre-toggle read (`fillBefore`, `:508`) is reused at `:544-547` as the "genuinely changed" baseline — it MUST resolve to a *real* triple inside `toPass` (fail-on-sentinel), not merely tolerate empty, or that guard degrades to trivially-true. The non-retried `tokenAfter != tokenBefore` guard (`:521-524`) must remain, so a no-op toggle still fails.
- **Fails when**: the helper throws on empty; an assertion uses raw `expect.poll` with a throwing callback; a resolved-but-wrong fill green-washes (guarded by the token-inequality assertion); or `fillBefore` is accepted as a sentinel.
- **Mutation rigor (post-plan)**: because the flake is a race, revert-and-observe is probabilistic — instead ship a **direct unit test of `helpers/colour.ts`** (`''`→sentinel; a real rgb→triple; sentinel ≠ any triple).
- **Proof of class-closure**: no throwing `toRgbTriple`/`nodeFill` copy remains in `tests/a11y/**` (grep asserts a single source). Grep is name-based → add a one-line convention note in `helpers/colour.ts` (a bare `expect.poll` with a fresh throwing read would escape both grep and `toPass`).

## C35 — re-derive parity is enforced, incl. WRONG exclusions (FR-003/FR-004)

- **Given** the build remark stack enumerated with `markua:true, diagrams:true` + glossary active (integrations selected by `doc-kitty:` prefix), **when** the parity test runs, **then** every remark stage (seen through `guardDeck.__inner`) is `MIRRORED` or a keyed `CONSCIOUS_EXCLUSIONS` entry, and the enumeration count ≥ the floor.
- **`MIRRORED` derived, not hand-listed (post-plan)**: the `MIRRORED` set is derived from the substrate's *real* plugin list (`page-processor.ts`), so it cannot silently disagree with what the substrate actually replays.
- **Behavioural golden-tree (post-plan)**: a fixture is rendered through the build substrate and the re-derive substrate; the mdast for the mirrored set must be identical. This catches a **wrong** `CONSCIOUS_EXCLUSIONS` entry (excluding a should-be-mirrored stage) behaviourally — the honesty gap the name-classification test alone cannot close.
- **SetupHook shim (post-plan)**: the `{updateConfig, injectScript}` shim (`markua-attributes.test.ts:315`) is loosened/annotated, and the test asserts each enumerated integration actually registered ≥1 plugin (an integration whose hook reads an omitted param registers nothing → would false-green).
- **Version-parity (post-plan, COP-OUT closed)**: assert the resolved `remark-gfm` / `remark-smartypants` versions the substrate imports equal Astro's (or a single centralised pin). If infeasibly fiddly in implementation, file a tracked follow-up instead — **never** leave it as a comment-only pin.
- **Fails when**: a remark stage is registered but neither mirrored nor excluded (names it); enumeration is empty/vacuous; integration selection reverts to a hardcoded name list; a should-be-mirrored stage is wrongly excluded (golden-tree reds); or the resolved gfm/smartypants version drifts from Astro's.
- **Scope note (DIRECTIVE_043)**: this closes the *silent-drift* class by construction and catches *wrong exclusion* behaviourally; the version axis is closed by the version-parity check or a tracked issue. Do not overclaim more.

## C36a — the five Markua passes no-op on decks for MARKUA-SYNTAX inputs (FR-005)

- **Given** a Presentation page whose body contains Markua markers **`{…}`, `W>`, `{aside}`** (the syntax the Markua passes own), **when** the build runs with Markua enabled, **then** none of `markuaNormalise/markuaAttributes/markuaCallouts/markuaFigure/markuaTocDemote` transforms the body — no slide line spliced, no slide boundary swallowed.
- **Assert STRUCTURE, not bytes (post-plan)**: "equals the marker-free deck" means **slide/section counts** (structure-adversarial fixture where unwrapping *would* change slide count), never body-equality.
- **Scope boundary (post-plan)**: explicit native `:::` is parsed by the **unwrapped** `remarkDirective` (`config.ts:567`) *before* `deckSplit`, independent of `guardDeck` — that is a **pre-existing directive/deck interaction, adjacent and out of scope**. Do NOT widen `guardDeck` to cover it (scope creep); the *silent Markua* path (`W>`/`{aside}`→`:::`) is what this mission closes (markuaNormalise is wrapped). C36a asserts the Markua-syntax inputs only.
- **Fails when**: any of the five passes is unwrapped at its registration array, or `guardDeck` misreads the frontmatter shape.

## C36b — one predicate, no proliferation (FR-006/C-005)

- **Baseline (post-plan)**: only **4** runtime `kind` guards exist today — `markua-figure.ts:237`, `deck-split.ts:46`, `glossary-autolink.ts:70`, `metadata.ts:428`. The count invariant EXCLUDES enum declarations (`schema.ts:40/58`, `metadata.ts:36`) and comments (`config.ts:347/745`).
- **Given** the source tree, **when** grepped for runtime `kind === 'Presentation'` / `kind !== 'Presentation'` checks, **then** each deck-aware site resolves through `isPresentationFile`/`isPresentationEntry` (except `deck-split`, the deck processor) — runtime-guard count does not increase over the baseline of 4 (and drops as copies fold onto the predicate).
- **Fails when**: a new inline copy of the check is introduced.

## C36c — guardDeck is transparent to parity (C-006)

- **Given** a `guardDeck`-wrapped plugin, **then** `wrapped.__inner` is the original plugin and `wrapped.name` matches, so the S-03 enumerator classifies it correctly.
- **Fails when**: wrapping hides identity and the parity test false-reds on a wrapped-but-mirrored stage.

## C36f — every registration-array member is deck-guarded (AS-3, "6th pass auto-guarded")

- **Given** the `config.ts:604` remark array and `:606` rehype array as built, **then** **every** member exposes `__inner` (i.e. every member is a `guardDeck` wrap).
- **Fails when**: a plugin is added to either array outside `.map(guardDeck)` — this is the concrete test that makes "a 6th pass is auto-guarded" a checked invariant rather than a claim.

## C36d — stacked attribute paragraphs preserved (FR-007)

- **Given** `{width:"50%"}` then `{alt:"x"}` stacked above one image, **when** `markua-attributes` runs, **then** both attribute lists apply (merged, nearest-wins).
- **Fails when**: the outer list is dropped.

## C36e — callouts three-form test is non-vacuous (FR-008)

- **Given** the three-form-equivalence test, **then** the three forms derive from genuinely distinct pre-normalisation inputs (or the assertion lives at the normalise layer).
- **Fails when**: two forms are byte-identical inputs (vacuous).
- **Mutation rigor (post-plan)**: revert-and-observe is meaningless here (vacuous and fixed versions are both green) — verify by breaking the **normalise fold** and confirming the test then reds.

## CDOC — living-docs synced (FR-009)

- ADR-0025 + `docs/architecture/glossary.md` carry a re-derive-parity enforcement note referencing the new guard; `docs/architecture/markua.md` Limits + `docs/architecture/slide-decks.md` state the deck-scope decision (a); ADR-0030 Consequences amended with (a) + a pointer to the (b) follow-up issue.
- **(post-plan) Also**: `docs/architecture/research/markua-syntax-support.md:~311` present-tense "supports … presentations" claim gets a scope breadcrumb (falsified by (a)); and the **in-code** FORWARD RULE breadcrumbs (`config.ts` markuaIntegration docstring, `page-processor.ts:45-54`) are trimmed to point at the new parity guard, so prose and gate cannot drift.

## Byte-identity gate (NFR-002) — with a concrete falsifier

- The full pre-existing gate set stays green.
- **(post-plan) Falsifier**: the named gates (`build`/`validate`/`assert:*`) test invariants, not a frozen baseline — so byte-identity is proven by **`diff -r <dist@baseline> <dist@feat>`** on the built corpus (empty diff), targeting exactly the decks where the four passes previously ran. Either this diff is run as the NFR-002 evidence, or NFR-002 is reworded to the invariants the gates actually assert.

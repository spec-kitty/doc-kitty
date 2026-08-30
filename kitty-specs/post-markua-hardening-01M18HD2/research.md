# Research: Post-Markua Hardening

Consolidated from the pre-spec six-lens investigation squad (debugger, architecture, researcher, paula-patterns, frontend-quality). Every anchor below was re-verified against `main` @ `b56f307`.

## D-01 — #34 root cause and fix primitive

- **Decision**: Switch the theme-toggle colour-equality assertions to `expect(cb).toPass({ timeout: 10_000 })` and make the colour read non-throwing (`nodeFill` returns `''` as a not-ready sentinel; a shared `toRgbTriple` tolerates empty). Extract one empty-tolerant colour helper shared by `diagram.spec.ts` and `deck.interaction.spec.ts`; delete both local throwing copies.
- **Rationale**: The failing stack is a bare `Cannot parse colour ''` parse error, not a poll-timeout message — proof that `expect.poll` **aborts on a thrown callback** rather than retrying. The toggle fires a destructive-then-async Mermaid re-render (`diagram-render.client.ts` MutationObserver → `textContent = source` → async `mermaid.run`), so `getComputedStyle(shape).fill` is momentarily `''`. `toPass` retries on *any* throw and uniquely also hardens the two **un-polled** reads (`:511/:513` pre-toggle, `:541/:547` post-toggle) that a poll-only fix cannot reach.
- **Alternatives considered**: (rejected) poll-returns-null sentinel — works for the one polled site but leaves the un-polled reads throwing; (rejected) `page.waitForFunction` / `toHaveCSS` — hex-vs-rgb parse mismatch; (rejected) adding a production render-settled signal — over-engineers an a11y-sensitive path for a test-only race (the render owner is sound: coalesces re-entrant runs, ends at one `<svg>`).
- **Class-closure**: the throwing antipattern also lives in `deck.interaction.spec.ts:299` and a tracked deck theme-toggle follow-up (`mode.ts:66-71`) will re-exercise it under a re-render — so sharing one helper and deleting the duplicate is what actually closes the class. Distinct from #31 (blocked internal-node geometry proof; different predicate).

## D-02 — #35 structural guard: drift-catching test, not shared array

- **Decision**: Option (a) — a parity test that enumerates the build's remark stages and asserts each is either in a `MIRRORED` set or a keyed `CONSCIOUS_EXCLUSIONS` allow-list; fail on anything unclassified. Extract the existing `combinedRemark` enumerator (`markua-attributes.test.ts:334`) to `src/tests/helpers/remark-stack.ts`.
- **Rationale**: The re-derive substrate is a *strict subset by design* — it wants the tree before the glossary term passes. Option (b) "one shared plugin array" forces two lists into one they were correctly designed to differ from, and cannot own the always-on Astro built-ins (`remark-gfm`/`remark-smartypants`) anyway. Option (a) tests the *classification decision*, which is exactly the thing that silently drifted for #16/#20.
- **False-green holes to plug** (patterns + quality lenses): (1) `combinedRemark` iterates a hardcoded integration-name list and `continue`s past unknowns → derive the name list from the array by the `doc-kitty:` prefix; (2) the Markua array is opt-gated (`config.ts:717-742`) → the test must build the stack with `markua:true, diagrams:true` + glossary active or it enumerates nothing and passes vacuously → add a **stage-count floor**; (3) `SetupHook` (`markua-attributes.test.ts:315`) models only `{updateConfig, injectScript}` → loosen/annotate so promoting it to a shared contract does not false-green.
- **Residual (documented, not covered)**: version-drift of a mirrored plugin (gfm 4.0.1 / smartypants 3.0.3 pinned by comment at `page-processor.ts:39`) is invisible to an identity-based guard — recorded as a known limit, per DIRECTIVE_048.
- **Alternatives considered**: (rejected) Option (b) derive-from-one-source; (rejected) keep the prose breadcrumb (the status quo that produced the class).
- **Correction to the issue framing**: `markua-toc-demote` and `markua-figure` are **rehype**; a remark-only processor cannot mirror them, so the mirror obligation is bounded to the remark/mdast stack — the parity test scopes to remark stages only.

## D-03 — #36 deck scope: (a) Markua-agnostic, closed at the registration site

- **Decision (owner-resolved, `decision_id 01M18HEA94W7DVZBX3CD5GY5AV`)**: (a) all five passes no-op on Presentation pages. Implement via one shared `isPresentationFile()` predicate and a `guardDeck(plugin)` wrapper applied at the registration arrays (`config.ts:604` remark, `:606` rehype), so deck-agnosticism is a property of array membership. Fold the scattered `kind === 'Presentation'` copies onto the predicate. (b) decks-Markua-capable is filed as a follow-up.
- **Rationale**: The three Markua remark passes run **before** `deckSplit`, so this is worse than inert — a `{…}` slide line would be silently spliced by `markua-attributes`, and `{aside}` could swallow a `###` slide boundary. Guarding inside five transformer bodies still leaves an N-1 hole (a 6th pass added unguarded); wrapping at the registration site closes it permanently. Today's four deck sources contain zero Markua, so (a) is byte-identical and reversible; the research note (`docs/architecture/research/markua-syntax-support.md:311`) only *positions* decks as in-scope and ships no deck-Markua fixture — it does not commit to (b) operationally.
- **Consolidation constraint** (arch lens): `kind === 'Presentation'` is already present at `markua-figure.ts:237`, `deck-split.ts:46`, `glossary-autolink.ts:70` (shape `file.data.astro.frontmatter.kind`) and `metadata.ts:428` (shape `entry.data.kind`). The fix must fold these onto the one predicate — not add the check to more sites (would grow 6→10+). `deck-split` is the deck processor and is never wrapped.
- **Cross-fix coupling (C-006)**: `guardDeck` changes plugin identity → D-02's parity classifier must key on the wrapped identity or `guardDeck` must expose `__inner`. Chosen: `guardDeck` exposes `plugin.__inner` and preserves `.name`/displayName so the parity enumerator recognises it.
- **Alternatives considered**: (rejected) per-body predicate in each of five passes (leaves N-1 hole); (rejected) (b) now (feature-sized: re-solve PR #33 hero regression, compose with deckSplit, deck-Markua fixture + new a11y gate).

## D-04 — #36 minor edges

- **D-04a stacked attribute paragraphs** (`markua-attributes.ts applyBlockFormsToChildren`): the greedy one-step attach drops the outer of two stacked `{…}` paragraphs. **Decision**: coalesce consecutive lone attribute paragraphs, merge their `entries` + hoisted-`id` channels (nearest-wins), attach to the first non-attribute block, and advance the child index past the coalesced run. Regression: `{width:"50%"}` + `{alt:"x"}` stacked above an image → both land.
- **D-04b vacuous callouts test** (`markua-callouts.test.ts` forms 1 & 3 byte-identical `run(directive('caution'))`): **Decision** — feed distinct pre-normalisation inputs (or relocate the equivalence to the `markua-normalise` layer where the fold happens). The authoritative three-form fold stays covered by the WP10 live-render gate (`tests/a11y/markua.spec.ts`).

## D-05 — Supply-chain posture (DIRECTIVE_051)

- **Decision**: N/A — this mission adds/upgrades/removes **no** dependency. Registry-authenticity, package-freshness, lifecycle-script, and Node-Active-LTS checks are not triggered. Node 24.x is current Active LTS; no runtime version change. Recorded explicitly so the absence is examined, not assumed.

## Adversarial evidence (plan point-cut)

No security-impacting dependency decision → the supply-chain adversarial challenge is not triggered. A brownfield post-plan adversarial squad (structural / recurring-boundary / test-quality lenses) reviews spec+plan+research before tasks; contested findings and their dispositions (`accepted` / `changed` / `deferred_with_rationale`) are appended below.

### Dispositions (post-plan adversarial point-cut — 3 opus lenses: structural / class-closure / test-quality)

Confirmations (risks refuted):
- **Frontmatter guard fires at remark time** — REFUTED as a risk. `deck-split.ts:46` and `glossary-autolink.ts:70` are shipping *remark* plugins reading `file.data.astro.frontmatter.kind`; Astro populates it before any remark/rehype plugin. `guardDeck` is safe. **MUST** use the defensive optional-chain `file?.data?.astro?.frontmatter?.kind` (throws on non-Astro VFiles in unit tests otherwise). *[accepted → S-02]*
- **`toPass` does not weaken the invariant** — `expect(async()=>{…}).toPass({timeout})` exists in Playwright 1.62.1, retries the whole callback, treats any throw as not-yet-passed. The non-retried `tokenAfter != tokenBefore` guard (`:521-524`) still fails a no-op toggle. *[accepted with pin, see below]*
- **Seam sound** — `config.ts:604/606` are inside `markuaIntegration.updateConfig`; `deckSplitIntegration` (:350/:746) is genuinely separate and correctly never wrapped. *[accepted]*

Changes folded into the plan/contracts:
1. **C34 fillBefore-reuse hazard (changed)** — `fillBefore` (`:508`) is reused at `:544-547` as the "genuinely changed" baseline; if captured as the empty sentinel that guard degrades to trivially-true. The pre-toggle read must resolve to a **real** triple (inside `toPass`, fail-on-sentinel), not merely tolerate empty. `toRgbTriple('')` sentinel must never equal a real triple. → C34.
2. **#35 catches silent drift but not a WRONG exclusion (changed)** — `CONSCIOUS_EXCLUSIONS` forces a *decision*, not a *correct* one; a maintainer could exclude a should-be-mirrored stage and re-green, reviving #16/#20. Also `MIRRORED` hand-listed is wiring-hollow. Fix: **derive `MIRRORED` from the substrate's real plugins** and add a **behavioural golden-tree diff** (render a fixture through the build substrate and the re-derive substrate; assert identical mdast for the mirrored set) so a wrong exclusion is caught behaviourally. Stop overclaiming DIRECTIVE_043 for #35 (it closes silent-drift; wrong-exclusion is caught behaviourally; version-axis is tracked). → C35, S-04, Charter Check.
3. **SetupHook shim hole (changed)** — D-02 hole 3 never reached the seam/contract; an integration whose hook reads a param the `{updateConfig, injectScript}` shim omits registers nothing → false green. Loosen/annotate the shim and assert non-empty registration. → S-03, C35.
4. **C36a over-broad (changed)** — `remarkDirective` (`config.ts:567`) is unwrapped and parses native `:::` before `deckSplit`, so an explicit `:::` around a `###` can swallow a boundary regardless of `guardDeck`. The **silent** Markua path (`W>`/`{aside}`→`:::`) IS closed (markuaNormalise wrapped). Narrow C36a to Markua-syntax inputs (`{…}`, `W>`, `{aside}`); note explicit `:::` as a pre-existing directive/deck interaction (adjacent — do NOT widen the guard = scope creep). Assert **structure** (slide/section counts), not body-equality; fixture must be structure-adversarial. → C36a.
5. **AS-3 "6th pass auto-guarded" untested (changed)** — add a test asserting every member of the `config.ts:604/606` arrays exposes `__inner` (catches a 6th plugin added outside `.map(guardDeck)`). → C36f, S-02.
6. **NFR-002 byte-identity unfalsifiable by named gates (changed)** — `build`/`validate`/`assert:*` test invariants, not a frozen baseline; the weak spot is exactly the decks where the four passes previously ran. Concrete falsifier: `diff -r <dist@main> <dist@feat>` on the built corpus. → byte-identity gate, quickstart.
7. **Mutation rigor (changed)** — C34 revert-and-observe is probabilistic (a race); use a **direct helper unit test** for `colour.ts` (empty→sentinel, non-empty→triple) instead. C36e revert-and-observe is meaningless (both green); the mutation must break the **normalise fold**. → NFR-004 notes, C35/C36e.
8. **C36b grep baseline wrong (changed)** — only **4 of 10** `Presentation` hits are runtime guards; the count invariant must exclude the enum decls (`schema.ts:40/58`, `metadata.ts:36`) and comments (`config.ts:347/745`). → C36b.
9. **Missed stale doc (changed)** — `docs/architecture/research/markua-syntax-support.md:~311` present-tense "supports … presentations" is falsified by (a); add a scope breadcrumb. Also trim the **in-code** FORWARD RULE breadcrumbs (`config.ts` markuaIntegration docstring, `page-processor.ts:45-54`) to point at the new guard. → FR-009/IC-05.
10. **Version-drift residual — COP-OUT verdict (changed)** — page-processor pins gfm/smartypants by *comment* while bare-importing whatever resolves; that reproduces the prose-breadcrumb anti-pattern #35 exists to kill. Minimum bar is a **construction check** (assert the resolved gfm/smartypants version equals Astro's, or centralise one pin) or a **tracked issue** — not a comment. → IC-02 (add cheap version-parity assertion; fallback: file a follow-up like IC-06).

Minor/accepted-as-is:
- `src/lib/deck/` already exists — it is a new *file* in an existing dir, not a new dir (plan wording corrected).
- IC-01 grep is name-based; a future differently-named throwing read inside a bare `expect.poll` escapes both grep and `toPass` — add a one-line convention note in `helpers/colour.ts`. *[accepted, low]*

No finding was dropped; no finding was deferred without rationale.

### Post-tasks point-cut (2 lenses: decomposition / WP-prompt-quality)

WP-prompt-quality lens: **all 10 post-plan pins faithfully carried into the WPs, none softened** (accepted). Decomposition lens found four folds:
- **D-1 (HIGH, changed)**: `page-processor.ts` has no plugin-list export to derive MIRRORED from (plugins are inline `.use()` chains). WP03 T013 now adds an exported `REDERIVE_REMARK_PLUGINS` array (WP03 owns the file) and derives MIRRORED from it — closes the hand-list false-parity trap.
- **O-1 (changed)**: `runSetup`/`SetupHook` live in WP04-owned `markua-attributes.test.ts`; WP03 T012 now **copies** them into `remark-stack.ts` and treats that test file as read-only (no ownership collision).
- **FR-010 (changed)**: filing the (b) issue is an orchestrator action at consolidation; WP05 writes only the reference — DoD clarified so WP05 is not blocked on the issue existing.
- **C36b (changed)**: added an automated grep/AST guard-count assertion to WP02 T010 (was review-only).
Confirmations: `combinedRemark` is file-local/unexported → WP03 correctly builds its own helper (no coupling); WP03→WP02 has no false-green risk; WP01/02/04 genuinely independent; no WP >10 subtasks. Minor/deferred: WP01 anchor drift (:508 vs :511/:513, descriptive); frontmatter `merge_target_branch` (feat branch, spec-kitty mission target) vs body "final merge target: main" (eventual PR) — two different targets, left as-is.

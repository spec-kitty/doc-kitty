---
affected_files: []
cycle_number: 1
mission_slug: doc-kitty-mcp-server-01M6BAQX
reproduction_command:
reviewed_at: '2026-11-01T20:26:14Z'
reviewer_agent: opencode
wp_id: WP05
---

# WP05 review feedback (round 1) — reviewer-renata

**Substance first: the acceptance-heart CODE passes every adversarial check.**
Full evidence is listed at the bottom so the next review can be a fast flip.
This rejection is a single planning-artifact reconciliation, not a rework
request.

## Issue 1 (BLOCKING — the only one): stale subtask scope in `tasks/WP05-conformance-gates.md` makes approval mechanically impossible

The post-tasks squad split WP05: `tasks.md` header says "WP05 split by the
post-tasks squad; WP08 carries T022/T023", `tasks.md` rows assign T020/T021 →
WP05 and T022/T023 → WP08, and `tasks/WP08-boundary-lane-nfr.md` frontmatter
owns `subtasks: [T022, T023]` with history "split out of WP05". But WP05's own
file was never updated:

1. Frontmatter still reads `subtasks: [T020, T021, T022, T023]` (verified on
   `feat/doc-kitty-mcp-server` and in the primary checkout).
2. The Definition-of-Done list still carries WP08's items ("C-003 boundary
   test green (and demonstrably fails if an HTTP import is seeded)",
   "NFR-001/002 evidence recorded", "CI: new serialized lane…").

This is not cosmetic: `spec-kitty agent tasks move-task WP05 --to approved`
REFUSES with "unchecked subtasks: T022, T023" — the completion gate reads the
stale scope and cannot pass while WP08's subtasks (in_progress on lane-d)
remain claimed here. A reviewer override (`--force`) would corrupt the event
log of the mission's most scrutinized WP; the implementer must not mark
T022/T023 done (they are WP08's and genuinely unfinished).

**Fix**: edit `tasks/WP05-conformance-gates.md` so its `subtasks:` frontmatter
lists exactly `T020, T021`, and strike/move the two stale DoD bullets
(boundary test, NFR evidence, serialized-CI lane) with a pointer to WP08 —
matching what the objective already says ("Scope after the planner-lens
split…"). Then re-submit for review; approval should then succeed without
`--force`.

## Verified PASSING (do not touch; evidence for the re-review)

- **Golden mechanism honest (V4)**: `projection.ts` imports only node builtins
  — zero code shared with `mcp/src`; expectations re-read fixture bytes from
  disk (fs) or over loopback HTTP (https, via its own `fetch`) and re-derive
  everything from contract prose; no `toMatchSnapshot`/`toMatchInlineSnapshot`
  anywhere in `mcp/`. Field-level comparator asserts UTF-8 byte equality,
  array order (registry order) and exact object key sets.
- **Matrix (SC-003)**: all 5 tools, deterministic ≥10-page sample with the
  empty-slug home asserted present, BOTH input modes, an fs+`--link-base`
  carve-out run with the rewrite arm proven genuinely engaged (href moved to
  the link base) plus a content-never-rewritten bound, and a
  pages-links-gated run (byte-conform index-level tools, `capabilities.pages
  === false`, `get_page` → named `PAGES_LINKS_GATED`, zero fabricated search
  hits). FR-010's paired positive control is present (raw home.json markdown
  vs `get_page` bytes).
- **Seeded-fault self-test — re-run personally**: as committed, 4/4 green.
  I then mutated `applyDevFaults` in `mcp/src/server.ts` to a no-op and the
  self-test went RED (2/4 fail) — the wrapper demonstrably can go red;
  worktree reverted (`git status` clean), solo re-run 4/4 green.
- **Failure matrix (SC-004)**: one fixture + one assertion per named error —
  `UNKNOWN_CONTRACT_MAJOR` version "99" AND non-numeric "beta" (distinct
  message anchors), `UNREACHABLE_ENDPOINT` 500-serving socket (with an exact
  attempt + ONE retry request-count assertion) AND dead port,
  `MALFORMED_CORPUS` (removed `markdown`, message names artifact path + key),
  `PAGES_LINKS_GATED` (load warning + capabilities + named tool error),
  `BUILD_IDENTITY_MISMATCH` mixed-buildId fixture WITH emission on, guarded
  against V6 vacuity by a companion test pinning buildId present on every
  artifact and exactly two distinct identities, `PAGE_NOT_FOUND` via
  `get_page` (resources/read variant correctly conditional on the WP04
  capability flag). Every row carries a hard asserted time budget
  (`withinBudget`, measured ms printed; 2 s fs / 10 s https ≪ the 35 s worst
  case).
- **SC-002 controls**: fixtures verified at field level — `zephyrquill`
  keyword-only (controls/alpha), `morrowdust` markdown-body-only
  (controls/beta), `amberline` known-K=3 across title (gamma), description
  (delta), keywords (epsilon) with zeta carrying it body-only as the
  exclusion control; isolation is pinned programmatically
  (`expect(expected.ids).toEqual([...])` before byte comparison) and run in
  both input modes including case-insensitivity.
- **Lane-crossing hook (`mcp/src/server.ts`)**: pure opt-in pass-through —
  `applyDevFaults` returns the snapshot by identity when `faults` is
  undefined/`uppercaseTitles` not true (no copy, no behavior change on the
  fault-free path), `createServer`'s widened `FaultyLaunchConfiguration` is
  backward-compatible, and the real cli never sets `faults` (grepped).
- **Runs (all in lane-e worktree, `npm_config_verify_deps_before_run=false`)**:
  `pnpm --filter @spec-kitty/doc-kitty-mcp test` → 148 passed, 1 skipped (the
  skip is WP02's pre-existing conditional dist-shebang guard, not WP05's);
  `typecheck` exit 0; `lint` exit 0.
- **Scope**: WP05's own commit touches only `mcp/tests/conformance/**`,
  `mcp/tests/fixtures/**` and the sanctioned `mcp/src/server.ts` hook
  (coordination note present in the commit message).

## Non-blocking flag for WP07 / mission-review (not this WP's scope)

The contract table in `contracts/mcp-surface.md` still lists `list_scenarios`
as "array of ScenarioRecord", while the landed (WP03-approved) shape —
mirrored identically by server and test projection — is the object
`{ version, generated_from, count, results?, features }` with
`generated_from` fed from the artifact's `generated_by`. Contract prose lags
the approved surface; reconcile at mission level.

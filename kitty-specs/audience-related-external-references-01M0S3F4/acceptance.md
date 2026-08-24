# Acceptance — Audience, Related & External References (M3)

Audience: the reviewer and merge operator deciding whether mission M3 is releasable.
This maps each success criterion (SC-001…SC-006) to the command/assertion that
proves it and records the observed result. Evidence is drawn from the per-WP reviews
and, for the integrated proof, from the WP06 lane (`lane-f`), which merged all six
lanes and ran the full gate suite — the first point all mission code coexists.

All commands run from the mission's integrated worktree on
`feat/audience-related-external-references`. The build under test is `example/dist`.

## Gate summary (integrated, WP06 lane-f)

| Lane | Command | Result |
|------|---------|--------|
| code-quality | `pnpm test` | 103 passed |
| code-quality | `pnpm lint` | exit 0 |
| code-quality | `pnpm typecheck` | 0 errors |
| doc-sanity | `pnpm validate:docs && validate:example && validate:links && validate:catalog` | all exit 0 (links: 506 resolve; catalog: refs resolve) |
| build-example | `pnpm build && pnpm assert:artifacts example/dist` | PASS — 16/16 index+sitemap pins, three-block + agent + bibliography assertions |
| a11y | `pnpm test:a11y` in `mcr.microsoft.com/playwright:v1.62.1-noble` (CI=1) | 12/12 — axe (4 pages × 2 modes incl. the Blocks demonstrator), visual, mode |

## Success criteria

### SC-001 — audience block renders; persona resolution soft (link or warn)
- WP04 wired `dk:audience` as a titled "Who is this for" `<section aria-labelledby>`;
  WP06 `assert-chrome-artifacts.mjs` §14 asserts the section + list on the Blocks
  demonstrator (which declares `audience: [{profile: example-persona, …}]`).
- `resolveProfile` returns null on a missing persona → humanized slug + build-log
  warn (not fatal); covered by `resolvers.test.ts` and `catalog-fixtures.test.ts`
  (dangling-profile fixture).
- Result: MET.

### SC-002 — related resolved cards + stale-target marker; dangling ref fails build
- WP04 `Related.astro` renders `<nav aria-label="Related pages">` cards whose
  accessible name is the resolved **target title** (verified in `example/dist` by the
  WP04 review). WP06 adds the stale-target status marker, mutation-proven
  non-fakeable (removing the marker fails the assertion).
- `resolveRelated` throws on an unresolvable ref (build-fatal, FR-004); `validate:links`
  resolves all refs.
- Result: MET.

### SC-003 — external refs (inline + catalog); unresolvable citation fails; /api/bibliography.json
- WP02 shipped the `bibliography`/`tools` collections + `validate-catalog.mjs`
  (verified to exit 1 on a missing id and an unknown catalog `type`); `/api/bibliography.json`
  emits `{version,count,records:[{id,title,url,…}]}` outside `doc_status` gating.
- WP04 `ExternalReferences.astro` + `ReferenceItem` lead the accessible name with the
  human **title**, mono citation key secondary (mutation-proven non-fakeable in WP06).
- Result: MET.

### SC-004 — personas at context/audience/, attribute fields, Audiences hub; parity
- WP03 relocated the example persona to `context/audience/example-persona.md`
  (`type: Context`, `doc_status: active`), reconciling the design of record; no page
  remains under `personas/`. `Persona.astro` renders role/goals/responsibilities; the
  `context/audience/README.md` Audiences hub (kind Hub) lists it.
- The standalone validator requires the persona fields (kind Persona); the zod schema
  stays lenient — parity fixtures `valid-persona.md` (SHAPE_PARITY) and `missing-role.md`
  (PRESENCE_LENIENT) pass. doc-sanity green.
- Result: MET.

### SC-005 — agent record carries audience + resolved related; version bumped; draft excluded
- WP05 enriches each record's `related` to `{ref,title,kind,doc_status}` and carries
  `audience`, composed in the route (`toAgentRecord` stays pure); agent-API `version`
  bumped `1 → 2`. WP06 `assert-build-artifacts.mjs` pins the bespoke record shape and
  `version === "2"`.
- `doc_status` gating intact: the retained `draft-persona.md` (and `adr/template.md`)
  are absent from index/RSS/sitemap; `/api/bibliography.json` is un-gated.
- Result: MET.

### SC-006 — ci-ok (four lanes) green; axe scans the three blocks; no red boundary
- Every WP left `ci-ok` green at its boundary (per the per-WP reviews). The WP06
  integrated lane ran all four lanes green (gate summary above); the axe lane scans
  the Blocks demonstrator that renders all three blocks (post-spec finding R1 closed).
- The example count pins were recomputed atomically (WP03 interim 14 → WP06 final 16 =
  18 `.md` − 2 drafts), cross-checked against the built dist.
- Result: MET.

## Anti-laziness evidence

Two adversarial squads (post-spec, post-tasks) and per-WP reviewer-renata reviews
verified non-fakeability throughout. WP06's central assertions were mutation-tested:
key-before-title → title-lead assertion fails; stripped stale marker → FR-005
assertion fails; both restored to PASS. The build-free gates (`check-links.mjs`,
`validate-catalog.mjs`) parity-duplicate the TS resolvers rather than importing them.

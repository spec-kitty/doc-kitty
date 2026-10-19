# Research: Dates, actors and anchors

Evidence comes from the alignment and scope squad and from the post-spec adversarial
squad (both 2026-10-19, read-only, at `e3e4a96`). Every finding below has a disposition.

## R1. #229 is already delivered

- **Decision**: close #229 and drop it from the mission (operator Decision Moment
  `01M5A02PY8EG1MMHHFWXV7NV8R`).
- **Evidence**:
  - `src/lib/routes/scenario-index.ts:464` emits `generated_by`;
  - `assert-build-artifacts.mjs:2520-2530` rejects `generated_from` and requires
    `parseActor(generated_by)`;
  - ADR-0059:205 and :214 record #182 and #183.
- **Alternatives**: keep it as verify-only. Rejected, because there is nothing left to verify.

## R2. #226: per-output precedence in one module

- **Decision**: per-output rules exported side by side from `generator-stamp.mjs`. The
  OKF rule counts only an ownership-producer stamp (operator Decision Moment
  `01M5A02GSJ9YZHCEK9SZ482MTY`).
- **Rationale**: the two rules answer different questions.
  - RSS `<pubDate>` is when the author last said the page changed (#190).
  - OKF `generated.at` is the producer's last-content-change instant (ADR-0059 §5/§5.2,
    FR-025 of the OKF mission).
  - A single precedence breaks one of those two contracts.
  - The agent API already passes the raw `generated` block, so agents see both dates.
- **Flaw fixed**: a scaffold stamp (`doc-kitty-scaffold/<v>`, provenance-only,
  `generator-stamp.mjs:29-35`) made the export report scaffold time as the last content
  change after a human edit.
- **Coherence (squad finding 3)**: when the stamp does not count, the whole stamp is
  ignored. `by` falls back to the first author or the export process, and `at` falls
  back to `updated`, else the stamp `at`. This way `by` and `at` describe one event.
- **Placement (squad finding 9)**: `generator-stamp.mjs` owns `PRODUCERS` and
  `isGeneratedStamp`, and is already imported by `metadata.ts` and the gate.
  `okf-export/core.mjs` stays I/O-free.
- **Alternatives**: one shared helper (rejected by the operator); document only
  (rejected, because it leaves the stale-date flaw).

## R3. #227: where the date-shape rule lives

- **Decision**: inside `normaliseInstant`, in the non-ISO (`legacyInstant`) branch, and
  for numbers.
  - A number returns `null`.
  - A non-ISO string returns `null` unless it has a month name plus a number, or at
    least three numeric groups.
- **Rationale**: this keeps one parser (FR-009). `instantDate` in both twins already
  maps `null` to a Zod failure. The other callers treat `null` as "absent":
  `docs-index.ts:224` drops it, `metadata.ts:290/305` gives 0, and
  `generate-adr-index.mjs:77` and `Persona.astro:94` fall back.
- **Rule check** (run against the current parser):

  | Result | Values |
  | --- | --- |
  | rejected | `"1"`, `"2024"`, `"1/2"`, `"abc 2024"`, `"2024.5"` |
  | kept (non-ISO) | `"May 1, 2024"`, `"May 2024"`, `"1 May 2024"`, `"1/2/24"`, `"2024-10"` (year-month, explicit), RFC-822 dates |
  | kept by V8 prefix matching (noted, unchanged) | `"Decimal 2024"`, `"1.2.3"` |
  | kept (ISO, rule never runs) | every ISO form, including rollover, zone-less and `±HHMM` |

- **Post-tasks finding 4 disposition**: `"2024-10"` built before (two numeric groups, no
  month name) and is a realistic `updated`. It is kept by an explicit `YYYY-MM` clause.
- **Squad finding 5 disposition**: the squad proposed a mandatory 4-digit year. That
  rejects `"1/2/24"`, which built before, and so breaks the invariant. It is replaced by
  the month-or-three-groups rule.

## R4. #227: stamp instants are not checked today

- **Decision**: `stampAt` in both twins refines with the parser: after the existing
  `Date` → string normalisation, `normaliseInstant(v) !== null`. This covers
  `generated.at` and `verified[].at` (squad finding 2).
- **Retired hash**: `sha256:` stamps already fail the gate with a "regenerate" message
  (`retiredStampProblem`). The gate must not also report a date-shape error for the same
  stamp. The `legacy-stamp-removal.test.ts` assertions use `toMatch` and survive.
- **Stale comment**: `schema.ts:153-155` ("older pages carry a hash here, so no instant
  check") is removed.

## R5. #227: error wording

- **Decision**: the gate twin's `instantDate` and `stampAt` failures name the field and
  the accepted form (`YYYY-MM-DDTHH:MM:SSZ`). The parity test compares verdicts only;
  the wording is asserted in the gate (squad finding 10).

## R6. #228: ids in the test harness

- **Decision**: in the strengthened test, run `rehypeHeadingIds`
  (`@astrojs/markdown-remark`) after `singleH1`, then count `id="title"` (squad
  finding 1). Also assert no alias `span`, and that the headings are `['h2: Title']`.

## R7. Determinism and baselines

- No page in `docs/` or `example/docs/` carries both `updated` and a stamp. All 10
  example stamps are ownership stamps, so no pinned baseline moves.
- NFR-001 has no full two-build gate (squad finding 4). Verify by building the example
  twice and diffing `dist/`, plus the existing two-run export test
  (`okf-export.test.ts:54`).
- Feed-order tests: `metadata.test.ts:101-165`, `collect-doc-entries-order.test.ts:96`.
- FR-004 positive control (squad finding 8): use the ownership stamp plus a different
  `updated` case. It exists in `okf-export/graph.json:14` (stamp 10-02, `updated` 10-05).

## R8. Changelog and descriptions

- No gate checks the 1,200-character entry limit; it is checked by hand at closeout
  (squad finding 11). The description gate (50–180) is enforced by `validate-frontmatter`.

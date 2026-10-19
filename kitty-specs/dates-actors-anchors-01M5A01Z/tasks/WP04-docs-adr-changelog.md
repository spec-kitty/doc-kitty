---
work_package_id: WP04
title: Decision record, docs and changelog
dependencies:
- WP01
- WP02
- WP03
requirement_refs:
- FR-005
- NFR-004
- C-004
- C-005
planning_base_branch: feat/dates-actors-anchors
merge_target_branch: feat/dates-actors-anchors
branch_strategy: Planning artifacts for this mission were generated on feat/dates-actors-anchors. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/dates-actors-anchors unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-dates-actors-anchors-01M5A01Z
base_commit: 404c21eb4c79aa7c06af20bc603a86baa27dff50
created_at: '2026-10-19T12:38:11.874448+00:00'
subtasks:
- T013
- T014
- T015
- T016
phase: Phase 2 - Record and document
history:
- at: '2026-10-19T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- docs/adr/0059-content-graph-and-okf-alignment.md
- docs/architecture/gherkin-pages.md
- docs/architecture/generators.md
- docs/architecture/metadata-model.md
- docs/guides/export-okf-bundle.md
- CHANGELOG.md
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP04 – Decision record, docs and changelog

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile with the
`/spk-charter-profile-load` skill (profile: **scribe-sally**). Then run
`spec-kitty charter context --action implement` and apply it. Follow the charter's
documentation policy:
- audience-oriented, one idea per sentence, sentence-case headings;
- no AI-writing tells (em-dash overuse, rule-of-three padding, hedging, puffery);
- living documentation.

## Objective

Record what WP01–WP03 changed, where readers look:

- the #226 per-output date precedence (an operator decision) and the OKF ownership-stamp
  fix;
- the #227 date-shape rule;
- the #228 test, in the changelog only.

Read the merged code from WP01 and WP02 before writing. Document the behaviour as built,
not as planned.

## Context

- **Spec**: FR-005, NFR-004. **Research**: R2, R3, R4 and R8.
  **Data model**: all three tables.
- Decision Moment `01M5A02GSJ9YZHCEK9SZ482MTY`: "Per-output, one module + OKF
  ownership-stamp fix".
- ADR-0059 is accepted. Its "Implementation notes" section (from line 158) is where
  settled implementation details go. **Do not edit the Decision section.** Add notes only.

## Branch Strategy

- Planning branch: `feat/dates-actors-anchors`. Final merge target:
  `feat/dates-actors-anchors`.
- Your execution worktree is allocated per computed lane from `lanes.json`; this WP
  depends on WP01–WP03.
- Implement with `spec-kitty agent action implement WP04 --agent claude --mission dates-actors-anchors-01M5A01Z`.

## Subtasks

### T013 — ADR-0059 implementation note

**Steps**:
1. Add a dated subsection at the end of the implementation notes, for example
   `### Dates per output (2026-10-19, #226, #227)`. Include:
   - **One rule per output, defined side by side.** Use a short table:
     - RSS: `updated`, then `generated.at`;
     - OKF export: an ownership stamp (`doc-kitty-gherkin`, `doc-kitty-glossary`)
       supplies `by`/`at`/`content_hash`, and any other stamp, such as the scaffold's, is
       treated as absent;
     - agent API: `updated`, with the raw `generated` block alongside.
   - **Why there are two.** RSS `<pubDate>` is when the author last said the page
     changed; OKF `generated.at` is the producing tool's last content change (§5, §5.2).
     One precedence would break one of the two contracts.
   - **The scaffold fix.** A scaffold stamp records provenance, not content change, so
     the export no longer reports it as the last change; `by` and `at` describe one
     event.
   - **Rejected alternatives**: one shared helper; documenting only.
   - **#227.** `normaliseInstant` rejects values that aren't date-shaped (rule in one
     sentence). Stamp instants (`generated.at`, `verified[].at`) are now checked too.
     The retired `sha256:` form still gets only its "regenerate" message.
2. Bump the page's `updated` to a UTC instant. Keep the description at 50–180
   characters if you touch it.

### T014 — Architecture and guide pages

Fix each place that states an old rule. Read each page first, and change only what is
now wrong or missing:

- `docs/architecture/gherkin-pages.md` (~421-425, feed dates): add one sentence that the
  OKF export uses its own rule, with a link to the ADR note.
- `docs/architecture/generators.md` (~30-32, stamps): say that a scaffold stamp is
  provenance-only and never the export's last-change instant.
- `docs/architecture/metadata-model.md` (~68 and ~326-330, instant fields): state the
  date-shape rule. Name the accepted forms and give examples of rejected values. Add
  `generated.at` and `verified[].at` to the checked fields.
- `docs/guides/export-okf-bundle.md` (~84-85): update the `generated` rule to the
  ownership-stamp form.

Bump each edited page's `updated`.

### T015 — CHANGELOG `[Unreleased]`

**Steps**:
1. In the root `CHANGELOG.md`, under the empty `## [Unreleased]` (line 7), add entries in
   the file's style: release sections use `### 💥 Breaking`, `### Changed` and
   `### Fixed`. Read the previous release section first.
   - **Changed**, bold impact-first lead: **The OKF export no longer reports a scaffold
     time as a page's last content change (#226).** Then before → after in one or two
     sentences, and the ADR-0059 note link.
   - **💥 Breaking**: **Date fields reject values that aren't dates (#227).** A YAML-number
     `updated` built on 0.4.0, so this breaks adopters. Name the fields, give examples
     (`"1"`, a YAML number), and list what still builds (including `YYYY-MM`). Add a
     one-line fix ("quote a real date, e.g. `updated: 2024-10-01T00:00:00Z`"). Also note
     that the Astro build now rejects a retired `sha256:` stamp `at`, which before only
     the gate failed.
   - **Tests**, or the file's equivalent: the #228 anchor-collision case, only if the
     file lists test-only changes. Otherwise skip it.
2. Each entry is at most 1,200 characters. Count with
   `python3 -c "print(len(open('/dev/stdin').read()))"` and paste the counts in the review
   note.

### T016 — Doc gates

Run the repo's doc-sanity gates on the edited pages (see `package.json` and
`.github/workflows/ci.yml` for exact commands):
- the frontmatter gate on `docs/`;
- the link and `related` check;
- markdownlint;
- Vale (if the `vale` binary is unavailable, say so in the review note).

All must pass.

## Definition of Done

- The ADR-0059 note records the decision, the rationale, the scaffold fix and the #227
  rule, with the Decision section untouched.
- Four pages are corrected; every `updated` is bumped; every description is 50–180.
- The CHANGELOG has `[Unreleased]` entries, each ≤1,200 characters.
- The doc gates are green.
- Commit with `spec-kitty safe-commit <files> -m "docs: record per-output dates and the date-shape rule (#226, #227)"`.

## Risks

- **Documenting planned rather than built behaviour**: read WP01 and WP02's merged diffs.
- **Changelog conflicts**: open PR #225 also edits `[Unreleased]`. Keep your entries
  self-contained so a union merge works.

## Reviewer Guidance

- Check every claim against code (`generator-stamp.mjs`, `vocabulary-core.mjs`).
- Check the length counts and the description gate.

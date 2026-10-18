---
work_package_id: WP04
title: ADR-0058, consumer guide, CHANGELOG
dependencies:
- WP01
- WP02
requirement_refs:
- FR-011
- FR-008
planning_base_branch: fix/gate-config-hardening
merge_target_branch: fix/gate-config-hardening
branch_strategy: Planning artifacts for this mission were generated on fix/gate-config-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/gate-config-hardening unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gate-config-hardening-01M55KMR
base_commit: 74c5bc9dd14b7dc01269ff0d34f07c6521ef9248
created_at: '2026-10-17T19:52:11.630853+00:00'
subtasks:
- T013
- T014
- T015
history:
- at: '2026-10-17T19:30:00Z'
  event: created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- docs/adr/0058-build-state-owner-and-config-split.md
- docs/guides/consumer-setup.md
- CHANGELOG.md
role: implementer
tags: []
tracker_refs: []
---

# WP04 — ADR-0058, consumer guide, CHANGELOG

## ⚡ Do This First: Load Agent Profile

Load the `scribe-sally` profile with the `/spk-charter-profile-load` skill. Then run `spec-kitty charter context --action implement --json`. Writing style: plain language, active voice, impact first, and concrete before/after. Avoid the common AI-writing tics the doctrine lists.

## Objective

Record what WP01 and WP02 changed, for readers and consumers. Spec: FR-008, FR-011. Read the merged WP01 and WP02 diffs first, and document the code as built, not as planned.

## Branch strategy

- Planning branch and merge target: `fix/gate-config-hardening`. The lane comes from `lanes.json`. It depends on WP01 and WP02.
- `spec-kitty agent action implement WP04 --agent claude --mission gate-config-hardening-01M55KMR`.

## Subtasks

### T013 — Amend ADR-0058

In `docs/adr/0058-build-state-owner-and-config-split.md`:

- In §3, around :110-111, the gates now **evaluate** the config, the same way `check-links` does, and fail closed with exit 2. Remove the text-search refusal.
- In the limits section, around :121-128:
  - remove the imported-module limit, because imports are now followed;
  - keep `updateConfig`;
  - add the mode-branching config limit, because the config is evaluated without a mode.
- In the `indexPath` bullet, around :162-165, replace the "must end in `/api/index.json`" rule with `--index-path`.
- Add a dated "Amended 2026-10 (#172, #173)" note. Keep the frontmatter `description` between 50 and 180 characters; `scripts/docs/description_length_check.py` checks this if it exists.

### T014 — Consumer guide

In `docs/guides/consumer-setup.md`:

- Replace "keep it ending in `/api/index.json`" with how to pass `--index-path`, with one example.
- Add one sentence saying the build gates evaluate `astro.config.*`: an evaluation failure stops them, and `--env-dir` skips evaluation.

### T015 — CHANGELOG

`CHANGELOG.md` is a regular file in this repo. Under `[Unreleased]`, add entries in the existing style: a **bold impact-first lead with (#issue)**, then before → after. Keep each entry under 1,200 characters.

- **Fixed (#173):** the draft gates follow `envDir`/`envFile` from an imported base config; a broken config stops them (exit 2) instead of a silent guess.
- **Added (#172):** `assert:artifacts --index-path`.
- #174 is internal: no entry.

## Definition of Done

- Run the docs checks that exist in this repo (check `package.json` scripts, for example `pnpm docs:check` / `validate:links`, and `scripts/docs/*`) and report the results.
- The commit is `docs: …` with the trailer lines.

## Addenda from the brownfield scout and post-tasks review (binding)

- **ADR-0058 targets** (against a76c5563):
  - the related gates paragraph is at :106-112;
  - `updateConfig` is at :123;
  - the text-check / imported-module passage is at :124-126. Rewrite it: imports are now followed, and the limits are `updateConfig` and mode-branching configs;
  - the `indexPath` rule is at :161-165. Replace the "fails, it does not skip, on any other path" sentence (:164-165) with `--index-path`.
- **consumer-setup.md:** the `indexPath` text is at :283-286, and the example at :289-291.
- **CHANGELOG.md:** `## [Unreleased]` is at :7, with existing subsections `### Added` :25 and `### Fixed` :80. Add the entries under those subsections; **do not add headings**.
- **Named checks:** each of these must exit 0, with the output pasted in your report:
  - `pnpm validate:links`;
  - `pnpm validate:adr-index`, if the ADR title or status changed;
  - `pnpm exec markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"`. It is advisory, so report it but don't block on pre-existing findings.
- **NFR-002 owner (this is the last WP):**
  - build the example on `main` (a76c5563) in a scratch worktree, and on the integrated mission head;
  - run `diff -r` on the two `dist/` trees and report 0 differences. Allow for the known sitemap/rss determinism.
  - Use `pnpm clean` first; mind the example `node_modules/.astro` cache trap.

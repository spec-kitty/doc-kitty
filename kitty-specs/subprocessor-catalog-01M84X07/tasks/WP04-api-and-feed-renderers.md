---
work_package_id: WP04
title: API and feed renderers
dependencies:
- WP02
requirement_refs:
- FR-009
- FR-011
- FR-013
- NFR-001
- C-005
- SC-003
- SC-005
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
subtasks:
- T014
- T015
- T016
- T017
agent: claude
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/subprocessors-render.ts
- src/tests/subprocessors-render.test.ts
execution_mode: code_change
owned_files:
- src/lib/subprocessors-render.ts
- src/tests/subprocessors-render.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 - API and feed renderers

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Write two pure functions that produce the **exact bytes** of the two outputs from
a checked catalog. WP05's routes call them and add no logic of their own. Keeping
the bytes here makes byte-stability testable without an Astro build.

Requirements: FR-009, FR-011, FR-013, NFR-001, C-005. Depends on: WP02.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- Run `spec-kitty agent action implement WP04 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

- **The bytes.** `contracts/subprocessors-api.contract.md` and `contracts/subprocessors-feed.contract.md` define them. Follow them exactly.
- **Shared helpers.** Reuse `absolute(site, path)` and `xmlEscape(value)` from `src/lib/routes/shared.ts`. `absolute` is base-aware. Read it, and do not re-implement it.
- **Precedents.**
  - `src/lib/routes/rss.ts` for the RSS channel and item layout (indentation, `atom:link` self).
  - The other `api/*.json` routes (for example `src/lib/routes/bibliography.ts`) for JSON serialisation: indentation and trailing newline. Match them.
- **Inputs.** The inputs are WP02's `checkSubprocessorCatalog` result: `normalised` records and `changes`. Accept a narrow typed input, not the whole result, so tests can build it by hand.
- **Red first.**

## Subtasks

### T014 — Red-first tests (`src/tests/subprocessors-render.test.ts`)

Build a fixed input by hand: three normalised records and four changes, including a future-dated one.

**API document.**
- It deep-equals the contract shape.
- Key order is exact: compare `JSON.stringify` output.
- Absent optional keys are omitted, never `null`.
- `_links.self` and `_links.feed` are absolute.
- Under a base of `/docs/`, URLs carry the base. Copy how existing route tests fake `site` and the base.

**Feed.**
- It is well-formed XML. Parse it with a light check, or assert the structure with string matching as `rss.ts` tests do. Find and mirror them.
- There is one `<item>` per change, in change order.
- Titles read `Added: <name>` and `Removed: <name>`.
- The `guid` is `<feed-url>#<id>-<kind>-<date>` with `isPermaLink="false"`.
- `pubDate` is the date at 00:00:00 GMT.
- There is no `lastBuildDate`.
- XML special characters in a name are escaped. Use a fixture name like `Ampersand & <Co>`.

**Empty catalog.** The API has `count: 0`, `records: []` and `changes: []`. The feed is a valid channel with no items.

**Item link.**
- It defaults to the API document URL.
- An optional `itemLink` parameter (a path) overrides it. WP07 will use this.

### T015 — `renderSubprocessorsApi(input, { site, title? })` returns a string

- **Document.** Holds `title` (default `"Sub-processors"`), `source`, `notice`, `count`, `records`, `changes` and `_links`, in that order.
- **Notice text.** Exactly `Structure only, not legal advice. The site owner's contract governs.`
- **Serialisation.** Use the same serialiser as the other `api/*.json` routes. If they use `JSON.stringify(x, null, 2) + '\n'`, do the same.

### T016 — `renderSubprocessorsFeed(input, { site, siteTitle, itemLink? })` returns a string

- **Channel.**
  - Title: `${siteTitle}: sub-processor changes`.
  - Link: the site home, from `absolute(site, '/')`.
  - Description: exactly as in the contract.
  - `atom:link rel="self"` pointing at `/subprocessors.xml`.
- **Items.**
  - The description is `"<name> (<id>), from|until <date>. Processing: <processing> Location: <codes joined ', '>."`.
  - Use `from` for added and `until` for removed.
  - Look the record up by id from the input.
- **Text.** Pass every text node through `xmlEscape`.

### T017 — Byte-stability

- Use `vi.useFakeTimers()` and `vi.setSystemTime()` to render the same input on two dates years apart, and under two `TZ` values if practical.
- Assert both outputs are byte-identical.
- **Positive control:** a changed input (a different `since`) produces different bytes, so the test can fail.
- Add a comment in each renderer stating it must never read the clock (C-005).

## Definition of Done

- The tests were written first and now pass.
- The outputs match the contracts exactly.
- There is no clock or environment access in `subprocessors-render.ts`, and no Astro import beyond types.
- The `itemLink` override exists and is tested.
- Full `pnpm test` passes (both tiers and mcp). Report the counts in the hand-off.

## Reviewer guidance

- Diff the rendered output against the contract examples.
- Check that the byte-stability test has its positive control.
- Check that `absolute` and `xmlEscape` are reused, not copied.

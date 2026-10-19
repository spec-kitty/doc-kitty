---
affected_files: []
cycle_number: 1
mission_slug: layout-guards-decisions-01M59CGE
reproduction_command:
reviewed_at: '2026-10-19T09:03:12Z'
reviewer_agent: claude
wp_id: WP08
---

# WP08 review feedback, cycle 1 (reviewer-renata), commit 2935956

Verdict: CHANGES REQUESTED. The serve-dist contract, webServer array, published
projects, membership spec, CI artifact plumbing and baseline workflow are all
correct and verified (see "Verified" below). The reason for rejecting is FR-012.

## Why: FR-012 is not met

FR-012 asks for "the sidebar a11y, geometry and screenshot checks" to run against
the drafts-off build. In published-light and published-dark, only axe (6 pages),
visual (2) and sidebar-membership (4, structural) run. `--list` shows 85 tests, but
150 of the 170 in the two published projects skip. That leaves NO geometry check on
the drafts-off dist. The WP prompt's "preferred" route allowed this, so the gap
comes from the plan, not from the implementer. Still, the reveal (FR-022) and the
sidebar target-size checks measure the sidebar's contents, which is the thing that
changes between the two dists. The research (option A, "about 60 to 75 s") also
budgeted for these specs to run. The orchestrator has approved the out-of-map edits
listed below.

## Findings

[HIGH] tests/a11y/target-size.spec.ts:42 - literal `testInfo.project.name !== 'light'` skips every target-size test in published-light, so the sidebar targets (desktop sidebar region + the 390px mobile-menu sidebar) are never measured on the drafts-off sidebar - replace with `test.skip(!isLightProject(testInfo), ...)` (import from ./routes). Record it as an orchestrator-approved out-of-map edit. Reviewer trial (a temp copy with the guard swapped, run against published-light): 20 passed, 9.2 s wall at 1 worker.

[HIGH] tests/a11y/layout-geometry.spec.ts:135 (FR-022 describe at :604) - the file-level literal guard skips "the current sidebar entry is revealed on load (FR-022)" in published-light. That describe uses relative `page.goto`, so it would measure the published dist through baseURL - make the FR-022 describe run in published-light and leave the frame/rail/header describes light-only. Example: change the file-level beforeEach to `test.skip(!isLightProject(testInfo) || (isPublishedProject(testInfo) && !testInfo.titlePath.includes(REVEAL_DESCRIBE)), ...)`, with `REVEAL_DESCRIBE` as a const shared with the describe title. Running the whole file in published-light is also acceptable if you record the timing: in the reviewer trial, all 37 tests passed against the published dist in 28.7 s wall. Record it as an orchestrator-approved out-of-map edit.

[MEDIUM] tests/a11y/sidebar-reveal.spec.ts:42-47 - do NOT just swap this guard. The spec drives its own throttled server, which hard-codes `example/dist` (tests/a11y/helpers/slow-server.mjs:43) and ignores baseURL. In published-light it would re-measure the drafts-on dist while appearing to cover the published one - remove 'sidebar-reveal.spec.ts' from PUBLISHED_SPECS. The FR-022 describe in layout-geometry (above) then carries the published reveal. Only if you prefer full coverage: give startSlowServer a `dist` option, pick example/dist-nodrafts and a distinct port when isPublishedProject, and swap the guard to isLightProject.

[MEDIUM] tests/a11y/routes.ts:518-526 (PUBLISHED_SPECS) - the list names specs that execute nothing in the published projects, so `--list --project published-light` overstates the lane (85 listed, 16 run) - remove every spec that intentionally does not run there: 'reading-width.spec.ts' (column/pane geometry does not depend on membership) and 'sidebar-reveal.spec.ts' (unless you take the full-coverage option above). Update the PUBLISHED_SPECS and isLightProject doc comments (routes.ts:500-517), the lane comment at routes.ts:9-20 and the playwright.config.ts header so they say exactly what runs where. Record the new `--list` count and the run/skip split in history.

[LOW] .github/workflows/update-a11y-baselines.yml:85 (job env comment above `DK_PUBLISH_DRAFTS: 'on'`) - "A baseline taken with `off` would show a sidebar without the draft pages, which the lane never screenshots" is now false: the published projects screenshot exactly that, and the new step builds it - reword it: the job-level `on` builds example/dist for the light/dark baselines, and the drafts-off step overrides it for the published baselines.

[LOW] tests/a11y/serve-dist.mjs:8 - two header comment lines run together ("A11Y_PORT the port to listen on (default 4321). This is deliberately NOT `astro dev`...") - break the line after "(default 4321)." and start the "This is deliberately NOT" paragraph on its own line.

## NFR-001 after the fix

Reviewer measurements, local, --workers=1 (the CI setting): the published projects take 30.4 s wall now. Adding target-size takes about 9 s. The FR-022 describe alone adds a few seconds, and the whole of layout-geometry adds about 29 s. Worst case is therefore about 68 s, well inside 120 s. Re-time the published projects after the change and record it.

## Verified (no change needed)

- serve-dist.mjs: drafts-on dist + expect off -> exit 1; drafts-off dist + expect on/default -> exit 1; `maybe`, `OFF`, empty -> exit 1; missing dist -> exit 1 naming <dist>/index.html; matching pairs listen. The messages name the dist, the expected and found modes and the right build command.
- playwright.config.ts: two webServers (PORT, PORT+1) with the correct DIST/EXPECT env; published projects use baseURL PORT+1; grepInvert removes exactly the 9 non-chrome axe pages (94 light tests in the same 7 files = 85 published + 9).
- sidebar-membership.spec.ts: green in all projects (7 passed, 9 skipped). Positive control (published-light baseURL -> drafts-on server): 3 failed, and the cross-server count test still passes because it reads both ports, as designed.
- ci.yml upload/download pinned to ea165f8 (v4.6.2) / d3f86a1 (v4.3.0); needs/ci-ok unchanged; the baseline workflow's drafts-off step uses the same env and command as ci.yml. Both YAML files parse; the vitest workflow guards pass (11).
- mode.ts: minimal, light/dark unchanged. .gitignore entry correct. No PNGs committed.

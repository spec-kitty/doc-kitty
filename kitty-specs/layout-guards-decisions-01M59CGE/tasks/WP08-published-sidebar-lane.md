---
work_package_id: WP08
title: Published-sidebar lane
dependencies:
- WP06
requirement_refs:
- FR-012
- FR-013
- FR-014
- NFR-001
- C-001
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: 4d834dee104d099bfa8287ed9a85abe7251851aa
created_at: '2026-10-19T08:38:04.291608+00:00'
subtasks:
- T040
- T041
- T042
- T043
- T044
- T045
phase: Phase 3 - Guards
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: tests/a11y/
create_intent:
- tests/a11y/sidebar-membership.spec.ts
execution_mode: code_change
model: ''
owned_files:
- tests/a11y/serve-dist.mjs
- playwright.config.ts
- tests/a11y/sidebar-membership.spec.ts
- tests/a11y/routes.ts
- .github/workflows/ci.yml
- .github/workflows/update-a11y-baselines.yml
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP08 – Published-sidebar lane

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## ⚠️ IMPORTANT: Review Feedback

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_ref` field in the event log (via `spec-kitty agent tasks status`).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Report progress**: As you address each feedback item, record what you changed with `spec-kitty agent tasks add-history <WPID> --note "..."` (stored in the status event log).

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`,````bash`

---

## Objectives & Success Criteria

Measure the sidebar that readers see, the drafts-off build, in the same CI job as
today's lane (#200). Make it impossible for a project to measure the wrong dist.
When this WP is done:

- `tests/a11y/serve-dist.mjs` takes the dist and the expected draft mode from its
  environment. It exits non-zero on a mismatch in either direction, or on an
  unknown value
  (`kitty-specs/layout-guards-decisions-01M59CGE/contracts/a11y-server-env.md`).
- `playwright.config.ts` has two web servers and two more projects,
  `published-light` and `published-dark`. They serve `example/dist-nodrafts` and run
  only the sidebar-relevant specs.
- `tests/a11y/sidebar-membership.spec.ts` asserts that draft entries are in the
  drafts-on sidebar and not in the published one, and that prev/next links skip the
  drafts in the published build.
- CI uploads `dist-nodrafts` and the a11y job runs all four projects, adding at most
  120 s and no build (NFR-001).
- The baseline workflow builds both dists, so one run regenerates both baseline
  sets.

Requirements: FR-012, FR-013, FR-014, NFR-001, C-001.

## Context & Constraints

- **Research** (Alphonso, #200 in
  `docs/architecture/research/layout-guards-and-decisions.md`):
  - `ci.yml` already builds `example/dist-nodrafts` with `DK_OUTDIR: dist-nodrafts`
    and `DK_PUBLISH_DRAFTS: off` (around lines 241 to 276), and runs the artifact,
    link and redirect gates on it, but never uploads it.
  - The a11y job downloads only `example-dist` (around lines 301 to 305), into the
    `mcr.microsoft.com/playwright:v1.62.1-noble` container.
  - Between the dists: every sidebar loses 4 links (84 to 80): draft-persona,
    `adr/template`, track-consignment and markua-footnotes-malformed. The draft deck
    is never in a sidebar.
  - 8 pages change their prev/next links. Example: getting-started's "next" is
    markua-footnotes-malformed in drafts-on and markua-footnotes-showcase in
    drafts-off.
  - The `chrome-1920` screenshot passed against the drafts-on baseline despite 4
    missing rows (1.35% diff under `maxDiffPixelRatio: 0.01`). So the screenshot is
    a weak guard; the structural membership spec is the real one.
  - All current sidebar specs pass on drafts-off.
- **`serve-dist.mjs` today** (lines 96 to 120): it hard-codes `example/dist`, checks
  the draft sentinel `adr/template/index.html`, and only warns with advice to "run
  `pnpm build:a11y`", which is wrong for a deliberate drafts-off server.
- **`playwright.config.ts` today**: one `webServer` (`node tests/a11y/serve-dist.mjs`,
  url `${BASE_URL}/doc-kitty/`, `reuseExistingServer: !CI`), two projects (light
  and dark), and `snapshotPathTemplate` with `{projectName}`. The published
  projects therefore get their own baseline files automatically.
- **Baseline workflow**: `.github/workflows/update-a11y-baselines.yml`. It is
  dispatched with `target_branch`, builds with `DK_PUBLISH_DRAFTS: 'on'` (line 80),
  then runs `pnpm test:a11y --update-snapshots`. A dispatch uses the workflow file
  from the ref it is dispatched from (see its header).
- **Do not regenerate baselines** (C-001). The published projects' PNG baselines do
  not exist yet, so their screenshot assertions fail until the orchestrator
  dispatches the workflow after all lanes merge. That is expected. Say so in your
  history, and make sure non-screenshot assertions pass locally.
- **Spec selection for the published projects** (`testMatch`):
  - `layout-geometry.spec.ts`;
  - `visual.spec.ts` (`chrome-1920` and home; check the spec for how to limit it to
    those; if it has more, filter by test title with `grep` in the project);
  - `axe.spec.ts` (sidebar pages only; check how routes are chosen);
  - `sidebar-reveal.spec.ts` (WP03);
  - `reading-width.spec.ts`;
  - `target-size.spec.ts` (WP06);
  - `sidebar-membership.spec.ts`.

  Leave out the deck, Markua, Gherkin, glossary and diagram specs; they do not
  depend on the sidebar.
- **Local Playwright**: use an uncommitted config with
  `executablePath: '/opt/pw-browsers/chromium'`. Build both dists locally:
  `pnpm build:a11y` and `DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build`.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

```bash
spec-kitty agent action implement WP08 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T040 – Give the a11y server a dist and an expected draft mode

- **Steps**:
  1. Read `DK_A11Y_DIST` (default `example/dist`, resolved from the repo root) and
     `DK_A11Y_EXPECT_DRAFTS` (default `on`; only `on` or `off`; anything else exits
     1).
  2. Before `listen`:
     - if `<dist>/index.html` is missing, exit 1 and name the path;
     - check the sentinel. With drafts present and `off` expected, or drafts absent
       and `on` expected, write one stderr line naming the dist, the expected mode,
       the found mode and the build command that makes the right dist, then
       `process.exit(1)`.
  3. Keep the existing sentinel comment and update it: the server now serves either
     mode on purpose.
  4. **Red/green proof** (record in history):
     - `DK_A11Y_EXPECT_DRAFTS=off node tests/a11y/serve-dist.mjs` with the drafts-on
       dist must exit 1;
     - `=on` with the drafts-off dist must exit 1;
     - `=maybe` must exit 1;
     - the matching pairs must listen.

### Subtask T041 – Add the published Playwright projects and a second web server

- **Steps**:
  1. Turn `webServer` into an array of two entries:
     - drafts-on on `PORT`, with env `DK_A11Y_DIST=example/dist` and
       `DK_A11Y_EXPECT_DRAFTS=on`;
     - drafts-off on `PORT + 1`, with env `DK_A11Y_DIST=example/dist-nodrafts`,
       `DK_A11Y_EXPECT_DRAFTS=off` and `A11Y_PORT` set to `PORT + 1`.

     Both use `url: …/doc-kitty/`, the same timeout, and
     `reuseExistingServer: !process.env.CI`.
  2. Add `published-light` and `published-dark`. Spread the same `devices['Desktop Chrome']`
     and colour scheme as `light` and `dark`, set
     `use.baseURL = http://localhost:${PORT + 1}`, and set `testMatch` to the spec
     list in Context.
  3. Specs that skip non-light projects (`testInfo.project.name !== 'light'`) would
     skip `published-light` too. Decide one rule and apply it everywhere you own:
     - **Preferred.** Add a tiny exported helper in `routes.ts`, such as
       `isLightProject(testInfo)` returning true for `light` and `published-light`.
       Specs you do not own keep their literal check, which leaves their geometry
       running only in `light`. That is acceptable: geometry does not depend on
       membership. Record which specs actually run in the published projects.
     - Alternatively, project `metadata` (`{ colourMode: 'light', published: true }`).

     Either way, the published projects must run at least the membership spec, axe
     and the visual sidebar screenshot. Check by listing tests with
     `--project published-light --list`.
  4. Update the config's header comment: the lane now covers both dists.

### Subtask T042 – Write `sidebar-membership.spec.ts`

- **Steps**:
  1. Use a fixture of expected draft sidebar slugs. Import the constant if one is
     shared; otherwise declare it with a comment pointing at
     `src/tests/draft-publication-build.test.ts`'s `SIDEBAR_DRAFTS`, which is the
     source of truth. Also read the slugs from the dist itself, so the spec cannot
     drift: fetch a page in each project and collect the `#starlight__sidebar`
     hrefs.
  2. In the drafts-on projects, every draft slug is in the sidebar. In the
     published projects, none is.
  3. In the published projects, `guides/getting-started`'s "next" link points at
     `markua-footnotes-showcase`, not the malformed draft.
  4. Count: the published sidebar has exactly 4 fewer links than drafts-on, read
     from the two servers in one test. This works because both servers are up.
  5. This spec runs in all four projects. It is structural, so the colour mode does
     not matter; skip dark and published-dark to save time.
- **Positive control**: point the published project at the drafts-on server, for
  example with a temporary `baseURL` override in a scratch run. The spec must go
  red. Record it.

### Subtask T043 – Upload `dist-nodrafts` and feed it to the a11y job

- **Steps** in `.github/workflows/ci.yml`:
  1. After the drafts-off gates in the build-example job, add an
     `actions/upload-artifact` step pinned to the same SHA as the existing upload
     (`ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2`), with
     `name: example-dist-nodrafts` and `path: example/dist-nodrafts`.
  2. In the a11y job, add a second `actions/download-artifact` step pinned to the
     same SHA as the existing one, with `name: example-dist-nodrafts` and
     `path: example/dist-nodrafts`.
  3. Leave `pnpm test:a11y` as is: it runs all projects. Change neither the `needs`
     graph nor `ci-ok`.
  4. Keep the repo's pinned-SHA convention for every action.

### Subtask T044 – Build both dists in the baseline workflow

- **Steps** in `.github/workflows/update-a11y-baselines.yml`:
  1. After "Build example site", add a step that builds the drafts-off dist exactly
     as `ci.yml` does: same env (`DK_PUBLISH_DRAFTS: 'off'`,
     `DK_OUTDIR: dist-nodrafts`) and same command.
  2. Update the header comment: one run regenerates the drafts-on and the published
     baselines (C-001).
  3. Leave the dispatch, push and PR steps unchanged.

### Subtask T045 – Update the lane comments in `routes.ts` and the config

- **Steps**:
  1. `tests/a11y/routes.ts`, lines 9 to 15, states the drafts-on assumption as a
     fixed rule. Rewrite it: the light and dark projects serve drafts-on, the
     published projects serve drafts-off, and here is which specs run where.
  2. Add the helper from T041 here, if chosen.
  3. Check that every comment mentioning `serve-dist.mjs`'s warning now describes
     the fatal check.

## Test Strategy

```bash
pnpm build:a11y
DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build
npx playwright test -c <local-config> --list --project published-light
npx playwright test -c <local-config> tests/a11y/sidebar-membership.spec.ts
npx playwright test -c <local-config> --project published-light --project light   # screenshots in published-* fail until baselines exist; everything else green
```

Time the published projects' run locally and record it (NFR-001 budget: 120 s in
CI).

## Risks & Mitigations

- **Port collision locally.** Allow `A11Y_PORT` to override as today; the second
  port is derived from it.
- **The published projects run every spec** and blow the budget. `testMatch` is
  explicit; check with `--list`.
- **A YAML mistake breaks CI.** Run `npx --yes @action-validator/cli` if it is
  available. If not, at least run `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" <file>`
  on both workflow files.

## Review Guidance

- The server check is fatal both ways, and an unknown value is fatal. The proof is
  in the history.
- The published projects list exactly the sidebar specs.
- Membership is asserted structurally, with a positive control.
- CI uploads and downloads both dists with pinned actions; `ci-ok` is untouched.
- The baseline workflow builds both dists.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP08 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP08 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`

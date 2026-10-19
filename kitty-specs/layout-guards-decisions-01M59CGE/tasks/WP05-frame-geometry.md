---
work_package_id: WP05
title: 'Frame geometry: cap, search alignment, toggle clearance, persona'
dependencies:
- WP01
requirement_refs:
- FR-005
- FR-006
- FR-007
- FR-008
- NFR-004
- NFR-006
- SC-001
- SC-004
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: 08df796a9d36bf267792dbfd3977b9d5241d8ae7
created_at: '2026-10-19T07:19:06.443078+00:00'
subtasks:
- T022
- T023
- T024
- T025
- T026
- T027
- T028
- T029
phase: Phase 2 - Reader-visible changes
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/styles/
create_intent:
- tests/a11y/frame-alignment.spec.ts
- tests/a11y/persona-card.spec.ts
execution_mode: code_change
model: ''
owned_files:
- src/styles/theme.css
- src/styles/dk-components.css
- src/styles/toc-rail.css
- src/lib/theme.ts
- src/layouts/Persona.astro
- src/tests/layout-css-contract.test.ts
- tests/a11y/frame-alignment.spec.ts
- tests/a11y/persona-card.spec.ts
- tests/a11y/layout-geometry.spec.ts
- tests/a11y/reading-width.spec.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP05 – Frame geometry: cap, search alignment, toggle clearance, persona

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `frontend-freddy`
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

Apply four owner decisions through tokens and CSS that a site can still override.
Each one sits behind a test written first.

| Issue | Decision | Requirement |
| --- | --- | --- |
| #216 | The header search starts at the reading column's start (±1 px) on rail, no-rail and collapsed-rail pages, at 1440, 1920 and 2560, uncapped and capped | FR-005, SC-001 |
| #217 | With the rail collapsed, the reading column ends ≥ 4 px before the toggle at every width from 72rem; the pane gets end padding of at least toggle width + 4 px below 84rem | FR-006 |
| #205 | `--dk-width-frame` defaults to 120rem; `:root { --dk-width-frame: 100% }` restores full width; every layout at ≤ 1920 px is unchanged within 0.5 px | FR-007, NFR-006, SC-004 |
| #206 | The persona card is start-aligned with the column and as wide as the metadata band (`--dk-width-band`, 50rem); `--dk-width-passport` is still the override hook | FR-008 |

Also: there are 0 new axe violations and the reading-column CLS stays 0 (NFR-004).
The header markup stays byte-identical to stock: CSS only, no markup
(`sidebar-frame-header-carrier-01M4T3CB#NFR-007`).

## Context & Constraints

- **Measured state on `main`** (research note, sections #204, #205, #206 and New
  findings):
  - **Rail page, expanded.** Column x / search x:
    - 1440: 312 / 323
    - 1920: 480 / 456
    - 2560: 800 / 776
  - **No-rail page.** Column and search both at 384 (1440), 624 (1920) and 944
    (2560). The no-rail page is already aligned.
  - **Rail collapsed.** The search stays at the expanded position: 168 px off at
    1920 and 2560, 61 px off at 1440.
  - **1152 to 1295 px, collapsed.** The column box ends 7 px past the toggle start:
    1127 vs 1120 at 1152, 1255 vs 1248 at 1280. With Inter, A5b reads −1.77 at
    1280; it is green in CI only because of the fallback font.
  - **Persona at 1920.** Column 624..1584, card 624..1136 (512 wide), so 448 px are
    blank. At band width the card is 624..1424 (800 wide).
  - **2560 with the 120rem default.** On a rail page there are 192 px each side.
- **Measurement pages**:
  - rail page: `/doc-kitty/guides/markua-showcase/`;
  - no-rail page: `/doc-kitty/guides/getting-started/`;
  - persona: `/doc-kitty/context/audience/example-persona/`.
- **Selectors**:
  - column: `.main-pane .sl-container`, or the selector `layout-geometry.spec.ts`
    measures (reuse it);
  - search: `header button[data-open-modal]`. The `site-search` element is
    `display: contents` and measures x=0;
  - toggle: `#dk-toc-toggle` or `.dk-toc-toggle`.
- **CSS you own, and its cascade notes**:
  - `src/styles/dk-components.css`, lines 553 to 715:
    - frame cap `.main-frame { max-width: var(--dk-width-frame) }`;
    - `--dk-frame-gutter`;
    - `@property --dk-width-frame { initial-value: 100% }`;
    - header inset `header.header { padding-inline: calc(var(--sl-nav-pad-x) + var(--dk-frame-gutter)) }`;
    - the `.main-pane` width and centring rules.

    Its comment at about line 569 says "Starlight 0.32 has no cascade layers". That
    is stale: 0.42 wraps its CSS in `@layer starlight.core`, and the toolkit's
    unlayered rules win by layer order, whatever their specificity. Fix the comment.
  - `src/styles/toc-rail.css`:
    - the toggle placement (around lines 110 to 135);
    - the collapsed hairline and the recentre rule (around 150 to 180);
    - duplicate rail-link minimums at lines 29 to 33
      (`nav[aria-labelledby='starlight__on-this-page'] a { min-height: 24px }`) and
      at about 189 (`.right-sidebar-panel a { min-block-size: 1.5rem }`). Keep one.
      Both produce exactly 24.0 px; keep whichever covers the desktop rail, and
      prove it with the measurement.
  - Starlight's header grid (`Header.astro`, 0.42.6) sets its first track from
    `--__main-column-fr`, `--__sidebar-width` and `--__toc-width`, which assume
    stock geometry. The toolkit no longer uses that geometry.
- **Tokens**: `src/styles/theme.css`, lines 84 to 91 (`--dk-width-content: 60rem`,
  `--dk-width-band: 50rem`, `--dk-width-passport: 32rem`,
  `--dk-width-frame: 100%`), mirrored in `src/lib/theme.ts`, lines 209 to 215.
  `src/tests/layout-css-contract.test.ts`, lines 99 to 116, pins the `@property`
  registration and the `100%` default; update it.
- **Existing geometry tests you own**: `tests/a11y/layout-geometry.spec.ts`.
  - Its header comment has the A1 to A11 legend and a per-width table.
  - A1 at 2560 assumes a full-width frame.
  - A10 is collapsed centring; your end padding changes centring between 1152 and
    1344.
  - The capped-frame describe is around line 330.
  - The FR-022 reveal and CLS tests (lines 463 to 560) must stay untouched and
    green.

  `tests/a11y/reading-width.spec.ts`: R1 at 2560 (lines 121 to 135) assumes
  uncapped.
- **Design (research D-03)**: make the column's start one toolkit-owned length, set
  where the toolkit centres the column and changed by the collapsed rule. The
  header's first grid track then uses that length, through an unlayered rule on the
  stock header's inner `.header` element only. A theme that fills `dk:site-header`
  replaces that element and is unaffected.
- **Local Playwright**: use an uncommitted config with
  `launchOptions.executablePath: '/opt/pw-browsers/chromium'`. Visual screenshots
  differ locally; ignore `visual.spec.ts` locally. Never write baselines
  (`--update-snapshots` is forbidden, C-001).

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

```bash
spec-kitty agent action implement WP05 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

Do T022 to T025 first, all red, and record the red output. Then T026 to T028 turn
them green, and T029 moves the old expectations. Every new spec file is
light-project only, using the `test.skip(testInfo.project.name !== 'light', …)`
pattern from `layout-geometry.spec.ts`.

### Subtask T022 – Red first: header search tracks the reading column

- **Steps**: create `tests/a11y/frame-alignment.spec.ts` with a describe for #216:
  1. A helper that loads a URL at a width (viewport height 900), optionally
     collapsed (copy how `layout-geometry.spec.ts` collapses the rail: through the
     toggle, or by seeding the stored preference), optionally with injected CSS
     (`page.addStyleTag`). It returns the column and search `getBoundingClientRect()`
     x values after the same settle step the other specs use.
  2. Matrix:
     - pages: rail page, rail page collapsed, no-rail page;
     - widths: 1440, 1920, 2560;
     - frame: default (after T026, 120rem), `100%`, `90rem`.

     For every cell, `expect.soft(Math.abs(search.x - column.x)).toBeLessThanOrEqual(1)`,
     with a message naming the page, state, width and frame.
  3. Run it on today's dist. It must fail on the rail and collapsed cells: −24 at
     1920 and 2560, and up to 168 collapsed. Record the red output.

### Subtask T023 – Red first: collapsed column clears the toggle

- **Steps** in the same file, a describe for #217:
  1. Collapse the rail on the rail page. At 1152, 1200, 1280, 1295, 1296, 1344,
     1440, 1920 and 2560, measure the column box's inline end and the toggle's
     inline start. Assert `toggle.start - column.end >= 4`.
  2. Measure boxes, not text, so the check holds with any font.
  3. Add a right-to-left case at 1280 (mirror: column start ≥ toggle end + 4). Copy
     how the right-to-left describe in `layout-geometry.spec.ts` sets `dir`.
  4. Today it is red at 1152 and 1280 (−7). Record it.

### Subtask T024 – Red first: 120rem default, opt-out, narrow layouts unchanged

- **Steps** in the same file:
  1. **Default cap.** At 2560 the frame is 1920 px wide (120rem at 16 px) and
     centred: start at 320 ±0.5. On the rail page the space beside the column is
     192 px each side ±1.
  2. **Opt-out.** With `:root { --dk-width-frame: 100% }` injected, the frame at 2560
     is 2560 wide, which is today's behaviour.
  3. **NFR-006.**
     - Before changing anything, record the column x and width of the rail page
       (expanded and collapsed), the no-rail page and the persona page, at 1152,
       1280, 1440, 1600 and 1920, on today's build.
     - Put them in a `const NARROW_BASELINE = { … }` with a comment that says they
       were measured on the commit before WP05, and name that commit.
     - Assert the new build matches within 0.5 px.
     - **Exceptions.** Values that #216 or #217 move on purpose are not baselines:
       the collapsed column between 1152 and 1344 shrinks by the new padding. List
       them as exceptions with the reason. Every other cell must match.
  4. Red today: the default-cap assertion fails at 2560.

### Subtask T025 – Red first: persona card start-aligned at band width

- **Steps**: create `tests/a11y/persona-card.spec.ts`:
  1. At 1920 and 1280, on the persona page:
     - card start (`.dk-passport`) = column start ±1;
     - card width = min(800, column width) ±1;
     - the page `h1` start = card start ±1, so they share one left edge.
  2. Opt-out hook: with `:root { --dk-width-passport: 32rem }` injected, the card is
     512 wide.
  3. Red today: the width is 512, not 800.

### Subtask T026 – Change the frame and passport token defaults

- **Steps**:
  1. In `theme.css`, set `--dk-width-frame: 120rem;` and
     `--dk-width-passport: var(--dk-width-band);`. Check that the token pipeline
     accepts a `var()` value: `theme.ts` may validate token values. If not, use
     `50rem` and comment that it equals the band.
  2. In `theme.ts`, mirror both values in the registry and its doc comments.
  3. In `dk-components.css`, set `@property --dk-width-frame { initial-value: 120rem; }`,
     so an invalid value still gives the default (FR-003 of the earlier mission). Fix
     the comment block at lines 560 to 583: the frame is capped at 120rem by default
     (ADR-0062); a site restores full width with `100%`; the example cap is 120rem,
     not 90rem.
  4. Check that the gutter formula stays non-negative and is 0 at ≤ 1920 px.
  5. In `layout-css-contract.test.ts`, change the expected default and the initial
     value to `120rem`, and keep the "registered" assertion. Rename the test text
     "computes to 100%" to "computes to the 120rem default".
  6. In `Persona.astro`, keep `max-width: var(--dk-width-passport)` and the `margin`
     (start alignment is the decision). Update the doc comment: the card defaults to
     band width; centring was rejected (ADR in WP01, `theming.md`).

### Subtask T027 – Share one column-start length with the header's first track

- **Purpose**: #216. On rail pages and collapsed pages the header search must start
  where the column starts.
- **Steps**:
  1. Derive the column's start relative to the header's content box from the same
     lengths the pane uses:
     - sidebar width;
     - pane width (expanded, `100% - sidebar` with the rail; collapsed, full);
     - `--sl-content-width`;
     - the pane's inline padding (the `--sl-content-pad-x`-like values Starlight
       uses).

     Expose it as one custom property (for example `--dk-column-inline-start`),
     defined on `:root` or `html` beside the `.main-pane` rules. Redefine it in the
     collapsed rule in `toc-rail.css` and for pages without a sidebar.
  2. Add an unlayered rule in `dk-components.css`, inside the `72rem` media query or
     wherever the rail exists, that sets the stock header's inner `.header`
     `grid-template-columns` first track from that property: the first track ends
     where the search must start, minus `--sl-nav-gap`, matching how Starlight's
     formula reserves the gap. Use logical properties only; right-to-left must
     mirror.
  3. Starlight's own track also sets a minimum (the title width). Keep
     `minmax(<your length>, auto)` so a long site title still pushes the search
     right instead of overlapping it.
  4. Iterate against T022 until every cell is green. Then run all of
     `layout-geometry.spec.ts`: A7 (header first and last items) must stay green.
- **Notes**: Do not use Starlight's private `--__main-column-fr`. If it proves
  unavoidable, stop and record why in the history before using it.

### Subtask T028 – Pad the collapsed pane past the toggle; tidy the rail sheet

- **Steps**:
  1. In `toc-rail.css`, within the collapsed state and below 84rem: the pane's end
     padding must be at least `toggle width + 4px`, while the toggle is 32 px. Derive
     the width from the toggle's own size if it is a token; if not, add one (for
     example `--dk-toc-toggle-size: 2rem`) and use it in both places. Prefer
     `max(<current end padding>, toggle + 4px)`, so wider screens are untouched.
     The column must still be centred in the space left. Check A10.
  2. Fix the comment that says the collapsed column is "capped and centred at every
     width from 72rem, so the button is clear of the text". Say what is true now.
  3. Remove the duplicate rail-link minimum (see Context). Re-measure that rail
     outline links are still at least 24 px tall at 1280 and 1920 on a dense-outline
     page, such as a generated behaviour page.
  4. Fix the "no cascade layers" comment in this file's header if it has one.
- **Validation**: T023 is green, including right-to-left.

### Subtask T029 – Move existing expectations the default cap changes

- **Steps**:
  1. In `layout-geometry.spec.ts`:
     - The "default frame" describe: at 2560 the frame is now 1920 and centred, so
       A1 takes the cap. Update the per-width table in the header comment.
     - A10 at 1152 and 1280: the new end padding makes the collapsed column's
       centring asymmetric if A10 measures against the pane edges. Update A10 to
       centre within the padded area, with a comment citing #217. Do not loosen the
       tolerance.
     - The capped-frame describe (90rem and 70rem caps) keeps passing.
     - "An invalid frame token at 1920px gives exactly the default layout": at 1920
       the default and full width agree, so it still passes. Add the same check at
       2560, where the default (1920) differs from full width (2560); that is where
       the test now proves something.
     - Do not touch the FR-022 and CLS tests.
  2. In `reading-width.spec.ts`: R1 at 2560, expanded and collapsed, must hold under
     the 120rem default. Add one R1 case at 2560 with `--dk-width-frame: 100%` so the
     uncapped geometry stays covered.
  3. Run the full a11y lane locally against a fresh `pnpm build:a11y`, light
     project, apart from visual: `layout-geometry`, `reading-width`, `toc-rail`,
     `frame-alignment`, `persona-card`, `axe` and `starlight-layer-parity`. All
     green.

## Test Strategy

```bash
pnpm build:a11y
npx playwright test -c <local-config> tests/a11y/frame-alignment.spec.ts tests/a11y/persona-card.spec.ts \
  tests/a11y/layout-geometry.spec.ts tests/a11y/reading-width.spec.ts tests/a11y/toc-rail.interaction.spec.ts \
  tests/a11y/axe.spec.ts tests/a11y/starlight-layer-parity.spec.ts
pnpm test -- tests/layout-css-contract.test.ts
pnpm --filter @spec-kitty/doc-toolkit typecheck
pnpm lint
```

Run axe in both projects (`--project light --project dark`).

## Risks & Mitigations

- **Changing the header markup.** It must not change; `header-carrier.test.ts` in
  the build project guards it. Run it once at the end.
- **The default cap moves 1920 px layouts.** It must not; NFR-006's
  `NARROW_BASELINE` guards it.
- **Specificity fights.** Starlight is layered now, so an unlayered toolkit rule
  always wins. Do not add `!important`.
- **The screenshot baselines (`chrome-1920`, `home`) will differ.** That is expected;
  they are regenerated once after all lanes merge (C-001). Never regenerate them
  locally.

## Review Guidance

- Red-first output for T022 to T025 is in the history, with the green run after.
- The `NARROW_BASELINE` commit is named, and every exception has a reason.
- There is no private `--__*` dependency, or its justification is recorded.
- The right-to-left cases pass.
- Stale comments (0.32, no cascade layers, "capped and centred from 72rem", the
  90rem example) are fixed in the owned files.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP05 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP05 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`

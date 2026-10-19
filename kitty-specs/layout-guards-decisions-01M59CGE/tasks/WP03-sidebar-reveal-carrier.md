---
work_package_id: WP03
title: Sidebar reveal carrier
dependencies:
- WP01
requirement_refs:
- FR-004
- NFR-005
- C-002
- SC-002
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: fc98328e758f54728aff6099d892baf2edbb8869
created_at: '2026-10-19T07:18:42.417576+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
- T017
phase: Phase 2 - Reader-visible changes
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/Sidebar.astro
- tests/a11y/sidebar-reveal.spec.ts
- tests/a11y/helpers/slow-server.mjs
execution_mode: code_change
model: ''
owned_files:
- src/components/Sidebar.astro
- src/lib/config.ts
- src/lib/route-shaping.ts
- src/tests/route-shaping.test.ts
- src/tests/config-invariants.test.ts
- src/scripts/assert-chrome-artifacts.mjs
- tests/a11y/sidebar-reveal.spec.ts
- tests/a11y/helpers/slow-server.mjs
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP03 – Sidebar reveal carrier

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

The current sidebar entry is revealed before the sidebar is first painted, by an
inline script placed right after Starlight's sidebar tree, through a new sixth
carrier (#203, ADR-0063). The same carrier map also gets a test-only switch that
drops the `Header` carrier, which WP04 needs. When this WP is done:

- `tests/a11y/sidebar-reveal.spec.ts` is red on `feat/layout-guards-decisions`
  before your code change and green after it (NFR-005: scroll position at first
  paint equals the revealed position within 1 px, in three load scenarios).
- Starlight's in-session restore still wins over the reveal.
- With the narrow menu closed, nothing scrolls; opening the menu still reveals the
  entry.
- The carrier map has exactly six entries, with or without a theme. A consumer's
  escape hatch still cannot add a seventh.
- The reveal script is no longer a head entry.
- The built output has exactly one reveal script per page with a sidebar, after
  Starlight's restore script. `assert:artifacts` checks it.
- `DK_INTERNAL_STOCK_HEADER=on` drops only `Header` from the carrier map. It is off
  by default and has unit tests.

Requirements: FR-004, NFR-005, C-002, SC-002. The switch is needed by FR-003
(WP04).

## Context & Constraints

- **Decision records**: ADR-0063 (written in WP01), research D-01 and D-02
  (`kitty-specs/layout-guards-decisions-01M59CGE/research.md`).
- **The reveal today**: `REVEAL_CURRENT_SCRIPT` in `src/lib/route-shaping.ts`
  (around lines 427 to 456). It is a raw string, a classic inline script.
  - When `document.readyState === 'loading'` it waits for `DOMContentLoaded`;
    otherwise it runs at once.
  - It sets `#starlight__sidebar`'s `scrollTop` so the `[aria-current="page"]`
    entry is centred, but only if the entry is outside the visible pane.
  - It adds a `toggle` listener for the mobile popover.
  - **Important**: an inline script in the body runs while the parser is still
    going, so `readyState` is `'loading'` there. Left unchanged, it would still
    wait for `DOMContentLoaded` and nothing would improve. T013 makes it run at
    once.
- **Head wiring**: `src/lib/config.ts`, around lines 545 to 556, has
  `{ tag: 'script', content: REVEAL_CURRENT_SCRIPT }` in `head`. The carriers map is
  around lines 285 to 298, and is applied after `...overrides` (comment around line
  589).
- **Starlight 0.42.6 source**, under
  `node_modules/.pnpm/@astrojs+starlight@0.42.6_*/node_modules/@astrojs/starlight/dist/components/`:
  - `Sidebar.astro` renders `<SidebarPersister><SidebarSublist sublist={sidebar} /></SidebarPersister>`,
    then `<div class="md:sl-hidden"><MobileMenuFooter /></div>`. It takes no props
    and reads `Astro.locals.starlightRoute`.
  - `SidebarPersister.astro` wraps the tree in `<sl-sidebar-state-persist>`. Its
    closing inline script sets `#starlight__sidebar.scrollTop`, but only at 50em or
    wider and only when the stored hash matches.
  - The package exports `./components/*`, so
    `@astrojs/starlight/components/Sidebar.astro` resolves. The existing Header
    carrier imports `@astrojs/starlight/components/Header.astro` the same way.
- **Existing carrier pattern**: `src/components/Header.astro` and `Footer.astro`
  are the model. Read their header comments and copy the style: a doc comment on
  what the carrier does and why, and `Astro.props` spread onto the default.
- **Existing tests to keep green**:
  - `src/tests/route-shaping.test.ts`, the `REVEAL_CURRENT_SCRIPT` describe (line
    562), runs the script against a stub document.
  - `ships the reveal script as a head entry` (line 776) must change: the script is
    no longer in `head`.
  - `src/tests/config-invariants.test.ts`, `EXPECTED_CARRIER_KEYS` (line 78) and the
    "exactly the five carriers" tests (lines 120 to 135).
  - `tests/a11y/layout-geometry.spec.ts`, describe "the current sidebar entry is
    revealed on load (FR-022)" (line 540), and the CLS test (line 503). WP05 owns
    that file; do not edit it. Both must stay green.
- **Internal env**: `src/lib/internal-env.mjs` holds internal handoff names that
  `createConfig` writes and clears. `DK_INTERNAL_STOCK_HEADER` is not a handoff: it
  is an input that `createConfig` reads, like `DK_PUBLISH_DRAFTS`. Do **not** add it
  to `INTERNAL_ENV_NAMES`, which would clear it.
- **Local Playwright**: this container's Playwright 1.62.1 wants a browser build that
  is not installed. Use a local, uncommitted config that sets
  `launchOptions.executablePath: '/opt/pw-browsers/chromium'`, and add the file to
  `.git/info/exclude`. Visual screenshot specs fail locally because of fonts;
  ignore those. Geometry is valid locally.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

```bash
spec-kitty agent action implement WP03 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T011 – Red first: slow-server helper and `sidebar-reveal.spec.ts`

- **Purpose**: A test that fails today and passes only when the reveal happens
  before first paint. The existing CLS test cannot see a scroll inside a scroll
  container.
- **Steps**:
  1. **`tests/a11y/helpers/slow-server.mjs`.** A tiny Node HTTP proxy, or a
     Playwright `page.route` handler if that is simpler; pick one and justify it in
     a comment. It serves the dist page HTML in two flushes: everything up to and
     including `</sl-sidebar-state-persist>` at once, then the rest after
     `DELAY_MS`. A second mode delays only module scripts (`/_astro/*.js`).
     `page.route` with `route.fulfill` cannot stream two flushes, so for the
     HTML-tail scenario a real server is needed. Start it on its own port, base
     `/doc-kitty/`, from `example/dist`.
  2. **`tests/a11y/sidebar-reveal.spec.ts`**, light project only (copy the
     `test.skip(testInfo.project.name !== 'light', …)` pattern):
     - **Probe.** `page.addInitScript` installs a capture-phase `DOMContentLoaded`
       listener and a `requestAnimationFrame` chain from the first frame. Each
       records `#starlight__sidebar.scrollTop` once the element exists. Also record
       the first frame at which the sidebar element exists, which is the "first
       paint of the sidebar" sample.
     - **Page.** A deep page whose current entry is far down the sidebar. Use
       `/doc-kitty/rhetoric/book-one/chapter-15/`, the one Freddy measured: revealed
       position 2031 at 1280x600. Compute the expected revealed position in the test
       from the entry's geometry with the same centring formula, not as a magic
       number.
     - **Scenarios** at 1280x600:
       - local, no delay;
       - HTML tail delayed 2000 ms;
       - module scripts delayed 2000 ms.

       In each, assert that the scrollTop at the first sidebar sample, and at
       `DOMContentLoaded`, equals the revealed position ±1 px.
     - **In-session restore wins.** Load chapter-15 and scroll the pane to a
       different position, about 1881. Click the chapter-14 link in the sidebar and
       assert that the pane is at Starlight's restored value, not re-centred.
     - **Narrow.** At 390x600: `scrollY` is 0 and the pane's `scrollTop` is 0 with
       the menu closed. Open the menu (`button[popovertarget="starlight__sidebar"]`)
       and assert the current entry is inside the pane's visible rect.
     - **Structure.** In the served HTML, exactly one reveal script appears after
       `</sl-sidebar-state-persist>`, and Starlight's restore script appears before
       it. Read `page.content()` or fetch the HTML.
  3. Run it against today's dist (`pnpm build:a11y`). The first-paint and
     `DOMContentLoaded` assertions must fail; the measured value is 0. Paste the red
     output into your history note.
- **Files**: the two new test files.
- **Notes**: Use `expect.soft` per scenario so one run shows every failure.

### Subtask T012 – Add the `Sidebar` carrier that composes Starlight's sidebar

- **Steps**:
  1. Create `src/components/Sidebar.astro`:

     ```astro
     ---
     /*
      * DocKitty carrier: Sidebar (the sixth carrier, ADR-0063; FR-004).
      * COMPOSE: renders Starlight's own Sidebar unchanged, then the reveal script.
      * ... (explain why after-the-tree ordering means after Starlight's restore)
      */
     import Default from '@astrojs/starlight/components/Sidebar.astro';
     import { REVEAL_CURRENT_SCRIPT } from '../lib/route-shaping.js';
     ---
     <Default {...Astro.props}><slot /></Default>
     <script is:inline set:html={REVEAL_CURRENT_SCRIPT} data-dk-sidebar-reveal />
     ```

     Check how `Header.astro` imports toolkit code. The component path the toolkit
     registers is `@spec-kitty/doc-toolkit/components/Sidebar.astro`, and the import
     must resolve from both the package and the example. Use a relative import, as
     the other carriers do.
  2. Confirm the attribute order and the `aria-hidden` convention. Starlight adds
     `aria-hidden="true"` to its inline scripts for a Safari/VoiceOver bug, so do the
     same.
  3. The script must emit no `type=module`, no `defer` and no `async`. `is:inline`
     keeps it classic.
- **Notes**: Do not wrap `<Default>` in any element. The sidebar markup must stay
  Starlight's.

### Subtask T013 – Make the reveal script run inline, keep the popover re-reveal

- **Steps**:
  1. Change `REVEAL_CURRENT_SCRIPT` so it runs `r()` at once, with no
     `DOMContentLoaded` wait. Placement after the tree guarantees the pane, the
     current entry and Starlight's restore all precede it. Keep the `try/catch`,
     the "act only when outside the visible part" rule, the `scrollTop` approach
     (never `scrollIntoView`), and the popover `toggle` listener.
  2. Rewrite the doc comment above it: the reveal now ships from the `Sidebar`
     carrier, right after Starlight's tree, and why that order is after the restore.
  3. In `src/tests/route-shaping.test.ts`, update the stub-document describe:
     - The script must run at once even when `readyState === 'loading'`. Flip the
       `ranEarly` expectation, and keep a test that it does not move a pane whose
       entry is visible.
     - It must not register a `DOMContentLoaded` listener.
     - Every other existing case (centring, no current entry, no pane, popover
       toggle, no `scrollIntoView`) must still hold.
- **Validation**: `pnpm test -- tests/route-shaping.test.ts` from `src/`, or the
  repo-root equivalent; all green.

### Subtask T014 – Register `Sidebar` and drop the head reveal entry in `config.ts`

- **Steps**:
  1. Add `Sidebar: '@spec-kitty/doc-toolkit/components/Sidebar.astro'` to
     `carriers`.
  2. Remove `{ tag: 'script', content: REVEAL_CURRENT_SCRIPT }` from `head`, and its
     import if it is now unused there.
  3. Update every comment that says "five carriers" or "exactly-five" (around lines
     174, 285 to 291 and 589 to 597) to six, citing ADR-0063.
  4. In `route-shaping.test.ts`, replace `ships the reveal script as a head entry`
     with `does not ship the reveal script as a head entry` and
     `registers the Sidebar carrier that ships it`.
- **Notes**: The Starlight `components` key is exactly `Sidebar`. Confirm it in
  Starlight's `schemas/components` or its virtual-components module before relying
  on it.

### Subtask T015 – Update the carrier invariants to six

- **Steps**: In `src/tests/config-invariants.test.ts`:
  1. Add `'Sidebar'` to `EXPECTED_CARRIER_KEYS`, sorted as the list is.
  2. Rename the tests "exactly the five carriers" to "six", and fix the file's
     header comment (around line 105, "none of these may add a sixth") to say
     seventh.
  3. Keep the escape-hatch test: a consumer `components` override must not expand
     the map.
- **Validation**: the file is green.

### Subtask T016 – Add the test-only stock-header switch

- **Purpose**: Owner decision `01M59CR08D2F8D3P8T3D0GN9VD` (research D-01). WP04's
  capture script builds the real example without the `Header` carrier.
- **Steps**:
  1. In `src/lib/config.ts`, read `process.env.DK_INTERNAL_STOCK_HEADER` once, where
     `carriers` is used. When it is exactly `'on'`, omit `Header` from the map passed
     to Starlight. Any other value, including unset, keeps all six.
  2. Do not register it in `src/lib/internal-env.mjs`. Add a short comment that says
     what it is for, that consumers must not set it, and that only
     `src/scripts/capture-stock-header.mjs` uses it.
  3. Tests in `config-invariants.test.ts`, setting and restoring the variable around
     each test:
     - unset → six carriers;
     - `on` → exactly the five without `Header`;
     - `yes` or `1` → six. Only `on` counts.
- **Notes**: Keep it to a few lines. If the map is a module-level constant, compute
  the filtered copy inside the config function, so the variable is read at config
  time and not at import time.

### Subtask T017 – Assert the reveal script ships once per sidebar page

- **Steps**:
  1. In `src/scripts/assert-chrome-artifacts.mjs`, section 4 ("Carriers active",
     around line 726), add a check on a deep page with a sidebar (for example
     `guides/getting-started/index.html`). It must have exactly one
     `<script … data-dk-sidebar-reveal …>`, it must come after the index of
     `</sl-sidebar-state-persist>`, and there must be no reveal script in `<head>`.
  2. Also check a page without a sidebar, the splash home, if it has none: it has no
     reveal script.
  3. Update the section comment: five marker-emitting carriers now. Keep the wording
     about `Header` being marker-free.
  4. Run `pnpm build:a11y` and then `pnpm assert:artifacts example/dist` (green).
     Also run the drafts-off build the way CI does
     (`DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build`) and
     `node src/scripts/assert-build-artifacts.mjs example/dist-nodrafts` (green).

## Test Strategy

```bash
# unit
pnpm test -- tests/route-shaping.test.ts tests/config-invariants.test.ts   # from src/, or the repo-root test script
pnpm --filter @spec-kitty/doc-toolkit typecheck
pnpm lint
# build + artifacts
pnpm build:a11y && pnpm assert:artifacts example/dist
# browser (local uncommitted config with executablePath)
npx playwright test -c <local-config> tests/a11y/sidebar-reveal.spec.ts tests/a11y/layout-geometry.spec.ts -g "revealed on load|layout shift|sidebar reveal" --project light
```

The red-first proof (T011) and the green run both go in your history note.

## Risks & Mitigations

- **The composed sidebar's markup changes.** Compare the `#starlight__sidebar`
  innerHTML of a built page before and after, with the reveal script removed. It
  must be identical; note the result in your history.
- **Running before the current entry exists.** It cannot, because the script follows
  the tree. The structure assertion proves the order.
- **Double reveal from a leftover head script.** The head entry is removed, and the
  artifact check asserts it.
- **The popover reveal regresses on mobile.** The narrow scenario covers it.

## Review Guidance

- Red-then-green evidence for `sidebar-reveal.spec.ts` is in the history.
- The six-carrier invariant and escape-hatch tests pass.
- `DK_INTERNAL_STOCK_HEADER` is read only in `config.ts`, is not in
  `INTERNAL_ENV_NAMES`, and only exactly `on` takes effect.
- `assert:artifacts` passes on both dists.
- The typecheck passes.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP03 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP03 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`

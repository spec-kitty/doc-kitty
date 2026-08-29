---
work_package_id: WP06
title: Presentations-hub instructional banner + how-to
dependencies: []
requirement_refs:
- FR-006
- FR-007
planning_base_branch: fix/reveal-deck-remediation
merge_target_branch: fix/reveal-deck-remediation
branch_strategy: Planning artifacts for this mission were generated on fix/reveal-deck-remediation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/reveal-deck-remediation unless the human explicitly redirects the landing branch.
subtasks:
- T025
- T026
- T027
history:
- '2026-08-28: authored by /spec-kitty.tasks (planner-priti)'
agent_profile: frontend-freddy
authoritative_surface: example/docs/presentations/README.md
create_intent:
- tests/a11y/presentations-hub.spec.ts
execution_mode: code_change
owned_files:
- example/docs/presentations/README.md
- tests/a11y/presentations-hub.spec.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Run `/ad-hoc-profile-load frontend-freddy` (role: implementer) BEFORE anything else.
Apply its initialization, boundaries, directives, and tactics. Then read this WP in
full, plus:
- [../spec.md](../spec.md) — FR-006, FR-007, SC-004; US3 acceptance scenarios + the
  "guidance lives on the hub only" assumption.
- [../plan.md](../plan.md) — **IC-05** (hub banner + how-to; the surface choice and the
  Pagefind/axe risks).
- [../reviews/post-plan-squad.md](../reviews/post-plan-squad.md) — finding **E2** (a cheap
  DOM assertion so SC-004 is not purely manual).

## Objective

Give first-time readers on-page guidance to operate and export the web-hosted decks. This
is the #12 QOL request (US3, P2). Add a concise instructional banner to the presentations
hub: a purpose sentence plus a "How to use" section covering vertical-slide navigation, the
reveal.js hotkeys, and PDF export via the browser print dialog. Add one cheap DOM test so
the guidance is not purely manual.

**Surface decision (already made — do not re-litigate):** author the banner as **hub body
content** in `example/docs/presentations/README.md`. This is the plan's preferred approach
(IC-05): it is living documentation, has no layout coupling, needs no new toolkit
primitive, and cannot regress the Hub layout's Pagefind/axe behaviour. The hub README
renders through `Hub.astro` via `<slot />` (see `src/layouts/Hub.astro:102`), landing the
body inside `<main data-pagefind-body>` — so the guidance is indexed and accessible for
free. You do NOT touch `Hub.astro` or any `src/` layout.

You own exactly the hub README and a NEW test file. You do NOT own `routes.ts` (WP05 owns
it) — reuse the existing presentations-hub route by importing `BASE` read-only.

## Subtasks

### T025 — Purpose banner on the presentations hub (README body)
Edit `example/docs/presentations/README.md`. Its current body (`:11-24`) explains that
decks live out-of-frame and are derived at build time. Add a concise instructional
**banner** — a visually distinct callout — as the lead of the how-to guidance. Author it as
a Starlight aside so it reads as a banner rather than plain prose, e.g.:

```markdown
:::note[Using these slide decks]
These are web-hosted reveal.js decks. Open a deck to present it in your browser, use the
keyboard to navigate, and export it to PDF with your browser's print dialog. The
"How to use" steps below cover all three.
:::
```

- Keep the existing hub intro paragraph (it explains what the hub is) — the banner is the
  purpose sentence FR-006 asks for. Do NOT add `data-pagefind-ignore` anywhere (it would
  drop the banner text from the index — IC-05 Pagefind risk).
- Keep the front-matter valid for doc-sanity (`validate-frontmatter.mjs`): description
  length in range, valid `kind: Hub`.

### T026 — "How to use" section: navigation, hotkeys, PDF export
Under the banner, add a "How to use" section (a `## How to use` heading with subsections or
a list) covering all three FR-007 topics, trimmed to what the shipped reveal 6.0.1 core +
Notes build actually supports (spec assumption):
- **Vertical-slide navigation**: some slides are stacked vertically; use Down/Up (or
  Space) to move within a stack and Right/Left to move between top-level slides.
- **reveal.js hotkeys**: at least `Esc` (slide overview), `S` (speaker-notes view — the
  Notes plugin IS shipped), `F` (fullscreen), and arrows/Space (navigate). Do not document
  hotkeys the shipped build lacks.
- **PDF export**: open the deck's `?print-pdf` view (the hub already links "Print / PDF
  export" per `Hub.astro:125-129`), then use the browser's print dialog to "Save as PDF",
  and enable **"Background graphics"** so the deck styling/colours are included. This is the
  reveal 6 print path folded into its core sheet (spec assumption).

Write for a first-time reader (DIRECTIVE_047, audience-oriented): concrete steps, no jargon
without a gloss. Keep it concise — this is a banner + short how-to, not a manual.

### T027 — New DOM test `tests/a11y/presentations-hub.spec.ts` (E2)
Create `tests/a11y/presentations-hub.spec.ts` — a cheap Playwright DOM test so SC-004 is not
purely manual (finding E2). It navigates to the presentations hub and asserts the banner +
its three topics are present via `toContainText`:
- Import `BASE` (read-only) from `./routes` and navigate to `${BASE}/presentations/` (the
  presentations hub route — reuse it; do NOT add a constant to `routes.ts`, WP05 owns it).
- Assert the page `main` (or `body`) `toContainText` **distinctive PHRASES, not short
  tokens (F5)** — bare `"Esc"`, `"S"`, or `"print"` can match hub chrome/sidebar text and
  pass vacuously. Bind to phrases the banner uniquely authors: the banner's purpose sentence
  (a distinctive substring of it), a vertical-navigation phrase (e.g. `"stacked vertically"`
  or `"Down / Up"`), a speaker-notes phrase (e.g. `"speaker-notes view"`), and the literal
  **`"Background graphics"`** for the PDF-export topic. Keep the asserted strings and the
  authored copy in sync so the test stays non-vacuous. Lightweight content assertion only —
  no axe scan (the presentations hub is not in `AXE_PAGES`, and this WP does not change that).
- Follow the existing spec conventions in `tests/a11y/` (`@playwright/test` import shape,
  the `BASE`-prefixed absolute route). Keep the test independent of colour mode.

## Suggested authored copy (illustrative — trim to what ships)

```markdown
:::note[Using these slide decks]
These are web-hosted reveal.js decks. Open a deck to present it in your browser, navigate
with the keyboard, and export it to PDF from the browser's print dialog.
:::

## How to use

### Navigate the slides
- **Right / Left** (or **Space**) move between top-level slides.
- Some slides are stacked **vertically** — use **Down / Up** to move within a stack.
- Press **Esc** for the slide overview, then arrow to any slide and **Enter** to open it.

### Handy hotkeys
- **Esc** — slide overview
- **S** — speaker-notes view (opens the notes window)
- **F** — fullscreen
- **arrows / Space** — navigate

### Export a deck to PDF
1. From a deck (or the **Print / PDF export** link on this hub) open the `?print-pdf` view.
2. Open your browser's **Print** dialog and choose **Save as PDF**.
3. Enable **Background graphics** so the deck's colours and styling are included.
```

Keep it concise and audience-first; the illustrative copy above is a starting point, not a
mandate — the DoD is that all three FR-007 topics are covered for a first-time reader.

## Validation

- `pnpm test tests/a11y/presentations-hub.spec.ts` (or the a11y lane's runner) — the new
  spec passes and its `toContainText` targets match the authored copy.
- doc-sanity: `node src/scripts/validate-frontmatter.mjs` (or `pnpm run <doc-sanity task>`)
  green on the edited README.
- After `pnpm build`, confirm the banner text appears in the presentations hub's Pagefind
  fragment (it must NOT be `data-pagefind-ignore`d).

## Branch Strategy

Planning base and final merge target: `fix/reveal-deck-remediation`. Work in the worktree
allocated to this WP's lane in `lanes.json`; changes merge back into the mission branch. No
dependencies — runs in Wave 1 alongside WP01, WP03, WP04.

## Definition of Done

- The presentations hub (`example/docs/presentations/README.md`) carries a concise
  instructional banner explaining the purpose of the hosted decks (FR-006).
- A "How to use" section covers vertical-slide navigation, the reveal hotkeys (`Esc`
  overview, `S` speaker notes, `F` fullscreen, arrows/Space), and PDF export via the print
  dialog including the "Background graphics" setting (FR-007, SC-004).
- Nothing carries `data-pagefind-ignore`; the guidance stays in the indexed, accessible hub
  body (no Pagefind/axe regression — NFR-004).
- `tests/a11y/presentations-hub.spec.ts` asserts the banner + its three topics via
  `toContainText` bound to DISTINCTIVE phrases (the banner sentence, a vertical-nav phrase,
  a speaker-notes phrase, and the literal `"Background graphics"`) — never short tokens
  that match hub chrome vacuously (F5); reusing the existing hub route read-only (does not
  touch `routes.ts`).
- doc-sanity green on the edited README; the new spec passes in the a11y lane.

## Risks

- The single ownership hazard: the new test must NOT edit `routes.ts` (WP05 owns it).
  Import `BASE` read-only and navigate to the literal `/presentations/` route — importing is
  not owning.
- Adding `data-pagefind-ignore` to the banner would drop its text from the index and could
  make the `toContainText` still pass while regressing search — do not add it.
- Do NOT add the presentations hub to `AXE_PAGES` or otherwise touch WP05/WP02 files — if
  the guidance truly cannot avoid touching a file another WP owns, STOP and report the
  conflict rather than creating overlap.
- Keep the hotkey list to what reveal 6.0.1 core + Notes actually ships (assumption) —
  don't document plugins that are not loaded.

## Reviewer guidance

- Confirm the diff touches only `example/docs/presentations/README.md` and the new
  `tests/a11y/presentations-hub.spec.ts` — nothing in `src/` or `routes.ts`.
- Confirm the banner text and all three how-to topics are present and that the test's
  `toContainText` targets match the authored copy (so it is non-vacuous).
- Confirm no `data-pagefind-ignore` was introduced.

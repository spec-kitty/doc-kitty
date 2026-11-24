---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command: spec-kitty agent tasks move-task WP05 --to approved --mission large-hubs-sidebar-child-cap-01M81KGV --agent claude::reviewer-renata
reviewed_at: '2026-11-23T10:39:54Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

Approved by claude::reviewer-renata: approval:WP05

# WP05 review — cycle 1: approved

Reviewer: `claude::reviewer-renata`. Implementer: `claude::implementer-ivan`.

## Range reviewed

The review range the CLI printed (`2f89de49..2ee53a4d`) holds only coordination status commits. This is
spec-kitty #7809, a planning_artifact WP whose owned paths are outside `kitty-specs/`. I reviewed the real
diff instead: the planning branch against its base, `9621b5f8..08c9781e` (`origin/main..feat/341-sidebar-child-cap`),
7 docs files plus one lifecycle record. To check it against the code, I merged `08c9781e` onto approved lane-d
`47bb7bc8`, which holds WP01–WP04, in a separate worktree.

## Accuracy against the code (lane-d)

- **Settings and precedence.** `resolveChildCap` resolves hub `sidebar_child_cap` > section `sidebar.childCap`
  > site `sidebar.childCap` > `DEFAULT_CHILD_CAP` (50), as the guide says. The guide says the hub cap goes in
  the index page's frontmatter; `hubCaps()` reads it from the index page. The section cap comes from both
  `sections.yaml` and the charter's `sections.entries`, through the same normaliser.
- **Validation.** Site: `[dk-config] sidebar.childCap must be a positive whole number`. Section: the error names
  the file and the section `id`. Hub: I built a fixture with `sidebar_child_cap: 0`. The build exits 1 with
  `InvalidContentEntryDataError … sidebar_child_cap: Too small` and the file path. So the guide's line "stops
  the build, with a message that names the setting and where it was set" holds.
- **Export.** `./child-cap` → `lib/child-cap.ts` exports `cappedChildHidden(childCount, cap)` and
  `resolveChildCap({hub, section, site})`. The guide's import and call match.
- **UI string.** The key is `CAPPED_LABEL_KEY = 'dockitty.sidebar.cappedEntry'`, the default is
  `'{count} pages'`, and `i18n-plugin.ts` ships both. `cappedLabel` wins over the translation
  (`resolveCappedLabel`).
- **Index-less sub-folders.** `selectHubChildren` keeps only direct children (`parentOf(slug) === hub`). A
  capped group keeps only `[hubIndex, entry]`, so sub-folder groups drop out of the sidebar. The guide's warning
  and its advice (an index per sub-folder) are correct.
- **Hidden-index hub.** `shapeSidebar` caps a group only when its index link is in the tree. A hub whose index is
  hidden is left uncapped, as the guide says.
- **Rendered behaviour.** On a built capped hub:
  - on a child page, the group is `<details open>` and the entry has `aria-current="page"`;
  - on the hub page, the index link is current and the entry is not;
  - on other pages, the group is collapsed and holds the index link plus the entry.

  This matches "What a reader sees".
- **Measurements.**
  - Page sizes match the WP04 evidence exactly: 168,877 / 24,013 bytes and 163.7 / 23.5 MiB.
  - The build times (20.0 → 15.1 s) come from a fresh run. They are internally consistent: each median is the
    middle of its three runs, the size cut is 85.8% ≈ 86%, and the time cut is ≈ 24.5%. WP04 recorded
    21.5 → 13.9 s (implementer) and 27.7 → 19.0 s (reviewer); the page states its own date and method.
  - The fixture shape (1,000 + 15 = 1,015 pages) matches `site.mjs`.
  - "Alternating runs" matches cycle-2's interleaved `measure.mjs`.
  - NFR-004 (≥ 50% smaller) is met.
- **FR-010 dogfood: built.** I built the repo's `docs/` tree with the toolkit twice.
  - The `adr` folder has 80 numbered ADRs plus `template.md`: 81 children. 2 are drafts, so 79 are published.
  - With `childCap: 100`, all 81 built ADR pages are linked in the sidebar of every page, along with the index
    (82 distinct `/adr/` hrefs), and there is no capped entry.
  - Without the line, the group collapses to "79 pages".
  - So the cap line is needed, and it works.

## Gates

- `validate:docs`: ✓ 211 files, with 4 pre-existing description-length warnings.
- `validate:links`: ✓ 1851 references.
- `validate:changelog`: ✓ 2 fragments.
- markdownlint: 0 issues in the 5 touched pages.
- Vale: not run. It is not installed in this environment, and the implementer did not run it either.
- Full `pnpm test` on lane-d + WP05: exit 0. src: 216/216 files, 4344/4344 tests. mcp: 23/23 files, 181/181
  tests.

## Changelog, terminology, accessibility, FR coverage

- **Changelog fragment.** It follows `docs/changelog/unreleased/README.md`:
  - `section: Added` is the only key;
  - it is one bullet with a bold lead and `#341`;
  - it uses "Before, … Now …";
  - the link is root-relative (`docs/guides/…`);
  - it has no headings.
- **Terminology.** Hub, section, index page and sub-folder are used as in the existing guides. Nothing conflicts
  with the Terminology Canon ("Mission" for the work object).
- **Accessibility.**
  - Every code fence carries a language.
  - Headings are sentence case and in order.
  - The link text is descriptive.
- **FR coverage.**
  - FR-010: met, and checked by a build.
  - FR-011: met. The guide covers the three settings, the label and its UI string, the hint, and an example. It
    is linked from `guides/README`, `consumer-setup` and `authoring`, and the changelog fragment is present.
  - NFR-004: recorded in `large-hubs.md`.

## Non-blocking notes (fold before the PR if convenient)

1. `docs/_meta/sections.yaml` comment says "over 80 ADRs". There are exactly 80 numbered ADRs (79 published
   children). Suggest: "80 ADRs; the default cap of 50 would collapse them".
2. In the changelog, "marked current on the hub's pages" could be read as including the hub page itself, where
   the overview link is current. Suggest "on the pages inside the hub".
3. The guide's cost table writes "168.9 KB" (decimal) next to "MiB" (binary). Use bytes, as `large-hubs.md` does,
   or `kB` consistently.
4. The producer-hint snippet passes `pages.length`. The build counts published children one level down, with a
   sub-folder as one child. A short comment in the snippet would keep a generator's hint from drifting.
5. The cost tables have an empty first header cell. The repo does this elsewhere, but a header such as "Measure"
   would serve screen-reader users better.

Observation, outside WP05's scope: the capped entry carries `aria-current="page"` on child pages although it
links to the hub. This is WP03/WP04 design; axe passes, and the guide describes it accurately.

Verdict: **approved**.

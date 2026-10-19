---
title: Astro 7 and Starlight 0.42 migration spike
description: What breaks when DocKitty moves from Astro 5 and Starlight 0.32 to Astro 7 and Starlight 0.42, with the fix and owning ticket for each breakage.
doc_status: active
updated: 2026-10-18T00:00:00Z
type: Architecture
kind: Explanation
tags: [research, astro, starlight, migration, spike]
related:
  - adr/0047-relative-markdown-links
  - adr/0041-markua-footnotes
---

# Astro 7 and Starlight 0.42 migration spike

This note records the spike for issue #142 (epic #149). It ran on a throwaway
branch that was never merged. The target was Starlight 0.41 or later; the latest
release at the time, 0.42.6, met it, so the spike used that.

The verdict, against the three go criteria:

- Every breakage found has a known fix that fits the epic's tickets.
- No Markdown plugin is lost under `unified()`.
- The diagram stack renders, with the same output as `main`.

The example also builds about 48% faster.

## Versions tried

| Package | From | To | Published |
|---|---|---|---|
| `astro` | `^5.2.0` | 7.4.0 | 2026-10-15 |
| `@astrojs/starlight` | `^0.32.6` | 0.42.6 | 2026-10-08 |
| `@astrojs/markdown-remark` | transitive | 7.3.3, now a direct dependency | 2026-10-15 |
| `@astrojs/sitemap` | `^3.2.0` | 3.7.4 | 2026-08-31 |
| `@astrojs/check` | `^0.9.4` | 0.9.10, range unchanged | 2026-07-27 |

Starlight 0.42.6 needs `astro ^7.2.10` and `@astrojs/markdown-remark ^7.3.0`.
Astro 7.4.0 needs Node `>=22.22.0`, so `engines` must rise from `>=22`. The
workspace minimum-release-age policy blocked nothing, and no exclusion was
added. Astro 7.4.0 and markdown-remark 7.3.3 were three days old at install; a
policy of seven days or more would have blocked them. The new tree also brings
Vite 8 (Rolldown), the Rust compiler (`@astrojs/compiler-rs`) and Zod 4.

## Gate results

| Gate | `main` | Spike |
|---|---|---|
| Example build | pass, 77 pages | pass, same 77 pages |
| `assert:artifacts` | pass | pass after gate fix B10 |
| `assert-chrome-artifacts.mjs` | pass | pass after gate fix B10 |
| `assert:no-broken-links`, `assert:markua`, redirect coverage | pass | pass |
| Consumption test and its Vitest suite | pass, 18/18 | pass, 18/18 |
| Vitest | 2422 of 2422 | 115 fail, 2204 pass; 3 files fail at import |
| Playwright a11y, heading links on | 264 pass, 3 fail | 228 pass, 39 fail |
| Playwright a11y, heading links off | 264 pass, 3 fail | 263 pass, 4 fail |

The three failures on `main` are the known local screenshot drifts (visual brand
home twice, layout-geometry 1280px collapsed). With heading links on, the 39
spike failures are those 3, 35 from heading links (B7) and 1 from the mobile
menu (B9). With heading links off, only the 3 drifts and B9 remain.

All 21 failing Vitest files are attributed:

| Cause | Breakage | Failing tests |
|---|---|---|
| Validator and parity tests mix Zod 3 with the Zod 4 schema | B18 | 56 |
| Sidebar groups need the `items` wrapper | B3 | 20 |
| Integration-order and version pins | B16 | 12 |
| Render harness has no Markdown processor | B13 | 9, plus 1 file at import |
| Tests spawn the moved Astro bin | B15 | 10 |
| Header markup and menu button changed | B8, B9 | 4 |
| `require.resolve('@astrojs/starlight')` fails | B14 | 1, plus 2 files at import |
| `glob()` loader rethrows render errors | B12 | 3 |

B18 is product code, the frontmatter validator. The rest are test code or pins.

## Breakages

| # | Category | What fails | File | Cause | Fix | Ticket |
|---|---|---|---|---|---|---|
| B1 | Markdown pipeline | Every plugin appended by an integration is dropped with a warning | `src/lib/config.ts`, `src/lib/integrations/markdown-pipeline.ts` | Astro 7 renders Markdown with Sätteri by default | A toolkit integration sets `markdown.processor: unified()` and runs first; add `@astrojs/markdown-remark` as a dependency | #143, #119 |
| B2 | Starlight config | Build stops: `social` syntax changed | `src/lib/config.ts`, `example/astro.config.mjs`, consumer fixture | Starlight 0.33 | `social` becomes an array | #144 |
| B3 | Starlight config | Build stops on 13 sidebar groups | `src/lib/sections.ts` | Starlight 0.39 removed `autogenerate` beside `label` | Wrap in `items: [{ autogenerate }]`; built sidebar unchanged | #144 |
| B4 | Content loader | `astro sync` fails inside Starlight's schema merge | `src/lib/schema.ts`, `src/lib/glossary/load.internal.ts` | Zod 4; a Zod 3 object passed to `docsSchema({ extend })` | Use `astro/zod`, drop `zod ^3`; give `z.record` two arguments; replace `.default({})`, whose inner defaults no longer apply (masked today by `??` fallbacks) | #119 |
| B5 | Starlight config | No asides, heading links or RTL code anywhere; Markua `T>` no longer becomes a tip | `src/lib/config.ts` | Starlight 0.41+ runs its Markdown transforms only on `src/content/docs` and `markdown.processedDirs` | Add the docs root to `processedDirs` | #144 |
| B6 | Compiler strictness | Build stops: `Fragment` already declared | `src/components/MarkdownContent.astro` | The Rust compiler declares `Fragment` itself | Rename the import | #145 |
| B7 | Starlight config | 278 heading anchors appear, including inside deck slides; 35 a11y tests fail | `src/lib/config.ts`, `tests/a11y/*` | Starlight 0.34 turns heading links on by default | Decision: `headingLinks: false` (parity) or adopt anchors and rework tests and CSS | #144, #146 |
| B8 | Starlight overrides | The stock header no longer matches its pinned fixture; non-current sidebar links lose `aria-current="false"` | `src/tests/header-carrier.test.ts`, `src/tests/sidebar-build-html.test.ts` | Starlight 0.42 markup | Re-check the header carrier against 0.42, rebaseline the fixture | #144, #146 |
| B9 | Starlight overrides | `<starlight-menu-button>` is gone; the mobile menu is a popover button | `tests/a11y/layout-geometry.spec.ts`, header tests, CSS | Starlight 0.42 | Update selectors and CSS | #144, #146 |
| B10 | Gates | Two artifact checks miss code that is present | `src/scripts/assert-build-artifacts.mjs`, `src/scripts/assert-chrome-artifacts.mjs` | Vite 8 minifier emits template literals and drops the space after `:` | Make the patterns minifier-agnostic | #146 |
| B11 | Compiler output | Inline whitespace between elements disappears; extracted text reads "status:activeUpdated" | All `.astro` markup | Astro 7 `compressHTML: 'jsx'` default | Set `compressHTML: true` from the toolkit, or add explicit spaces | #145 |
| B12 | Content loader | Three failed-render bookkeeping tests fail | `src/lib/schema.ts`, `src/tests/docs-loader-includes.test.ts` | Astro 7's `glob()` loader rethrows render errors, so a failed render now fails the sync | #119 decides whether to delete the bookkeeping or keep it for another reason | #119 |
| B13 | Gates | Render harnesses crash: no renderer | `src/tests/helpers/gherkin-render-harness.ts`, `agent-page-includes.test.ts` | Astro 7 takes the renderer from the processor | Pass `processor: unified()` in harness configs | #146 |
| B14 | Gates | `require.resolve('@astrojs/starlight')` fails; about 100 tests never collected | three test files | Starlight 0.42 ships an exports map with no main entry | Resolve `@astrojs/starlight/package.json` or a subpath | #146 |
| B15 | Gates | Build tests spawn a missing file | gherkin and loader build tests | Astro 7 moved its bin to `bin/astro.mjs` | Spawn through the package `bin` | #146 |
| B16 | Gates | Integration-order, sidebar-shape and version pins fail | several `src/tests/*` | B1, B3 and the version bump | Update pins; re-prove explicit heading IDs on markdown-remark 7.3.3 | #146 |
| B17 | Build noise | New warnings: missing `i18n` collection, five deck routes reported as conflicts | `src/lib/i18n-plugin.ts`, `example/src/pages/presentations` | Starlight 0.42 and Astro 7 logging | Add an empty `i18n` collection; exclude deck pages from Starlight's catch-all | #144 |
| B18 | Gates (product) | 56 parity and metadata tests crash with `keyValidator._parse is not a function` | `src/scripts/validate-frontmatter.mjs:48`, `src/tests/schema-validator-parity.test.ts` | The validator CLI imports Zod 3 while the schema now uses Zod 4 | Move the validator to `zod@^4` (it must still run without Astro); `.passthrough()` at line 249 is deprecated and should change | #119, test edits #146 |
| B19 | Starlight CSS | `.dk-callout` top margin grows from 16px to 24px | `src/styles/dk-components.css` | Starlight 0.34 moved its CSS into a `starlight` cascade layer, so unlayered DocKitty rules that used to lose now win | Audit every DocKitty rule that used to lose to Starlight | #144 |

Checked and clean: build hooks (sitemap order, favicon, manifest, OKF export),
the diagram stack, Pagefind (1.5.2, 77 pages indexed on both), and the route
middleware. The five Starlight carriers build and pass their gates, apart from
the markup changes in B8 and B9.

## Plugins under unified()

Every marker below appears the same number of times on `main` and on the spike.
Default local builds render diagrams in the browser (client mode). Build-mode
rendering was checked separately on both trees with `DK_DIAGRAM_BUILD_RENDER=on`,
a local PlantUML server on port 8091 and the installed headless Chromium; that
output is kept as `example/dist-bm` in both worktrees (the spike and a `main` baseline).

| Plugin | Marker | Page | Count |
|---|---|---|---|
| Deck split | `<section` slides | `presentations/showcase-deck` | 7 |
| relative-md-links | Probe link `../../guides/markua-showcase.md#eq-tip` becomes `/doc-kitty/guides/markua-showcase/#eq-tip` | `plans/missions/mission-alpha` (probe added on both trees) | 1 |
| base-absolute-links | Base-prefixed `href` from an authored root link | `plans/missions/mission-alpha` | 4 |
| Diagram meta | `dk-diagram__caption` | `architecture/diagram-demonstrator` | 2 |
| Mermaid | Rendered SVG / `figure.dk-diagram` (build mode) | `architecture/diagram-demonstrator` | 1 / 2 |
| PlantUML | `plantuml-svg` / `figure.dk-diagram` (build mode) | `architecture/plantuml-demonstrator` | 1 / 1 |
| Diagram figures | `figure.dk-diagram` (build mode) | overview, showcase deck | 1, 3 |
| Glossary | `dk-glossary-link` | `glossary-demo/shipping-guide` | 3 |
| Markua | `starlight-aside--tip` / `dk-callout` | `guides/markua-showcase` | 3 / 26 |
| Footnotes | `data-footnote-ref` | `guides/markua-footnotes-showcase` | 6 |

Every build-mode figure contains an `<svg>`. The example has no relative `.md`
link of its own, so relative-md-links was proven with a probe link added to one
page on both trees; that build is kept as `example/dist-rel` in both worktrees. The #113 re-derive parity test passes 12 of 13; the one
failure is the pinned integration order, which now starts with the processor
integration (B1).

### Can an integration still append plugins under unified()?

Yes. Astro folds the legacy `markdown.remarkPlugins` and `rehypePlugins` keys
into the processor after each integration's setup, in integration order.
Starlight inserts its own plugins in place. The resolved order is unchanged:
directive owner first, Markua before Starlight's asides, deck split and base
links after Starlight.

The condition: the processor must be `unified()` **before** the first
integration appends a plugin. Otherwise Astro has already chosen Sätteri and
drops each plugin with a warning. Astro also prints, once per build:

> `markdown.remarkPlugins`, `markdown.rehypePlugins`, and `markdown.remarkRehype` are deprecated. Pass them to `unified({...})` from `@astrojs/markdown-remark` directly instead.

## The #188 canonical rewrite

Starlight 0.42's head merge treats two `<link>` tags as duplicates only when
both are canonical, or both are sitemap links. Starlight 0.32 dropped every
earlier `<link>` once a page head carried a canonical. On 0.42 the root page
keeps its favicon, sitemap, RSS and `llms.txt` links, and the canonical gets its
trailing slash natively. The HTML rewrite in the sitemap-order hook now changes
nothing. It is no longer needed, still correct and harmless. The separate
sitemap `<loc>` normalisation is still needed.

## Changelog audit

The Astro 6 and 7 changelogs and the Starlight 0.33 to 0.42 changelogs hold
about 55 entries that touch DocKitty. The breakages above cover the ones that
fail. These entries were checked separately:

| Entry | Effect on DocKitty | Result | Ticket |
|---|---|---|---|
| Starlight 0.34 cascade layers | Unlayered DocKitty CSS now wins over Starlight | Real: B19; computed styles of header, TOC, links, headings, asides and code are otherwise identical | #144 |
| Starlight 0.42 sidebar `scrollbar-gutter: stable` | Sidebar links 15px narrower; one long label now wraps | Visual change, not a breakage | #146 |
| Astro 6 heading ID generation | Fragment links and baselines could move | Clean: 389 heading IDs site-wide, identical lists | — |
| Rust compiler stops correcting invalid nesting | DOM could reshape | Clean: tag skeletons of 8 representative pages match; the only difference is one extra `div` in Expressive Code's copy button (expressive-code 0.44) | — |
| Astro 7 `compressHTML: 'jsx'` | Whitespace between elements | B11. Screenshots of `getting-started` at 1280px show the content column unchanged; the effect seen so far is in extracted text (copy, search excerpts) | #145 |
| Astro 6 `import.meta.env` always inlined | `DK_*` handoff | Clean: only `BASE_URL` is read; all non-HTML output (API JSON, `llms.txt`, RSS, sitemaps, OKF) is byte-identical | — |
| Astro 6 endpoints with a file extension and a trailing slash | `/api/*.json`, `llms.txt`, RSS routes | Static output identical; dev-server behaviour not tested | #146 |
| Vite 8 | Vitest 2 runs on Vite 5 | Vitest 2 still runs today; moving to Vitest 4 is a follow-up, not a blocker | #146 |
| Zod 4 error messages | Gate tests that assert message text | Covered by B18's test edits | #146 |
| Starlight 0.42 ships compiled JS | Deep imports of `/props`, `/route-data`, components | Build clean; B14 is the only failure | #146 |
| Starlight 0.42 `PageTitle` override must keep `id="_top"` | Page freeze | Clean: DocKitty's override keeps it; 68 pages carry `id="_top"` on both trees | — |

Not relevant to DocKitty: `Astro.glob` removal (DocKitty uses
`import.meta.glob`), build-hook `routes` and `entryPoints`, numeric
`getStaticPaths` params, experimental flags, and Astro `i18n` config.

## Build time and determinism

Cold example builds took 31.4 s and 30.9 s on `main`, and 15.0 s and 16.9 s on
the spike. Two clean spike builds were byte-identical with nothing excluded.

## Decisions the tickets must make

- **Processor wiring (#143):** the toolkit sets `unified()` from an integration
  that runs first. The alternative, passing plugins to `unified({...})`
  directly, avoids the deprecation warning but changes how integrations
  register plugins.
- **Heading links (#144):** keep Starlight's new anchors, or set
  `headingLinks: false` for parity.
- **Whitespace (#145):** set `compressHTML: true`, or fix markup spacing.

## Proposed ticket changes

- **#119:** add the Node floor, Zod 4 in the schema and the validator (B4,
  B18), and the loader change (B12).
- **#144:** add `processedDirs` (B5), the heading-link decision (B7), the
  cascade-layer audit (B19), the `PageTitle` check, and the `i18n` and
  deck-route warnings (B17). The #188 rewrite can be removed.
- **#145:** smaller than expected: one compiler error (B6) and the whitespace
  default (B11). No nesting reshaping was found.
- **#146:** test-harness updates (B13 to B16, B18's test edits), B7's test
  rework if anchors are kept, the gate patterns (B10), and baselines for B8, B9
  and the sidebar gutter. No determinism change was needed.

No split is proposed.

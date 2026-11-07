---
affected_files: []
cycle_number: 1
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-06T10:18:21Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP08
---

WP08 review: changes requested.

1. [HIGH] src/tests/draft-publication-build.test.ts:79 - T033's NFR-001 item was not done. `api/**/*.atom.xml` is not in MACHINE_SURFACE_GLOBS (`api/**/*.json` does not match it), and the off/offRepeat builds do not diff page HTML. The file is untouched in aa1f362 and the report never mentioned it. Add the glob and extend the off/offRepeat comparison to page HTML, with a non-vacuity control.
2. [MEDIUM] src/tests/page-atom-build.test.ts (determinism test) - the glossary exemption is a fixture artifact, not an NFR-001 exception. The generator keeps `generated.at` while content_hash is unchanged (glossary/generate.ts stampPage -> makeStamp), and two consecutive example builds are byte-identical (diff -rq: 0 differences). Fresh fixture roots have no prior pages, so `at` = now. Don't exclude the pages; either seed the second root with the first root's generated glossary files or rebuild in the same root so `at` carries over, and compare all entries (0 differing bytes). Failing that, compare glossary entries with only `<updated>` normalised, and assert the exemption is that narrow.
3. [MEDIUM] src/lib/routes/page-atom.ts:79 - `rendered.html` is put in `<content>` unfiltered. All 70 example entries carry `<script type="application/json" id="dk-glossary-definitions">` (about 275 KB of the 1.04 MB total, 26%), 8 carry `<link rel="stylesheet" href="/doc-kitty/_astro/ec.*.css">` (Expressive Code), and 22 carry HTML comments (markdownlint-disable). Strip script/link/style/comment from the HTML before escaping, with a test on built output.
4. [LOW] docs/changelog/unreleased/page-atom-entries.md - validate:changelog accepts it (the README allows `<slug>.md` when there is no issue). Optional rename to 292-page-atom.md as the WP states.
5. [LOW] page-atom.ts:25 - `!isDraftEntry` is redundant (isDraftEntry implies !isPublished, including the root), harmless; the WP text asked for it.

Everything else passed: lint, typecheck, assert:artifacts, assert:no-broken-links, fast project (3587 tests), page-atom tests, sax strict with control, pageFormats off, goldens untouched.

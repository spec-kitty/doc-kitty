---
affected_files: []
cycle_number: 1
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-06T12:05:59Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP09
---

# WP09 review: changes requested (reviewer-renata)

Commit reviewed: 25386487 (lane head 33aa69d).

## Must fix

**Issue 1 [BLOCKER]: the footer gate fails the CI drafts-off job.**
`src/scripts/assert-chrome-artifacts.mjs:1668` loops over `[WP09_DRAFT, ...]` and calls `readHtml`, which calls `fail` on ENOENT. `adr/template/index.html` is a draft, so it isn't built with `DK_PUBLISH_DRAFTS=off`. `.github/workflows/ci.yml:324` runs this gate on `example/dist-nodrafts`.

Reproduce:

    DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build
    DK_PUBLISH_DRAFTS=off node src/scripts/assert-build-artifacts.mjs example/dist-nodrafts

Result: exit 1, `assert:chrome: FAIL - could not read adr/template/index.html (ENOENT)`.

Removing only the draft entry from that loop makes the same command pass, so this is the only cause.

Fix: skip a draft that wasn't built, as section 1b of the same gate does (`catch { continue; // not built (drafts off) }`). Keep the 404 and generated-page checks unconditional. Rerun both the drafts-on and drafts-off gates.

**Issue 2 [HIGH]: `normaliseFooterCss` can hide changes that aren't WP09's rules.**
`FOOTER_CSS_RULE` (`src/tests/fixtures/chrome/harness.mjs:199`) matches any rule that starts with one of four prefixes, followed by `[^{}]*`. Each of these was added to the emitted CSS and still compared equal to the golden:

- `.dk-page-formats,.dk-kind-tag{color:red}`: an unrelated selector in a selector list
- `a.dk-pill,body{display:none}`: the same hole, affecting the whole page
- `.dk-machine-links-other{color:red}` and `a.dk-pill--brand{color:red}`: unrelated selectors sharing a prefix

It also doesn't go red when individual rules go missing or change:

- Removing a rule is caught for `a.dk-pill:focus-visible` only. The other 8 rules can each be removed and still compare equal, because the presence check is three substrings.
- Editing any of the 9 rule bodies compares equal.

Unrelated rules that don't start with a prefix do go red when added, edited or removed, as do a `.foo a.dk-pill` rule and one inside `@media`.

Fix: replace the prefix regex with the exact list of nine expected rule strings, with the `.astro-HASH` token as captured. Require each to occur exactly once, remove those literal strings, and throw naming any that is missing. That turns the smuggles, removals and edits red. The existing "removes WP09's rules and no others" test should gain these cases: a selector-list smuggle, a same-prefix selector, one removed rule, one edited rule.

## Should fix (in this cycle if cheap)

**Issue 3 [MEDIUM]: the machine links are browser-default blue under the spec-kitty theme.**
Computed colour of `.dk-machine-links a` in the themed example: light `rgb(0,0,238)`, dark `rgb(158,158,255)`. Prose links on the same page are `rgb(128,101,8)` and `rgb(245,197,24)`. Nothing sets a visited colour, so visited links should take the browser's too (not tested). Screenshots show this as the one off-palette element in the footer.

Nothing in the spec requires a colour and Axe passes, but it looks unfinished. Add a token colour for `.dk-machine-links a` in the theme's CSS. That isn't pill styling, so C-004 doesn't apply; the unthemed build stays plain.

## Notes, no change required

- **`head` behaviour for `starlight.head` consumers (LOW):** `...overrides` replaces the toolkit's `head`, so such a consumer used to lose the RSS and llms.txt links. They now get them from the carrier. Consumer entries are kept, but a consumer who re-added their own RSS alternate now has two (seen in a real build). Worth one clause in `docs/changelog/unreleased/290-machine-entry-points.md`.
- **`siteDir: '.'` (LOW):** at `src/lib/page-formats.ts:122` this stays `.`, giving `.../blob/main/./docs/x.md`, because the regex only strips `./` with its slash. Browsers normalise it. Strip a bare `.` if you touch this line.
- **Ring and size tests (LOW):** removing both scoped focus-visible rules, or the `.dk-machine-links a` min sizes, leaves all of `footer-links-build`, `chrome-baseline`, `footer-links.spec` and the chrome gate green. The UA outline and the line-height cover those cases today, so behaviour holds, but these rules aren't pinned. The exact rule list from Issue 2 pins them.
- **`agent.discoverable: false` (product question):** such a page still shows JSON and OKF links. Both targets are served, so none is dead. FR-022 doesn't cover this; raise it only if opt-out should also mean no link.

## Verified good, don't rework

Head diff (only moved, plus the new links); 404, OpenAPI, draft and deck heads; every generated href in `dist`; 56 of 56 example source links are git-tracked files; real Tab focus ring and 24x24 in all cells; footer layout at 1280, 390 and 320; `normaliseFooterAndHeadLinks` together with the exact FR-019 tests; `servedSurfaces` caching; `getEntry` cost.

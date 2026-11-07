# Mission Review Report: page-chrome-01M6PBR7

**Reviewer**: Reviewer Renata profile (`reviewer-renata`), run by Claude Opus 5.5 (`claude-opus-5-5`). Not involved in the implementation.
**Date**: 2026-11-06
**Mission**: `page-chrome-01M6PBR7` — Page chrome: footer entry points, sidebar, metadata blocks, hub order, page formats and nav icons
**Baseline commit**: `a03080e` (see PROC-3: `meta.json` records `0e9c968`, which is not the baseline)
**HEAD at review**: `694342db91216e361778114bfd7e6c0e044dc049`
**WPs reviewed**: WP01..WP11, all `done`

**Result**: PASS WITH NOTES. Every FR is implemented and has a test that fails when the behaviour is removed. Nothing is CRITICAL or HIGH. Four MEDIUM findings all sit in the Atom entry, on inputs the suites don't use.

---

## Gate Results

### Gate 1 — Contract tests
- Command: not run
- Exit code: n/a
- Result: NOT APPLICABLE
- Notes: `tests/contract/` lives in the spec-kitty repo and isn't this project's. The doc-kitty equivalent is below.

### Gate 2 — Architectural tests
- Command: not run
- Exit code: n/a
- Result: NOT APPLICABLE
- Notes: `tests/architectural/` lives in the spec-kitty repo.

### Gate 3 — Cross-repo E2E
- Command: not run
- Exit code: n/a
- Result: NOT APPLICABLE
- Notes: the scenarios live in the spec-kitty end-to-end repo. This mission claims no cross-repo behaviour. There is no `mission-exception.md`, and none is needed.

### Gate 4 — Issue Matrix
- Command: `spec-kitty review --mission page-chrome-01M6PBR7 --mode post-merge`
- Exit code: 0
- Tool verdict: `pass_with_notes`, 1 finding: `MISSION_REVIEW_DEAD_CODE_NOT_APPLICABLE`, because the scan only supports Python
- File: `issue-matrix.json`
- Rows: 7 (3 `fixed`, 4 `not-applicable`)
- Empty / `unknown` verdicts: 0
- `deferred-with-followup` rows missing a follow-up handle: 0 (there are none)
- Result: PASS
- Notes: the tool **accepted** `not-applicable` and printed `✓ Issue matrix: 7 row(s) validated`, with no rejection message. The skill's written allow-list doesn't include that value, so the skill and the tool disagree. All four rows are context citations with no work owed (#150, #264, #279, #289). I checked that the mission didn't take on #150's or #289's work.

| Issue | Verdict | Evidence in the matrix | Reviewer check |
|---|---|---|---|
| #290 | fixed | WP01–WP06, WP09 | Confirmed against the code and by mutation |
| #292 | fixed | WP08, WP09 | Confirmed, with the Atom notes below |
| #293 | fixed | WP06, WP07; fixture, not the example | Confirmed; the amendment is in the spec's assumptions |
| #150, #264, #279, #289 | not-applicable | Context only | Confirmed |

Side effects of the command: it wrote `mission-review-report.md`, which I left in place as asked. It also rewrote the tracked `status.json`, which I restored with `git checkout` (see PROC-4).

### Doc-kitty's own gates

| Command | Exit | Result |
|---|---|---|
| `DK_DIAGRAM_BUILD_RENDER=off pnpm test` | 0 | src: 187 files, 3930 tests passed. mcp: 22 files, 178 tests passed |
| `pnpm lint` | 0 | |
| `pnpm typecheck` | 0 | |
| `pnpm validate:docs`, `validate:example`, `validate:links`, `validate:adr-ids`, `validate:changelog` | 0 each | |
| `npx playwright test` on `footer-links`, `metadata-blocks`, `sidebar-title-as-index` specs | 0 | 57 passed, 22 skipped |
| Example build at `a03080e` | 0 | |
| Example build at HEAD, default and with `sidebar.collapsed:false` | 0 each | |

Not rerun, spot-check only as instructed: the full Playwright run, `tests/consumption`, and the `assert:*` gates. The previous agent's numbers for those remain unverified by me.

---

## FR Coverage Matrix

Adequacy here means I mutated the implementation and the named suite failed, unless the row says otherwise. Results are in [Mutation evidence](#mutation-evidence).

| FR ID | Description (brief) | WP Owner | Test File(s) | Test Adequacy | Finding |
|---|---|---|---|---|---|
| FR-001 | Machine entry points group | WP09 | `footer-links-build.test.ts`, `tests/a11y/footer-links.spec.ts` | ADEQUATE (M4) | — |
| FR-002 | One served-surfaces source, detected | WP01 | `served-surfaces.test.ts`, `served-surfaces-build.test.ts` | ADEQUATE (M15, M16) | LOW-7 |
| FR-003 | No link to an unserved surface | WP09 | `footer-links-build.test.ts` | ADEQUATE (M5, M15); all 205 generated hrefs resolve on the example | — |
| FR-004 | Footer group control | WP09 | `footer-links-build.test.ts` | ADEQUATE (M20) | — |
| FR-005 | Collapsed sidebar by default | WP05 | `route-shaping.test.ts`, `chrome-baseline.test.ts`, `sidebar-reveal.spec.ts` | ADEQUATE (M6) | — |
| FR-006 | Sidebar opt-out, byte-identical | WP05 | `chrome-baseline.test.ts` | ADEQUATE (M6); reviewer's example build matched on 77 of 77 pages | — |
| FR-007 | Title-as-index | WP06 | `sidebar-title-as-index-build.test.ts`, `sidebar-title-as-index.spec.ts` | ADEQUATE (M18, M30) | — |
| FR-008 | Index first in both modes | WP05/06 | `route-shaping.test.ts:1021`, `sidebar-title-as-index-build.test.ts:137` | ADEQUATE by reading; each has a fixture with the index last in source order. Not mutated | — |
| FR-009 | Conflicting index settings | WP01 | `chrome-options.test.ts` | ADEQUATE (M21) | — |
| FR-010 | Consumer-written sidebar untouched | WP05 | `sidebar-build-html.test.ts` | ADEQUATE by reading; holds by construction (`config.ts:722`). Not mutated | — |
| FR-011 | Pagination titles preserved | WP05/06 | `route-shaping.test.ts`, `sidebar-title-as-index-build.test.ts` | ADEQUATE by reading. Not mutated | — |
| FR-012 | Hub cards before blocks | WP02 | `hub-block-order-build.test.ts` | ADEQUATE (M7) | — |
| FR-013 | Other layouts keep their order | WP02 | `hub-block-order-build.test.ts`, `chrome-baseline.test.ts` | ADEQUATE (M28); the bare-hub theme case is at `hub-block-order-build.test.ts:128` | — |
| FR-014 | Collapsed metadata blocks | WP04 | `metadata-blocks-build.test.ts`, `metadata-blocks.spec.ts` | ADEQUATE (M1) | — |
| FR-015 | Block opt-out | WP04 | `metadata-blocks-build.test.ts` | ADEQUATE (M14) | — |
| FR-016 | No persisted block state | WP03/04 | `disclosure.test.ts`, `metadata-blocks.spec.ts` | ADEQUATE (M19) | — |
| FR-017 | Shared disclosure control | WP03 | `disclosure.test.ts`, `toc-rail*` tests | ADEQUATE (M13, M19) | LOW-6 |
| FR-018 | Reachable and in search | WP04 | `metadata-blocks-build.test.ts:154-173` (Pagefind fragment), `metadata-blocks.spec.ts` | ADEQUATE by reading; the sentinel has a control | — |
| FR-019 | Page format links | WP09 | `page-formats.test.ts`, `footer-links-build.test.ts` | ADEQUATE (M12, M26) | LOW-1 |
| FR-020 | Injected Atom entries | WP08 | `page-atom.test.ts`, `page-atom-build.test.ts` | PARTIAL: the route and off switch are proven (M8, M9, M29), but no fixture has an `.mdx` page or a local image | RISK-1, RISK-2 |
| FR-021 | Head links follow surfaces | WP09 | `footer-links-build.test.ts`, `page-formats.test.ts` | ADEQUATE (M5) | — |
| FR-022 | No formats for drafts | WP08/09 | `page-formats.test.ts`, `footer-links-build.test.ts`, `page-atom-build.test.ts` | ADEQUATE for `doc_status` drafts (M10, M12) | LOW-2 |
| FR-023 | Opt-in source link | WP09 | `page-formats.test.ts`, `footer-links-build.test.ts` | ADEQUATE (M26) | LOW-3 |
| FR-024 | No source when unset or generated | WP09 | `page-formats.test.ts`, `footer-links-build.test.ts` | ADEQUATE (M11) | — |
| FR-025 | Link styling by theme | WP09 | `footer-links-build.test.ts`, `footer-links.spec.ts` | ADEQUATE (M25) | — |
| FR-026 | Page and section icons | WP07 | `sidebar-icons.test.ts`, `sidebar-icons-build.test.ts` | ADEQUATE (M22, M17) | — |
| FR-027 | Unknown icon fails | WP07 | `sidebar-icons.test.ts`, `sidebar-icons-build.test.ts` | ADEQUATE (M23); six prototype-key names also fail the build | — |
| FR-028 | No icons, no change | WP07 | `sidebar-icons-build.test.ts`, `chrome-baseline.test.ts` | ADEQUATE (M24) | — |
| FR-029 | Docs and upgrade note | WP10 | None; documentation | Read against what shipped. Every option and field is covered | LOW-4 |

**Legend**: ADEQUATE = test constrains the required behaviour; PARTIAL = test exists but misses a real input class; MISSING = no test found; FALSE_POSITIVE = test passes with the implementation removed. No FR is MISSING or FALSE_POSITIVE.

### Mutation evidence

I ran 29 mutations in a scratch worktree at HEAD, each against the suites named. 28 were killed.

| # | Mutation | Suites run | Result |
|---|---|---|---|
| M1 | `MetadataBlock` drops `<slot />` (content gone, count stays) | chrome-baseline, metadata-blocks-build | Killed, by metadata-blocks-build only (6 tests) |
| **M2** | `disclosure.css` gains `.sl-markdown-content{display:none}` | chrome-baseline, metadata-blocks-build, disclosure | **SURVIVED** (LOW-6) |
| M3 | Junk element between the footer groups | chrome-baseline | Killed |
| M4 | Always-on dead machine link | chrome-baseline, footer-links-build | Killed, by footer-links-build |
| M5 | Head RSS link ignores detection | chrome-baseline, footer-links-build, served-surfaces-build | Killed, by footer-links-build |
| M6 | Sidebar opt-out ignored | chrome-baseline | Killed, sidebar golden |
| M7 | Hub placement off | hub-block-order-build | Killed |
| M8 | Atom title unescaped | page-atom, page-atom-build | Killed |
| M9 | Atom strips nothing | page-atom, page-atom-build | Killed |
| M10 | Atom eligibility ignores drafts | page-atom-build, page-formats | Killed |
| M11 | Source link on generated pages | page-formats, footer-links-build | Killed |
| M12 | Format links on drafts | page-formats, footer-links-build | Killed |
| M13 | Upgrade opens details on load | disclosure, metadata-blocks-build | Killed |
| M14 | Block opt-out ignored | metadata-blocks-build | Killed |
| M15 | Detection always true | served-surfaces (both), footer-links-build | Killed |
| M16 | Agent index ignores detection | served-surfaces-build | Killed |
| M17 | Font Awesome licence comment never written | sidebar-icons-build | Killed |
| M18 | Title-as-index loses `aria-current` | sidebar-title-as-index-build | Killed |
| M19 | Block state written to `localStorage` | disclosure, metadata-blocks-build | Killed |
| M20 | Footer label ignored | footer-links-build | Killed |
| M21 | FR-009 conflict allowed | chrome-options | Killed |
| M22 | Index page icon beats section icon | sidebar-icons (both) | Killed |
| M23 | Frontmatter gate ignores icon | sidebar-icons (both) | Killed |
| M24 | Custom sidebar body always on | chrome-baseline, sidebar-icons-build | Killed, CSS golden |
| M25 | Pill class removed | footer-links-build | Killed |
| M26 | GitLab URL wrong | page-formats, footer-links-build | Killed |
| M28 | Hub placement on every page | hub-block-order-build, chrome-baseline | Killed |
| M29 | Atom off switch ignored | page-atom-build | Killed |
| M30 | Shaping marker leaks to output | sidebar suites | Killed |

(There is no M27: I left it out when rewriting that batch. 29 mutations ran in total.)

**Did the three normalisers hollow out the golden?** No. They do remove the regions they name from the page comparison: M1 and M4 pass through `chrome-baseline` untouched. But each of those regions has a dedicated functional suite that kills the same mutation. M3, M6, M24 and M28 show the golden still catches changes outside those regions. The golden's own control tests hold too. The one real gap is M2 (LOW-6).

---

## Drift Findings

### DRIFT-1: Atom entries aren't always well-formed XML

**Type**: NFR-MISS
**Severity**: MEDIUM
**Spec reference**: NFR-008 ("100% of generated Atom entries are well-formed XML")
**Evidence**:
- `src/lib/routes/shared.ts:151-158`: `xmlEscape` handles `& < > " '` only.
- `src/lib/routes/page-atom.ts:46`: the page HTML goes through it into `<content>`.
- Reproduction: a page whose body holds a form feed (`\f`) or vertical tab (`\v`) builds with exit 0, and Python's parser reports `not well-formed (invalid token): line 9, column 52`.

**Analysis**: XML 1.0 forbids most C0 control characters even when escaped, so these need removing, not escaping. Terminal output pasted into a code block is the likely source (ANSI `\x1b`). The build stays green, and only that page's entry is broken. No page in the example triggers it, and `page-atom-build.test.ts` uses no such input. `xmlEscape` is shared with the RSS route, so the feed has the same weakness, but NFR-008 is this mission's promise. MEDIUM because it needs unusual input and breaks one file, not the site.

---

## Risk Findings

### RISK-1: An `.mdx` page gets an Atom entry with empty content

**Type**: ERROR-PATH
**Severity**: MEDIUM
**Location**: `src/lib/routes/page-atom.ts:75,82`
**Trigger condition**: any published, dated `.mdx` page.

**Analysis**: `entry.rendered` is unset for MDX, and `rendered?.html ?? ''` turns that into `<content type="html"></content>`. Reproduction: `docs/guides/mdx-page.mdx` with body text builds with exit 0. The HTML page holds the text and the Atom entry has none. The entry is still valid XML, so no gate sees it, and the footer advertises it as that page's content. The toolkit treats `.mdx` as a page format elsewhere (`page-formats.ts:64`). The contract promises `{escaped rendered HTML}`, and the guide doesn't mention this limit.

### RISK-2: Local images in Atom content are Astro placeholders

**Type**: CROSS-WP-INTEGRATION
**Severity**: MEDIUM
**Location**: `src/lib/routes/page-atom.ts:75,82`
**Trigger condition**: a Markdown page with a local image.

**Analysis**: `entry.rendered.html` is the stored form, taken before Astro resolves images. Reproduction: `![alt text](../images/x.svg)` produces `<img __ASTRO_IMAGE_="{&quot;src&quot;:&quot;../images/x.svg&quot;,...}">`, with no `src`, escaped into `<content>`. The placeholder is present in **four of the example's own entries today**: `presentations/markua-deck`, `presentations/showcase-deck`, `guides/markua-malformed` and `guides/markua-showcase`. A feed reader shows no image, and an internal Astro attribute ships to consumers. No test looks for it.

### RISK-3: With no `site`, Atom identity is `http://localhost:4321/...`

**Type**: BOUNDARY-CONDITION
**Severity**: MEDIUM
**Location**: `src/lib/routes/shared.ts:145-147`, `src/lib/routes/page-atom.ts:78`
**Trigger condition**: a site with no `site` in its Astro config, which is a supported setup.

**Analysis**: `absolute()` falls back to localhost. Reproduction: `buildChromeFixture({ options: { site: null } })` gives `<id>http://localhost:4321/doc-kitty/guides/getting-started/</id>`, and the same value in `xml:base` and `link`. RFC 4287 requires `atom:id` to be permanent and universally unique, and every site without `site` now mints the same ids, with alternates pointing at the reader's own machine. The links still appear in the footer and head. The mission handled this same condition for the sitemap (`served-surfaces.ts:36`) but not for Atom, and the guide and upgrade note say nothing. RSS has the same fallback, but its use predates this mission. The fix is a product decision: skip Atom without `site`, or warn at build time.

### RISK-4: Atom `id` changes with the URL

**Type**: BOUNDARY-CONDITION
**Severity**: LOW
**Location**: `src/lib/routes/page-atom.ts:78`

**Analysis**: the `id` is stable across builds; I confirmed 0 differing files between two builds, Pagefind aside. It changes when a site moves domain or `base`, or a page's slug changes, and readers then see a new entry. This is the choice `contracts/page-atom.md` made. It's recorded here because the guide doesn't say so.

### RISK-5: Pages rendered at runtime lose the chrome options

**Type**: BOUNDARY-CONDITION
**Severity**: LOW
**Location**: `src/lib/chrome-options.ts:68-74`, `src/lib/served-surfaces.ts:46-51`
**Trigger condition**: `output: 'server'` with `starlight: { prerender: false }`.

**Analysis**: both readers use `process.env` at render time, and the build sets those values in the build process only. A runtime process would see nothing: no machine links, no format links, no feed alternates, and `metadataBlocks.collapsed: false` and `repository` silently reset to defaults. **This is from reading the code.** I built this configuration with a stub adapter (exit 0) but did not serve it. The common case is fine: with Starlight's default `prerender`, under a stub adapter, the build exits 0, the pages prerender, and the Atom files and `okf/index.md` land in `dist/client/`. Other internal handoffs share this pattern, so it isn't new in kind.

---

## Other LOW findings

- **LOW-1: the `agent.discoverable: false` ruling isn't in the spec.** `page-formats.ts:86` hides the format links on those pages, while FR-019 and US5 scenario 1 still say "a published page". It's recorded in `research.md` and the guide, and made by the orchestrator, not through `decisions/`.
- **LOW-2: Starlight's `draft: true` isn't a draft to Atom.** A page with `draft: true` and `doc_status: active` isn't rendered as HTML but gets an Atom entry, so the body is exposed. `atom-eligible.ts:13-15` checks `doc_status` only. The same page was already in the JSON route, OKF, RSS, `llms.txt`, the agent index and the content graph through untouched code, so Atom adds a surface to an existing gap, not a new class of leak. FR-022's fixture covers `doc_status` drafts only.
- **LOW-3: `repository.repo` isn't checked as `owner/name`.** `chrome-options.ts:122` only requires a non-empty string, and `page-formats.ts:112-114` interpolates it unencoded. `../../evil.example/x` gives a link that normalises to `https://github.com/evil.example/x/...`. The value is the site owner's config and the host can't change, so this is a wrong link and not an attack.
- **LOW-4: the upgrade note has gaps.** It doesn't mention these:
  - A surface served as a static file, such as `public/rss.xml`, isn't a route. Its head alternate, which used to be emitted unconditionally, disappears.
  - A Starlight plugin that overrides `Head` also loses the RSS and `llms.txt` links, which used to come from config.
  - `IndexLinks.llms` and `.sitemap` became optional in `contract.ts:125,127`, so a TypeScript consumer reading `_links.llms.href` stops compiling.
  - The Atom limits in RISK-1, RISK-2 and RISK-3.
- **LOW-5: new reader-facing strings are hard-coded English.** "This page as data" (`PageFormats.astro:17`), the link labels (`page-formats.ts:46-53`), and "Show" and "Hide" (`MetadataBlock.astro:35-36`). The toolkit has a `dockitty.*` UI string mechanism. An i18n build works otherwise: `/fr/` pages link the right formats, and fallback pages link the source-language page's.
- **LOW-6: `disclosure.css` escapes the golden (M2).** `normaliseMetadataBlocks` (`harness.mjs:185`) removes the whole inline sheet, and the CSS golden only reads emitted `.css` files. A rule in that sheet that changes other content passes `chrome-baseline`, `metadata-blocks-build` and `disclosure`. A rule as blunt as M2 would probably fail a Playwright test (I didn't run that), but a subtle one depends on the visual baselines, which aren't regenerated yet.
- **LOW-7: detection misses a renamed parameter.** A consumer route at `/api/pages/[...path].json` serves the same URLs but isn't `[...slug]`, so its JSON link silently disappears on upgrade. This fails safe, and "standard paths only" is documented, but this variant isn't obvious from that wording.
- **LOW-8: small dead code.**
  - `export { atomEligible }` at `page-atom.ts:22` is used only by `page-atom.test.ts`.
  - The `integrations()` fallback at `fixtures/chrome/astro.config.mjs:32-46` can no longer fire now that WP01 has landed.
  - `PAGE_ATOM_CONTENT_TYPE` is exported but used only in its own file.
- **LOW-9: no packed-install coverage of the opt-in renderer.** `tests/consumption/consumer-fixture/astro.config.mjs` sets neither `titleIsIndex` nor an icon, so `CustomSidebarBody` and the Font Awesome data are only exercised through the workspace link. The `./components/*` export and `files` list look right from reading them.

---

## Silent Failure Candidates

| Location | Condition | Silent result | Spec impact |
|---|---|---|---|
| `routes/page-atom.ts:82` | `entry.rendered` unset (MDX) | Empty `<content>` | FR-020, RISK-1 |
| `routes/shared.ts:146` | No `site` | Localhost URLs in Atom | RISK-3 |
| `chrome-options.ts:70-71` | Handoff unset at runtime | Defaults replace the site's options | RISK-5 |
| `served-surfaces.ts:48` | Handoff unset | `undefined`: no links in chrome. `agent-index.ts` then defaults to linking everything | RISK-5; the agent index side can name a missing surface |
| `page-formats.ts:61-65` | `filePath` outside the docs folder | No OKF link | Fails safe |
| `integrations/sidebar-icons.ts:56-59` | Icons on a consumer-written sidebar | Warning, no icons | Documented |
| `disclosure/upgrade-details.ts:67` | Wrapper missing id or labels | Stays a native `details` | By design |

---

## Security Notes

| Finding | Location | Risk class | Recommendation |
|---|---|---|---|
| **`javascript:` provider**: refused. `provider: 'javascript:alert(1)//'` fails the build with the `[dk-config]` message | `chrome-options.ts:119` | None | None |
| **Quote breaking in repo, branch, siteDir, label**: not exploitable. Astro escapes attribute values, so `"` becomes `&quot;` and the payload stays inside the attribute | `PageFormats.astro:24`, `MachineEntryPoints.astro:18` | None | None |
| **Repo traversal**: `../../` stays on the fixed host | `page-formats.ts:112-114` | Wrong link only | LOW-3 |
| **Icon names as lookup keys**: `__proto__`, `constructor`, `toString`, `hasOwnProperty`, `fa-__proto__` and `fa-constructor` each fail the build with `unknown icon`. `Object.hasOwn` is used in both sets | `sidebar-icons-core.mjs:65,78` | None | None |
| **`set:html`**: icon bodies come from the pinned package or the committed list, never from frontmatter. The licence comment is a constant. The reveal script isn't changed by this mission | `SidebarSublist.astro:53,81,94`, `CustomSidebarBody.astro:30` | None | None |
| **Atom escaping**: title, summary, content and URLs all go through `xmlEscape`. M8 proves this is tested | `page-atom.ts:39-46` | Well-formedness only | DRIFT-1 |
| **`stripNonContent` isn't a sanitiser**: its comment says so, and it only sees Astro's own output. Author-supplied `javascript:` links pass through, as they do in the HTML page. Worst case is quadratic on hostile raw HTML (1.8 s for 140 KB of unclosed `<link "`), and only an author can supply that. An 8 MB ordinary page takes 5 ms | `strip-non-content.ts:24` | Author-trusted input | None |
| **Draft exposure**: `doc_status` drafts are excluded, including under `DK_PUBLISH_DRAFTS=on` (M10, M12). Starlight's `draft: true` isn't | `atom-eligible.ts:13-15` | Pre-existing gap, one more surface | LOW-2 |
| **Supply chain**: `@iconify-json/fa6-solid@1.2.4` pinned, no lifecycle scripts, CC BY 4.0 handled by C-008. Controls recorded in `research.md` | `src/package.json` | None | None |

No subprocess, credential, HTTP or lock code was added to the toolkit's runtime.

---

## What I checked that held

**FR-006, byte-identical sidebar on the real example.** At `a03080e` and at HEAD with `sidebar: { collapsed: false }`, built at the same path: 77 of 77 sidebar fragments are identical, `data-hash` included, and the full `<nav class="sidebar">` matched on the three pages I compared whole. My first comparison, across two worktree paths, differed on every page only in the scoped class (`astro-grtvwea5` against `astro-hpxdyb36`). That hash follows the file path. So the promise holds for a site upgrading in place, while a site built from a different path differs by that class alone, which the fixture's golden normalises away. The golden's capture commit `ff738ffe` has the same `src` and `example` trees as `a03080e`.

**SC-006, an upgrade with no config changes.** Compared with the baseline, the default build removes no files and adds 70, all `.atom.xml`. `llms.txt`, `rss.xml`, `sitemap-0.xml` and `bibliography.json` are byte-identical. The agent index diff I read comes from the content edit to `rhetoric/book-one` (`buildId`, `related`, `audience`); I didn't read the `content-graph.json` or `scenarios.json` diffs, and both differ. No page lost its RSS or `llms.txt` head link.

**Consumer breakage.**
- `starlight.components` overrides are discarded by design (`config.ts:813`), and the guide says so.
- A theme with its own Hub layout is tested (`hub-block-order-build.test.ts:128`).
- A theme's `dk:head` doesn't affect the alternates, which render outside that branch (`Head.astro:65`).
- `output: 'server'` with prerendered pages works, as RISK-5 notes.
- An i18n build works (LOW-5).
- `base` works: the fixture's `/doc-kitty` base and the root case are both in `footer-links-build.test.ts`.
- A path with a space encodes correctly (`unicode%20page.json`).

**Search pollution.** The new footer links are not in the Pagefind index. I decompressed all 77 fragments: "Machine-readable" appears in 1 (the changelog page's own text), "Agent API" in none, and the "source" and "Sitemap" counts match the baseline. Pagefind skips `nav`.

**Very large sites.** 2000 pages build in 42.3 s with Atom and 41.2 s without, so the per-page `getCollection` lookup isn't a real cost here.

**Dead code.** `chromeOptions()` has 11 non-test files using it, `servedSurfaces()` 5, `dkIcon` 3. All have live paths from carriers or routes. Only the small items in LOW-8 are unused.

**Disclosure lifecycle (item 7).** The `astro:page-load` listener and the print handlers are registered once at module top level (`disclosure.client.ts:26,33,40`), and module scripts evaluate once. `upgradeDetails` returns early on the upgraded class, so the first-load double call is harmless. Each `toggle` listener is added only on a real upgrade. `beforeprint` accumulates, with a test for the repeat case. `ClientRouter` isn't configured, so the hook is inert today. There are 0 duplicate ids on the example and the title-as-index dist.

**Locked decisions and constraints.**
- C-001: six carriers, ADR-0075 present, ADR-0063 unchanged.
- C-002: ADR-0076 and ADR-0077 present, with guard tests.
- C-003: no font files. C-004: pills are theme-only (M25).
- C-005 and C-006: no references or edit-link work in the diff.
- C-007: `CHANGELOG.md` and the ADR index table unchanged, 8 fragments added.
- C-008: the licence comment is proven in a real build (M17).
- The route-detection and rail-extraction decisions are implemented as chosen, and no declaration option exists.

**NFR-001.** Two HEAD builds of the example have 0 differing files outside `pagefind/`.

---

## Process assessment

None of these change the verdict, because the evidence above doesn't rest on the review record.

- **PROC-1: acceptance verdicts are empty scaffolds (LOW).** All 29 rows of `acceptance-matrix.json` read `description: "Verify FR-NNN is satisfied"` and `notes: "TODO: replace with a real acceptance criterion"`. All were verified by the orchestrator and cite trial commit `14aeae0`. `negative_invariants` is empty, and no NFR, SC or constraint has a row. The acceptance gate recorded a claim rather than a check. This matters for how far to trust the record, and it's the most significant process item.
- **PROC-2: reviewer identity is inaccurate (LOW).**
  - Re-reviews claimed as Opus but run on Sonnet make those events' model field wrong. Per-WP reviews did happen, and they caught real defects.
  - **Not in your list:** 6 events carry a malformed model, `claude-opus-5-5eviewer-renata`, on WP04, WP05 and WP08.
  - **Also not in your list:** most of WP11's transition events carry `claude:None:*` actors, like the first claims on WP01 and WP02.
  - No `ReviewerSelfApproval` events exist.
- **PROC-3: `meta.json` baseline is wrong (LOW).** `baseline_merge_commit` is `0e9c968`, an acceptance commit inside the mission's range. The skill's `git diff <baseline>..HEAD` would show only the merge and later commits. I used `a03080e` as you said.
- **PROC-4: the committed `status.json` is incomplete (LOW).** It has an empty `mission_number` and `mission_type`. Its `event_count` of 132 does match the log's WP transitions. `spec-kitty review` regenerates the file with a diff of 226 insertions and 45 deletions, so running this gate dirties the tree.
- **Commits after acceptance (LOW).** Acceptance was `e63d069` and the merge `a00ba44`. Six commits followed, and `b12876b` changes source (`strip-non-content.ts`) with no WP review. I read it and its tests, including a control case, and it's sound. T042's run on the trial integration doesn't cover these commits. The `pnpm test` run in this review does.
- **Identity-repair returns (no impact).** They inflate the rejection counts the retrospective reports for WP01 and WP02.
- **Lane merges and `14aeae0` on lane-i (no impact).** WP09's `approved -> in_progress` reconcile event is recorded with a reason, and the final tree passes.
- **Spec header (cosmetic).** `spec.md` still says `Status: Draft`, and every FR says `Open`.
- **Not done, by design.** Visual baselines, ticket amendments and the PR. Regenerate the baselines before relying on them (LOW-6).

---

## Final Verdict

**PASS WITH NOTES**

### Verdict rationale

The merged code implements all 29 FRs, with no locked decision violated and no non-goal invaded. Each FR has a test, and 28 of 29 mutations were killed, which shows the suites and the three normalisers still constrain behaviour. FR-006 holds on the real example, not only the fixture. No CRITICAL or HIGH finding exists. The four MEDIUM findings all concern the Atom entry's content or identity on inputs the suites don't use: control characters (an NFR-008 miss on that input), `.mdx` pages, local images (present in the example today), and sites with no `site`. Each degrades one optional machine surface without affecting pages, navigation or the build. No security finding blocks release: the injection and prototype-key attempts all failed.

### Open items (non-blocking)

Address before or soon after the PR:

1. RISK-2: resolve or drop `__ASTRO_IMAGE_` in Atom content. It ships in the example now.
2. RISK-1: render MDX into Atom, or skip the entry and the link for those pages.
3. RISK-3: decide what Atom does with no `site`, and document it.
4. DRIFT-1: strip XML-illegal characters in the Atom path, and consider RSS as well.
5. LOW-4: extend the upgrade note.
6. PROC-1: replace the acceptance matrix scaffolds, or record why not.
7. LOW-1 to LOW-3 and LOW-5 to LOW-9, as capacity allows.

## Retrospective Reminder

The canonical post-merge sequence is: **mission review → author or verify retrospective (`retrospect create`) → surface findings (`summary` aggregates; `synthesize` reviews proposals)**.

**Checked:** the record exists at `kitty-specs/page-chrome-01M6PBR7/retrospective.yaml` (8123 bytes, created by the runtime at `2026-11-06T13:38:37Z`, `findings_status: has_findings`), and `status.events.jsonl` has a `RetrospectiveCaptured` event. The path the skill names, `.kittify/missions/01M6PBR7DP6X6EG3VVXT1CB589/retrospective.yaml`, doesn't exist, and neither does `.kittify/missions/`. The mission is flattened (`"flattened": true`), so the record is not missing, but the skill's path doesn't match this layout. No `retrospect create` is needed.

Then surface findings:

- `spec-kitty retrospect summary` — cross-mission aggregation (read-only; does NOT author)
- `spec-kitty agent retrospect synthesize --mission page-chrome-01M6PBR7` — inspect proposals (dry-run by default)
- `spec-kitty agent retrospect synthesize --mission page-chrome-01M6PBR7 --apply` — apply proposals (mutates)

The retrospective's rejection counts for WP01 and WP02 include identity-repair returns, so read them with that in mind. I did not run these commands.

## Addendum: findings closed after this review

The four MEDIUM Atom findings and the listed upgrade-note gaps were fixed on `feat/page-chrome` before the PR. An independent post-acceptance review then returned NO-GO on a copy-button regex and a `starlight.head` workaround. Commits `31f3818`, `5517c0f`, `caba753`, `63df321` and `52edc4a` fixed these, and a further independent recheck returned GO.

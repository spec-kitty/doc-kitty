---
title: Layout guards and layout decisions after Astro 7
description: Current behaviour on Starlight 0.42.6, options, and a recommendation for the layout guard and layout decision issues #199 to #207 split from #116.
doc_status: draft
updated: 2026-10-19T00:00:00Z
type: Architecture
kind: Explanation
tags: [research, layout, toc-rail, sidebar, reading-width, a11y, playwright]
related:
  - architecture/collapsible-toc-rail
  - adr/0045-frame-width-token
  - adr/0053-reading-width
  - architecture/research/astro7-starlight-041-migration-spike
---

# Layout guards and layout decisions after Astro 7

This note records the research for issues #199 to #207. They were split from #116
(layout guard gaps after PR #111) on 2026-10-18. The research ran on `main` after
PR #212, which moved DocKitty to Astro 7.4 and Starlight 0.42.6.

Four lenses each looked at part of the set: front-end measurement, design,
architecture, and provenance with upstream Starlight. Each one reproduced the
behaviour on the example build with Playwright and Chromium. Nothing in this note
is a decision. Each issue ends with the options and a recommendation for the
owner to choose from.

## Verdict

- **Most of the numbers in #204, #205 and #206 are out of date.** #116 was filed when
  the reading column was 45rem (720px). [ADR-0053](../../adr/0053-reading-width.md)
  widened it to 60rem (960px) the next day, and the split issues copied the old
  figures. The re-measured figures are below.
- **The Astro 7 migration resolved none of the issues.** It touched the reveal
  script (a popover re-reveal only, with the same timing) and recaptured the stock
  header fixture twice. It left the rail, the frame and the column alone.
- **Three issues need only a guard:** #200, #201 and #202. #201's surfaces are
  already byte-identical, and #202's chrome targets already pass.
- **Five issues need a decision:** #199, #203, #204, #205 and #206. #206 is not
  labelled as a decision, but "as the design decides" makes it one.
- **#207's premise is half right.** The fixture does not go stale silently: an
  upgrade turns CI red. Its real weakness is that it is now recaptured from builds
  that already carry the header carrier.
- **The research found four defects that no issue tracks.** They are listed under
  [New findings](#new-findings).

## Method

- **Builds.** The example was built from `main` with `DK_PUBLISH_DRAFTS=on` and
  `off`. For #201 it was built four more times in a scratch copy: twice with the
  same input, once after touching every source file's modification time, and once
  with drafts on.
- **Browser.** Playwright 1.62.1 drove a Chromium build older than the one it pins.
  The repository's own lane was run with a local config override that changes only
  the browser executable.
- **Measurements.** Ad hoc scripts measured element boxes on served copies of the
  dist. Prototypes injected CSS with `page.addStyleTag` or patched a scratch copy of
  the source. The repository itself was not changed.
- **Local noise.** Three tests fail in this environment on both dists and pass in
  CI: the `1280px collapsed` layout case (font-driven, see
  [New findings](#new-findings)) and the home screenshot in both colour modes.

Pages measured: `/guides/markua-showcase/` has a rail, `/guides/getting-started/`
has none, and `/context/audience/example-persona/` is the persona page.

## Guards

### #200: measure the published (drafts-off) sidebar

**Current behaviour.**

- The a11y and geometry lane runs only against the drafts-on `example/dist`.
- CI already builds `example/dist-nodrafts` and runs the artifact, link and redirect
  gates on it (`.github/workflows/ci.yml`, the build-example job). It never uploads
  that dist, so no Playwright run sees it.
- Between the two dists, every sidebar loses four links (84 to 80), and eight pages
  change their previous and next links. Nothing else differs.
- Every current sidebar a11y and geometry spec passes against the drafts-off dist.
- The `chrome-1920` screenshot also passes against the drafts-on baseline, although
  four sidebar rows are missing. The diff is 1.35% of pixels, and
  `maxDiffPixelRatio: 0.01` with pixelmatch's threshold absorbs it. A second PNG
  baseline is therefore a weak guard on its own.

**Migration impact.** None.

**Options.**

| Option | How | Extra CI cost |
| --- | --- | --- |
| A. More Playwright projects in the same job | Upload `dist-nodrafts`; serve both dists; add `published-light` and `published-dark` projects limited to the sidebar specs | About 60 to 75 s, no extra build |
| B. A separate CI job | As A, in its own job | About 2 to 3 min of setup |
| C. Run the lane twice with an environment switch | As A, without named projects | As A, but harder to find |

**Recommendation: option A**, plus two changes:

- Make `serve-dist.mjs` take the expected draft mode and fail on a mismatch. Today a
  mismatch only prints a warning.
- Add a structural assertion on sidebar membership: drafts appear in one dist and
  not the other.

Land it last, after #204 and #206, so the new baselines are generated once. Size:
small to medium.

### #201: compare machine surfaces across two builds (NFR-006)

**Current behaviour.**

- Two builds of the same tree are byte-identical across the whole dist: sitemaps,
  `rss.xml`, `llms.txt`, `api/**`, `okf/**`, `pagefind/**`, `_astro/**` and every
  HTML page.
- Touching every source file's modification time changes nothing.
- No surface carries a build clock: there is no `<lastmod>` and no
  `<lastBuildDate>`.
- A build from a different checkout path differs only in Astro's scoped-class hash
  and the one CSS file name that carries it. No machine surface differs.
- `src/tests/draft-publication-build.test.ts` already makes a repeat drafts-off
  build (`offRepeat`). It uses that build only to compare the sidebar of two pages.

**Migration impact.** None to the behaviour. PR #212 removed the last generator
stamps.

**Options.**

- **A. Extend the existing test.** Compare `off` with `offRepeat` byte for byte over
  one declared surface manifest, and fail if any glob in it matches nothing. Costs
  no extra build.
- **B. A script in the build job.** Adds one more build of 15 to 20 s, and duplicates
  A.
- **C. A new test file with its own two builds.** Duplicates both builds.

**Recommendation: option A.** The contract is "byte-identical", with no list of
fields allowed to differ. Fold `rss.xml`, `okf/**`, `pagefind/**` and `api/pages/*`
into the same manifest that the drafts-on and drafts-off comparison uses. Size:
small.

### #202: an explicit 24x24 target-size assertion (NFR-004)

**Current behaviour.** Measured on seven routes at 1280 and 1920, with the rail
expanded and collapsed:

| Region | Smallest target |
| --- | --- |
| Header | 32 x 32 |
| Sidebar | 28 px tall |
| Rail | outline links exactly 24.0 px tall; toggle 32 x 32 |
| Footer pagination | 320 x 92 |

- No chrome target is below 24x24.
- Every undersized target is in content, and each is either inline text or meets the
  WCAG 2.5.8 spacing exception.
- axe already runs its `target-size` rule through the `wcag22aa` tag
  (`tests/a11y/routes.ts`). It reported no violations and no incomplete results.
  axe files ambiguous cases as incomplete and the lane ignores those, so an explicit
  check still adds a guard.

**Scope note.** NFR-004 covers only the toggle and the rail links. The issue also
asks for the sidebar, header and footer, which goes beyond the requirement. All of
them pass today, so the wider scope costs nothing.

**Recommendation:** add the assertion with the issue's wider scope.

- Collect targets per region and require at least one per region.
- Pass a target at 24x24 or larger. Otherwise apply the spacing exception: a 24 px
  circle on the target must not meet another target.
- Run it at 1280 and 1920, expanded and collapsed, plus 390 px with the menu open.
- Prove it fails first by injecting CSS that shrinks the rail links.

Size: small. Two rules in `toc-rail.css` set the same rail-link minimum; keep one.

### #207: detect a stale stock-header fixture

**Current behaviour.**

- `src/tests/fixtures/header-theme/stock-header.html` matches the header of the
  installed Starlight 0.42.6 exactly.
- PR #212 recaptured it twice: once for 0.42.6, and once for `compressHTML`.
- `src/tests/header-carrier.test.ts` byte-compares a fresh build with the fixture,
  so an upgrade that changes the header turns CI red. The failure is a large
  one-line diff with no hint to regenerate.
- The fixture is documented as captured before the carrier existed, at commit
  2ffe856. The recaptures used a normal build, which includes the carrier, so the
  neutrality check now partly compares the carrier with itself.
- The fixture also embeds a Vite asset hash and Astro's `compressHTML` whitespace,
  so a stamp that records only the Starlight version would miss some breaking
  upgrades.

**Recommendation:** fold it into the guard slice.

- Add a version stamp sidecar that records the Starlight version, the Astro version
  and `compressHTML`.
- Add a fast test that compares the stamp with the installed versions and prints
  the regeneration command.
- Add one regeneration script.
- Make one small decision: capture the fixture from a build without the carrier, or
  record the weaker guarantee in the test and the spec.

Size: extra small to small.

## Decisions

### #199: the rail recentre without a sidebar (FR-010)

**Current behaviour.**

- "Simulation" is not a committed test. The acceptance matrix of the
  `sidebar-frame-header-carrier` mission records FR-010 as a code review by two
  reviewers at 1280 and 1920.
- That simulation removed only `data-has-sidebar`. The result never ships: the
  fixed sidebar stays and covers 264 px of the pane.
- A real `StarlightPage` with `hasSidebar={false}` still yields a rail on 0.42.6.
  Built as a prototype, it keeps the column centred within 1 px at every width from
  1152 to 2560, with the rail collapsed.
- **The FR-010 rule has no effect on 0.42.** Deleting the
  `:not([data-has-sidebar])` recentre selector changes no measurement, because
  Starlight already centres a page without a sidebar. A test's fail-first mutation
  must therefore break the pane's margin, not delete that rule.
- A fixture page in `example/` breaks `assert:artifacts`: the sitemap counts 69
  pages instead of 68.
- Removing both `data-has-sidebar` and the `nav.sidebar` element from a normal page
  reproduces the real fixture's geometry at all ten measured points.

**Migration impact.** None. Splash pages still get no outline in 0.42.6.

**Options.**

| Option | What | Trade-off | Size |
| --- | --- | --- | --- |
| 1. Real fixture page | `StarlightPage hasSidebar={false}`, built only when a layout-fixture switch is on, kept out of the sitemap | Highest fidelity. Adds a test page and CI wiring to the example | Medium |
| 1b. DOM-derived simulation (not in the issue) | Remove the attribute and the sidebar in the geometry lane, then assert the centring at five widths, collapsed and expanded | Shown to match a real page. Could miss a future Starlight change to pages without a sidebar | Small |
| 2. Record "simulation only" | No test | No guard at all | Extra small |

**Recommendation: option 1b.** Record the decision in the spec and acceptance
matrix with the equivalence evidence. Add option 1 to the Starlight upgrade
tripwire in [ADR-0045](../../adr/0045-frame-width-token.md), so a later version
gets a real page.

### #203: the sidebar reveal jumps on slow pages

**Current behaviour.**

- `REVEAL_CURRENT_SCRIPT` (`src/lib/route-shaping.ts`) is a `<head>` script that
  waits for `DOMContentLoaded`. It waits on purpose, so that it runs after
  Starlight's own scroll restore.
- The sidebar ends about halfway through the HTML. It paints at the top and jumps
  later.

| Scenario | Wrong position before the jump |
| --- | --- |
| Local server, no delay | about 60 ms |
| Last part of the HTML delayed 2 s | about 2 s |
| Module scripts delayed 2 s | about 4 s |

- The NFR-005 layout-shift test cannot see this. A scroll inside a scroll container
  is not a layout shift, so the test passes while the sidebar jumps.

**What Starlight does.**

- Starlight 0.42 has no reveal of the current entry.
- Its `SidebarPersister` restores the scroll position with an inline script right
  after the sidebar tree. That only works from 50em up, and only on in-session
  navigation.
- Upstream closed a reveal-current pull request (withastro/starlight#2012) in favour
  of persistence. It accepted that a restore can still jump on slow devices
  (withastro/starlight#2242).
- DocKitty's jump happens on a first visit or a new tab. In-session navigation
  restores the position before paint.

**Migration impact.** PR #212 added a re-reveal when the mobile menu opens. The
timing did not change.

**Options.**

| Option | What | Trade-off | Size |
| --- | --- | --- | --- |
| 1. Inline after the sidebar | A `Sidebar` override that emits the script after the tree | Exact placement, but a sixth carrier against the carrier lock; needs an ADR | Medium |
| 1c. Observer in the head script (not in the issue) | The head script watches for the end of `sl-sidebar-state-persist` and reveals then; `DOMContentLoaded` stays as the fallback | No new carrier, about four lines. Depends on Starlight's element name; a rename brings back today's jump, nothing worse | Small |
| 2. Accept and document | Nothing changes | A visible jump on every first visit, seconds long on slow links | Extra small |

Option 1c was prototyped. The reveal lands before first paint in all three
scenarios. The existing reveal and layout-shift tests pass, the 67 route-shaping
unit tests pass, and in-session restore still wins.

**Recommendation: option 1c.** Add a fail-first test that reads the sidebar's
scroll position at `DOMContentLoaded`: today it reads 0, and with 1c it reads the
revealed position. Reword NFR-005 so the reveal is measured as "revealed by first
paint", not through layout shift.

### #204: the column and header search shift between rail and no-rail pages

**Current behaviour, rail expanded.** Each cell is the rail page / the no-rail page.

| Viewport | Column x | Column shift | Search x | Search shift |
| --- | --- | --- | --- | --- |
| 1280 | 312 / 312 | 0 (the width changes by 288) | 323 / 323 | 0 |
| 1440 | 312 / 384 | 72 | 323 / 384 | 61 |
| 1600 | 320 / 464 | 144 | 323 / 464 | 141 |
| 1920 | 480 / 624 | 144 | 456 / 624 | 168 |
| 2560 | 800 / 944 | 144 | 776 / 944 | 168 |

- The issue's 144 px at 1920 still holds; its 112 px at 1280 is now zero.
- 26 of the example's 68 framed pages have no rail. They include every section
  index and every persona, so the common move from an index to a child page crosses
  the boundary.
- Stock Starlight also moves both the column and the search between pages with and
  without an outline. ADR-0053 already accepts that the search moves.
- What stock Starlight does not do is put the search somewhere other than the
  column. DocKitty does, which makes it a new defect (see
  [New findings](#new-findings)).

**What the records say.**

- FR-011 and research item R7 of the `sidebar-frame-header-carrier` mission removed
  the reserved rail on purpose: 360 px of rail had been reserved for a single link.
  Option 1 reverses that.
- ADR-0053 §3 says the column never sits under the rail. Option 2 must keep that.

**Options.**

| Option | What | Measured result | Size |
| --- | --- | --- | --- |
| 1. Reserve the rail column on every page | Three CSS rules | Zero shift at every width. The 26 no-rail pages lose reading width: 944 to 656 px at 1280 (−30%). Reverses FR-011 | Small |
| 2. Anchor the column; the rail sits in the margin | Centre the column in the full pane, clamped so it ends at least the rail's width before the frame edge | Zero shift once the frame is 117rem (1872 px) or wider; 72 to 144 px of shift remains from 1440 to 1860. Collapsing the rail no longer moves the column. Keeps FR-011 and ADR-0053 §3 | Medium |
| 3. Accept and document | Nothing changes | Matches upstream | Extra small |

The option 2 prototype used a viewport media query for the header and overrode
Starlight's private `--__toc-width`. A real fix must key on the frame width, for
example with a container query, so that it holds under a frame cap. It should also
own the header's first grid track through the existing header carrier
([ADR-0044](../../adr/0044-header-carrier.md)).

The lenses split on this issue:

- The design lens recommends option 2.
- The provenance lens reads the records as pointing to option 3.

They disagree on whether option 2 breaks ADR-0053 §3. The prototype keeps the
column clear of the rail at every measured width; the guard it proposes asserts
`column end ≤ rail start − 24` from 1152 to 1872 px. So option 2 is compatible with
the ADR, but it still needs a new ADR, because it changes the frame layout that
ADR-0045 §5 and ADR-0053 §3 describe.

**Recommendation.**

- **Fix the search alignment in every case.** It is a defect, not a decision.
- **Choose option 2 if layout stability between pages is a goal, otherwise option 3.**
  Option 2 is worth its medium cost only together with a wide frame, which is why
  it couples with #205. On its own it removes the shift only on screens wider than
  117rem.

### #205: wide-screen margins and a recommended page-width cap

**Current behaviour at 2560.**

- Without a cap there are 512 px of empty space on each side of the column on a rail
  page, and 656 px on a page without a rail. The issue's 632 px predates ADR-0053.
- The cap is the `--dk-width-frame` token. It defaults to `100%`, and a site can set
  it on `:root`.
- [ADR-0045](../../adr/0045-frame-width-token.md) decision 1 makes full width the
  default and a cap opt-in, and records that a 90rem default was rejected.
- The cap is documented in one bullet in `docs/guides/consumer-setup.md`. The same
  page still says the column is at most 720 px.

| Cap | Margin each side, rail page | Margin each side, no-rail page | Gutter outside the frame, each side |
| --- | --- | --- | --- |
| None | 512 | 656 | 0 |
| 90rem | 24 | 96 | 560 |
| 100rem | 32 | 176 | 480 |
| 120rem | 192 | 336 | 320 |

**Coupling with #204.**

- Any cap below 117rem brings back a 72 px shift between rail and no-rail pages,
  even under #204 option 2.
- A 120rem cap with option 2 gives zero shift at every viewport from 1920 up.
- So the 90rem example in the docs is a poor recommendation, and 120rem is a better
  one.

**Options.**

- **1. Document a recommended cap more prominently.** Covers the README, the
  adopting guide and consumer setup. This repository has no separate getting-started
  guide.
- **2. Ship a default cap.** Changes the appearance of every consuming site at
  viewports wider than the cap. It reverses an owner decision recorded in ADR-0045
  and needs a new ADR. At 0.x it fits a 0.5.0 minor release with a migration line,
  `:root { --dk-width-frame: 100%; }`.
- **3. Leave it.**

A 120rem default would leave every layout at 1920 px and narrower unchanged. Only
the 2560 px geometry cases would need new expectations.

**Recommendation: option 1 now**, recommending 120rem, and correcting the stale
720 px figures in the same change. Whether to also ship 120rem as the default in
0.5.0 (option 2) is the owner's call. ADR-0045 recorded the opposite choice, and
this research found no new fact that forces it.

### #206: the Persona card is start-aligned in the wide column

**Current behaviour.**

- The card is `.dk-passport` in `src/layouts/Persona.astro`. Its `max-width` is
  `--dk-width-passport` (32rem), with no inline auto margins.
- At 1920 it leaves 448 px blank beside it, not about 210 px. The gap is the column
  width minus the card width, so it grew with ADR-0053.
- A frame cap does not change the gap, and neither do the #204 options, so this
  issue stands on its own.

**Options measured at 1920.**

| Option | Result |
| --- | --- |
| Centred | 224 px blank on each side. The card's title then starts 329 px to the right of the prose below it, breaking the shared left edge |
| Stretched | 960 px wide. Field values run to about 120 characters a line |
| Band width (`--dk-width-band`, 50rem) | 800 px wide, start-aligned. Matches the metadata band on normal pages |
| Start-aligned at 32rem (today) | 448 px blank |

**Recommendation:** keep it start-aligned, as the metadata band, the hero and the
page title are. Optionally widen the card to the band token so the identity blocks
share one width, and keep `--dk-width-passport` as the override hook. Record that
centring was rejected, and why. Add a 1920 geometry assertion: the card starts at
the column start and has the token width. Size: extra small to small.

## New findings

These came up during the research and are not tracked by any of the issues.

1. **On a rail page the header search does not line up with the column.**
   - From about 1700 px the search starts 24 px before the column (456 against 480
     at 1920).
   - The cause: Starlight's header grid still assumes stock geometry, while the
     toolkit re-centres the column (`src/styles/dk-components.css`).
   - The layout lane's A7 case checks only the first and last header items, so it
     misses this.
2. **With the rail collapsed, the search stays where the expanded rail put it.**
   - It ends up 168 px from the re-centred column at 1920 and 2560.
   - `src/styles/toc-rail.css` re-centres the pane but not the header.
3. **From 1152 to 1295 px with the rail collapsed, the column box runs 7 px under the
   toggle.**
   - Whether text actually touches the toggle depends on the fallback font. That is
     why the `1280px collapsed` case fails with Inter or Liberation Sans and passes
     in CI's image.
   - The comment at `toc-rail.css` that says the toggle is clear of the text from
     72rem is wrong for that range.
4. **Some comments and docs are stale.**
   - `consumer-setup.md` still gives 720 px figures.
   - `collapsible-toc-rail.md` and `theming.md` still say the upgrade tripwire was
     checked against Starlight 0.32.6.
   - `dk-components.css` and `toc-rail.css` still say Starlight has no cascade
     layers. 0.42 uses `@layer starlight.core`.
   - `header-carrier.test.ts` still says the fixture predates the carrier.

Findings 1 to 3 belong with #204. Finding 3 also affects #202's chrome checks.
Finding 4 is cleanup that can ride with whichever change touches each file.

## Proposed Phase 2 shape

All the issues share one spec (the `sidebar-frame-header-carrier` mission's FR-010,
FR-022, NFR-004, NFR-005 and NFR-006), one baseline workflow, and one ordering
constraint: baselines should be regenerated once. That argues for one mission with
this order:

| Order | Work package | Issues | Baselines moved |
| --- | --- | --- | --- |
| 0 | Decision records | #199, #203, #204, #205, #206, #207 fixture source | None |
| 1 | Independent guards, in parallel with the rest | #201, #207 | None |
| 2 | Layout changes | #204 and new findings 1 to 3, #206, #205 if it ships a default, #203 | Drafts-on screenshots, once |
| 3 | Geometry guards | #204 parity, #199, #202 | Geometry only |
| 4 | Published lane | #200 | Drafts-off screenshots, once |

If the mission is too large, #201 and #207 can land first as a small separate change,
because they move no baselines. Screenshot baselines must come from the CI baseline
workflow in the pinned container, never from a local run.

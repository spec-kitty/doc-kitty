# WP07 review feedback — round 1

Reviewer: reviewer-renata (claude). Reviewed `f9cd6a4^..bf12b01` in lane-g.

Verdict: **changes requested**. Two small items meet the reject bar set for this
package (a factual error in a guide; a consumer check that does not
discriminate). Everything else verified and stands; do not rework it.

## Must fix

### 1. `docs/guides/consumer-setup.md:404-406` — wrong statement about `on`

> A page with `doc_status: draft` (or no `doc_status`) is left out of the build,
> the sidebar and every machine-readable surface unless the build runs with
> `DK_PUBLISH_DRAFTS=on`.

With `on`, a draft is still absent from `sitemap-*.xml`, `rss.xml`, `llms.txt`
and `api/index.json`. `docs/guides/draft-publication.md` says so ("The four
listing surfaces never include a draft, whatever the value") and
`assert-consumer-surfaces.mjs` asserts it from the tarball. The sentence tells a
consumer the opposite.

Fix: say that `on` builds and lists the page (marked `noindex`), and that the
sitemap, feed, `llms.txt` and agent index never list a draft in either mode.

### 2. `tests/consumption/scripts/assert-consumer-surfaces.mjs:204` — check passes for the stock header

```js
check(/<site-search|starlight-theme-select|site-title/.test(headerBlock), ...)
```

The alternation passes when any one of the three is present, and all three are
in Starlight's stock header. Measured: with `src/components/Header.astro`
mutated to always render the stock header, the full pack run reports this check
as passing (only the check before it fails). It also still passes if the
fixture's `SiteHeader.astro` drops two of its three parts.

Fix: require each of the three parts the fixture header supplies, as three
separate tests or one `every`, so that the label ("the Starlight parts the theme
header re-supplies are rendered inside it") is what is tested.

## Should fix in the same round (cheap; not blocking on their own)

### 3. `CHANGELOG.md:70` — "24 pages on the example site"

24 is the count in a drafts-on build (25 framed pages without `data-has-toc`,
minus `404.html`). The default, published build has 19. The same entry says the
published site is built with the setting off. Say which build the number is
from, or drop the number.

### 4. Acceptance gap 3.6 — nothing pins `deploy.yml`'s `DK_PUBLISH_DRAFTS: 'off'`

Add a unit test next to the one added in
`src/tests/regen-workflow-render-setup.test.ts`: read
`.github/workflows/deploy.yml` and assert the job-level
`DK_PUBLISH_DRAFTS: 'off'`. The default is also off, so what this guards is
someone setting `on` on the live build (FR-018).

### 5. Acceptance gap 4.4 — reveal-current has no browser test

Add one Playwright test: open a deep page with a short viewport and assert the
`[aria-current="page"]` entry lies inside `.sidebar-pane`'s visible range.
Measured during review at 1280x600 on `/rhetoric/book-one/chapter-15/`:
`scrollTop` 1664, entry at 318..346 inside the pane's 64..600. The existing
tests run the script against a stub document only, and this package rewrote the
comment in `src/lib/route-shaping.ts` to claim the script also acts in the
mobile menu at 390px, which no test measures.

## For the record (no change requested here)

- `src/tests/glossary-substrate-parity.test.ts:162` — the reworded `why` is
  accurate, but the gap it names is not pre-existing: this mission opened it by
  removing `tableOfContents: false` from the Markua pages (`e0340a4`, `a0f9ba8`,
  and the last two in `416ffe8`). It is latent today (the Markua example pages
  set `glossary_autolink: false`). Raise a follow-up issue for a Markua-body
  re-derive fixture and mention it in the pull request.
- Acceptance gap 2.5 (simulation only) is acceptable as documented in ADR-0045
  and the changelog.

## Verified and not to be reworked

- `redirectsToDrafts`: chain, draft-route-that-redirects, loops, self-redirect,
  base/no base, trailing slash, external targets all correct. Disabling the
  chain walk fails 3 tests; removing the loop guard hangs the suite.
- Removal of `.right-sidebar { inset-inline-end }`: measured at 1920 under a
  90rem cap, with and without the rule: rail 1392..1680 (LTR), 240..528 (RTL),
  identical; the rule was guarded to the expanded state, so collapsed is
  untouched by the removal.
- `dist-*` typecheck exclusion hides no tracked source.
- `update-a11y-baselines.yml` env and image match `ci.yml` `build-example` / `a11y`.
- Forcing `shapeSidebar: true` fails 2 consumer-sidebar tests.
- Four source mutations (frame registration, env-file read, Header carrier,
  sidebar shaping) each fail the packed-consumer run.
- ADR-0044, ADR-0045, both new guides, `theming.md`, `collapsible-toc-rail.md`,
  `markua.md` and the rest of the changelog match the code. ADR index is
  regeneration-clean.
- No `.png`, no `kitty-specs/` edit, nothing pushed.

---
title: "ADR-0037: Base-aware internal links and a fail-closed, built-output link gate"
description: Internal links AND emitted RSS/llms.txt/agent-API absolute URLs carry the site base, enforced end-to-end by a base-aware built-output link gate.
doc_status: active
updated: 2026-09-04
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0034-redirect-coverage-gate
  - context/convention
---

# ADR-0037: Base-aware internal links and a fail-closed, built-output link gate

## Status

**Accepted** — 2026-09-04. Greenfield contract. Introduced by the
link-integrity mission (issues #61/#62/#63; spec FR-004/FR-005, NFR-003/004,
C-003/C-005). No prior ADR governs internal-link base-prefixing or a
built-output link check; this closes both gaps together because #62 (the gate)
is why #61/#63 (the broken links) shipped unnoticed.

## Context

The example docsite deploys under a path base (`/doc-kitty`, a GitHub Pages
project site) with trailing-slash, directory-style routes
(`…/architecture/overview/`). Two independent defects compounded:

1. **Internal hrefs shipped without the base.** Component-generated hrefs
   (`Related`/`Audience`/`OnThisPage`/glossary autolink), and hand-authored
   Markdown links, were built as root-absolute or `.md`-relative strings with
   no `/doc-kitty` prefix. Astro/Starlight does not rewrite either shape on
   its own — a raw `/…` href or a `.md`-relative href is emitted **verbatim**
   into the rendered HTML. On a based deployment that 404s; on a leaf page a
   bare relative link (no `./`/`../`) additionally resolves as a **child** of
   the current page under trailing-slash directory semantics, not the
   filesystem sibling the author meant (confirmed: `superseded-note.md`'s
   `[…](blocks-demonstrator)` → `…/superseded-note/blocks-demonstrator`, a
   dead route).
2. **The pre-build link gate could not see any of it.** `check-links.mjs`
   (`pnpm validate:links`) skips site-absolute links by design and resolves a
   relative link against the **filesystem**, not the served URL. It reported
   "✓ 863 references resolve" while roughly 30 links 404'd — a green gate is
   worse than no gate, because it actively hides the defect it should be
   catching.

A prior WP01 review cycle also established, empirically, that the originally
planned `.md`-relative authoring fix (re-author as `[…](./target.md)`,
assuming Astro rewrites it to the live route) does **not** work in this
Starlight dynamic-route architecture — the `.md` href renders unrewritten and
still 404s. The convention below reflects that finding, not the original
research draft.

## Decision

### 1. Two render-time seams carry the base; the source stays base-less

- **Component-generated hrefs** go through one shared `withBase()` helper
  (`src/lib/with-base.ts`, reads `import.meta.env.BASE_URL`) at each call site
  (`metadata.ts routeFor` consumer, `Related.astro`, `OnThisPage.astro`,
  `Audience.astro`).
- **Glossary term hrefs** (`/glossary/<context>/#<anchor>`) go through one
  shared, base-aware URL builder threaded the configured base via the
  established `normalizeBasePrefix` pattern (`config.ts`), shared by the
  autolinker, the `:term` directive, and the hover-preview client — one
  source, no cloned prefix logic (NFR-002).
- **Hand-authored content links** are written as **root-absolute canonical
  routes** — `[…](/architecture/blocks-demonstrator/)`, not
  `.md`-relative — and a new, always-on rehype plugin
  (`src/lib/rehype/base-absolute-links.ts`) base-prefixes every root-absolute
  `<a href="/...">` in the rendered HAST, threaded the SAME
  `normalizeBasePrefix(base)` value as the glossary plugins. This is the
  render-time seam authored content has no call site to fix at — the
  rehype pass is the one point every page's markdown output passes through.
  With no base configured the plugin is a strict no-op (byte-identical
  corpus), matching the diagrams/Markua opt-in seams' shape.
- **Feed/agent-API absolute URLs** (`rss.xml`'s `<link>`/`<guid>`/atom
  self-href, `llms.txt`'s page and machine-index URLs, and the agent-API
  JSON's `url`/`source` fields) go through the ONE shared `absolute(site,
  path)` composer (`src/lib/routes/shared.ts`). A pre-PR review of this
  mission found these three routes still 404'd on the based deployment even
  after the seams above shipped: `absolute()` built its URL from the
  base-less `path` argument verbatim, so e.g. `rss.xml`'s `<link>` read
  `https://…/guides/x/` instead of `https://…/doc-kitty/guides/x/`, even
  though `discoveryHead` (`config.ts`) already base-prefixed the `<head>`
  advertisement of `/rss.xml`/`/llms.txt` itself. `absolute()` now routes its
  `path` through the SAME `withBase` helper before resolving it against
  `site` — closing the gap with the established seam rather than cloning a
  fourth base-prefix implementation. The agent-API's `route`/`source`-as-path
  fields (`toAgentRecord`, `metadata.ts`) stay deliberately base-less — that
  is the committed contract `assert-build-artifacts.mjs` and
  `agent-api.test.ts` pin — only the derived `url` (and the `source`
  URL field distinct from the base-less `route`) are base-prefixed.

A relative content link that names a real, already-nested subdirectory route
(e.g. `./missions/mission-alpha/` from a directory-index page, or
`./hr/` from the glossary index) stays untouched — it is correct exactly as
written under directory-URL semantics and needs no base (a relative link
resolves against the browser's current, already-based document URL).

### 2. The built-output gate is the enforcement authority; the source gate is a fast, best-effort filter

`assert-no-broken-links.mjs` walks the actual rendered `example/dist/**/*.html`,
extracts every `<a href>`, resolves it **as a URL** (via the WHATWG `URL`
resolver, so RFC 3986 trailing-slash-directory semantics apply exactly as a
browser would) against the page's own base-prefixed route, strips the
query/fragment, and requires the result to exist in `dist` — an `index.html`
for a directory route, or the literal file (`rss.xml`, `api/index.json`, …).
A resolved path that does not carry the configured base at all is reported
distinctly (`likely a base-less internal link (#61)`) rather than folded into
a generic "missing" — dist's on-disk layout never nests a `<base>/` directory,
so a base-less href would otherwise coincidentally "exist" against the
filesystem even though it 404s for real; this is exactly the class of miss
that let #62 ship. Cross-page `#fragment` heading-id existence is explicitly
OUT of this gate's v1 scope (covered instead by `link-integrity.test.ts`'s
glossary-anchor assertions); a page resolving is proven, its named anchor
existing is not yet.

An optional `--site <origin>` flag additionally scans `rss.xml`, `llms.txt`,
and every `api/**/*.json` file for an absolute URL sharing the configured
site's origin but missing the base — the completeness gap the pre-PR review
above found (this gate, at merge time, walked only rendered `<a href>`s and
never looked at these three routes' self-composed absolute URLs at all).
`pnpm assert:no-broken-links` always passes `--site`, so CI runs both scans
together; an absolute URL on a different origin (an external citation/image
link embedded in page content) is never flagged.

`check-links.mjs` (the pre-build source gate) is tightened, but only for
`example/docs` (the base-prefixed, directory-routed site tree — the top-level
`docs/` root stays plain, unbuilt Markdown viewed on GitHub, where
`.md`-relative cross-links are the correct, working convention and must not
be flagged). For `example/docs`, an inline link that is internal and relative
now fails outright when it is `.md`/`.mdx`-relative (confirmed dead, per
above) or extensionless with no trailing slash (the bare-relative
child-not-sibling trap); a root-absolute link is left accepted here — this
fast, filesystem-only check cannot verify a root-absolute target against the
real route tree, so `assert-no-broken-links.mjs` is deliberately the authority
on whether it actually resolves, not this gate.

### 3. Wiring

`pnpm assert:no-broken-links` (`example/dist --base /doc-kitty --site
https://spec-kitty.github.io`) runs in CI's `build-example` job, immediately
after `assert:artifacts` and before the redirect-coverage gate — the same
"runs after the build produced `dist/`" shape `check-redirect-coverage.mjs`
already established.

## Consequences

### Positive

- Internal navigation (glossary terms, Related/Audience/OnThisPage cards,
  hand-authored content links) resolves on the real, based deployment — the
  three shipped defect classes (#61 component/authored, #63 glossary anchor,
  #62 gate) close together, not as three independent point-fixes.
- RSS, llms.txt, and the agent-API JSON's absolute URLs are ALSO
  base-prefixed and gated (pre-PR review fold-in, same #61/#62 defect class,
  same seams: `absolute()` now routes through `withBase`; `--site` extends
  `assert-no-broken-links.mjs` to scan all three surfaces) — not a
  point-fix bolted alongside, but the same mechanism closing its last gap.
- The gate that let this ship is now fail-closed and mutation-provably so: a
  reintroduced base-less or wrongly-relative link reds the build, not just a
  future manual click-through.
- No new dependency; both the rehype plugin and the dist gate reuse
  established patterns (`normalizeBasePrefix`, the bare-Node dist-walk gate
  shape from `check-redirect-coverage.mjs`/`assert-build-artifacts.mjs`).

### Negative

- Two link gates now exist with different authority: `check-links.mjs` is a
  fast pre-build filter that cannot fully validate a root-absolute link, and
  `assert-no-broken-links.mjs` is the slower, build-dependent authority. A
  contributor must run (or CI must run) a full build to get the real verdict.
- Cross-page anchor-fragment existence is not verified by the new gate; a
  future anchor-id regression on an otherwise-resolving page would not be
  caught here (tracked as v1 scope, not silently dropped).

### Risks

- `assert-no-broken-links.mjs`'s base is passed explicitly
  (`--base /doc-kitty`, matching `astro.config.mjs`'s `BASE` constant) rather
  than derived from the build; if the site's base changes, this wiring must be
  updated by hand (mirrors how `OWNER`/`REPO` are already explicit, real
  values in `astro.config.mjs`, not auto-detected).
- The rehype plugin's root-absolute detection and `check-links.mjs`'s relative
  classification must keep agreeing with `with-base.ts`'s scheme rules as new
  link shapes are introduced; a drift between the three would reopen a gap
  the built-output gate would still catch, but later than a source-level
  check ideally would.

## Alternatives considered

### Option A: Re-author content links as `.md`-relative (original research D2)

Rejected on evidence, not preference. WP01 review-cycle-1 confirmed the `.md`
href renders unrewritten in this Starlight dynamic-route build and 404s live
— the assumption that Astro rewrites a `.md`-relative link to its final route
does not hold here.

### Option B: Fix only the source gate, skip a built-output gate

Rejected. `check-links.mjs` cannot see component- or glossary-generated hrefs
at all (it only reads source Markdown), and cannot validate a root-absolute
link against the real route tree without either building the site or
duplicating Astro's routing. Only a built-output walk closes NFR-001 (zero
internal 404s) for real.

### Option C: A Playwright crawl of the served build

Rejected, mirroring ADR-0034's identical call for the redirect-coverage gate:
heavier setup, slower, and non-deterministic relative to the bare-Node,
few-seconds-added budget the existing sanity-gate shape already meets.

## References

- [ADR-0034](./0034-redirect-coverage-gate.md) — the bare-Node,
  built-output-authoritative gate shape this pattern follows (baseline vs.
  route resolution, but the same "reads dist, doesn't build" discipline).
- Spec FR-001–FR-005, NFR-001–NFR-004, C-001–C-005; research D1–D4;
  `kitty-specs/link-integrity-01M1PSEH/{spec.md,research.md}`.
- `src/lib/rehype/base-absolute-links.ts`, `src/lib/with-base.ts`,
  `src/lib/routes/shared.ts` (`absolute()`), `src/scripts/check-links.mjs`,
  `src/scripts/assert-no-broken-links.mjs`.

---
title: "ADR-0078: The OpenAPI surface matrix"
description: The OpenAPI surface matrix — one agent entry per version, which surfaces are included or excluded, the input contract, and the owner-trusted trust model.
doc_status: active
updated: 2026-11-08T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0049-openapi-reference-via-existing-integration
  - adr/0026-glossary-source-and-generation-seam
  - adr/0046-gherkin-feature-pages
  - adr/0048-generated-page-names-and-empty-sources
  - architecture/openapi-pages
  - guides/openapi-reference
---

# ADR-0078: The OpenAPI surface matrix

## Status

**Accepted** — 2026-11-08, from the maintainer's decisions of the same date on
epic #285. Supersedes the *surface matrix* of
[ADR-0049](./0049-openapi-reference-via-existing-integration.md) — its
"Surfaces" section and the surface rows of its 2026-10-29 addendum — which
recorded `llms.txt` as wired and the agent API, content graph and glossary
autolinker as follow-ups. ADR-0049's core decision (an existing integration,
`starlight-openapi`, behind thin adapters) and its NFR-002 waiver stand
unchanged; its text and the ADR index are untouched.

## Context

ADR-0049 accepted `starlight-openapi` for the reference pages and recorded
which site surfaces saw them. The second OpenAPI slice (#285, sub-issues #257,
to #260) closed the gaps: synthetic agent entries, per-operation
search, the version switcher, the tagged-release archive, multi-file and remote
inputs, and the unreleased-version publication rules. Epic issue #257 originally
asked for the pages to reach *every* surface. The maintainer resolved five
decisions on 2026-11-08 that this ADR records, including three deliberate
exclusions from that ask.

The pages are injected routes, not content-collection entries (ADR-0049
addendum, "Surfaces"). That fact drives most of the matrix below: the surfaces
that read the content collections never see the pages, so each surface either
gets a synthetic entry built from the materialised spec list, or is excluded on
purpose.

## Decision

### 1. One synthetic entry per spec version

Every materialised spec version — from `specs[].path`, a remote `url`, the
`archive` glob, a multi-file definition or a Swagger 2.0 document — yields one
synthetic entry on the agent surfaces, projected once and shared:

- `slug` is `<section>/<label>`; the record carries `type: reference`,
  `doc_status: active`, `kind: Reference`, `tags: ["openapi"]`, the `released`
  flag, `rawDocumentUrl` (the base-aware path of the published raw document)
  and its `sha256`.
- The index record in `/api/index.json` and the page payload at
  `/api/pages/<slug>.json` come from **one** projection function, so they
  cannot drift.
- Entries are **appended after** the docs records, never ranked among them,
  and the docs-only `buildId` is unchanged by them: index, docs pages and
  synthetic pages keep agreeing on it.
- An unreleased version gets an entry too, marked `released: false` (and
  "(unreleased)" in its title). It stays out of the sitemap and search
  (decision 4 below); the agent surfaces carry it because an agent resolving
  a contract does not care about the site's release calendar.

### 2. The surface matrix

| Surface | Carries the reference? | Decision |
| --- | --- | --- |
| Reference pages, sidebar, TOC | Yes | ADR-0049: the renderer, inside the DocKitty frame. |
| Raw document + `.sha256` | Yes | Byte-identical to the input (or to the bundle, §3), at `<section>/<label>/openapi.<ext>`. |
| Version switcher | Yes | A native disclosure of plain links on every page; it targets the **same operation** in the other version when that version routes one, else that version's overview (#259). No inline script, so no new CSP hash. |
| Sitemap | Released only | Unreleased pages are built and served but held back (FR-015). |
| Search (Pagefind) | Released only, one result per operation | Findable by summary, method and path (FR-013); unreleased pages carry no `data-pagefind-body`. |
| `llms.txt` | Yes | One line per version (raw document link, "(unreleased)" suffix); with `openapi.llmsOperations: true`, one line per operation, indented two spaces (`- METHOD /path: summary`). Off by default, so an opting-out site's `llms.txt` is byte-identical. |
| Agent index + agent pages | Yes | The synthetic entries of §1. |
| Content graph | Yes | One `resource` node per version, with its raw-document edge. |
| OKF bundle | Yes | One file per version, the shared summary Markdown. |
| RSS / Atom feeds | **No** (FR-011) | A spec version has no publication date, and the raw document carries its own history. |
| Glossary autolinker | **No** (FR-010) | The renderer runs its own Markdown pipeline over descriptions; autolinking there would silently miss. |
| Frontmatter gate | **No** (FR-012) | The pages are synthesised and carry no frontmatter. The spec **input** is validated instead (FR-021/FR-022). |

The three exclusions are the deviations from issue #257's original ask, resolved
by the maintainer: feeds, autolinker and frontmatter gate stay out, and the
input gate replaces the frontmatter gate's assurance.

### 3. The input contract

One materialised list is computed at config time — before any page renders —
and every surface reads it:

- `specs[]`: a local `path` (`.yaml`/`.yml`/`.json`), or a remote `url`
  (`https:` only) with a required `sha256`. A local `path` may also carry an
  optional `sha256` pin, verified at materialisation.
- Remote inputs obey an offline switch: `openapi.offline`, defaulting to
  `DOCKITTY_OFFLINE === '1'`. An offline build makes **zero** network
  requests: the pinned bytes are served from the cache under
  `node_modules/.cache/doc-kitty/openapi/`, keyed by the spec's sha256, and a
  missing or corrupted cache entry fails the build closed instead of
  fetching.
- `archive`: `{ glob, labelPattern, released? }` scans the site root for
  matched files, one version per match, label taken from the file name by the
  pattern's one capturing group; matches sort by POSIX relative path and follow
  the explicit specs.
- A definition with relative `$ref`s across local files is accepted and
  published as **one bundled file**: the published bytes are the bundle, and
  match no single source file (decision 1). Swagger 2.0 documents are accepted;
  the original bytes are published and conversion happens in memory only.
- Labels are unique, lower-cased, and route-safe: `a-z`, `0-9`, `_`, `-`.
  **A dot is refused** — the renderer slugifies routes and drops dots, so
  `v1.1` would advertise an address the site does not serve (`/v11/`).
- Ordering is stable end to end (FR-023): explicit specs in config order,
  archive matches after them, operations by path then uppercase method,
  bytewise.
- Every rejection names the spec version and the cause, prefixed
  `[dk-openapi]`, with URL query strings redacted. A failing build publishes
  nothing. The rejected-input matrix (FR-022) is enforced at this step, not at
  page render.

### 4. Trust model (C-008, research R14)

Spec inputs are **owner-trusted**, exactly like the site's Markdown:

- The renderer's HTML is not sanitised, and private or intranet HTTPS hosts are
  allowed for remote URLs. Integrity comes from the sha256 pin, not from
  host filtering.
- Broken or hostile input fails closed through the FR-028 bounds: realpath
  containment for `$ref` targets and archive matches, regular files only,
  absolute/`file://`/`http(s)` refs rejected, at most 200 archive matches, a
  30 s fetch timeout, a 10 MB size cap, at most 100 YAML aliases, bounded ref
  count and depth, no URL userinfo, no authentication headers, a verified
  cache (hash checked before parse, atomic write, never through a symlinked
  entry), and a dev-server raw-document route limited to an exact allowlist,
  GET and HEAD only.
- Spec-derived text that reaches DocKitty's own outputs (`llms.txt` lines,
  agent Markdown, the OKF summary, switcher labels) is flattened to one line
  and link-escaped, so a hostile document cannot inject a line, heading or
  link. `javascript:`, `data:` and `vbscript:` links in descriptions fail the
  build-time link check; other non-file schemes are skipped as external.

### 5. Deviations from the issues

Beyond the three exclusions of §2: #260 asked for a remote URL input and got it
behind a mandatory sha256 pin (decision 2); #259's archive input landed with
the route-safe label rule applied to derived labels too, which makes a dotted
label a **breaking change** for any site that used one (the build now refuses
it with a pointed message instead of silently serving the wrong address).

## Consequences

### Positive

- An agent can resolve and verify a contract in at most two GETs (index, then
  raw document), with the digest on every surface agreeing.
- The surface matrix is written down once, so later slices extend it instead of
  re-deriving it from code.
- The exclusions are deliberate and recorded, with the compensating control
  named (the input gate).

### Negative

- Two projections of one version exist in the wild (HTML pages and synthetic
  entries); the shared projection function keeps the machine surfaces
  agreeing, but the HTML remains the renderer's.
- The matrix must be updated by hand when a new surface is added to the
  toolkit; the build gate (`assert-openapi-artifacts.mjs`) catches drift on the
  surfaces it pins.

### Risks

- The renderer's route slug rules (dots dropped, duplicate-`operationId`
  suffixes) are mirrored in toolkit code; a pin bump can change them and turn
  the switcher mapping or label rule stale. Re-running the C-006 exit-criteria
  table on bump is the guard (ADR-0049 addendum).

## Alternatives considered

### Rank the synthetic entries among the docs records

Rejected. A spec version is not a docs page: it has no author, no frontmatter
and no section ordering. Appending keeps the docs ranking and `buildId`
untouched.

### Sanitise the renderer's HTML

Rejected under C-008. The owner already trusts the site's Markdown; the
sha256 pin plus the FR-028 bounds give the same assurance without a sanitiser
dependency and its bypass churn.

### Include unreleased versions in the sitemap and search

Rejected (FR-015). Search and sitemap are reader-facing discovery surfaces; an
unreleased contract is not discoverable output. The agent surfaces carry it
because agents resolve pinned digests, not calendars.

## References

- Epic #285 and sub-issues #257, #258, #259, #260; the maintainer's five
  resolved decisions of 2026-11-08.
- [ADR-0049](./0049-openapi-reference-via-existing-integration.md): the
  integration choice, the NFR-002 waiver and the supply-chain check this ADR
  builds on.
- [OpenAPI pages](../architecture/openapi-pages.md): how the matrix is
  implemented; [the guide](../guides/openapi-reference.md) for the consumer
  view.

# Research: OpenAPI pages, second slice

Inputs: the #285 research debrief (surface matrix, bugs 1-7), the post-spec rulings R1-R21 and the code at `e5b7efc`. Maintainer decisions 1-5 in the spec are not reopened here.

## R1: Where bytes and sha256 are computed

- **Decision**: a config-time `materialiseOpenApiSpecs()` step, called in `defineDocKittyIntegrations` after the static check. Bytes stay in the integration closure; metadata goes out through `DK_OPENAPI`.
- **Rationale**: today `openapi-publish.ts` re-reads `absPath` at `astro:build:done`, so the file can change between validation and publication (TOCTOU, ruling R3). Config time runs in build, dev, sync and check, which FR-021 needs.
- **Alternatives**: compute at `astro:config:done` (later, same effect, but routes have already read the env in some paths); compute in each consumer (the drift FR-006 forbids).

## R2: Unreleased pages out of search (FR-015, the plan decision)

- **Decision**: extend the existing `getPageProps` splice so the frontmatter carries `pagefind: false` for an unreleased version. The runtime half looks the label up in `virtual:doc-kitty/openapi` (already loaded by the transform's import) from `schema.config.base`.
- **Rationale**: Starlight omits `data-pagefind-body` when frontmatter has `pagefind: false`, so Pagefind generates no fragment. It reuses the one splice site that already throws on a renderer shape change. Testable by the absence of `data-pagefind-body` and of fragments in `dist/pagefind/`.
- **Alternatives**: a post-build HTML rewrite removing the attribute (edits renderer output after the fact); a Pagefind `exclude_selectors` / glob config (Starlight owns the Pagefind invocation, no supported hook); a route middleware that strips the attribute (runs per request in dev, fragile).

## R3: Raw documents in dev (FR-016)

- **Decision**: a Connect middleware registered in `astro:server:setup`, serving the materialised bytes and sidecar at the same base-aware paths.
- **Rationale**: same bytes as the build by construction (NFR-007); no files written into `public/` or the source tree.
- **Alternatives**: write into `public/` (pollutes the tree, collides with the authored-file guard); an injected Astro endpoint (would also emit in the build and duplicate the publisher).

## R4: Bundler and serialisation (FR-019, C-006)

- **Decision**: `@readme/openapi-parser` `bundle()` on the entry file, after a DocKitty pre-walk of `$ref`s that enforces: file scheme only, resolved path inside the entry's folder, target exists and parses, no cycle through external files (report the chain). Internal (`#/...`) cycles are left alone. Output is serialised in the input's format: JSON with `JSON.stringify(doc, null, 2) + '\n'`, YAML with the existing js-yaml (`dump` with `noRefs: true, lineWidth: -1, sortKeys: false`). Key order is the parser's, which is deterministic for the same input.
- **Rationale**: the renderer already uses this parser, so bundling semantics match the rendered pages. The pre-walk gives `[dk-openapi]` errors instead of parser stack traces (NFR-003).
- **Alternatives**: `@apidevtools/json-schema-ref-parser` directly (transitive, not pinned by us); `redocly bundle` (large new dependency); publishing the source tree (rejected by Decision 1).

## R5: Remote fetch and cache (FR-021)

- **Decision**: global `fetch` with `redirect: 'manual'`, following up to 5 `Location` hops, each required to be `https`. Hash the final body; compare to the configured sha256; write `node_modules/.cache/doc-kitty/openapi/<sha256>.<ext>` atomically (temp file + rename). Cache hit = file exists and its digest matches its name. Offline when `DOCKITTY_OFFLINE=1` or the option `openapi.offline: true`; offline never calls `fetch`.
- **Rationale**: manual redirects make the count and the https rule enforceable. Keying by digest makes a corrupted entry detectable and lets two labels share bytes.
- **Alternatives**: `redirect: 'follow'` (cannot count or scheme-check hops); cache keyed by URL (stale on content change).

## R6: API page link check (FR-009)

- **Decision**: a new module `openapi-link-check.ts` run at `astro:build:done` after the publisher, over `<outDir>/<section>/**/*.html`, reading `href`s inside the renderer's content area. Classes: relative `.md` (resolve against the page route, map `x.md` to its route as the site link rewrite does), root-relative (base-stripped, file or `index.html` must exist, raw documents included), fragment (`#id` must exist in the target page), external (scheme or `//`) skipped. Failure throws `[dk-openapi] <page route>: broken link <target>`.
- **Rationale**: the docs link rewrite never sees renderer output (debrief bug 5); checking built HTML covers every class without rewriting.
- **Alternatives**: extend `assert-no-broken-links.mjs` (a CI script, not a build-time failure for consumers); check the spec Markdown before render (misses renderer-built anchors).

## R7: Same-operation mapping (FR-017, C-007)

- **Decision**: compute each operation's renderer slug at materialisation with a port of `starlight-openapi` 0.27.0's slug rules (operationId slug, else method+path; duplicate suffix), and pin it with tests that compare against the renderer's actual routes on a fixture with duplicate `operationId`s.
- **Rationale**: the switcher must link at build time with no script; the renderer exports no slug helper.
- **Alternatives**: import renderer internals (unexported, breaks on bump silently); link only overviews (contradicts Decision 5).

## R8: Archive glob (FR-018)

- **Decision**: `fs.globSync` (Node >= 22.22, already the engine floor) relative to the site root; label from `new RegExp(labelPattern).exec(basename)[1]`, lower-cased, through the existing label rule.
- **Rationale**: no new dependency.
- **Alternatives**: `tinyglobby` (another dependency for the same result).

## R9: Swagger 2 (FR-020)

- **Decision**: accept `swagger: "2.0"`; publish original bytes; the renderer converts in memory. Operation extraction reads `paths` the same way for 2.0 and 3.x.
- **Alternatives**: convert and publish 3.x (rejected by FR-020).

## R10: Synthetic entry metadata defaults (FR-001)

- **Decision**: values: `section` = first segment of the OpenAPI section, `type: 'reference'`, `kind: 'Reference'`, `doc_status: 'active'` for every version (a `draft` value would trip publication filters and drop the entry, contradicting Decision 4), `tags: ['openapi']`, `priority` = the record default, `authors: []`, `keywords` = operation summaries (deduped, sorted), `source` = the agent page URL (as for docs pages, `self`), `url` = the version overview.
- **Rationale**: these satisfy the MCP corpus shape (`mcp/src/corpus/source.ts`) with values already in the vocabulary; unreleased is stated by the explicit `released` field and in `title` and `markdown`.
- **Alternatives**: a new `kind: ApiSpec` (vocabulary change, consumer charters might reject it).

## R11: Content graph node

- **Decision**: `{ id: 'openapi:<label>', kind: 'resource', title, url: <raw document URL>, resource: { sha256, released, overview } }`. No graph schema bump (spec assumption, verified at `src/lib/docs-index.ts:131`).

## R12: Served-surfaces flag

- **Decision**: `openapi` is set from the option at config time, not detected from routes (the renderer's routes have site-specific patterns). It is internal; no carrier reads it unless true.

## R13: Test seam first

- **Decision**: WP01 adds failing tests and fixtures (two-version example, 200-op fixture, rejected-input matrix, default-off compare, two-build compare) marked `it.fails`/`todo` per later WP, which each WP flips green.
- **Rationale**: follows the page-chrome lesson that goldens captured after a behaviour change hide regressions.

## R14: Security model and adversarial dispositions (DIRECTIVE_051)

- **Trust model (maintainer decision, C-008)**: spec inputs are owner-trusted, like the site's Markdown. Integrity comes from the sha256 pin; FR-028 bounds make broken or hostile input fail closed.

| Finding | Disposition |
|---|---|
| X1 Renderer HTML not sanitised; private-IP SSRF | Accepted under the trust model: no sanitisation, intranet hosts allowed. Recorded in the new ADR |
| X2 Spec text injected into our outputs | Fixed: `llms.txt` lines, agent Markdown, OKF summary and switcher labels flatten to one line and escape Markdown link syntax; hostile-string fixtures (`<script>`, newline, `](javascript:...)`) in WP01, asserted in WP03/WP04/WP07/WP12 |
| X3 Dangerous link schemes | Fixed: `javascript:`, `data:`, `vbscript:` fail the link check (WP06); other schemes skipped |
| X4 `$ref` escape | Fixed: realpath of root and targets, regular files, symlink targets inside, absolute/`file://`/`http` refs rejected, parser resolvers deny-by-default (http off) (WP09) |
| X5 Archive glob escape | Fixed: relative only, no `..`, realpath under siteRoot, regular files, cap 200 (WP08) |
| X6 Resource exhaustion | Fixed: fetch timeout 30 s, 10 MB cap, YAML `maxAliasCount` 100, ref count/depth bound (WP02 limits module; WP09, WP10 apply) |
| X7 Credential leak via URL | Fixed: userinfo rejected, query redacted in messages, no auth headers (WP10) |
| X8 Cache poisoning | Fixed: hash verified before parse (parser-spy test), unique temp + rename, no symlink follow; shared atomic writer in WP02 |
| X9 Dev path traversal | Fixed: exact route allowlist after base-aware parsing, GET/HEAD only (WP04) |
| X10 Supply chain | `@readme/openapi-parser` pinned 4.1.2; lockfile transitive set unchanged; no lifecycle scripts; MIT |

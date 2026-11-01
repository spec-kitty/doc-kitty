# Research: OpenAPI reference pages

Grounding squad, 2026-10-28: codebase seams (architect), rendering options (researcher), scope (planner). Post-spec review by a reviewer, 2026-10-29.

## R1: Renderer

- **Decision**: `starlight-openapi@0.27.0`, pinned exactly and installed as an optional peer, following ADR-0049.
- **Rationale**: it renders inside the Starlight frame, reads the site's tokens, puts operation text in static HTML, and needs no new CSP allowance (to be confirmed in WP01). ADR-0049 Decision 1 prefers an existing integration.
- **Alternatives considered**:
  - **`@redocly/cli@2.71.2 build-docs`** (spiked). Rejected for four reasons:
    - The output is a standalone HTML page: 238 KiB, plus a runtime `cdn.redocly.com` bundle, or 2474 KiB inlined.
    - Paths, operationIds and schema descriptions exist only in inline JS state.
    - It needs inline `<script>` and `<style>` blocks, and dark mode uses its own `:root.dark`.
    - The UI bundle contains `otel.cloud.redocly.com`.
  - **Redoc React SSR.** Rejected: it would add React, react-router and styled-components to a site that has no React.
  - **Scalar, Stoplight Elements, RapiDoc.** Rejected: all render client-side.
  - **Own generator.** This is the fallback, through a new ADR, if WP01 fails C-006.

## R2: Injected routes

- **Decision** (operator, DM 01M631YA75R7DR57DS8MV0HGNV): injected routes are acceptable.
  - `llms.txt` lines are wired by DocKitty.
  - The frontmatter gate does not apply to the generated API pages.
  - The agent API, the content graph and the glossary autolinker are follow-ups, recorded in the ADR addendum.
- **Rationale**: the plugin ships `routes/static` and `routes/ssr`. Requiring content entries would force the own-generator fallback and a much larger mission.

## R3: Sätteri peer

- **Fact**: `starlight-openapi@0.27.0` declares the peer `@astrojs/markdown-satteri >= 0.3.2`. DocKitty runs `unified()` (ADR-0060) and does not install Sätteri.
- **Decision**: it becomes a second optional peer. WP01 checks three things:
  - the plugin works with the site processor left at `unified()`;
  - Sätteri's platform binaries install without lifecycle scripts;
  - the consumption test passes with both installed.
- **Known limit** (ADR-0049): Markdown in descriptions bypasses the glossary autolinker, the relative-link rewrite and the link checks.

## R4: Supply chain (DIRECTIVE_051) — adversarial challenge

| Finding | Disposition |
|---|---|
| Sätteri is young (first release May 2026) and ships native binaries | **Accepted with mitigation**: optional peer, so only opting-in sites carry it. Exact pin. WP01 inspects the per-platform packages for install hooks. |
| The local default npm registry is a corporate mirror that hung | **Mitigated**: CI and the lockfile resolve from registry.npmjs.org. WP01 verifies the lockfile `resolution` URLs. |
| The transitive `httpsnippet` produces code samples | **Open in WP01**: confirm that the samples are static text, not a request console (FR-009). If they are a console, disable them in the plugin config. |
| The plugin's own `styles` export | **Rejected**: not loaded. Theming comes from `--dk-*` (ADR-0049 §1). |

## R5: Raw-document contract

- **Decision**: `<base>/<section>/<label>/openapi.<ext>`, written byte for byte, with `openapi.<ext>.sha256` in `sha256sum` format (`<hex>  openapi.<ext>\n`).
- **Rationale**: the consumer, spec-kitty-charter, checks its bundle checksum. `sha256sum -c` works on the sidecar as published.

## R7: Spike results (WP01, 2026-10-29)

`starlight-openapi@0.27.0` was spiked against C-006.

| # | Criterion | Verdict |
|---|---|---|
| 1 | Builds on Astro 7.4 / Starlight 0.42.6 on `unified()` | Pass, with an adapter. The plugin's page props carry only `title`, so the DocKitty docs schema rejects them (`description: Required`). A description adapter is needed. Remark plugins still run on ordinary pages. |
| 2 | Multiple specs, own base and sidebar group | Pass, via `createOpenAPISidebarGroup()` placeholders |
| 3 | DocKitty frame | Pass |
| 4 | No plugin stylesheet, `--dk-*` styling | Pass, with an adapter: a follow-on Starlight plugin filters `starlight-openapi/styles` out of `customCss`. There is no config switch. |
| 5 | Static HTML content | Pass |
| 6 | No request console | Pass: snippets are `<pre>`, with no form and no fetch |
| 7 | Byte-identical rebuilds | Pass |
| 8 | NFR-002 | **Fail as originally worded.** It adds 1 inline script (`starlight-openapi-content-picker`) with snippets off, and 3 with snippets on, plus an overview style attribute (`--sl-icon-size`). **Waived narrowly** by the operator (DM plan.security.nfr002-waiver). |
| 9 | Surfaces | Sitemap and Pagefind yes; llms.txt, agent API, content graph and glossary autolinker no; frontmatter gate not applicable |
| 10 | Build time | +0.78 s (median 5.26 s against 4.48 s) |

**DIRECTIVE_051.**
- The pnpm 11 lockfile records integrity hashes only, with no tarball URLs. The hashes match `dist.integrity` on registry.npmjs.org.
- The install adds 30 packages, none with pre-, post- or install scripts (`prepare` only, in `momoa` and `openapi-types`).
- The Sätteri `@bruits/*` binaries and `@astrojs/markdown-satteri@0.4.4` were already in the tree through Starlight. Pin 0.4.4, not 0.4.6, which is less than 24 hours old.
- `event-stream` is 4.0.1, not the compromised 3.3.6.

**Hooks.** WP03 can use:
- the `sl-openapi-*` classes and `--sl-openapi-*` custom properties;
- the options `base`, `sidebar.{label,group,collapsed,operations,tags}` and `snippets.*`.

There are no slots or component overrides, so the version links and the badge need route middleware or a wrapper.

**Default section.** `api/` collides with the agent API (`/api/index.json`, `/api/pages/*`), so the default becomes `reference/api` (DM plan.routes.default-section).

## R6: Labels

- **Decision**: lower-case the label, then reject any character outside `[a-z0-9._-]`. Labels that collide after lower-casing are duplicates. Labels are never rewritten.

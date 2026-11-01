# Implementation Plan: OpenAPI reference pages

**Branch**: `feat/openapi-reference-pages` (PR to `main`) | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

## Summary

This adds an opt-in `openapi` option to `defineDocKittyIntegrations`. Each configured spec becomes a `starlight-openapi` entry under `/<section>/<label>/`, styled through the `--dk-*` tokens. DocKitty writes the rest around it:
- the raw document, copied byte for byte, and its `sha256sum` sidecar;
- the version links and the "unreleased" badge;
- one `llms.txt` line per version;
- the sidebar entry.

`starlight-openapi` and its `@astrojs/markdown-satteri` peer are **optional peers**: a site that does not set the option installs and loads neither. The first work package is a spike against the C-006 exit criteria. It records an ADR-0049 addendum that moves ADR-0049 to Accepted. If the spike fails, the work stops and comes back to the operator as a scope change for the own-generator fallback.

Operator decisions (see `decisions/`): starlight-openapi first; #244 is a slice of parent #140; the first-PR boundary; and injected routes are acceptable. For injected routes, the `llms.txt` list is wired, the frontmatter gate does not apply, and the agent API, the content graph and the glossary autolinker are follow-ups.

## Technical Context

**Language/Version**: TypeScript 5 (integration, routes) and JavaScript ESM with `// @ts-check` (scripts); Node ≥22.22
**Primary Dependencies**:
- Existing: Astro 7.4 and Starlight 0.42.6.
- New: `starlight-openapi@0.27.0` (MIT), as an exact-pinned **optional peer**.
- Its peer `@astrojs/markdown-satteri` (MIT, 0.4.x, prebuilt native binaries with a WASM fallback), also an optional peer.
- Dev dependencies for tests and the example site.
**Storage**: N/A (build-time generated output)
**Testing**:
- Vitest (`--project fast`) for configuration, validation and the raw-document contract.
- The build project and `assert-build-artifacts` for the rendered pages, the sitemap, `llms.txt` and determinism.
- Playwright a11y (axe) in light and dark mode.
- The consumption test (packed tarball), with and without the renderer.
**Target Platform**: static site build (Astro build hooks); consumers on GitHub Pages or similar
**Project Type**: single toolkit package (`src/`) plus the example site (`example/`)
**Performance Goals**: NFR-004, at most 10 s extra build time for the two-version fixture (median of 3)
**Constraints**:
- C-001 to C-006;
- no new content-security allowances (NFR-002);
- byte-stable rebuilds (NFR-001);
- complexity ≤15.
**Scale/Scope**: about 6 source files, 1 new integration module, 2 fixture specs, 4 test files, 1 how-to, an ADR addendum, `NOTICE` and the CHANGELOG

### Supply chain (DIRECTIVE_051)

| Control | starlight-openapi@0.27.0 | @astrojs/markdown-satteri | Action |
|---|---|---|---|
| (1) Registry authenticity | Resolved from registry.npmjs.org (the local default registry is a corporate mirror; CI uses npmjs) | Same | Confirm in WP01 that the lockfile `resolution` points at registry.npmjs.org |
| (2) Freshness | 0.27.0 published 2026-10-07; the package was first published 2023-08-24 | 0.4.6 latest; first shipped May 2026 (young) | Record in research.md; pin exactly |
| (3) Lifecycle scripts | No install or postinstall hooks (only lint and test scripts) | Prebuilt binaries per platform; check for install hooks in WP01 | Deny by default; `onlyBuiltDependencies` stays unchanged unless WP01 justifies an entry |
| (4) Lockfile-driven installs | `pnpm-lock.yaml`, frozen in CI | Same | Lockfile diff reviewed in WP01 |
| (5) Incident / IoC posture | Transitive deps `@readme/openapi-parser`, `httpsnippet`, `url-template`, `github-slugger` | Native binary packages | WP01 checks the transitive tree for install scripts and network calls at install; the adversarial challenge is in research.md |

## Charter Check

- **ADRs are immutable.** ADR-0049 is changed only by an addendum (C-002). The addendum moves it from Proposed to Accepted and records the spike. PASS.
- **Generated indexes doctrine.** The sidebar entry and the version links are generated, not hand-maintained. PASS.
- **Supply chain (DIRECTIVE_051).** All five controls are surfaced above, and WP01 runs the checks. PASS, pending WP01 evidence.
- **Tests first.** NFR-005 requires tests that fail when their behaviour is removed. PASS.
- **Living documentation.** The how-to, `NOTICE` and the CHANGELOG ship in the same PR (FR-011). PASS.
- **Writing policy.** Docs go through Vale and markdownlint. PASS.

## Project Structure

### Documentation (this mission)

```text
kitty-specs/openapi-reference-pages-01M60GZ5/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/openapi-option.md     # option shape and published-artifact contract
├── decisions/
└── tasks/
```

### Source Code (repository root)

```text
src/lib/config.ts                           # DocKittyOptions.openapi + eager validation
src/lib/openapi/options.mjs                 # normalise/validate specs (pure, testable)
src/lib/integrations/openapi.ts             # optional-peer load, plugin wiring, raw-doc emit, llms lines
src/lib/routes/llms-txt.ts                  # one line per API version
src/styles/dk-components.css                # token mapping for plugin markup
src/tests/openapi-options.test.ts           # validation + fail-closed messages
src/tests/openapi-raw-document.test.ts      # byte-identity + sha256sum sidecar
src/scripts/assert-build-artifacts.mjs      # rendered pages, sitemap, llms, CSP set, determinism
example/astro.config.mjs + example/openapi/{v1.yaml,main.yaml}
tests/consumption/                          # arm without the renderer, arm with it
docs/guides/openapi-reference.md, docs/adr/0049-*.md (addendum), NOTICE, CHANGELOG.md
```

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| Two optional peers (plugin + Sätteri) | The plugin requires Sätteri | A hard dependency charges every site, which violates FR-010 |
| Token CSS for third-party markup | ADR-0049 §1 forbids the plugin's own stylesheet | Using the plugin's `styles` breaks branding overrides |

## Implementation Concern Map

### IC-01: Spike and ADR addendum
- **Files**: `docs/adr/0049-*.md` (addendum), `kitty-specs/.../research.md` (spike results), `example/openapi/*.yaml` (fixtures)
- **Requirements**: C-001, C-006, FR-013, NFR-001, NFR-002 (measurement method), DIRECTIVE_051 evidence
- **Exit**: every C-006 criterion has a verdict. If any one fails, stop and escalate.

### IC-02: Option and validation
- **Files**: `src/lib/config.ts`, `src/lib/openapi/options.mjs`, `src/tests/openapi-options.test.ts`
- **Requirements**: FR-001, FR-007, the label rules from the edge cases, FR-010 (no import when the option is unset)

### IC-03: Rendering and chrome
- **Files**: `src/lib/integrations/openapi.ts`, `src/styles/dk-components.css`, sidebar wiring in `config.ts`
- **Requirements**: FR-002, FR-003, FR-004, FR-005, FR-008 (nav, sitemap, search), FR-009, NFR-002, NFR-003, the route collisions from the edge cases (ADR-0050)

### IC-04: Raw document, checksum, llms.txt and generated-page rules
- **Files**: `src/lib/integrations/openapi.ts` (emit), `src/lib/routes/llms-txt.ts`, `src/tests/openapi-raw-document.test.ts`
- **Requirements**: FR-006, FR-008 (llms.txt), FR-012, NFR-001

### IC-05: Consumption test
- **Files**: `tests/consumption/**`
- **Requirements**: FR-010, SC-004, the missing-peer error in FR-007

### IC-06: Docs and example
- **Files**: `docs/guides/openapi-reference.md`, `NOTICE`, `CHANGELOG.md`, `example/` pages, example-pin and baseline updates
- **Requirements**: FR-011, NFR-004 measurement report

**Order**: IC-01 first. Then IC-02. Then IC-03 and IC-04, which can run in parallel but both touch `integrations/openapi.ts`, so they go in one WP or in sequence. Then IC-05 and IC-06.

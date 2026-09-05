# Implementation Plan: Internal link integrity

**Branch**: `fix/link-integrity` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Input**: `kitty-specs/link-integrity-01M1PSEH/spec.md`

## Summary

Make every internal link resolve under the `/doc-kitty` base and make the link gate fail-closed. Base-prefix the glossary URL builder (shared by autolink/`:term`/preview) and fix its anchor generation (#63); introduce one `withBase()` helper for component links and re-author content links as `.md`-relative (#61); add a base-aware built-output link gate + tighten the source gate (#62). Approach is grounded by the prior architect link-integrity investigation (root causes + P1–P5); this plan does not re-open those decisions. All three issues re-verified on current main (7921389): 21 base-less glossary links, base-less section links, relative-as-child 404, literal `{#…}` anchors, and `check-links.mjs` reporting "✓ 863 resolve" while broken.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 24 (Astro 5.18.2); ESM
**Primary Dependencies**: Astro 5.18.2, `@astrojs/starlight` 0.32.6, remark/rehype (unified), vitest, Playwright (a11y lane), Node build-artifact asserts
**Storage**: N/A (static site)
**Testing**: vitest unit; Node build-artifact asserts (`src/scripts/assert-*.mjs`, `pnpm assert:artifacts`); source link check (`src/scripts/check-links.mjs`, `pnpm validate:links`); CI (`.github/workflows/ci.yml`)
**Target Platform**: static HTML served under base `/doc-kitty` (trailing-slash directory URLs)
**Project Type**: single (toolkit `src/` + example consumer `example/`)
**Performance Goals**: no build/runtime regression
**Constraints**: thread base via `normalizeBasePrefix` (config.ts) into glossary remark plugins; one `withBase()` for components; `.md`-relative authoring; block-form glossary anchors; base-aware dist link gate + fail-closed source gate; keep external/anchor/directory-index-relative links untouched
**Scale/Scope**: ~30 base-less links + anchor desync + gate; toolkit + example content

## Charter Check
Charter present (software-dev-default). Honored: DIRECTIVE_024 (fix base-prefixing at shared seams, not per-call-site), DIRECTIVE_043/040 (close the class: a fail-closed gate makes recurrence impossible), DIRECTIVE_001 (one `withBase`/one glossary-URL builder — no cloned base logic), DIRECTIVE_041 (gate mutation-true: RED on today's dist). No new runtime dependency → supply-chain N/A.

## Project Structure

```
src/
├── lib/
│   ├── config.ts                        # thread `base` into the glossary plugins (#61)
│   ├── with-base.ts (NEW)               # single component base helper (#61, NFR-002)
│   ├── metadata.ts                      # routeFor via withBase (#61)
│   ├── glossary/{resolve,generate,...}  # generate.ts block-form anchors (#63); shared base-aware term-URL builder
│   └── remark/{glossary-autolink.internal,glossary-term}.ts  # base-prefixed term hrefs (#61)
├── components/slots/{Related,OnThisPage,Audience}.astro       # withBase + shared glossary-URL builder (#61)
└── scripts/
    ├── check-links.mjs                  # tighten: fail root-absolute + extensionless-relative internal doc links (#62)
    └── assert-no-broken-links.mjs (NEW) # base-aware dist walk, URL-resolved (#62)

example/docs/**                          # re-author root-absolute + bare-relative-on-leaf links to ./target.md (#61)
.github/workflows/ci.yml                 # wire assert:no-broken-links (#62)
docs/{adr,changelog}/                    # ADR/convention note + dated changelog fragment
```

**Structure Decision**: fix in the toolkit + example content; the base-aware dist gate is the durable guarantee. Exact new-file names finalized in tasks; invariants are *one* component base helper, *one* glossary-URL builder, and a *base-aware URL-resolved* dist gate.

## Complexity Tracking
No Charter violations. N/A.

## Implementation Concern Map

### IC-01 — Glossary links resolve (#61 glossary + #63)
- **Purpose**: base-prefix the glossary term URL (autolink/`:term`/preview share one builder) and emit resolvable anchors.
- **Requirements**: FR-001, FR-002, NFR-001/002, C-001, C-004
- **Surfaces**: `src/lib/config.ts` (thread `base` via `normalizeBasePrefix`), `src/lib/remark/glossary-autolink.internal.ts` (~:160), `src/lib/remark/glossary-term.ts` (~:108), `src/lib/glossary/generate.ts` (~:93 block-form anchor), `src/lib/glossary/resolve.ts`/preview client (shared builder)
- **Depends-on**: none
- **Risks**: keep the autolink/`:term`/preview twins byte-identical in URL shape; block-form anchor must not change the visible heading text; `no-autolink`/collision behavior unchanged.

### IC-02 — Component & authored links resolve (#61)
- **Purpose**: one `withBase()` for component hrefs; re-author content links.
- **Requirements**: FR-003, FR-004, NFR-001/002, C-002, C-003
- **Surfaces**: `src/lib/with-base.ts` (NEW), `src/lib/metadata.ts` (`routeFor` ~:288), `src/components/slots/{Related.astro:65, OnThisPage.astro:253/299, Audience.astro:74}`, authored `example/docs/**` (superseded-note.md:19, blocks-demonstrator.md:29/32/34, mission-alpha.md:22, mission-beta.md:14, changelog/README.md:12, adr/README.md:17, guides/README.md:14, architecture/README.md:16)
- **Depends-on**: IC-01 (OnThisPage's glossary list reuses IC-01's shared glossary-URL builder)
- **Risks**: don't double-prefix (Astro components vs raw links); directory-index relative links already correct must stay; keep external/anchor links untouched.

### IC-03 — Fail-closed link gate (#62)
- **Purpose**: a base-aware dist link gate + tightened source gate so link 404s can't ship green.
- **Requirements**: FR-005, NFR-003, C-005, C-006
- **Surfaces**: `src/scripts/assert-no-broken-links.mjs` (NEW; base-aware URL-resolved dist walk), `src/scripts/check-links.mjs` (fail root-absolute + extensionless-relative internal doc links), `package.json` (script), `.github/workflows/ci.yml` (wire it), `docs/adr` + `docs/changelog`
- **Depends-on**: IC-01, IC-02 (the gate goes green only once the links are fixed; prove RED on pre-fix dist)
- **Risks**: false positives on external/mailto/anchor/directory-index links; must model trailing-slash URL semantics, not the filesystem.

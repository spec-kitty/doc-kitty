# Implementation Plan: Astro 7 and Starlight 0.41 migration

**Branch**: `claude/ecstatic-mccarthy-pm655w` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/astro7-starlight-migration-01M57Y2C/spec.md`

## Summary

Move `@spec-kitty/doc-toolkit` and the example site from Astro 5 / Starlight
0.32 to Astro 7 / Starlight 0.41+, keeping every remark/rehype plugin on
`markdown.processor: unified()` from `@astrojs/markdown-remark`. A spike runs
first and ends at an operator go/no-go gate (C-002). On GO, the same branch line
carries the ADR, the core bump with override and markup fixes, the gate
rebaseline, the #183 and #210 removals, and 0.4.0 release prep. No tag, publish
or merge (C-003).

## Engineering Alignment (confirmed by operator brief)

- `unified()` now, Sätteri deferred with a reopen trigger (#143 direction).
- #119, #144 and #145 share one line because the build only goes green when all
  three land; each stays a separate reviewable commit.
- Red-first for behaviour fixes; rebaselines carry a reason each; determinism is
  fixed at the cause.
- Two-lens opus review before each PR; folds as their own commits; changelog last.

## Technical Context

**Language/Version**: TypeScript 5.x and ESM JavaScript on Node 22+ (pnpm 11 workspace)
**Primary Dependencies**: astro 5 → 7.x, @astrojs/starlight 0.32 → 0.41+, new @astrojs/markdown-remark, @astrojs/sitemap, @beoe/rehype-mermaid, astro-plantuml, zod (content schema), Pagefind (via Starlight)
**Storage**: Files (`docs/` trees, built `dist/`)
**Testing**: Vitest (`src/tests`), artifact gates (`pnpm assert:artifacts`, `src/scripts/assert-chrome-artifacts.mjs`), Playwright a11y and visual suites, packed-tarball consumption test (`tests/consumption/consumer-fixture`)
**Target Platform**: Static site build (GitHub Pages); adopters on Node 22+
**Project Type**: single (toolkit package `src/` plus `example/` site)
**Performance Goals**: Example build time within +25% of `main` (NFR-003)
**Constraints**: Byte-identical two-build output (NFR-001); zero new WCAG 2.2 AA violations (NFR-002); `ci-ok` green (NFR-004)
**Scale/Scope**: ~9 Markdown plugins, 5 Starlight component carriers, route middleware, 4 build hooks, the scenarios API, the generator-stamp module

### Supply-chain (DIRECTIVE_051, advisory)

- New and upgraded packages: astro, @astrojs/starlight, @astrojs/markdown-remark, plus their transitive tree.
- Controls: install with `pnpm install` against the committed lockfile only (no `--no-frozen-lockfile` in CI); the workspace's minimum-release-age policy applies (no new exclusions added unless a pinned version is younger than the window, recorded in research.md); `allowBuilds` stays limited to `esbuild` and `sharp`; packages come only from the public registry through the proxy.
- The spike records each resolved version and its publish date in the research note. An adversarial pass over the dependency change is folded into the pre-PR two-lens review (research.md R-6).

## Charter Check

- **Structure / three axes:** no change to the content, IA or presentation separation; overrides stay in the theme/chrome layer. PASS.
- **Living documentation:** behaviour changes update docs in the same change (migration guide, gherkin-pages architecture page, ADR). PASS.
- **ADR immutability:** the processor choice is a new ADR, not an edit of an accepted one. PASS.
- **Quality gates:** no gate loosened (C-004); `ci-ok` is the only required check. PASS.
- **Writing policy:** the research note, ADR and guide follow the documentation policy (sentence-case headings, no AI tells). PASS.

Re-checked after design: no new gaps.

## Project Structure

### Documentation (this mission)

```
kitty-specs/astro7-starlight-migration-01M57Y2C/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/scenarios-api-v-next.md
└── tasks/            (from /spec-kitty.tasks)
```

### Source Code (repository root)

```
src/package.json, example/package.json, pnpm-lock.yaml   # versions and peer ranges
src/lib/config.ts, src/lib/integrations/markdown-pipeline.ts  # processor + plugin wiring
src/components/*.astro, src/lib/route-middleware.ts        # Starlight carriers, locals.starlightRoute
src/lib/schema.ts, docs loader                             # content loader / zod
src/lib/sitemap-order.ts, favicon.ts, manifest.ts          # build hooks (#188 rewrite)
src/lib/routes/scenario-index.ts                           # #183
src/lib/generator-stamp.mjs, src/scripts/validate-frontmatter.mjs  # #210
src/scripts/assert-*.mjs, tests/, src/tests/               # gates and baselines
docs/ (research note, ADR, migrations guide), CHANGELOG.md
```

**Structure Decision**: existing single-package layout; no new modules.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| Second Markdown processor (`unified()` beside default Sätteri) | Keeps all plugins unchanged | A Sätteri port is a separate decision (#148), out of scope by operator ruling |

## Implementation Concern Map

### IC-01 — Spike and go/no-go (#142)

Bump versions on the branch, run every gate, prove each plugin, audit the
changelogs, write the research note and the #142 comment. Ends with a stop and
an operator report. FR-001…FR-007.

### IC-02 — Processor ADR (#143)

Accepted ADR under `docs/adr/`, regenerate the ADR index. FR-008.

### IC-03 — Core bump, overrides, markup (#119, #144, #145)

One line, three commits: dependency/processor wiring; Starlight carriers,
config, middleware, head and CSS; compiler-strictness markup. Includes the #188
canonical re-check. Red-first from the spike's failing build. FR-009, FR-010.

### IC-04 — Gate rebaseline (#146)

A11y, visual, determinism, example pins, remark-stack enumerator, consumption
test; one reason per file. FR-011.

### IC-05 — Deprecated-surface removals (#183, #210)

Red-first tests, then removal; scenarios API version bump; regenerate failure
for legacy stamps. FR-012, FR-013.

### IC-06 — 0.4.0 release prep (#147)

Peer ranges and compatibility-matrix test, version, changelog, migration guide
in `docs/migrations/`. No tag or publish. FR-014.

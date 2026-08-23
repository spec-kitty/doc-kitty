# Research: Component system + swappable theme

Phase-0 output. Resolves the one open technical mechanism (the manifest transport,
spec C-006), the supply-chain posture for the two new dev dependencies
(DIRECTIVE_051), and records the adversarial-evidence disposition from the post-spec
squad.

## Decision 1 — Merged virtual manifest transport (C-006, seams F1/F2)

**Decision**: Deliver the merged manifest as an **Astro integration that generates a
virtual module at `astro:config:setup`**. The generated module statically imports each
registered `kind → layout` `.astro` path and each `dk:slot → component` path from the
merged theme, and exports a **synchronous** `resolveLayout(kind): LayoutComponent`
(map lookup with a `Default` fallback) plus a per-slot component map. The carriers
import from `virtual:doc-kitty/manifest` and call `resolveLayout` exactly as they call
today's static module — same synchronous signature, so the `MarkdownContent` body is
byte-unchanged (ADR-0015 decision 1).

**Rationale**:

- Astro/Vite cannot turn an arbitrary runtime string path into a rendered component
  via a dynamic `import(path)` synchronously. Codegen resolves each theme-provided
  path to a real static `import` at config time, so resolution at render is a plain
  synchronous map lookup — matching the M1 `resolveLayout` contract and keeping the
  carrier untouched.
- An integration-generated `virtual:` module is the same mechanism Starlight itself
  uses (`virtual:starlight/*`), so it is proven on the pinned Astro 5.18.2 /
  Starlight 0.32.6 toolchain.

**Alternatives considered**:

- **Eager `import.meta.glob('/src/themes/**/*.astro', { eager: true })`** — works for
  in-tree layouts but cannot cleanly import a consumer theme's out-of-tree `.astro`
  path, and it couples resolution to a directory convention. Rejected as the primary
  mechanism; may back the in-repo brand as an implementation detail.
- **Runtime dynamic `import(path)`** — asynchronous, would force the carrier body to
  `await` and change the `resolveLayout` signature, breaking ADR-0013 seam 1 and
  ADR-0015 decision 1. Rejected.

**Verification gate**: the first IC-03 work package is a **build spike** that proves
the generated virtual module resolves a brand-registered layout synchronously on the
pinned toolchain, before the carrier swap lands. If the spike fails, it surfaces a new
ADR rather than a silent mechanism change (C-009).

## Decision 2 — Supply-chain posture for the new dev dependencies (DIRECTIVE_051)

Two **dev-only** dependencies are added for the accessibility lane (NFR-005): they are
never shipped in the toolkit's runtime surface.

| Package | Role | Registry authenticity | Lifecycle scripts | Notes |
|---|---|---|---|---|
| `@playwright/test` | test runner + browser driver | official npm (`microsoft`), integrity-hashed | browser binaries are **not** silently postinstalled; they are fetched by an explicit `playwright install` step | pin to a single minor; CI runs `playwright install --with-deps chromium` as an explicit, allowlisted step (deny-by-default satisfied) |
| `@axe-core/playwright` | axe-core bridge for Playwright | official npm (`dequelabs`), integrity-hashed | no `preinstall`/`install`/`postinstall` | wraps `axe-core`; run with the `wcag22aa` tag |

Threat-class controls applied: (1) **registry authenticity** — both from the official
npm registry with integrity hashes; (2) **freshness** — pin an established minor, not a
same-day release; surface first/last-publish at add time; (3) **lifecycle-script
discipline** — no auto-approved install scripts; the only download (Playwright
browsers) is an explicit, allowlisted CI step limited to Chromium; (4) **Node Active
LTS** — the build Node is checked against current Active LTS and any skew disclosed;
(5) **incident posture** — check the add against active-incident/IoC feeds at
implementation time. `pnpm-lock.yaml` changes are reviewed; the `sharp`/`@img/*` hoist
is unaffected.

## Decision 3 — Backward-compatibility verification (H7)

The example site carries the brand theme (deployed live, FR-014), so `example/dist` is
the branded build. Backward-compatibility (NFR-002) is verified two ways rather than by
a second full site build:

- a **merge-resolver unit test** on the no-theme path — asserts `customCss` is the
  single static `theme.css` entry, the Default catalog values, and static Hub+Default
  layout resolution (byte-compatible with M1);
- the **M1 structural chrome/build assertions** run on the branded example — they bind
  to theme-agnostic markers (token *names*, the bridge assignments, carrier markers,
  band/hero structure, share-image derivation, agent-index count), so they stay green
  under any theme.

## Adversarial evidence (post-spec squad) — dispositions

Per `contracts/adversarial-evidence-contract.md`, every contested finding's
disposition is recorded. All findings were folded into the spec / ADR-0015; none
dropped silently.

| Finding | Lens | Disposition |
|---|---|---|
| Pass-through slot surface + brand header vs. seam 3 | fidelity F1 / seams F4 | **changed** — ADR-0015 + FR-018/FR-009 |
| Manifest transport unbounded; carrier byte-stability | seams F1/F2 | **changed** — Decision 1 above; C-006 + C-001 |
| No-theme CSS byte-compat unstated | seams F3 | **changed** — FR-003, NFR-002, Decision 3 |
| Cascade-order assertion missing | seams F5 | **changed** — FR-017 |
| `ci-ok` membership contradiction | scope #1 | **changed** — FR-016/NFR-003/SC-005 aligned |
| Persona field drift / M3-block atoms | scope #3/#4 | **changed** — FR-013 generic fields; C-010/FR-012 guard |
| Presentation route guard; diagram=M5 | scope #5/#6 | **changed** — C-010 |
| a11y testability (pages, target-size, focus, both-modes, Persona marker) | testability H1–H6 | **changed** — NFR-001, FR-013/FR-017 |
| Backward-compat artifact | testability H7 | **changed** — Decision 3 |
| Astro pin 5.2 → 5.18.2 | fidelity F3 | **changed** — C-006 |

No finding is `deferred_with_rationale`; the pass-through override *surface* is
sequenced past M2 by ADR-0015 decision 4 (a scope decision, recorded), not a deferred
contested finding.

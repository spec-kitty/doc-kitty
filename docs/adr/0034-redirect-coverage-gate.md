---
title: "ADR-0034: Redirect-coverage primitive — committed baseline, native redirects, target-aware bare-Node gate"
description: A committed URL baseline, Astro's native redirects for emission, and a bare-Node target-aware CI gate give migrating adopters the redirect-parity doc-kitty lacked.
doc_status: active
updated: 2026-09-03
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0033-flexible-section-identity
  - adr/0029-sidebar-autogenerate-content-root-coupling
  - adr/0032-adr-index-generation
  - context/convention
---

# ADR-0034: Redirect-coverage primitive — committed baseline, native redirects, target-aware bare-Node gate

## Status

**Accepted** — 2026-09-03. Greenfield. Introduced by the adopter-loader-migration
mission (issue #42; spec C-007, US3). No prior ADR governs redirects or URL
continuity; this is a net-new toolkit primitive.

## Context

doc-kitty renders clean Starlight URLs (`…/foo/`). An adopter migrating from a
URL-preserving host — the proving-ground study names DocFX's `…/foo.html`
scheme — changes every URL on cutover, and doc-kitty ships **no** mechanism to
declare or verify that the old URLs still resolve
(see [`spec-kitty-adoption-proof.md`](../architecture/research/spec-kitty-adoption-proof.md),
the "NFR-002 redirect parity" gap). The research names this the single highest
technical risk of a real migration: a silent ~1,589-link 404 regression,
discovered by users rather than by CI. [ADR-0033](./0033-flexible-section-identity.md)'s
section rename (US2) compounds the same problem — a renamed section orphans its
old child URLs — so both need one covering mechanism, sequenced last so its
baseline is captured against the route scheme US1/US2 have already settled.

A post-spec adversarial review (paula/annie squad) also found that a
coverage check which only inspects the *source* redirect map is insufficient: a
redirect can point at a target that itself 404s or redirects again, and such a
redirect must **not** read as "covered" — a redirect to a dead page is a live
404 by another name (finding B1, folded into the design below).

## Decision

### 1. Redirect-map source of truth: Astro's native `redirects`

The redirect map is declared as Astro's built-in `redirects` config
(`example/astro.config.mjs`), optionally also emitted as a host `_redirects`
file. No new runtime dependency is added — this reuses first-class Astro
capability rather than a bespoke middleware or a third-party redirect package
(DIRECTIVE_051; no dependency decision was open at plan time).

### 2. A committed, pre-change URL baseline

The set of URLs that must keep resolving is captured as a **version-controlled
artifact** (for example `example/url-baseline.txt`), written **before** the
change that would otherwise break them. The gate never regenerates the baseline
from the current build — a self-referential baseline can never fail against real
drift, which would defeat the point of having a gate at all.

### 3. A bare-Node, target-aware coverage gate

`src/scripts/check-redirect-coverage.mjs` — patterned off the existing sanity
gates (`check-links.mjs`, `assert-build-artifacts.mjs`) — takes the committed
baseline, the redirect map, and the built `dist/` and computes, per baselined
URL:

- **`covered`** — a live page exists at the URL, **or** a redirect exists whose
  target chain terminates at a live page (a chain is followed to its live
  terminus, not accepted on the first hop);
- **`uncovered`** (fails the gate) — neither a live page nor a redirect exists,
  **or** a redirect exists but its target is dead or itself loops/dead-ends.

The gate exits non-zero and names every uncovered URL — and, for a dead
redirect, the failing target — iff at least one baselined URL is `uncovered`.
It runs in bare Node with **no** Astro build context (it reads the already-built
`dist/`, it does not invoke Astro itself), performs no network access, and is
deterministic across repeat runs, adding no more than a few seconds to the
existing `doc-sanity` CI job. It is wired into CI alongside the other bare-Node
sanity gates as an explicit step, the same operational shape as the
[ADR-0032](./0032-adr-index-generation.md) lockfile-style `--check`.

### 4. Rename churn is covered by the same machinery

A section-folder rename under [ADR-0033](./0033-flexible-section-identity.md)
produces exactly the URL churn this gate is built for: the renamed section's old
child URLs are baselined and covered by redirect entries like any other URL
change, rather than needing a second mechanism.

## Consequences

### Positive

- A migrating adopter gets a concrete, CI-enforced answer to "did this change
  break any of my old URLs" before shipping, closing the research's
  highest-named migration risk.
- Target-awareness closes the redirect-to-dead-target failure mode by
  construction — a redirect can no longer *look* covered while pointing nowhere.
- No new dependency; the gate follows the established bare-Node sanity-gate
  shape (deterministic, CI-wired, no Astro build spawn), so it composes cleanly
  with `check-links.mjs` and `generate-adr-index.mjs --check`.

### Negative

- The URL baseline and the redirect map are adopter-authored and
  adopter-maintained artifacts; this mission does not ship a baseline-capture
  tool, so keeping the baseline current across further changes is a manual
  discipline the gate can only enforce, not automate.
- A second committed artifact (the baseline) needs a place in the adopter's
  history and review discipline, distinct from the docs tree itself.

### Risks

- A baseline captured too late (after the URL-breaking change has already
  landed) silently loses its ability to catch that specific regression — the
  gate is only as good as when the baseline was taken (mitigated by NFR-005:
  the baseline must be committed *before* the change, as a matter of process,
  not something the gate itself can verify).
- A redirect chain that is very long or cyclic must terminate deterministically;
  the gate's chain-following is bounded and reports a cycle as `uncovered`
  rather than looping.

## Alternatives considered

### Option A: A Playwright crawl of the built, served site

Rejected. Requires a served build (heavier setup, slower), and browser-driven
crawling is comparatively non-deterministic against the bare-Node,
few-seconds-added budget (NFR-002).

### Option B: Source-only coverage (check the redirect map's keys against the baseline, without resolving targets)

Rejected. This is exactly the B1 defect the adversarial review surfaced: a
redirect to a dead or looping target would read as "covered" when the resulting
user experience is still a 404.

### Option C: Custom redirect middleware or a third-party redirect package

Rejected. Astro's native `redirects` already produces the static redirect a
migrating adopter needs; a bespoke or third-party mechanism adds dependency and
maintenance surface for no additional capability.

## References

- [ADR-0033](./0033-flexible-section-identity.md) — the section-rename source of
  the URL churn this gate also covers.
- [ADR-0029](./0029-sidebar-autogenerate-content-root-coupling.md) — the
  route/content-root coupling a rename's URLs move through.
- [ADR-0032](./0032-adr-index-generation.md) — the bare-Node lockfile-style
  `--check` gate shape this pattern follows.
- Spec C-007, FR-008–FR-011, NFR-002, NFR-005, US3; research D-04, D-05, D-07,
  D-08; data-model E-03, E-04, E-07; `contracts/redirect-coverage-gate.md`.
- [`spec-kitty-adoption-proof.md`](../architecture/research/spec-kitty-adoption-proof.md)
  — the NFR-002 redirect-parity gap this ADR closes.

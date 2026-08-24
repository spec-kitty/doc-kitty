# Research — M3 (audience / related / external references)

Phase 0. Decisions consolidated from the pre-spec squad, the spec (rev 2), the
post-spec squad, and this plan. Format: Decision / Rationale / Alternatives.

## D1 — Content blocks render carrier-body, token-styled (ADR-0017)

- **Decision**: The three `dk:` content blocks render in the `MarkdownContent`
  carrier body from resolved data; theming is by `--dk-*` tokens/CSS; the no-props
  component-override passthrough is retired for exactly these three slots.
- **Rationale**: The slot-props path is ADR-0015-incompatible (prop-less slot
  factories, synchronous `resolveLayout`); carrier-body avoids a transport change and
  the double-render.
- **Alternatives**: props through `slotComponents` (rejected — seam change);
  passthrough + data render side by side (rejected — double render).

## D2 — Citation catalog: CSL-JSON-lite data collections, fail-fast (ADR-0018)

- **Decision**: `bibliography` + `tools` content-layer collections (`file()` loader),
  one YAML per catalog under `docs/_meta/` (mirrored in `example/`); CSL-JSON-lite
  record shape; catalog `type` discriminator (`biblio|tool`); unresolvable id /
  unknown catalog `type` = build-fail, parity-duplicated in a build-free validator;
  toolkit exports schema+loader; `/api/bibliography.json` outside `doc_status` gating.
- **Rationale**: Single-source a citation; agent-dereferenceable stable id; matches
  ADR-0009's named collections and `related`'s fail-fast posture; no new dependency.
- **Alternatives**: BibTeX / full CSL (rejected — parser/citeproc weight, NFR-006);
  one merged collection (rejected — differing shapes).

## D3 — Persona attribute fields; requiredness in the validator (ADR-0019)

- **Decision**: `role` (string), `goals` (string[]), `responsibilities` (string[])
  on `kind: Persona`; zod stays lenient (optional), the standalone validator enforces
  requiredness for Persona.
- **Rationale**: `kind` is open `z.string()` — no clean zod discriminated union;
  parity discipline keeps strict contextual rules in the validator (M1 pattern).
- **Alternatives**: zod discriminated union on `kind` (rejected — fights the open
  vocabulary); defer fields (rejected — in scope per product owner).

## D4 — Personas at `context/audience/`; Audiences hub (ADR-0020)

- **Decision**: personas at `context/audience/<profile>.md` (`type: Context`);
  relocate + promote the example persona to `active`; add an Audiences hub;
  rewrite all four hard-coded sites atomically; accept the agent-surface reorder;
  recompute the count pins.
- **Rationale**: honor the design of record; give `audience.profile` a single
  resolution target; a Hub needs published children.
- **Alternatives**: keep `personas/` and edit the design doc (rejected by product owner).

## D5 — Resolution is pure; gates parity-duplicate

- **Decision**: `resolveRelated` / `resolveProfile` / `resolveCitation` are pure
  Astro-free functions in `metadata.ts`, consumed by the build + API routes;
  `check-links.mjs` and `validate-catalog.mjs` re-implement (parity, NFR-004).
- **Rationale**: the build-free gates are zero-import `.mjs` by design (a TS import
  needs transpilation, at odds with NFR-006); parity tests keep them in agreement.
- **Alternatives**: import the resolver into the gate (rejected — transpile burden).

## D6 — `toAgentRecord` stays pure; resolve in the route (ADR/DIRECTIVE_018)

- **Decision**: keep `toAgentRecord(entry)` single-entry/pure; add
  `resolveRelated(refs, index)` composed in the routes (which already call
  `getCollection('docs')`); bump the agent-API `version`.
- **Rationale**: resolving `related` needs the whole corpus; the record shape change
  is a published-contract change → version bump.
- **Alternatives**: make `toAgentRecord` corpus-aware (rejected — breaks purity,
  ripples to callers).

## Supply-chain install safety (DIRECTIVE_051)

- **No dependency is added, upgraded, or removed** (NFR-006). CSL-JSON-lite is a
  hand-rolled subset; the catalog uses Astro's existing content-layer `file()`
  loader; the a11y lane uses the already-shipped Playwright/axe. Therefore there is
  **no registry-authenticity, package-freshness, or lifecycle-script surface** to
  examine this mission. This is an explicit finding, not an unexamined default. If
  plan/tasks later introduces a dependency, an install-safety pass is required before
  that WP is claimed.

## Adversarial evidence (post-spec squad)

A four-lens post-spec adversarial squad challenged spec rev 1; all contested
findings are dispositioned in `reviews/post-spec-squad.md` and folded into rev 2
(none silently dropped). Dispositions: **changed** — persona-relocation blast radius
(C1), the count-pin ownership (C2), the agent-record seam (C4), the content-block
rendering seam (A1), the parity-duplication of gates (A2/R4), FR-020 fixture lanes
(R3), the terminology cluster (L1–L5); **accepted (decision taken)** — persona
promoted to `active` with a retained draft (C3); **deferred_with_rationale** — the
rendered site-wide bibliography page, `related` backlinks, full CSL, JSON-LD (C-005,
named future extensions). No security-impacting dependency decision was made, so the
adversarial pass covered design/scope, not supply-chain.

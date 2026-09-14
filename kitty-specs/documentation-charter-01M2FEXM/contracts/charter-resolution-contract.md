# Contract — Charter file & resolution

This is a *data + function* contract (no HTTP API). It binds the authoring
surface (`_meta/charter.yaml`) to the resolver behavior the toolkit guarantees.

## C1 — File location & discovery
- Authoritative file: `<docsRoot>/_meta/charter.yaml`.
- Legacy (honored, deprecated): `<docsRoot>/_meta/vocabulary.yaml`,
  `<docsRoot>/_meta/sections.yaml`.
- Absent charter file ⇒ legacy/default resolution (no error). Empty charter file
  ⇒ identity/defaults (no error).

## C2 — Resolution precedence (per-axis, deterministic)
- Axis declared in `charter.yaml` ⇒ that axis resolves solely from the charter.
- Axis omitted ⇒ resolve from the corresponding legacy file if present, else the
  shipped canonical default.
- MUST NOT partial-merge the same axis across charter + legacy.
- When any legacy file is present, emit exactly one deprecation notice
  referencing the migration guide (idempotent per build).

## C3 — Vocabulary axes (types, kinds)
- Same semantics as today's `parseVocabularyAxis` / `makeAxisResolver`
  (alias, forbidden, passthrough). A forbidden authored `type` is a hard failure
  in the gate; an unknown-but-not-forbidden value warns.

## C4 — Statuses axis (extend-only)
- `resolveStatus` legal set = canonical `STATUSES` ∪ `statuses.add`.
- Adding a status ⇒ pages using it validate as legal.
- Attempting to remove / forbid / alias-away a canonical status ⇒ **fail closed**
  with a message naming the reserved status.
- Unknown-and-not-added status on a page ⇒ warn (parity with kinds), not fail.

## C5 — Required-field policy
- `required_fields.optional` removes listed fields from the required set for this
  consumer, EXCEPT `title`, which is a floor and always required.
- Listing `title` in `optional` ⇒ **fail closed** with a floor message.
- With no policy, the canonical required set applies unchanged.

## C6 — Failure posture
- Malformed charter (bad YAML, unknown `version` shape, invalid axis) ⇒ **fail
  closed** with a message naming the file and the offending key. Never silently
  ignored, never partially applied.
- Unknown *top-level* key ⇒ warn (forward-compat), not fail.

## C7 — Portability & purity invariants
- Resolution imports nothing from Spec Kitty / DoctrineService (NFR-001).
- Pure core (`vocabulary-core.mjs`) stays fs-free & Astro-free; fs access only in
  `vocabulary-loader.mjs` (NFR-004).
- Enforcement runs in bare-Node gates without an Astro build (NFR-003).
- Astro-side and bare-Node resolutions stay in parity (parity guard).

## C8 — OKF conformance
- Every non-orphan page still resolves to a non-empty `type`. A stricter consumer
  policy may add requirements but the emitted record stays OKF-valid (NFR-006).

## Acceptance mapping
| Contract | Spec acceptance |
|---|---|
| C2 | US1-AC1, US2-AC1/AC2, FR-009 |
| C4 | US3-AC1, FR-005, C-004 |
| C5 | US3-AC2, FR-006, C-005 |
| C6 | US1-AC3, FR-010 |
| C7 | NFR-001/003/004, US1 clean-room test |
| C8 | NFR-006 |

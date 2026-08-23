# Contract: frontmatter validator + schema

The two validators (build-free `validate-frontmatter.mjs` and the Astro
`docsSchema({ extend })` in `schema.ts`) MUST agree on this contract. Parity is
enforced by `src/tests/schema-validator-parity.test.ts` over a shared fixture set.

## Required fields (every non-reserved page)

- `title`: non-empty string. Missing/empty → **error**.
- `description`: string; length >180 → **error**; length <50 → **warning**.
- `doc_status`: one of `draft|active|deprecated|superseded`. Missing or
  out-of-enum → **error**. (Standalone validator: required, no default.)
- `updated`: coercible `YYYY-MM-DD`. Missing/invalid → **error**.
- `type`: string; validated against the section default (registry where present +
  loader sub-path table). Mismatch/unknown → **warning** (observably printed).
- `kind`: string; required on **every** page incl. bundle-root README. Missing →
  **error**. Unknown (outside canonical set) → **warning** (observably printed).

## Bundle root (`docs/README.md`)

- Exempt from `type`; MUST carry `okf_version: "0.2"`, `doc_status`, and `kind`.

## Optional families (shape-validated)

- `hero_image { src, alt }` — `alt` **required** when `hero_image` present.
- `social_thumb { src, alt } | string`.
- `related [ string | { ref, note } ]` — each ref MUST resolve (build +
  `check-links.mjs`, which is taught the object form); dangling → **error**.
- `external_references [ {url,title,note?} | {type,id} ]` — shape only (catalog
  `{type,id}` resolution deferred to M3; unresolved id does NOT fail M1).
- `audience [ { profile, guidance_text } ]` — `guidance_text` required per entry.
- `moscow { level, rationale }` — `level ∈ Must|Should|Could|Won't`; `rationale`
  required when `moscow` present.
- Empty `related: []` / `audience: []` → **valid** (no block).

## Strict/advisory split (ADR-0004/0009 posture)

- Strict (error): required-field presence, enums, description upper bound,
  ref integrity, required sub-fields.
- Advisory (warning, exit 0, message printed): unknown `kind`, unknown `type`,
  section/`type` mismatch, under-50 `description`, registry/folder coverage gaps.

## Parity assertion (NFR-005)

For every fixture in `src/tests/fixtures/` (one valid + one per invalid
permutation above), the standalone validator and the build schema MUST return the
same pass/fail verdict.

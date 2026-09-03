# Contract — index basename & registry subtypes (toolkit-internal)

These are internal toolkit contracts (no HTTP surface). "Consumer" = an adopter's `astro.config` / `sections.yaml`; "provider" = the toolkit.

## C-IB — `indexBasename` loader option

- **Type**: `indexBasename?: string | string[]` — a single basename or a set. Default `"README"`.
- **Provider guarantees**:
  - Default `"README"` reproduces today's behaviour exactly (no-op on the current corpus); a stray `index.md` stays an ordinary page under the default.
  - When a basename is configured (single or in the set), the matching file (case-insensitive) becomes the section index and owns the section slug (`<section>/`, not `<section>/index/`). A set (`['README','index']`) collapses **both** in one build — the mixed-basename example case (M2).
  - Every index-detecting surface honours it: content-loader id, route slug, `draftRoutes`, `routes/shared` docs-root, `llms.txt` description, deck slug, the bare-Node validator gate (incl. root-index exemption), `check-links`, `scaffold`, `new-doc`, `assert-build-artifacts`.
- **Consumer obligations**: none to keep the default; to use `index.md`, keep index files consistently named within the tree.
- **Error/edge**: both files present ⇒ configured basename wins + warning (E-05).

## C-ST — registry `subtypes` field

- **Provider guarantees**:
  - `subtypes` is optional; absent ⇒ built-in table fallback (unchanged behaviour).
  - Present ⇒ a page under `<section>/<seg>/…` whose `<seg>` equals a `subtypes[].match` derives that `type`, in both the TS lib and the bare-Node gate identically (parity-gated).
  - Resolution order per E-06; authored `type` always wins.
- **Consumer obligations**: declare the section `id` and, for sub-path types, the `subtypes` list in `sections.yaml`. A rename is: rename the folder, update the `id`/`match`, add redirects.
- **Error/edge**: unknown section id ⇒ documented default + warning (US2-AS5).

## Verification

- Parity tests (`section-type-parity.test.ts`, `schema-validator-parity.test.ts`) assert TS≡mjs for basename detection and subtypes derivation.
- `index-basename.test.ts` / `section-rename.test.ts` assert the per-surface behaviour + collision + fallback warning.

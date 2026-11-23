# Contract: `docs/_meta/subprocessors.yaml`

The data model lives in [data-model.md](../data-model.md). This contract pins the
behaviour that tests assert.

## Example

```yaml
- id: acme-hosting
  name: Acme Hosting B.V.          # fictional
  address: 1 Example Street, Amsterdam
  contact: privacy@acme-hosting.example
  processing: Hosting of the production database and backups.
  location: [NL, DE]
  location_note: Backups replicate to Frankfurt.
  responsibilities: Acme operates the infrastructure; we configure access and retention.
  since: 2025-01-15
  external_references:
    - { type: biblio, id: acme-dpa }
  tom_classification:
    - physical-access-control
    - measure: certification-assurance
      note: ISO/IEC 27001 certificate, renewed yearly.
```

## Validation messages

Every message has the form `<source>: <subject>: <problem>`:
- `<source>` is the catalog path as the caller names it.
- `<subject>` is `subprocessor "<id>"`, or `subprocessor #<n>` (1-based) when the id is missing or invalid.

| Case | Message tail (exact wording fixed in WP01 tests) |
|------|-----------------------------------------------|
| top level not a list | `the catalog must be a list of records` |
| record not a mapping | `must be a mapping` |
| missing required field | `missing required field "<field>"` |
| unknown field | `unknown field "<field>"` |
| bad id | `id must be kebab-case` |
| duplicate id | `duplicate id "<id>"` |
| empty required string | `"<field>" must be a non-empty string` |
| bad date | `"<field>" must be a calendar date (YYYY-MM-DD)` |
| until before since | `"until" (<until>) is before "since" (<since>)` |
| empty location | `"location" must list at least one country code` |
| bad country code | `"location" has "<code>", which is not an assigned ISO 3166-1 alpha-2 code` |
| lower-case code | `"location" has "<code>"; write country codes in upper case ("<CODE>")` |
| duplicate code | `"location" lists "<code>" twice` |
| unresolved biblio/tool id | `external_references cites <type> "<id>", which is not in the catalog` |
| unknown reference type | `external_references has unknown type "<type>"` |
| unknown measure | the measures core's own `classificationProblems` message, unchanged |
| YAML parse error | `could not parse YAML: <reason>` |

## Callers

- **Gate.** `node src/scripts/validate-catalog.mjs [<root> ...]`. For each root it
  reads `<root>/_meta/subprocessors.yaml` when present, prints the problems, and
  exits 1 on any problem. Its summary adds `N sub-processor record(s)`.
- **Build.** The `doc-kitty:subprocessors` integration reads
  `<docsDir>/_meta/subprocessors.yaml`. On problems it throws one `Error` whose
  message is `[dk-subprocessors] invalid sub-processor catalog:` followed by one
  problem per line.
- **Parity.** For the same file and reference data, both callers produce the same
  problem lines. Only the `<source>` prefix may differ: the gate names the path
  from the repository root, and the build from the docs root.

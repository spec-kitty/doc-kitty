# Contract: frontmatter field and measures catalog

## `tom_classification` (optional page field)

```yaml
tom_classification:
  - transmission-protection                 # bare id, scope system
  - measure: events-logging
    scope: system                           # system (default) | organisation
    note: Every admin action is logged and kept for 13 months.
```

- Shape errors fail both the build schema and `validate-frontmatter.mjs`: a non-list, an entry that is neither a string nor an object with `measure`, a `scope` outside the enum, or a non-string `note`.
- A case variant key (for example `TOM_classification`) is ignored by the build. The gate warns: ``unknown key `TOM_classification`: did you mean `tom_classification`?``.

## `_meta/measures.yaml` (optional consumer file)

```yaml
- id: transmission-protection
  label: Protection of data during transmission
  nature: technical            # technical | organisational | legal | physical
  frameworks:
    - framework: eu-scc-2021-914-annex-ii
      ref: "6"
  dpv: https://w3id.org/dpv#EncryptionInTransfer
```

- Present: it replaces the shipped default wholesale. Absent: the default applies.
- Framework keys in the default: `eu-scc-2021-914-annex-ii` (heading number) and `eu-gdpr` (`Art. 32(1)(a)` … `(d)`).

## Error messages (build and gate share the wording)

- Unknown id: `[dk-measures] <page path>: unknown measure id "<id>" (not in <catalog path>)`
- Conflicting scope: `[dk-measures] <page path>: measure "<id>" is listed with both scopes`
- Malformed catalog: `[dk-measures] <catalog path>: <record id or index>: <problem>`

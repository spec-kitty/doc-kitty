# Quickstart — Authoring & migrating a Documentation Charter

## 1. Author a charter (new consumer)
Create `<docsRoot>/_meta/charter.yaml`:
```yaml
version: 1
vocabulary:
  types: { forbidden: [ Feature ], aliases: { Feature: Capability } }
statuses:
  add: [ deprecated ]
required_fields:
  optional: [ updated ]
sections:
  index_basename: README
  order: [ context, architecture, adr, guides ]
```
Then build/validate exactly as an external adopter (from the packed tarball) —
no Spec Kitty required. Forbidden terms hard-fail; the added status validates;
pages omitting `updated` pass; `title`-less pages still fail.

## 2. Verify the effective charter (FR-015)
Inspect the resolved/effective charter to confirm what governance is in force
(the derived-but-committed catalog projection).

## 3. Migrate a legacy consumer
Existing `_meta/vocabulary.yaml` + `_meta/sections.yaml` keep working (you'll see
a deprecation notice). To consolidate:
1. Create `_meta/charter.yaml` with `version: 1`.
2. Move `vocabulary.yaml` contents under `vocabulary:`.
3. Move `sections.yaml` contents under `sections:` (order/entries/index_basename/subtypes).
4. Rebuild — behavior is identical (same forbidden terms, same section resolution).
5. Once green, delete the legacy files. (Per-axis precedence means a half-migrated
   state is deterministic: any axis present in the charter fully owns that axis.)

## 4. Guardrails
- `title` is always required (cannot be relaxed).
- Canonical statuses (`draft`, `published`, `durable`, …) are reserved — you may
  only ADD statuses.
- A malformed charter fails the build with a message naming the offending key.

---
title: Migrating to the documentation charter
description: Consolidate legacy _meta/vocabulary.yaml and _meta/sections.yaml into a single _meta/charter.yaml without changing governance behavior.
doc_status: active
updated: 2026-09-14
type: Guide
kind: How-To
tags: [adoption, charter, migration, governance]
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
  - guides/consumer-setup
  - adr/0042-native-documentation-charter
---

# Migrating to the documentation charter

**Audience.** A consumer who already governs their docs with the legacy
`_meta/vocabulary.yaml` and/or `_meta/sections.yaml` files and wants to
consolidate them into the single [`_meta/charter.yaml`](/context/convention/)
surface. This is a **behavior-preserving** move: done as described, your build
resolves the same vocabulary, the same sections, and the same statuses it did
before.

You do not have to migrate. The legacy files keep working indefinitely — you will
just see one deprecation notice per build until you consolidate.

## Before you start

Two facts make the migration safe to do incrementally:

- **Precedence is per axis, not per file.** An axis declared in `charter.yaml`
  (`vocabulary`, `sections`, `statuses`, `required_fields`) resolves *solely* from
  the charter. Any axis you leave out of the charter still resolves from the
  legacy file if one is present, else from the shipped default. The same axis is
  never partial-merged across the charter and a legacy file, so a half-migrated
  tree is deterministic — a moved axis is fully owned by the charter, an un-moved
  axis is untouched.
- **One deprecation notice.** While any legacy `_meta/*.yaml` is present, the
  build emits exactly one notice pointing back here. It clears when you delete the
  last legacy file.

Migrate on a branch and diff the built output (or run your validation gates) after
each step to confirm nothing changed.

## Steps

1. **Create the charter with a version.** Add `docs/_meta/charter.yaml`:

   ```yaml
   # docs/_meta/charter.yaml
   version: 1
   ```

   With only `version`, every axis still resolves from the legacy files —
   behavior is unchanged and you have a place to move each axis into.

2. **Move the vocabulary axis.** Copy the contents of `_meta/vocabulary.yaml`
   under a `vocabulary:` key. The shape is identical (`types` / `kinds`, each with
   `aliases` and `forbidden`):

   ```yaml
   vocabulary:
     types:
       aliases:   { Feature: Capability }
       forbidden: [ Feature ]
     kinds:
       aliases:   {}
       forbidden: []
   ```

   Rebuild. The same terms are forbidden and the same aliases apply, because the
   `vocabulary` axis now resolves from the charter instead of the legacy file.

3. **Move the sections axis.** Copy the contents of `_meta/sections.yaml` under a
   `sections:` key — `index_basename`, `order`, `entries`, and `subtypes` keep
   their legacy shape:

   ```yaml
   sections:
     index_basename: README
     order: [ context, architecture, adr, guides ]
     entries:
       - { id: context, label: Context, type: Context, purpose: "Why we exist", feeds: [rss] }
     subtypes: { }
   ```

   Rebuild. Section resolution — order, labels, feeds, sub-path types — is
   identical.

4. **(Optional) adopt the new axes.** The charter adds two axes the legacy files
   never had. They are optional; skip them to stay strictly behavior-preserving.
   - `statuses.add` — add to the `doc_status` set (extend-only; the canonical
     statuses are reserved).
   - `required_fields.optional` — relax required fields for your consumer, except
     `title`, which is always required.

   ```yaml
   statuses:
     add: [ archived ]
   required_fields:
     optional: [ updated ]
   ```

5. **Delete the legacy files once green.** When every axis you use lives in the
   charter and your gates are green, delete `_meta/vocabulary.yaml` and
   `_meta/sections.yaml`. The deprecation notice clears on the next build.

## Guardrails

- **`title` is always required** — it is a floor; listing it in
  `required_fields.optional` fails the build with a floor message.
- **Canonical statuses are reserved** — `statuses.add` only *adds*; removing,
  forbidding, or aliasing-away a canonical status (`draft`, `active`,
  `deprecated`, `superseded`, `durable`) fails closed.
- **A malformed charter fails closed** with a message naming the file and the
  offending key — it is never silently ignored or partially applied. An unknown
  *top-level* key only warns, so the schema can grow without breaking your build.
- **Do not partial-migrate a single axis.** Keep each axis wholly in the charter
  or wholly in its legacy file during the transition; per-axis precedence means
  the charter, once it declares an axis, owns it completely.

See [Common Docs — Kitty Variation](/context/convention/) for the full list of
governable dimensions and [Consumer setup](/guides/consumer-setup/) for where the
charter sits in a net-new build.

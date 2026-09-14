---
title: Forbidden Type Page (charter-only)
description: A page whose `type` is forbidden ONLY by `_meta/charter.yaml` — no legacy `_meta/vocabulary.yaml` exists in this root.
kind: Reference
type: Feature
doc_status: active
updated: 2026-01-01
---
Isolates the charter-only enforcement path: this root carries no legacy
`_meta/vocabulary.yaml` at all, so a pass here can only come from the gate
reading the forbidden-type ban through `resolveGovernance` (the charter),
never through `loadVocabulary` (the legacy file).

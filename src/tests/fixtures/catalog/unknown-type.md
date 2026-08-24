---
title: Unknown catalog type
description: A fixture whose external_references use a catalog type that is neither biblio nor tool, so resolveCitation must fail fast on the unknown type.
doc_status: active
updated: 2026-08-24
type: Architecture
kind: Explanation
external_references:
  - type: journal
    id: divio-2017
---

# Unknown catalog type

This fixture uses a catalog `type` (`journal`) that is neither `biblio` nor
`tool`. The resolver (`resolveCitation`) MUST fail fast on the unknown type
(FR-008 / catalog-and-citation contract), even when the `id` exists in a catalog.

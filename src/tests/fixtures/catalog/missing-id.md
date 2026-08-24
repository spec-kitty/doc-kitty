---
title: Missing citation id
description: A fixture whose external_references cite a catalog id that is absent from the bibliography, so resolveCitation must throw a build-fatal miss.
doc_status: active
updated: 2026-08-24
type: Architecture
kind: Explanation
external_references:
  - type: biblio
    id: does-not-exist-in-catalog
---

# Missing citation id

This fixture cites a bibliography `id` that is not present in the catalog. The
resolver (`resolveCitation`) MUST throw a build-fatal error rather than emit a
dangling citation (FR-008 / catalog-and-citation contract).

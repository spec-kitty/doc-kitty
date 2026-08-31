---
title: Orphan page with no derivable type
description: A root/orphan page under no registered section that omits type; derivation yields nothing, so the gate accepts it as deterministically untyped (US1 AS-3).
doc_status: active
updated: 2026-08-23
kind: Reference
---

# Orphan page with no derivable type

This page has no `type` and lives outside any registered section, so derivation
yields nothing. The gate treats it as deterministically untyped (no crash, no
garbage type) rather than failing.

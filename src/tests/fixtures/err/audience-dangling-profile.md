---
title: Dangling audience profile
description: A fixture whose audience targets a reader profile with no persona page, so resolveProfile returns null (a soft miss) rather than failing the build.
doc_status: active
updated: 2026-08-24
type: Architecture
kind: Explanation
audience:
  - profile: ghost-profile-with-no-page
    guidance_text: This profile has no persona page under context/audience/, so it resolves to null.
---

# Dangling audience profile

This fixture targets an audience `profile` for which no persona page exists under
`context/audience/`. Unlike a dangling `related` ref (build-fatal), a missing
persona is a SOFT miss (FR-002): `resolveProfile` returns `null` and the block
renders the humanized slug while warning on the build log.

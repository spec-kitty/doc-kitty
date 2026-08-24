---
title: CI actions bumped off deprecated Node 20
description: actions/checkout and dorny/paths-filter re-pinned to their Node 24 majors to clear GitHub's Node 20 deprecation warning.
doc_status: active
updated: 2026-08-24
type: Changelog
kind: Changelog
tags: [ci]
related:
  - architecture/ci-cd-pipeline
---

# 2026-08-24 — CI actions moved to the Node 24 runtime

GitHub warned that two SHA-pinned actions still target the deprecated Node 20
runtime and were being force-migrated to Node 24 at run time:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are being
> forced to run on Node.js 24: `actions/checkout`, `dorny/paths-filter`.

Both are now re-pinned to the latest release of their Node 24 major, so the runner
uses the version the action was built for instead of a forced migration:

- **`actions/checkout`** `v4.4.0` → `v5.1.0` (`fbc6f39`) — `using: node24`.
- **`dorny/paths-filter`** `v3.0.2` → `v4.0.3` (`ceb8a2b`) — `using: node24`.

The pins are updated across `ci.yml`, `deploy.yml`, and `nightly.yml`. Every pin
keeps the `# vX.Y.Z` comment beside its SHA per the repo's pinning convention. The
other pinned actions were not named in the deprecation and are left untouched.

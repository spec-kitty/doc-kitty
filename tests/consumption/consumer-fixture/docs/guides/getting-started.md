---
title: Getting started
description: Install the packed toolkit tarball, configure, and build a consumer docsite.
doc_status: active
updated: 2026-09-09
type: Guide
kind: Tutorial
tags: [setup, getting-started]
---

# Getting started

This fixture consumes the **packed** `@commondocs-kitty/toolkit` from a local
tarball, exactly as an external adopter would consume a published release.

1. Pack the toolkit and install the tarball (the orchestrator does this for you):

   ```sh
   node tests/consumption/scripts/run-consumption-test.mjs
   ```

2. The fixture is its own pnpm workspace root (`packages: []`) and installs with
   `--ignore-workspace`, so it resolves the toolkit **only** from
   `file:./toolkit.tgz` — never the repo's workspace symlink to `src/`.

3. `astro build` then renders this `docs/` tree plus the generated `rss.xml`,
   `llms.txt`, `sitemap*.xml`, and the JSON agent-API.

See the [Guides hub](/guides/) for the full list.

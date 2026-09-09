---
okf_version: "0.2"
title: Consumer Fixture
description: Master entry point for the clean-room consumer docsite built from the packed @commondocs-kitty/toolkit tarball.
doc_status: active
kind: Hub
updated: 2026-09-09
authors:
  - stijn@sddevelopment.be
---

# Consumer Fixture

A net-new docsite that renders a **Common Docs — Kitty Variation** `docs/` tree
using the **packed** `@commondocs-kitty/toolkit` — installed from a local
`file:./toolkit.tgz`, never the workspace symlink. It exists to prove that what
`npm pack` ships is enough to build a consuming site, and that the generated
discovery artifacts resolve:

<!--
  The hrefs below are RELATIVE on purpose. This page renders at the site root, so
  `./rss.xml` resolves under the site `base` (`/consumer-fixture`) — a root-absolute
  `/rss.xml` would drop the base and 404 on a based deployment.
-->

- [`/sitemap-index.xml`](./sitemap-index.xml) — search-engine discovery
- [`/rss.xml`](./rss.xml) — subscribe to documentation changes
- [`/llms.txt`](./llms.txt) — the agent-facing index
- [`/api/index.json`](./api/index.json) — the machine-readable corpus map

Start with the [Guides](/guides/) section — the base prefix (`/consumer-fixture`)
is added at render time by the toolkit's base-absolute-links seam.

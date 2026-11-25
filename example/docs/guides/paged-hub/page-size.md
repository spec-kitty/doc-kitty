---
title: Page size
description: The number of children each listing page shows, set per hub, per section or for the site.
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: Explanation
---

# Page size

The page size is how many children each listing page shows. The most specific
setting wins:

1. the hub's own `hub_page_size` frontmatter, as on this example's hub;
2. `hub.pageSize` on the section in `docs/_meta/sections.yaml`, or in the
   charter's `sections.entries`;
3. `hub.pageSize` in `defineDocKittyIntegrations`;
4. the default, 50.

A page size is a positive whole number. Any other value stops the build with a
message that names the setting.

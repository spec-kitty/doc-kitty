---
title: Where the cap is set
description: The cap is read from the hub, then its section, then the site.
doc_status: active
updated: 2026-11-23T00:00:00Z
type: Guide
kind: Explanation
---

# Where the cap is set

The most specific setting wins:

1. the hub's own `sidebar_child_cap` frontmatter, as on this example's hub;
2. `sidebar.childCap` on the section in `docs/_meta/sections.yaml`;
3. `sidebar.childCap` in `defineDocKittyIntegrations`;
4. the default, 50.

A cap is a positive whole number. Any other value stops the build with a
message that names the setting.

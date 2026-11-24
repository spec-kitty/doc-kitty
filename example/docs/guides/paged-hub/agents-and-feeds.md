---
title: Agents and feeds
description: Listing pages appear in the agent API, llms.txt and the sitemap, and every child is still listed once.
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: Explanation
---

# Agents and feeds

Paging is for readers. Agents and crawlers still reach every page:

- the sitemap lists every child and every listing page;
- the agent API index has one `Listing` record per listing page, with
  `listing_of`, `page` and `of`, and a JSON file per listing page that lists
  its children;
- llms.txt lists each listing page right after its hub.

Each child is still listed once, under its own entry.

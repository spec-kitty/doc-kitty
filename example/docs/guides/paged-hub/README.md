---
title: Paged hub
description: "A hub over its sidebar child cap that lists its pages two at a time, with a pagination below the list."
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: Hub
sidebar_child_cap: 3
hub_page_size: 2
---

# Paged hub

This hub has seven pages, a sidebar child cap of 3 and a page size of 2, set
with `sidebar_child_cap: 3` and `hub_page_size: 2` in this page's frontmatter.
Seven is more than three, so the sidebar shows one "7 pages" entry, and seven
is more than two, so this page lists its first two pages and the rest follow on
listing pages 2, 3 and 4.

Use the pagination below the list to move between the listing pages. Each one
is a page of its own, at `/guides/paged-hub/page/2/` and so on.

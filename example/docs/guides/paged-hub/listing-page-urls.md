---
title: Listing page URLs
description: Listing page N of a hub is at /<hub>/page/N/, from 2 up; page 1 is the hub itself.
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: Reference
---

# Listing page URLs

Page 1 is the hub page. Listing page N, from 2 up, is at
`/<hub>/page/N/`. No page 1 URL is built, and no page past the last.

Each listing page is its own canonical URL. It sits in the site frame with the
sidebar, shows the hub's title with its page number, and has no previous or
next links: the pagination takes their place.

Because these URLs are taken, a paged hub may not have a child named `page`.
The build stops and names the hub and the child.

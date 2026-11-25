---
title: Translating the pagination
description: The pagination's name and labels are UI strings that a site can translate.
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: How-To
---

# Translating the pagination

The pagination uses five UI strings, with these English defaults:

| Key | Default |
| --- | --- |
| `dockitty.hub.pagination.label` | Pagination |
| `dockitty.hub.pagination.previous` | Previous |
| `dockitty.hub.pagination.next` | Next |
| `dockitty.hub.pagination.page` | Page {page} |
| `dockitty.hub.pagination.title` | {title}, page {page} |

Add a translation for any of them in the site's `src/content/i18n/<locale>.json`.
A string a locale does not translate falls back to English.

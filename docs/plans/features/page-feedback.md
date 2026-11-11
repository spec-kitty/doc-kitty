---
title: Page feedback
description: "Toggleable edit-this-page and comment affordances, from a host edit link to section-anchored comments."
doc_status: draft
updated: 2026-11-11T00:00:00Z
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: Plan, ADR and open-pack review all need a reader feedback loop. The first slice reuses the existing repository settings.
tags: [feedback, comments, edit-link]
related:
  - architecture/research/page-feedback
---

# Page feedback

Readers can edit a page through its git host, or comment on it. Both are off by
default, and a site turns them on in its main config.

Scope: Extended.

**First implementation: GitHub and giscus only.** Slices 1 and 2 target
`repository.provider: github`. Every other provider is a later slice.

Design: [Page feedback](../../architecture/research/page-feedback.md).

## Slices

1. **Edit link (web).** Add an `editLink()` helper next to `sourceLink()`, with
   the same guards. It covers the GitHub edit URL first.
   Override Starlight's `EditLink` slot with it, and add a `feedback.editLink`
   toggle. Tests mirror the `sourceLink` table.
2. **Page comments (giscus).** A `feedback.comments` option with
   `provider: giscus` and `scope: page`. One thread per page (`specific`
   mapping on the slug). Sync the theme with the site's dark/light toggle, and
   opt out per section and per page.
3. **Fallback for hosts other than GitHub.** An `issue-link` provider: a
   "Discuss" link that opens a new issue with the page and section in it.
4. **Section comments.** `scope: section`: a comment button per heading, one
   giscus thread per `<slug>#<id>`, mounted lazily. Pinned heading ids, and a
   build check for orphaned threads.
5. **Build-time ingest.** In CI, read the discussions (and open PRs that touch
   a page) and bake section counts and excerpts into the page and its
   `/api/pages` payload.
6. **Agent-prompt edit mode.** `editLink.mode: agent | both`: a copyable
   prompt built from the page's repository path and agent payload.
7. **Other hosts.** GitLab and Bitbucket edit URLs, then a Hypothesis
   provider or a self-hosted W3C Web Annotation backend for comments.

Slices 1 and 2 are independent and could each be one mission. Each slice that
changes the config contract needs an ADR (the `feedback` option, and the
`sections.yaml` / frontmatter opt-out key).

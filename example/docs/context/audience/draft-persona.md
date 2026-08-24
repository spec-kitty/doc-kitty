---
title: Pending the Placeholder
description: A deliberately unpublished persona retained as the draft-exclusion demonstrator — it must stay out of the hub, sitemap, RSS, and agent index.
doc_status: draft
updated: 2026-08-24
type: Context
kind: Persona
authors:
  - stijn@spec-kitty.ai
tags: [persona, draft, fixture]
role: A persona still being drafted, kept unpublished to prove draft exclusion.
goals:
  - Demonstrate that a draft page is excluded from every published surface.
responsibilities:
  - Stays absent from the Audiences hub list, sitemap, RSS feed, and agent index while draft.
---

The pending placeholder draft sentinel — this page exists only to prove that a
`doc_status: draft` persona is excluded from the hub list, the sitemap, the RSS
feed, and the agent index while it remains unpublished (FR-022 / US5).

Once promoted to `active`, it would list on the Audiences hub like any other
persona; until then it renders to HTML but appears on no discovery surface.

---
title: A page that lives in the shipping context
description: Declaring glossary_context lets the auto-linker settle a collision by itself — here policy resolves to shipping with no directive and no warning.
doc_status: active
updated: 2026-08-26
type: Guide
kind: How-To
tags: [glossary, demonstrator, context]
glossary_context: shipping
---

# A page that lives in the shipping context

This page declares `glossary_context: shipping` in its frontmatter. That one field
changes how the auto-linker treats an otherwise ambiguous term: the page's own context
is used to settle a collision the context-free page had to leave plain.

## The collision resolves itself here

The word policy is defined in both shipping and hr, but because this page belongs to
the shipping context the auto-linker links policy straight to the shipping definition —
no `:term` directive, no build warning. Hovering the link shows the definition inline,
and following it opens the full glossary entry in a new tab.

## Single-context terms link as usual

Terms that live in only one context never needed the page context. The word cargo and
the word freight both link to their shipping definitions on their first mention in this
section, exactly as they would on any page.

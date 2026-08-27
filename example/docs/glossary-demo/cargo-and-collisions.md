---
title: Cargo, consignments, and a cross-context collision
description: The context-free demonstrator — auto-linking, an unresolved collision left plain with one build warning, a forced :term link, and a suppressed one.
doc_status: active
updated: 2026-08-26
type: Guide
kind: Explanation
tags: [glossary, demonstrator, autolink, collision]
# Several short same-level H2s would make Starlight's on-this-page nav a tightly
# packed list whose links fall below the WCAG 2.2 target-size (2.5.8) minimum — an
# unrelated theme-chrome issue this glossary fixture should not carry (the diagram
# demonstrator suppresses its TOC for the same reason). The sections are short and
# self-evident, so the table of contents is suppressed here.
tableOfContents: false
---

# Cargo, consignments, and a cross-context collision

This page declares **no** `glossary_context`, so it is the honest test of what the
auto-linker does when a term is ambiguous. It sits deliberately outside any single
bounded context, which is exactly the situation the collision rules exist for.

## Auto-linking a single-context term

The first time a context-free term appears in a section, doc-kitty links it to its
definition. Here the word cargo becomes a link, and its alias consignment links the
same way — both point at the shipping definition. A second mention of cargo in this
same section stays plain text, because only the first occurrence per section is
linked.

## An unresolved collision stays plain

The word policy is defined in **both** the shipping and the hr contexts. On a
context-free page the auto-linker refuses to guess which one you mean, so it leaves
policy as plain text and prints one build warning naming the competing contexts. That
warning is the pinned, greppable signal the build asserts on.

## Forcing a link with the :term directive

When you do know which context you mean, name it. The directive
:term[policy]{context=hr} resolves policy to the hr definition even though this page
declares no context of its own — the one sanctioned way to link across a collision.

## Suppressing a link

Sometimes a word that happens to be a term should stay plain — a label you are
quoting, for instance. Write :term[cargo]{link=false} and it renders as ordinary text
with no link, even though cargo is a real term.

---
title: A page that opts out of auto-linking
description: Setting glossary_autolink to false turns off automatic links for the whole page, while an explicit :term directive still resolves and links.
doc_status: active
updated: 2026-08-26
type: Guide
kind: How-To
tags: [glossary, demonstrator, opt-out]
glossary_context: shipping
glossary_autolink: false
---

# A page that opts out of auto-linking

This page sets `glossary_autolink: false`. Automatic linking is off for the whole page,
so terms that would normally link are left exactly as written — useful for a reference
page, a changelog, or any text where inline links would be noise.

## Nothing here is auto-linked

The words cargo, freight, and policy all appear in this paragraph and every one of them
stays plain text. With the auto-linker off the page emits no glossary links and no
collision warning, whatever terms the prose happens to mention.

## An explicit directive still works

Opting out of auto-linking does not disable the escape hatch. The directive
:term[cargo]{context=shipping} still resolves and links, because `:term` is an
author's deliberate choice rather than an automatic one.

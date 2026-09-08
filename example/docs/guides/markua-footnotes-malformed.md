---
title: Markua footnotes graceful degradation
description: Unmatched Markua footnote marker + orphan definition that must never fail the build (NFR-002).
doc_status: draft
updated: 2026-09-08
type: Guide
kind: Reference
tags: [markua, footnotes, fixture, degradation]
tableOfContents: false
glossary_autolink: false
---
<!-- markdownlint-disable -->
<!-- This is a Markua fixture: it deliberately contains malformed footnote
     constructs (an unmatched reference marker and an orphan definition) that must
     degrade to readable text and never throw. doc_status: draft — no ratchet move. -->

# Markua footnotes graceful degradation

Every case below is deliberately malformed. The build must still exit 0 (NFR-002)
and every case must degrade to **readable text** — never broken markup, never a
thrown error.

## An unmatched reference marker degrades to literal text

There is no definition for this marker, so `remark-gfm` never makes it a footnote
and it stays as the literal source text: a reference[^^7_7] with no matching
definition renders verbatim as `[^^7_7]`, not a broken link.

## An orphan definition renders nowhere

The definition below has no reference anywhere on the page. GFM keeps it out of
the rendered notes list, so it simply does not appear — the build does not fail.

[^^8_8]: This orphan definition is never referenced, so it renders nowhere.

---
title: Post-Markua hardening — a11y flake fix + structural guards for the Markua/re-derive boundaries
description: Resolves the three post-Markua-merge follow-ups (#34/#35/#36) — stops the deck-diagram a11y flake and turns two by-convention boundaries into structural, drift-catching guards.
doc_status: active
updated: 2026-08-30
type: Changelog
kind: Changelog
tags: [markua, accessibility, remark, rehype, testing, slide-decks, glossary]
related:
  - architecture/markua
  - architecture/slide-decks
  - architecture/glossary
  - adr/0030-markua-preprocess-to-directive
  - adr/0025-glossary-on-this-page-block-and-remark-render-channel
---

# 2026-08-30 — Post-Markua hardening

Three follow-ups were filed after the [Markua subset](./2026-08-29-markua-syntax-support.md)
merged. They shared one theme — **boundaries that were correct but guarded only by
convention** — so each is now closed as a defect *class* with a regression test, not patched
as a one-off. Base behaviour and the shipped Markua feature are unchanged; on today's corpus
every new guard is a no-op and rendered output is byte-identical.

## What changed

- **The a11y lane no longer flakes on the deck-diagram theme toggle (#34).** The toggle fires
  a destructive-then-async Mermaid re-render, and the colour-equality read could land while the
  computed fill was still empty. The real defect was that `expect.poll` does not retry when its
  callback *throws* — an empty-colour parse aborted the poll on the first unlucky tick. The read
  now uses `expect(...).toPass({ timeout })` (which retries on any throw) over one shared,
  empty-tolerant colour helper (`tests/a11y/helpers/colour.ts`); the throwing duplicate in the
  deck spec is gone, so the flake class cannot reappear in the twin file. The invariant is not
  weakened — a genuine colour divergence still fails, and the "colours differ across modes"
  guard is retained. Fix is test-only; the production render path is unchanged.

- **The render-time re-derive substrate can no longer silently drift from the build remark
  stack (#35).** `page-processor.ts` (the shared parse config that `OnThisPage` and the
  definitions payload re-derive from) mirrored the build's remark plugins *by convention* — the
  root cause behind the earlier gfm/smartypants parity bugs. It now exports
  `REDERIVE_REMARK_PLUGINS` as the single source it consumes, and a new parity test
  (`glossary-substrate-parity.test.ts`) enumerates the build's remark stages and fails if any is
  neither mirrored (derived from that export) nor recorded in a keyed conscious-exclusions
  allow-list. A behavioural golden-tree diff also catches a *wrong* exclusion, and a
  version-parity assertion catches gfm/smartypants drifting from Astro's resolved versions.

- **Deck (Presentation) pages are consistently Markua-agnostic (#36).** Previously only one of
  the five Markua passes skipped decks; the other four ran on deck bodies (before slide-splitting),
  so a future `{…}` / `W>` / `{aside}` slide line could have been silently transformed. All five
  passes now no-op on deck pages through one shared `isPresentationFile()` predicate and a
  `guardDeck()` wrapper applied at the plugin registration arrays — deck-agnosticism is a property
  of array membership, so a sixth pass can't silently re-open the gap (a test asserts every
  registered pass is wrapped). The scattered `kind: Presentation` checks were folded onto the one
  predicate. Decks remain Markua-agnostic for now; making deck slides Markua-capable is captured
  as a tracked follow-up.

- **Two minor Markua edges closed (#36).** Two stacked `{…}` attribute-list paragraphs above one
  target now both apply (nearest-wins) instead of the outer being dropped; and the callout
  three-form-equivalence unit test now exercises genuinely distinct pre-normalisation inputs
  through the real normaliser instead of vacuously comparing identical inputs.

## Scope

Test-only for #34. For #35/#36 the runtime change is a behaviour-preserving refactor plus new
guards; decks carry zero Markua today, so the guards are no-ops and the built corpus is
byte-identical. No dependency was added, upgraded, or removed. The full unit suite, build,
`assert:markua`, and docs validation stay green (582 unit tests, up from 553).

Decision of record: decks are Markua-agnostic (option (a)); see the amendment in
[ADR-0030](../adr/0030-markua-preprocess-to-directive.md).

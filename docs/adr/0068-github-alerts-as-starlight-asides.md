---
title: "ADR-0068: Render GitHub alert blockquotes as Starlight asides"
description: An opt-in remark pass turns a top-level > [!NOTE]-style blockquote into the directive Starlight renders as a native aside, so one file reads correctly on GitHub and on the site.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0030-markua-preprocess-to-directive
  - adr/0038-decks-markua-capable
  - adr/0047-relative-markdown-links
  - guides/consumer-setup
---

# ADR-0068: Render GitHub alert blockquotes as Starlight asides

## Status

Proposed — 2026-10-31. Introduced for issue #250.

## Context

Docs that are read both on GitHub and on the site use GitHub's alert syntax:

```md
> [!NOTE]
> Text.
```

GitHub renders it as a callout. The toolkit rendered it as a plain blockquote
that starts with a literal `[!NOTE]`. Converting a page to `:::note` fixes the
site and breaks GitHub, where the directive shows as raw text. This is the same
"one file, two readers" problem that
[ADR-0047](./0047-relative-markdown-links.md) solved for links. The first
consumer has nine pages that use alerts.

The toolkit already has one path to a themed, labelled aside: the Markua mapped
callouts leave a `containerDirective` named `note`, `tip`, `caution` or
`danger`, and Starlight's `remarkAsides` turns it into a native aside
([ADR-0030](./0030-markua-preprocess-to-directive.md)).

## Decision

1. **A remark pass, `githubAlerts`, rewrites the alert into that directive.**
   It emits no aside markup of its own. Starlight's `remarkAsides` renders the
   aside, so the alert gets the same theme, icon, title and `aria-label` as
   `:::note` and the Markua callouts.
2. **The type map.** NOTE → note, TIP → tip, IMPORTANT → note, WARNING →
   caution, CAUTION → danger. Starlight has four variants, so IMPORTANT shares
   the note variant.
3. **Titles follow GitHub where Starlight would differ.** IMPORTANT, WARNING
   and CAUTION pass GitHub's label as the directive label, which Starlight uses
   as the title and the accessible name. NOTE and TIP keep Starlight's
   default title, which is translated. The three passed labels are English.
4. **The match follows GitHub.** The marker is the first line of the
   blockquote, alone on it, in any case. Only a top-level blockquote counts.
   Anything else stays a blockquote: an unknown `[!X]`, text after the marker,
   an empty body, or a quote inside a list or another quote.
5. **Opt-in.** `defineDocKittyIntegrations({ githubAlerts: true })`. Off by
   default, so an existing site renders byte-identically. The integration sits
   immediately before Starlight, after the glossary passes, so the glossary and
   its re-derive see the same blockquote.
6. **No-op on decks.** A `kind: Presentation` page does not load Starlight's
   aside CSS (ADR-0038), so the pass leaves its blockquotes alone.
7. **A fallback.** The directive carries `data.hName: 'blockquote'`. On a
   Markdown file Starlight does not process, the body renders as a blockquote
   instead of an unknown `<div>`.

## Consequences

### Positive

- One file reads correctly on GitHub and on the site.
- No new theme surface: alerts reuse the native aside and its tokens.
- No new dependency; the walk is hand-rolled like the Markua passes.

### Negative

- IMPORTANT and NOTE look the same apart from the title.
- The three GitHub labels are not translated.

### Risks

- If Starlight renames its aside variants or stops reading the directive
  label, alerts fall back to the `blockquote` rendering. The Playwright lane
  asserts the rendered asides and their theme against the Markua asides, so
  the regression is caught.

## Alternatives considered

### Option A: always on

Simpler for adopters, but it changes the output of every existing page that
happens to quote a `[!NOTE]`. Rejected for now; flipping the default later is
a one-line change.

### Option B: a dedicated `important` variant

A theme callout (`dk-callout--important`) would distinguish IMPORTANT from
NOTE, but it adds a theme surface and a second rendering path. Rejected; the
title already carries the difference.

### Option C: a third-party plugin

`remark-github-blockquote-alert` and similar plugins emit their own markup and
CSS, which would not match the Starlight asides. Rejected.

## References

- Issue #250.
- GitHub alert syntax: GitHub Docs, "Basic writing and formatting syntax", Alerts.
- `src/lib/remark/github-alerts.ts`, `src/lib/remark/github-alerts.internal.ts`.

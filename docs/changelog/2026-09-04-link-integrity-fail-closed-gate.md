---
title: "Link integrity — base-prefixed internal links + a fail-closed built-output gate"
description: "Closes #61/#62/#63 — internal links AND RSS/llms.txt/agent-API absolute URLs no longer 404 on the deployed site, gated end-to-end by a base-aware built-output check."
doc_status: active
updated: 2026-09-04
type: Changelog
kind: Changelog
tags: [links, gate, ci, glossary, reliability]
related:
  - adr/0037-base-aware-link-fail-closed-gate
  - context/convention
---

# 2026-09-04 — Link integrity: base-prefixed links + a fail-closed gate

The example docsite's internal navigation 404'd on the real, based deployment
(`/doc-kitty`) while `pnpm validate:links` reported "✓ 863 references
resolve." Three linked defects (#61/#62/#63), one mission.

## What changed

- **Internal links resolve on the deployed site (#61/#63).** Glossary term
  links (autolink, `:term`, hover preview), Related/Audience/On-this-page
  cards, and hand-authored content links all now carry the site base and
  navigate to a real page — including the correct heading anchor for glossary
  terms, which previously doubled its id (`cargo-cargo`) and rendered the
  literal `{#cargo}` as visible text.
- **A new gate catches link breakage for real (#62).** `pnpm
  assert:no-broken-links` walks the built `example/dist`, resolves every
  internal link **as a URL** against the site base (matching a browser's
  trailing-slash directory routing), and fails the build on any link that
  would 404 — including a link that is merely missing its base prefix, which
  the on-disk `dist` layout would otherwise hide. It runs in CI right after
  the build, next to the existing artifact and redirect-coverage assertions.
  The pre-build `check-links.mjs` (`pnpm validate:links`) is also tightened
  for the site tree: a `.md`-relative or bare-relative internal content link
  now fails there too, with a hint toward the working root-absolute
  convention.
- **RSS/llms.txt/agent-API absolute URLs are now base-correct too (pre-PR
  review fold-in, #61/#62).** A completeness gap found before opening the PR:
  `rss.xml`'s `<link>`/`<guid>`/atom self-href, `llms.txt`'s page and
  machine-index URLs, and the agent-API JSON's `url`/`source` fields all
  emitted BASE-LESS absolute URLs (e.g. `.../guides/x/` instead of
  `.../doc-kitty/guides/x/`) even after the fixes above shipped. The shared
  `absolute()` URL composer (`src/lib/routes/shared.ts`) now routes through
  the same `withBase` helper every other seam uses, and `pnpm
  assert:no-broken-links --site <origin>` extends the gate to scan
  `rss.xml`, `llms.txt`, and every `api/**/*.json` file for a base-less
  internal absolute URL. The agent-API's base-less `route`/per-page-source
  path fields stay unchanged — only the derived absolute `url`/`source`
  fields carry the base.
- **Mutation-proven, not just asserted green.** Temporarily reverting the
  link-base fix and rebuilding reds the new gate with the exact page → href →
  reason for each broken link; restoring the fix greens it again on the same
  build.

## Why it matters

A link gate that reports success while links 404 is worse than no gate — it
actively hides the defect. This closes that gap for the three confirmed
classes (glossary anchors, component/authored base-less links, and the gate
itself) together, and the new built-output check makes the whole class of
"looks green, ships a 404" much harder to reintroduce. See
[ADR-0037](../adr/0037-base-aware-link-fail-closed-gate.md) for the full
rationale, including why the built-output gate — not the fast source gate —
is the authority on whether a link actually resolves. No dependency added,
upgraded, or removed.

---
title: "ADR-0039: One shared glossary link-node builder + aria-label term affordance"
description: Collapse the two byte-identical glossary link-node builders into one shared builder and add an aria-label so glossary terms are AT-perceivable.
doc_status: active
updated: 2026-09-06
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0025-glossary-on-this-page-block-and-remark-render-channel
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - context/convention
---

# ADR-0039: One shared glossary link-node builder + `aria-label` term affordance

## Status

**Accepted** — 2026-09-06. Delivered by the glossary a11y follow-up cluster
(issues #77/#79), filed from the #64 glossary-term-ux pre-PR adversarial squad.

## Context

`makeLinkNode` (`src/lib/remark/glossary-autolink.internal.ts`) and
`glossaryLinkNode` (`src/lib/remark/glossary-term.ts`) each built a
byte-identical `link` node — same `hProperties` bag, same href via the shared
`glossaryTermUrl` — as two independent, hand-authored functions kept in sync only
by discipline plus a live cross-emitter parity test. Any edit to the shape had to
land twice.

Separately (#77), a glossary term anchor was announced to assistive technology
identically to any ordinary link: the only cue that it names a glossary term was
the dotted underline and `help` cursor, both visual-only. A screen-reader user had
no way to tell a term link apart from a normal content link.

## Decision

1. **One shared builder.** Extract both emitters' bag into a single
   `glossaryLinkNode(context, contextSlug, anchor, termName, children, basePrefix)`
   in `src/lib/glossary/link-node.ts` — beside `glossaryTermUrl` in `resolve.ts`,
   the glossary bounded context's home for pure, framework-free logic. Both
   `makeLinkNode` (auto-linker) and `glossary-term.ts`'s call site now delegate to
   it; the auto-linker's only per-caller delta is wrapping its `surface: string`
   into `children = [{ type: 'text', value: surface }]`. No `@types/mdast`
   dependency was added — the shared builder uses the same hand-rolled structural
   node-type precedent (`diagram-meta.internal`, the two prior builders).

2. **`aria-label` as the affordance mechanism.** The shared builder sets
   `hProperties['aria-label'] = "<visible text>, glossary term"`, where visible
   text is the concatenated text of the link's `children` (mirroring the
   existing `textOf`/`textContent` helpers). This is an **attribute**, not an
   extra text child, so it:
   - is present in the server-rendered HTML (no-JS-safe);
   - never enters the `textContent`-based links-used surface or its count-pins
     (FR-005) — "On this page" keeps recording the plain visible text;
   - leads with the exact visible text, so the accessible name stays in sync
     with the visual/spoken name for voice control (NFR-005).

   Alternatives considered and rejected: a visually-hidden text child (would
   pollute the used-list's `textContent` scan) and `aria-roledescription`
   (patchier assistive-technology support than `aria-label`).

## Consequences

### Positive

- The two glossary link emitters can no longer drift in shape — one authored
  place, one parity test surface.
- Every glossary term anchor in the built corpus is now programmatically
  distinguishable from an ordinary link, non-visually, with no JavaScript.
- The corpus delta is exactly the new attribute: href, class, `data-glossary-*`,
  and DOM ordering are unchanged.

### Negative

- One more property in the `hProperties` bag for every consumer that pattern-
  matches on it (none currently do beyond equality/parity assertions).

### Risks

- A rich `:term[...]` label degrades to plain concatenated text in the
  `aria-label` — this mirrors how the used-list already derives its surface, so
  it is not a new risk class.

## Alternatives considered

### Option A: Keep two builders, add `aria-label` to each independently

Rejected: does nothing about the duplication risk and doubles the chance the two
literals drift on the very same edit that introduces the affordance.

### Option B: `aria-roledescription="glossary term"` instead of `aria-label`

Rejected: leaves the accessible name as the plain link text (losing the
explicit "glossary term" announcement in some AT/browser combinations) and has
patchier assistive-technology support than `aria-label`.

## References

- Decision `01M1V8ZYHJYYVGY438PB166WAX` (spec C-002).
- Contract: `kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/shared-link-node.md`.
- [ADR-0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md) —
  the links-used surface this affordance stays out of.
- [ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md) — the
  auto-linker / `:term` split this ADR's shared builder now sits under.

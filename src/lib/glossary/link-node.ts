/**
 * `glossaryLinkNode` — the ONE shared glossary link-node builder (issue #79,
 * contract `shared-link-node.md`; C-001/C-004, FR-003). Both the auto-linker
 * (`makeLinkNode` in `../remark/glossary-autolink.internal.ts`) and the `:term`
 * directive (`glossaryLinkNode` re-export in `../remark/glossary-term.ts`) MUST
 * delegate here — this is the single authored place for the `hProperties` bag and
 * the href (via {@link glossaryTermUrl}), so the two emitters can no longer drift.
 *
 * It also carries the AT-perceivable term affordance (issue #77, decision
 * `01M1V8ZYHJYYVGY438PB166WAX`, C-002): `hProperties['aria-label']` = the link's
 * visible text + `, glossary term`. It is an ATTRIBUTE only — never an extra
 * `text` child — so it never enters the {@link textOf}-based links-used surface
 * (FR-005) and the visible `children` the link renders are unchanged.
 *
 * Lives beside `glossaryTermUrl` (this module's sibling `resolve.ts`) — the
 * glossary bounded context's home for pure, framework-free logic (C-003).
 *
 * Deliberately hand-rolled structural types (no `@types/mdast` dependency, D3).
 * Assignability runs in BOTH directions, for two different reasons (issue #83).
 * Inbound — the callers' own local `MdNode` / `MdastNode` nodes flow into
 * {@link LinkChild} — is plain structural width: `LinkChild` asks only for
 * `type` (+ optional `value` / `children`), which those interfaces have, so
 * nothing special is needed. Outbound — the builder's return value flows
 * {@link GlossaryLinkNode} → `MdNode` / `MdastNode`, both of which declare
 * `[key: string]: unknown` — needs an index signature on the source type, and
 * `GlossaryLinkNode` gets one implicitly by being a `type` alias (an
 * `interface` would need an explicit one, at the cost of excess-property
 * checking here). Neither direction needs a cast, and neither needs a shared
 * runtime dependency — the `diagram-meta.internal` / pre-existing two-builder
 * precedent this extraction collapses.
 */
import { glossaryTermUrl } from './resolve.js';

/** A visible-label mdast node — enough to walk for its text content. */
export interface LinkChild {
  type: string;
  value?: string;
  children?: LinkChild[];
  [key: string]: unknown;
}

/** The `link` node shape both emitters return — minimal, structural (no `@types/mdast`).
 * A `type` alias, not an `interface`, on purpose (#83): TypeScript gives object-literal
 * type aliases an implicit string index signature, so the value is assignable to the
 * callers' local `MdNode` / `MdastNode` (which declare `[key: string]: unknown`) with no
 * cast — while, unlike an explicit index signature on an interface, the alias keeps
 * excess-property checking on this module's own `return {…}` literal. */
export type GlossaryLinkNode = {
  type: 'link';
  url: string;
  children: LinkChild[];
  data: { hProperties: Record<string, unknown> };
};

/**
 * THE subtree-text helper (issue #83) — the single authored place the glossary
 * derives a node's plain text. It feeds this builder's `aria-label` visible
 * text, the auto-linker's links-used surface and per-section already-linked
 * seed (`../remark/glossary-autolink.internal.ts`), and the `:term` directive's
 * label, warning strings, suppress form and fallback label
 * (`../remark/glossary-term.ts`), so the accessible name and the recorded
 * surface cannot drift apart (FR-001/FR-002). It replaced three equivalent
 * private copies; it is no longer a "mirror" of anything.
 *
 * Semantics: a `text` node is a LEAF whose `value` contributes only when it is
 * a string (otherwise `''` — not producible by real mdast); every other node
 * concatenates `textOf(child)` over its `children` in document order; a node
 * with neither yields `''` — including a node whose text lives only in
 * `data.hChildren` (e.g. the Markua `markuaSpan` leaf), which therefore
 * contributes nothing; that is a pre-existing blind spot shared by all three
 * former copies, recorded here rather than changed. The parameter is the
 * minimal structural {@link LinkChild}, so both callers pass their own
 * `MdNode` / `MdastNode` nodes with no cast.
 */
export function textOf(node: LinkChild): string {
  if (node.type === 'text') return typeof node.value === 'string' ? node.value : '';
  const children = node.children;
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

/**
 * Build the shared glossary link node: a `link` to
 * `glossaryTermUrl(basePrefix, contextSlug, anchor)` carrying the
 * `dk-glossary-link` class, the `data-glossary-*` markers the hover island and
 * the links-used tree-scan key on, and (new, #77) an `aria-label` leading with
 * the visible text (NFR-005) so a glossary term anchor is programmatically
 * distinguishable from an ordinary link. No `target`/`rel` — a term link
 * resolves to an internal glossary page, so it opens same-tab like any other
 * internal link (#64 FR-004).
 */
export function glossaryLinkNode(
  context: string,
  contextSlug: string,
  anchor: string,
  termName: string,
  children: LinkChild[],
  basePrefix: string,
): GlossaryLinkNode {
  const visibleText = children.map(textOf).join('');
  const hProperties: Record<string, unknown> = {
    class: 'dk-glossary-link',
    'data-glossary-term': termName,
    'data-glossary-context': context,
    'data-glossary-anchor': anchor,
    'data-glossary-context-slug': contextSlug,
  };
  // Attribute only — never a child node (FR-005). A resolved glossary link
  // always has a surface, so an empty (or whitespace-only, per spec Edge Cases)
  // `visibleText` is a defensive guard, not a normal path; when it occurs, omit
  // the attribute entirely rather than emit a dangling ", glossary term" with no
  // leading text.
  if (visibleText.trim().length > 0) {
    hProperties['aria-label'] = `${visibleText}, glossary term`;
  }

  return {
    type: 'link',
    url: glossaryTermUrl(basePrefix, contextSlug, anchor),
    children,
    data: { hProperties },
  };
}

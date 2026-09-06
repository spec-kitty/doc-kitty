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
 * `text` child — so it never enters the `textContent`-based links-used surface
 * (FR-005) and the visible `children` the link renders are unchanged.
 *
 * Lives beside `glossaryTermUrl` (this module's sibling `resolve.ts`) — the
 * glossary bounded context's home for pure, framework-free logic (C-003).
 *
 * Deliberately hand-rolled structural types (no `@types/mdast` dependency, D3):
 * the two callers' own local `MdNode`/`MdastNode` interfaces are structurally
 * assignable to {@link LinkChild} / {@link GlossaryLinkNode} without a shared
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

/** The `link` node shape both emitters return — minimal, structural (no `@types/mdast`). */
export interface GlossaryLinkNode {
  type: 'link';
  url: string;
  children: LinkChild[];
  data: {
    hProperties: Record<string, unknown>;
  };
}

/** Concatenated text of a node's subtree — mirrors the callers' own `textOf`/`textContent`. */
function textOf(node: LinkChild): string {
  if (node.type === 'text') return node.value ?? '';
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
  // always has a surface, so an empty `visibleText` is a defensive guard, not a
  // normal path; when it occurs, omit the attribute entirely rather than emit a
  // dangling ", glossary term" with no leading text (spec Edge Cases).
  if (visibleText.length > 0) {
    hProperties['aria-label'] = `${visibleText}, glossary term`;
  }

  return {
    type: 'link',
    url: glossaryTermUrl(basePrefix, contextSlug, anchor),
    children,
    data: { hProperties },
  };
}

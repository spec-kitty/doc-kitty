/**
 * `glossary-autolink.internal` — the pure, Astro-free core of the auto-linker
 * (ADR-0027 Decision 2, contract `autolink-and-term.md`; FR-005/006/007/009,
 * NFR-004/007). All the string/tree logic the remark wrapper needs lives here so
 * it can be exercised over hand-built mdast under vitest with no Astro, unified,
 * or vfile runtime.
 *
 * The one exported entry point is {@link computePageLinks}. It is the SINGLE
 * function two consumers share (D6, ADR-0025 Decision 2):
 *   - the build-time remark wrapper (`glossary-autolink.ts`), and
 *   - WP07's render-time "On this page" re-derive (`linksForBody` over
 *     `entry.body`),
 * so "links used" can never drift from "links inserted" — same pure function,
 * same `(tree, context, index)`. Because WP07 has no vfile, unresolved warnings
 * are surfaced through an OPTIONAL `onUnresolved` sink rather than a hard
 * `file.message` dependency: the wrapper passes one (→ `file.message`), WP07
 * omits it. The tree rewrite and the returned `linksUsed` are otherwise
 * deterministic (NFR-004).
 *
 * Resolution itself is NOT done here — every surface is handed to WP02's pure
 * `resolveSurface` (the one shared matcher). This module only walks the tree,
 * models sections, applies the ancestor + whole-word guards, rewrites eligible
 * text into link nodes, and collects the used-list.
 */
import { resolveSurface } from '../glossary/resolve.js';
import { glossaryLinkNode } from '../glossary/link-node.js';
import type { GlossaryLinkUsed, SharedTermIndex } from '../glossary/types.js';

/**
 * Minimal structural mdast node — enough to walk, guard, and rewrite without a
 * dependency on `@types/mdast`/`unist` (the `diagram-meta.internal` precedent).
 * The fields we actually touch are named; everything else rides along.
 */
export interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: {
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** The document root — a node whose `children` is the block sequence. */
export interface MdRoot extends MdNode {
  children: MdNode[];
}

/** Called once per DISTINCT unresolved surface per page (the warning sink). */
export type UnresolvedSink = (surface: string, competing: string[]) => void;

/** The attributes the hover island / used-list key on, on every glossary link. */
const TERM_ATTR = 'data-glossary-term';
const CONTEXT_ATTR = 'data-glossary-context';
/** The AUTHORITATIVE, de-collided anchor + context page-slug (issue #17), carried on
 * the node so `collectLinksUsed` and the "On this page" block READ them rather than
 * recomputing `slug(...)` (which cannot know about de-collision). */
const ANCHOR_ATTR = 'data-glossary-anchor';
const CONTEXT_SLUG_ATTR = 'data-glossary-context-slug';

/** Ancestor node types a rewrite must never descend into (FR-006). `dkMermaid`
 * (the diagram-meta remark pass's retyped mermaid code node, `config.ts`
 * `node.type = 'dkMermaid'`) is guarded defensively alongside `code`: it is a
 * leaf whose source lives in `data.hChildren` rather than mdast `children`, so
 * the walk never actually descends into it today — but naming it here closes
 * the gap by construction instead of relying on that incidental leaf shape. */
function isGuardType(type: string): boolean {
  return (
    type === 'code' ||
    type === 'inlineCode' ||
    type === 'heading' ||
    type === 'link' ||
    type === 'dkMermaid'
  );
}

/** True when `node` is a glossary link (auto-linked OR a `:term` node). */
function isGlossaryLink(node: MdNode): boolean {
  const hp = node.data?.hProperties;
  return (
    node.type === 'link' && hp !== undefined && typeof hp[TERM_ATTR] === 'string'
  );
}

/** Depth-first visit of every node, in document order. */
function visit(node: MdNode, fn: (node: MdNode) => void): void {
  fn(node);
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) visit(child, fn);
  }
}

/** Concatenated text of a node's subtree — a link node's visible surface. */
function textContent(node: MdNode): string {
  let out = '';
  visit(node, (n) => {
    if (n.type === 'text' && typeof n.value === 'string') out += n.value;
  });
  return out;
}

/**
 * FR-005 section model: an H2 begins a section; the body before the first H2 is
 * one implicit section; H3+ (and everything else) belong to the current H2
 * section. Returns the block sequence sliced into per-section block lists, in
 * document order. The implicit leading section is always present (possibly
 * empty when the document opens on an H2).
 */
export function partitionSections(children: readonly MdNode[]): MdNode[][] {
  const sections: MdNode[][] = [];
  let current: MdNode[] = [];
  for (const child of children) {
    if (child.type === 'heading' && child.depth === 2) {
      sections.push(current);
      current = [child];
    } else {
      current.push(child);
    }
  }
  sections.push(current);
  return sections;
}

/** Escape a surface for use as a literal inside a `RegExp`. */
function escapeRegExp(surface: string): string {
  return surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One combined whole-word, case-insensitive matcher over every known surface.
 * Longest surfaces first so a multi-word term wins over a single-word substring
 * of it. Boundaries are **Unicode** letter/number lookarounds (`\p{L}\p{N}`, `u`
 * flag), so "policyholder" never matches "policy" (FR-006) while "Cargo"/"cargo"
 * both do (case-insensitive) — and, unlike an ASCII-only class, a term abutting a
 * non-Latin letter (e.g. `Cargoで`, `caféCargo`) is correctly treated as inside a
 * word and left unlinked, while ASCII punctuation adjacency (`Cargo.`, `(Cargo)`)
 * still links. `undefined` when the index has no surfaces (nothing to match).
 */
function buildSurfaceRegExp(index: SharedTermIndex): RegExp | undefined {
  const surfaces = Array.from(index.bySurface.keys());
  if (surfaces.length === 0) return undefined;
  const alternation = surfaces
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * The shared link node both this plugin and `:term` (WP05) emit (FR-009), built by
 * the ONE shared builder ({@link glossaryLinkNode}, `../glossary/link-node.ts`,
 * issue #79) — the source of the shape lives there, including the `dk-glossary-link`
 * class (glossary-term-ux mission, #64, FR-001/FR-003), the absence of
 * `target`/`rel` (#64 FR-004), and the `aria-label` a11y affordance (#77). This
 * function only wraps the auto-linker's `surface: string` into the shared builder's
 * `children` shape — the one per-caller delta (contract `shared-link-node.md`).
 * The URL uses the context's de-collided page-SLUG (`contextSlug`) — the page
 * actually lives at `/glossary/<slug>/`, so a raw context name with spaces/caps/`&`
 * would 404 (issue #17 finding #5). `data-glossary-context` keeps the original NAME
 * (the hover payload keys on it). `basePrefix` (#61, C-001) is threaded from
 * `computePageLinks` through to the shared builder's `glossaryTermUrl` call, so this
 * and `:term`'s emitted href stay single-sourced.
 */
function makeLinkNode(
  context: string,
  contextSlug: string,
  anchor: string,
  termName: string,
  surface: string,
  basePrefix: string,
): MdNode {
  return glossaryLinkNode(
    context,
    contextSlug,
    anchor,
    termName,
    [{ type: 'text', value: surface }],
    basePrefix,
  ) as unknown as MdNode;
}

/** The per-page/per-section state threaded through the walk. */
interface Walk {
  readonly re: RegExp;
  readonly pageContext: string | undefined;
  readonly index: SharedTermIndex;
  readonly ignoreList: ReadonlySet<string>;
  readonly onUnresolved: UnresolvedSink | undefined;
  /** Surfaces already linked in the CURRENT section (lowercased). */
  linkedSurfaces: Set<string>;
  /** Surfaces already warned about on THIS PAGE (lowercased) — dedup NFR-007. */
  readonly warnedSurfaces: Set<string>;
  /** The site's already-normalized base prefix (#61, C-001); `''` when none. */
  readonly basePrefix: string;
}

/**
 * Rewrite one text node into a mix of text + link nodes for every eligible,
 * not-yet-linked surface it contains. Returns the ORIGINAL node untouched (same
 * identity) when nothing links, so a page with no matches is byte-identical.
 */
function expandTextNode(node: MdNode, w: Walk): MdNode[] {
  const value = node.value;
  if (typeof value !== 'string' || value.length === 0) return [node];

  const out: MdNode[] = [];
  let cursor = 0;
  let linked = false;
  w.re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = w.re.exec(value)) !== null) {
    const matched = m[0];
    const lower = matched.toLowerCase();
    // Already linked earlier in this section (incl. a pre-seeded `:term`): the
    // section's slot for this surface is taken — leave later occurrences plain.
    if (w.linkedSurfaces.has(lower)) continue;

    const res = resolveSurface(matched, w.pageContext, w.index, w.ignoreList);
    if (res.kind === 'link') {
      if (m.index > cursor) out.push({ type: 'text', value: value.slice(cursor, m.index) });
      out.push(
        makeLinkNode(res.context, res.contextSlug, res.anchor, res.termName, matched, w.basePrefix),
      );
      w.linkedSurfaces.add(lower);
      cursor = m.index + matched.length;
      linked = true;
    } else if (res.kind === 'unresolved') {
      // One greppable warning per distinct surface per page (NFR-007); the text
      // is left plain (INV-G3 — never guess on a collision).
      if (!w.warnedSurfaces.has(lower)) {
        w.warnedSurfaces.add(lower);
        w.onUnresolved?.(res.surface, res.competing);
      }
    }
    // `none` → leave plain.
  }

  if (!linked) return [node];
  if (cursor < value.length) out.push({ type: 'text', value: value.slice(cursor) });
  return out;
}

/**
 * Rewrite a node's children in place. `blocked` becomes true once any ancestor
 * is a guard type (code/inlineCode/heading/link), which stops us from linking —
 * or double-linking — inside those subtrees (FR-006; the `:term` link guard).
 */
function linkifyNode(node: MdNode, blocked: boolean, w: Walk): void {
  const children = node.children;
  if (!Array.isArray(children)) return;
  const out: MdNode[] = [];
  for (const child of children) {
    if (child.type === 'text' && !blocked) {
      out.push(...expandTextNode(child, w));
    } else {
      linkifyNode(child, blocked || isGuardType(child.type), w);
      out.push(child);
    }
  }
  node.children = out;
}

/**
 * Seed a section's already-linked set with the surfaces of any PRE-EXISTING
 * glossary links — the `:term` nodes WP05 produced (it runs first in the pinned
 * order). This is the WP04↔WP05 coupling: without it, a plain occurrence of the
 * same surface later in the section would be linked a second time (the ancestor
 * guard only stops rewriting *inside* the existing link).
 */
function seedFromExistingLinks(blocks: readonly MdNode[], linkedSurfaces: Set<string>): void {
  for (const block of blocks) {
    visit(block, (n) => {
      if (isGlossaryLink(n)) linkedSurfaces.add(textContent(n).toLowerCase());
    });
  }
}

/**
 * Collect the deduped, document-ordered used-list by scanning EVERY glossary
 * link in the final tree — both this plugin's auto-links and pre-existing
 * `:term` links (ADR-0025 Decision 2 / post-squad A-2: a bare resolver re-derive
 * would drop `:term`). Distinct by term within its context; the surface recorded
 * is the first-appearance one. `anchor` and `contextSlug` are READ from the node's
 * stored `data-glossary-anchor` / `data-glossary-context-slug` (issue #17) — the
 * authoritative de-collided values, never recomputed via `slug` (which cannot know
 * about de-collision, so a re-derive would drift from the heading id).
 */
export function collectLinksUsed(tree: MdNode): GlossaryLinkUsed[] {
  const seen = new Set<string>();
  const result: GlossaryLinkUsed[] = [];
  visit(tree, (node) => {
    if (!isGlossaryLink(node)) return;
    const hp = node.data!.hProperties!;
    const termName = String(hp[TERM_ATTR]);
    const context = String(hp[CONTEXT_ATTR] ?? '');
    const key = `${context} ${termName}`;
    if (seen.has(key)) return;
    seen.add(key);
    const anchor = String(hp[ANCHOR_ATTR] ?? '');
    const contextSlug = String(hp[CONTEXT_SLUG_ATTR] ?? '');
    result.push({ surface: textContent(node), context, contextSlug, anchor, termName });
  });
  return result;
}

/**
 * The stable, greppable unresolved-collision warning (NFR-007). Exact form:
 * `[glossary] unresolved collision "<name>" in <ctxA>, <ctxB> — left unlinked`.
 * `competing` arrives already deterministically sorted from the resolver.
 */
export function formatUnresolvedWarning(name: string, competing: readonly string[]): string {
  return `[glossary] unresolved collision "${name}" in ${competing.join(', ')} — left unlinked`;
}

/**
 * THE shared core (ADR-0027 Decision 2). Walk `tree`, model H2 sections, and for
 * the first eligible occurrence of each distinct surface per section, resolve it
 * via WP02 and rewrite it into a link node — leaving code/heading/link subtrees,
 * substrings-in-words, ignore-listed surfaces, and unresolved collisions plain.
 * Returns the (in-place mutated) `tree` and the deduped, ordered `linksUsed`
 * gathered from every glossary link — auto-linked and `:term` alike.
 *
 * `onUnresolved` (optional) is invoked once per distinct unresolved surface per
 * page; the wrapper wires it to `file.message`, WP07's re-derive omits it. This
 * function does NOT read frontmatter, touch Astro, or publish to any channel —
 * the wrapper owns the deck/opt-out/presence gates and the vfile.
 *
 * `basePrefix` (#61, C-001) is the site's already-normalized base, threaded from
 * `config.ts` via the build wrapper (`glossary-autolink.ts`) so every emitted link
 * node's `url` carries it (through the shared `glossaryTermUrl` builder). Defaults
 * to `''` (no base) — WP07's render-time re-derive (`OnThisPage.astro`) omits it
 * because it only reads `linksUsed`'s `contextSlug`/`anchor` (never the discarded
 * tree's `url`) to build its own base-aware href.
 */
export function computePageLinks(
  tree: MdRoot,
  pageContext: string | undefined,
  index: SharedTermIndex,
  ignoreList: ReadonlySet<string>,
  onUnresolved?: UnresolvedSink,
  basePrefix = '',
): { tree: MdRoot; linksUsed: GlossaryLinkUsed[] } {
  const re = buildSurfaceRegExp(index);
  if (re === undefined) {
    // No surfaces at all — nothing to link; still collect any `:term` links.
    return { tree, linksUsed: collectLinksUsed(tree) };
  }

  const warnedSurfaces = new Set<string>();
  const sections = partitionSections(tree.children);
  for (const blocks of sections) {
    const linkedSurfaces = new Set<string>();
    seedFromExistingLinks(blocks, linkedSurfaces);
    const w: Walk = {
      re,
      pageContext,
      index,
      ignoreList,
      onUnresolved,
      linkedSurfaces,
      warnedSurfaces,
      basePrefix,
    };
    for (const block of blocks) {
      linkifyNode(block, isGuardType(block.type), w);
    }
  }

  return { tree, linksUsed: collectLinksUsed(tree) };
}

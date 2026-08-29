/**
 * `markuaTocDemote` — the ToC heading-exclusion demotion pass (FR-001, US1 sc.2;
 * WCAG 2.2 AA preserved, NFR-004). It is the mission's **second bounded spike**:
 * there is no native hook to keep an in-aside heading out of the on-this-page
 * nav, so this doc-kitty **user rehype pass** demotes any ATX heading that lives
 * inside a callout/aside container to a NON-heading element that still carries
 * the heading role.
 *
 * For a heading inside a matched container:
 *
 * ```html
 * <!-- before -->  <aside class="dk-callout …"><h3 id="tips">Tips</h3></aside>
 * <!-- after  -->  <aside class="dk-callout …"><p role="heading" aria-level="3" id="tips">Tips</p></aside>
 * ```
 *
 * - The `<h_n>` element becomes a `<p>` carrying `role="heading"` and
 *   `aria-level="{n}"` — assistive tech still announces it as a heading at the
 *   original level (the document outline stays intact), but the collector below
 *   no longer sees an `h_n` and omits it from the visual ToC.
 * - The heading's `children` (text/inline) and any explicit `id` are preserved
 *   (do not strip an anchor the author set, FR-008).
 * - Headings OUTSIDE any callout/aside container are UNTOUCHED — they keep their
 *   normal ToC + auto-id behaviour (FR-008).
 *
 * ── Ordering (load-bearing) ──────────────────────────────────────────────────
 * This MUST run BEFORE `rehypeHeadingIds` / `rehypeCollectHeadings`. Astro's
 * fixed rehype order places USER rehype plugins before `rehypeImages` →
 * `rehypeHeadingIds`, so registering this as a user rehype plugin (WP08) puts it
 * ahead of collection naturally. The collector is purely `tagName`-keyed —
 * verified against `@astrojs/markdown-remark@6.3.11`'s `rehype-collect-headings.js`,
 * whose `rehypeHeadingIds` does `if (tagName[0] !== "h") return;` and only then
 * `headings.push(...)`. So once the element is a `<p>`, it is skipped by
 * collection entirely and the `role`/`aria-level` attributes are ignored by the
 * collector (they matter only to assistive tech). A demotion that ran AFTER
 * collection would be a vacuous pass — the heading would still show in the ToC.
 * WP08 registers this in the user-rehype stage; a future reorder that moves it
 * after `rehypeHeadingIds` reintroduces the exact bug this pass guards.
 *
 * ── Matched containers ───────────────────────────────────────────────────────
 * A "callout/aside container" is any element carrying one of these classes
 * (grounded against Starlight 0.32.6 and WP04/WP05 output):
 *   - `starlight-aside`  — Starlight native aside (`remarkAsides` emits
 *                          `<aside class="starlight-aside starlight-aside--{variant}">`).
 *   - `dk-callout`       — doc-kitty theme callout (WP04 emits
 *                          `<aside class="dk-callout dk-callout--{variant}">`;
 *                          styled by WP05).
 * A wrong selector silently demotes nothing (or demotes real page headings), so
 * the set is small, explicit, and named against the emitters above.
 *
 * ── Spike disposition ────────────────────────────────────────────────────────
 * Demotion is the RATIFIED default (it preserves author-written headings). This
 * WP owns the unit-level proof (node shape + that the collector is tagName-keyed);
 * the INTEGRATION proof — a real build where the ToC genuinely omits the heading
 * while the outline stays intact — is deferred to WP10's a11y lane. Fallback (a
 * documented author limit surfaced in WP11): if WP10 shows demotion cannot
 * precede collection in the real pipeline, restrict aside/callout bodies to
 * non-ATX-heading content. Adopt the fallback ONLY on that evidence.
 *
 * Standalone: registered by nobody in this work package (WP08 wires it), so the
 * built corpus is byte-identical until then — this pass is DORMANT until wired.
 */

/** Minimal structural hast node — enough to find/demote in-container headings. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
  [key: string]: unknown;
}

/**
 * Classes that mark a callout/aside container. Matching ANY of these on an
 * element treats its whole subtree as "inside a callout/aside" for demotion.
 */
const CONTAINER_CLASSES = new Set(['starlight-aside', 'dk-callout']);

/** Read the hast `className` (array or string form) as a list of tokens. */
function classList(node: HastNode): string[] {
  const raw = node.properties?.className;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
  return [];
}

/** True when the element carries a callout/aside container class. */
function isContainer(node: HastNode): boolean {
  if (node.type !== 'element') return false;
  return classList(node).some((cls) => CONTAINER_CLASSES.has(cls));
}

/**
 * The ATX heading level for an `<h1>`…`<h6>` element, or `undefined` for any
 * other node. Keyed on `tagName` exactly as the downstream collector is, so the
 * two passes agree on what "a heading" is.
 */
function headingLevel(node: HastNode): number | undefined {
  if (node.type !== 'element' || typeof node.tagName !== 'string') return undefined;
  const match = /^h([1-6])$/.exec(node.tagName);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * Demote an in-container heading node IN PLACE: `<h_n>` → `<p role="heading"
 * aria-level="{n}">`, preserving its children and any existing `id`. Mutating
 * the node (rather than replacing it in the parent) keeps its document position
 * and identity; only `tagName` and the role/level attributes change.
 */
function demote(node: HastNode, level: number): void {
  node.tagName = 'p';
  const properties = { ...(node.properties ?? {}) };
  properties.role = 'heading';
  properties['aria-level'] = level;
  node.properties = properties;
}

/**
 * Rehype plugin factory. Returns the transformer Astro runs over each page's
 * hast; assignable to Astro's `RehypePlugin` (a unified `Plugin<[], Root>`).
 *
 * Walks the tree tracking whether the current subtree is inside a matched
 * container. Once inside a container, every descendant `<h1>`…`<h6>` is demoted
 * (a nested container inside a callout stays "inside", so its heading is demoted
 * once, correctly). Outside every container, headings are left untouched.
 */
export default function markuaTocDemote() {
  return function transformer(tree: HastNode): void {
    const walk = (node: HastNode, inContainer: boolean): void => {
      const insideNow = inContainer || isContainer(node);

      if (insideNow) {
        const level = headingLevel(node);
        if (level !== undefined) demote(node, level);
      }

      const children = node.children;
      if (!Array.isArray(children)) return;
      for (const child of children) {
        walk(child, insideNow);
      }
    };

    walk(tree, false);
  };
}

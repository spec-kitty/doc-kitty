/**
 * review-cycle-1 Fix A (WP01 FR-004/SC-002) — the rehype plugin that
 * base-prefixes authored, root-absolute internal markdown links.
 *
 * Pre-fix, `example/docs/**` authored internal links were re-written to a
 * `.md`-relative form (`./target.md`) on the (wrong) assumption Astro rewrites
 * those — it does not, so they 404'd verbatim in the built site. This plugin
 * replaces that approach: authored links stay root-absolute
 * (`/architecture/overview/`) and this rehype pass base-prefixes them at the
 * rendered-HTML seam, mirroring `withBase`'s component-side classification
 * rules exactly (same scheme/protocol-relative/anchor/relative passthroughs).
 *
 * `prefixIfRootAbsolute` is exercised directly (pure, no hast needed) and the
 * default export is proven end-to-end over a small hast tree, including the
 * idempotent (already-prefixed) and no-base-configured no-op cases.
 */
import { describe, it, expect } from 'vitest';
import baseAbsoluteLinks, {
  prefixIfRootAbsolute,
} from '../lib/rehype/base-absolute-links.js';

const BASE = '/doc-kitty';

describe('prefixIfRootAbsolute — classification matrix', () => {
  it('prefixes a root-absolute internal href with the configured base', () => {
    expect(prefixIfRootAbsolute('/architecture/overview/', BASE)).toBe(
      '/doc-kitty/architecture/overview/',
    );
  });

  it('is a no-op with no base configured', () => {
    expect(prefixIfRootAbsolute('/architecture/overview/', '')).toBeUndefined();
  });

  it('is idempotent — an already-prefixed href is left alone (no double-prefix)', () => {
    expect(prefixIfRootAbsolute('/doc-kitty/architecture/overview/', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('/doc-kitty', BASE)).toBeUndefined();
  });

  it('skips external, mailto, tel, and protocol-relative hrefs', () => {
    expect(prefixIfRootAbsolute('https://example.com/x', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('http://example.com', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('mailto:a@b.test', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('tel:+15551234567', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('//cdn.example.com/x', BASE)).toBeUndefined();
  });

  it('skips anchor-only hrefs', () => {
    expect(prefixIfRootAbsolute('#section', BASE)).toBeUndefined();
  });

  it('skips already-relative hrefs (left to the browser/Astro)', () => {
    expect(prefixIfRootAbsolute('./sibling.md', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('../parent/', BASE)).toBeUndefined();
    expect(prefixIfRootAbsolute('sibling.md', BASE)).toBeUndefined();
  });

  it('skips the empty string', () => {
    expect(prefixIfRootAbsolute('', BASE)).toBeUndefined();
  });
});

describe('baseAbsoluteLinks (rehype plugin) — end-to-end over a hast tree', () => {
  interface HastNode {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
  }

  function anchor(href: string): HastNode {
    return { type: 'element', tagName: 'a', properties: { href }, children: [] };
  }

  function treeOf(...anchors: HastNode[]): HastNode {
    return {
      type: 'root',
      children: [{ type: 'element', tagName: 'p', properties: {}, children: anchors }],
    };
  }

  /** Read the href off the anchor nested two levels down (root -> p -> a). */
  function hrefOf(tree: HastNode): string {
    const paragraph = tree.children![0] as HastNode;
    const anchorNode = paragraph.children![0] as HastNode;
    return String(anchorNode.properties!.href);
  }

  it('base-prefixes a root-absolute authored content link (the #61-class bug this fixes)', () => {
    const tree = treeOf(anchor('/architecture/overview/'));
    baseAbsoluteLinks({ base: BASE })(tree);
    expect(hrefOf(tree)).toBe('/doc-kitty/architecture/overview/');
  });

  it('leaves external, anchor-only, and already-relative hrefs untouched', () => {
    const tree = {
      type: 'root',
      children: [
        anchor('https://example.com/x'),
        anchor('#note'),
        anchor('./sibling.md'),
      ],
    };
    baseAbsoluteLinks({ base: BASE })(tree);
    expect((tree.children[0].properties as { href: string }).href).toBe('https://example.com/x');
    expect((tree.children[1].properties as { href: string }).href).toBe('#note');
    expect((tree.children[2].properties as { href: string }).href).toBe('./sibling.md');
  });

  it('does not double-prefix an href that already carries the base', () => {
    const tree = treeOf(anchor('/doc-kitty/architecture/overview/'));
    baseAbsoluteLinks({ base: BASE })(tree);
    expect(hrefOf(tree)).toBe('/doc-kitty/architecture/overview/');
  });

  it('is a strict no-op with no base option supplied (byte-identical corpus)', () => {
    const tree = treeOf(anchor('/architecture/overview/'));
    baseAbsoluteLinks()(tree);
    expect(hrefOf(tree)).toBe('/architecture/overview/');
  });
});

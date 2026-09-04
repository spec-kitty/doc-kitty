/**
 * WP01 — internal links resolve (#61/#63; FR-001/002/003, NFR-001/002).
 * Red-first proof for the shared seams this WP introduces:
 *
 *  1. `withBase` (T003, C-002) — the ONE component base-prefix helper. Pre-fix,
 *     no such helper existed and every component built a raw `/…` href.
 *  2. `glossaryTermUrl` (T001, C-001) — the ONE base-aware glossary term-URL
 *     builder. Pre-fix, the autolinker and `:term` each hand-built
 *     `/glossary/<slug>/#<anchor>` with NO base (#61) — two clones, both
 *     base-less.
 *  3. The autolinker and `:term` emit the identical href the shared builder
 *     produces (NFR-002 — no cloned base logic).
 *  4. The generated glossary heading's REAL id (after the attribute-list
 *     pipeline runs) matches the anchor the shared builder targets (#63).
 *     Pre-fix, `generate.ts` emitted the inline `## name {#anchor}` form, which
 *     this toolkit's block-form-only attribute plugin never consumes — the
 *     slugger doubled the id (`cargo-cargo`) and the literal `{#cargo}`
 *     rendered as visible text, so this assertion failed on both counts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

import { withBase } from '../lib/with-base.js';
import { glossaryTermUrl } from '../lib/glossary/resolve.js';
import { generateGlossaryPages } from '../lib/glossary/generate.js';
import {
  buildIndex,
  parseAndValidate,
  parseDefinitionsYaml,
} from '../lib/glossary/load.internal.js';
import markuaAttributes from '../lib/remark/markua-attributes.js';
import glossaryTerm from '../lib/remark/glossary-term.js';
import glossaryAutolink from '../lib/remark/glossary-autolink.js';
import {
  computePageLinks,
  type MdNode,
  type MdRoot,
} from '../lib/remark/glossary-autolink.internal.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// mdast constructors (mirrors glossary-autolink.test.ts's local helpers).
// ---------------------------------------------------------------------------
const text = (value: string): MdNode => ({ type: 'text', value });
const para = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children });
const root = (...children: MdNode[]): MdRoot => ({ type: 'root', children });

// ===========================================================================
// 1. `withBase` — the ONE component base-prefix helper (T003, C-002)
// ===========================================================================
describe('withBase', () => {
  it('leaves an in-site path untouched with no base configured', () => {
    expect(withBase('/architecture/overview/')).toBe('/architecture/overview/');
  });

  it('prefixes an in-site root-absolute path with the configured base (#61)', () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    expect(withBase('/architecture/overview/')).toBe('/doc-kitty/architecture/overview/');
    expect(withBase('/')).toBe('/doc-kitty/');
  });

  it('is idempotent — a path already carrying the base is left alone (no double-prefix)', () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    expect(withBase('/doc-kitty/architecture/overview/')).toBe(
      '/doc-kitty/architecture/overview/',
    );
    expect(withBase('/doc-kitty')).toBe('/doc-kitty');
  });

  it('leaves external, mailto, protocol-relative, and anchor-only links untouched', () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    expect(withBase('https://example.com/x')).toBe('https://example.com/x');
    expect(withBase('mailto:a@b.test')).toBe('mailto:a@b.test');
    expect(withBase('//cdn.example.com/x')).toBe('//cdn.example.com/x');
    expect(withBase('#section')).toBe('#section');
  });

  it('leaves an already-relative path untouched — Astro resolves it itself', () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    expect(withBase('./target.md')).toBe('./target.md');
    expect(withBase('target.md')).toBe('target.md');
  });

  it('normalizes a base missing/carrying extra slashes identically', () => {
    vi.stubEnv('BASE_URL', 'doc-kitty//');
    expect(withBase('/guides/getting-started/')).toBe('/doc-kitty/guides/getting-started/');
  });
});

// ===========================================================================
// 2. `glossaryTermUrl` — the ONE base-aware glossary term-URL builder (T001, C-001)
// ===========================================================================
describe('glossaryTermUrl', () => {
  it('builds a no-base href when basePrefix is empty (unchanged pre-fix shape)', () => {
    expect(glossaryTermUrl('', 'shipping', 'cargo')).toBe('/glossary/shipping/#cargo');
  });

  it('builds a base-prefixed href (#61) — the pre-fix builders never carried the base', () => {
    expect(glossaryTermUrl('/doc-kitty', 'shipping', 'cargo')).toBe(
      '/doc-kitty/glossary/shipping/#cargo',
    );
  });
});

// ===========================================================================
// 3. The autolinker and `:term` share the SAME base-aware builder (NFR-002)
// ===========================================================================
describe('the autolinker and `:term` emit the SAME base-prefixed href (NFR-002)', () => {
  const BASE = '/doc-kitty';
  const index: SharedTermIndex = {
    bySurface: new Map([
      ['cargo', [{ context: 'Shipping', contextSlug: 'shipping', anchor: 'cargo', termName: 'Cargo' }]],
    ]),
    contexts: new Map(),
  };

  it('computePageLinks (the autolinker core) threads basePrefix into the emitted href', () => {
    const tree = root(para(text('See Cargo for details.')));
    const { tree: linked } = computePageLinks(tree, undefined, index, new Set(), undefined, BASE);
    const link = (linked.children[0].children as MdNode[]).find((n) => n.type === 'link');
    expect(link).toBeDefined();
    expect(link?.url).toBe(glossaryTermUrl(BASE, 'shipping', 'cargo'));
    expect(link?.url).toBe('/doc-kitty/glossary/shipping/#cargo');
  });

  it('the glossaryAutolink build wrapper threads its `base` option the same way', () => {
    const tree = root(para(text('See Cargo for details.')));
    const file = { message: () => undefined };
    (glossaryAutolink({ index, base: BASE }) as (t: MdRoot, f: typeof file) => void)(tree, file);
    const link = (tree.children[0].children as MdNode[]).find((n) => n.type === 'link');
    expect(link?.url).toBe('/doc-kitty/glossary/shipping/#cargo');
  });

  it(':term emits the IDENTICAL base-prefixed href as the autolinker for the same term', () => {
    const directive: MdNode = {
      type: 'textDirective',
      name: 'term',
      attributes: { context: 'Shipping' },
      children: [text('Cargo')],
    };
    const tree = root(para(directive));
    const file = { message: () => undefined };
    (glossaryTerm({ index, base: BASE }) as (t: MdRoot, f: typeof file) => void)(tree, file);
    const node = (tree.children[0].children as MdNode[])[0];
    expect(node.url).toBe(glossaryTermUrl(BASE, 'shipping', 'cargo'));
    expect(node.url).toBe('/doc-kitty/glossary/shipping/#cargo');
  });

  it('with no `base` option, both stay byte-identical to the pre-fix no-base shape', () => {
    const autolinkTree = root(para(text('See Cargo for details.')));
    const { tree: linked } = computePageLinks(autolinkTree, undefined, index, new Set());
    const link = (linked.children[0].children as MdNode[]).find((n) => n.type === 'link');
    expect(link?.url).toBe('/glossary/shipping/#cargo');

    const directive: MdNode = {
      type: 'textDirective',
      name: 'term',
      attributes: { context: 'Shipping' },
      children: [text('Cargo')],
    };
    const termTree = root(para(directive));
    const file = { message: () => undefined };
    (glossaryTerm({ index }) as (t: MdRoot, f: typeof file) => void)(termTree, file);
    const node = (termTree.children[0].children as MdNode[])[0];
    expect(node.url).toBe('/glossary/shipping/#cargo');
  });
});

// ===========================================================================
// 4. Generated glossary anchors resolve end-to-end (#63)
// ===========================================================================
describe('generated glossary anchors resolve (#63)', () => {
  const YAML = `contexts:
  - name: Shipping
    terms:
      - name: Cargo
        definition: Goods carried by a vessel.
`;

  /** Codegen the one-term Shipping context page into a throwaway temp dir. */
  function generatedShippingPage(): string {
    const index = buildIndex(parseAndValidate(parseDefinitionsYaml(YAML)));
    const out = mkdtempSync(join(tmpdir(), 'dk-link-integrity-'));
    try {
      generateGlossaryPages(index, out);
      return readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }

  it('emits the BLOCK-form attribute line, never the inline `## name {#anchor}` form', () => {
    const page = generatedShippingPage();
    expect(page).toContain('{#cargo}\n\n## Cargo');
    // The inline form this toolkit's block-form-only plugin never consumed (#63).
    expect(page).not.toMatch(/##\s*Cargo\s*\{#/);
  });

  it("the heading's REAL id (after the attribute-list pipeline runs) equals the anchor the shared URL builder targets", () => {
    const page = generatedShippingPage();
    // Strip the frontmatter block, leaving just the markdown body.
    const body = page.replace(/^---\n[\s\S]*?\n---\n\n/, '');

    interface HastNode {
      type: string;
      children?: HastNode[];
      data?: { hProperties?: Record<string, unknown> };
    }
    const proc = unified().use(remarkParse).use(remarkGfm);
    const tree = proc.runSync(proc.parse(body)) as unknown as { children: HastNode[] };
    markuaAttributes()(tree as never);

    const heading = tree.children.find((n) => n.type === 'heading' && !!n.data?.hProperties?.id);
    expect(heading).toBeDefined();
    const id = heading?.data?.hProperties?.id;
    expect(id).toBe('cargo');
    // No literal `{#…}` attribute-list paragraph survives in the processed tree.
    expect(tree.children.some((n) => n.type === 'paragraph')).toBe(true); // the definition itself
    const attrLeftover = JSON.stringify(tree).includes('{#cargo}');
    expect(attrLeftover).toBe(false);

    // The shared builder's href must target this SAME id.
    const href = glossaryTermUrl('/doc-kitty', 'shipping', String(id));
    expect(href).toBe('/doc-kitty/glossary/shipping/#cargo');
    expect(href.endsWith(`#${id}`)).toBe(true);
  });
});

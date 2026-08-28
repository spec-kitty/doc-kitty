import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Coverage for the sitemap draft filter's NEW `feeds` gate (composed on top of the
 * existing draft gate). `config.ts` statically imports `@astrojs/starlight`; the
 * config-invariants suite mocks it, and we do the same so importing the module is
 * side-effect-free (we only exercise the exported `sitemapDraftFilter`, never the
 * full integrations array).
 */
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

const { sitemapDraftFilter } = await import('../lib/config.js');

/** Write a docs tree (content .md files + optional sections.yaml) under a temp root. */
function makeDocs(
  files: Record<string, string>,
  registryYaml?: string,
): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-sitemap-feeds-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body, 'utf8');
  }
  if (registryYaml !== undefined) {
    mkdirSync(path.join(root, '_meta'), { recursive: true });
    writeFileSync(path.join(root, '_meta', 'sections.yaml'), registryYaml, 'utf8');
  }
  return root;
}

const active = (title: string): string =>
  `---\ntitle: ${title}\ndoc_status: active\n---\n\n# ${title}\n`;
const draft = (title: string): string =>
  `---\ntitle: ${title}\ndoc_status: draft\n---\n\n# ${title}\n`;

const CONTENT = {
  'context/README.md': active('Context'),
  'context/draft.md': draft('A Draft'),
  'presentations/deck.md': active('A Deck'),
  'guides/start.md': active('Start'),
};

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('sitemapDraftFilter — draft gate + section `feeds` gate', () => {
  let root: string;
  let keep: (page: string) => boolean;

  beforeAll(() => {
    // presentations feeds [llms, agent] (NOT sitemap); guides OMITS feeds (all).
    const registry = `version: 1
sections:
  - id: context
    label: Context
    order: 10
    feeds: [sitemap, rss, llms, agent]
  - id: presentations
    label: Presentations
    order: 20
    feeds: [llms, agent]
  - id: guides
    label: Guides
    order: 30
`;
    root = makeDocs(CONTENT, registry);
    roots.push(root);
    keep = sitemapDraftFilter(root, '/');
  });

  it('keeps a published page whose section feeds sitemap', () => {
    expect(keep('https://site.test/context/')).toBe(true);
  });

  it('keeps a page in an absent-feeds section (absent = all feeds sitemap)', () => {
    expect(keep('https://site.test/guides/start/')).toBe(true);
  });

  it('keeps the site root (section "" → absent = all)', () => {
    expect(keep('https://site.test/')).toBe(true);
  });

  it('drops a page whose section does not feed sitemap', () => {
    expect(keep('https://site.test/presentations/deck/')).toBe(false);
  });

  it('still drops a draft even though its section feeds sitemap', () => {
    expect(keep('https://site.test/context/draft/')).toBe(false);
  });
});

describe('sitemapDraftFilter — absent registry / no-feeds registry are INERT', () => {
  it('applies NO feeds filtering when there is no sections.yaml (only drafts drop)', () => {
    const root = makeDocs(CONTENT); // no registry
    roots.push(root);
    const keep = sitemapDraftFilter(root, '/');
    // Byte-compatible with the pre-feeds sitemap: every published page is kept,
    // the draft is dropped.
    expect(keep('https://site.test/presentations/deck/')).toBe(true);
    expect(keep('https://site.test/guides/start/')).toBe(true);
    expect(keep('https://site.test/context/draft/')).toBe(false);
  });

  it('is inert when the registry declares NO feeds on any section (the example-corpus case)', () => {
    const registry = `version: 1
sections:
  - id: context
    label: Context
    order: 10
  - id: presentations
    label: Presentations
    order: 20
  - id: guides
    label: Guides
    order: 30
`;
    const root = makeDocs(CONTENT, registry);
    roots.push(root);
    const keep = sitemapDraftFilter(root, '/');
    // No section declares feeds → absent = all → nothing is dropped by the feeds
    // gate (this is the guarantee that the example build loses no page).
    expect(keep('https://site.test/context/')).toBe(true);
    expect(keep('https://site.test/presentations/deck/')).toBe(true);
    expect(keep('https://site.test/guides/start/')).toBe(true);
    expect(keep('https://site.test/context/draft/')).toBe(false);
  });
});

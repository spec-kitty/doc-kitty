/**
 * The evidence index's opt-in hub page (WP07 T030, #401, FR-010): a Markdown
 * Hub rendered from the built index, stamped by `doc-kitty-tom-annex` with the
 * ADR-0087 stamp, dated from the index and never the clock.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTomAnnex, TOM_ANNEX_COUNSEL, TOM_ANNEX_LABEL, TOM_ANNEX_NOTICE } from '../lib/tom-annex/core.mjs';
import { pageContentHash, renderHubPage } from '../lib/tom-annex/hub-page.mjs';
import { stampAnnex } from '../lib/tom-annex/stamp.mjs';
import { canonical, catalog, classified, graph, measureNode, page, record } from './fixtures/tom-annex/graph.mjs';

const SITE = new URL('https://docs.example.org');
const INPUTS = [{ key: 'docs/a.md', sha256: 'a'.repeat(64) }];
const stamped = (g: unknown, c: unknown) =>
  stampAnnex(buildTomAnnex(g as never, c as never, { site: SITE, base: '/docs/' }), { inputs: INPUTS });
const { graph: g0, catalog: c0 } = canonical();
const annex = stamped(g0, c0);
const hub = renderHubPage(annex);
const { data, content } = matter(hub);

describe('pageContentHash follows ADR-0087 D2 for Markdown', () => {
  it('reproduces the ADR worked example', () => {
    const text = [
      '---',
      'title: "Ship an order"',
      'generated:',
      '  by: "doc-kitty-gherkin/0.8.0"',
      '  at: "2026-11-23T09:30:00Z"',
      '  source_digest: "sha256:…"',
      '  content_hash: "sha256:…"',
      'kind: Reference',
      '---',
      '',
      '# Ship an order',
      '',
    ].join('\n');
    expect(pageContentHash(text)).toBe('sha256:3ebe501730db');
  });

  it('normalises CRLF line endings before hashing (review cycle 1, R4)', () => {
    const lf = '---\ntitle: "x"\ngenerated:\n  by: "y"\n---\n\n# X\n';
    expect(pageContentHash(lf.replace(/\n/g, '\r\n'))).toBe(pageContentHash(lf));
  });

  it('only strips the generated block in the frontmatter, not a body line that looks like one', () => {
    const body = '---\ntitle: "x"\n---\n\ngenerated:\n  by: "y"\n';
    const expected = `sha256:${createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 12)}`;
    expect(pageContentHash(body)).toBe(expected);
  });
});

describe('renderHubPage (WP07 T030)', () => {
  it('renders the canonical fixture exactly as the golden page (by masked to <version>)', () => {
    const golden = readFileSync(new URL('./fixtures/tom-annex/hub.golden.md', import.meta.url), 'utf8');
    expect(hub.replace(/"doc-kitty-tom-annex\/[^"]+"/, '"doc-kitty-tom-annex/<version>"')).toBe(golden);
  });

  it('writes frontmatter that meets the metadata contract, dated from the index', () => {
    expect(data.title).toBe('Evidence index (technical and organisational measures)');
    expect(data.description).toContain(TOM_ANNEX_LABEL);
    expect(data.doc_status).toBe('active');
    expect(data.type).toBe('Reference');
    expect(data.kind).toBe('Hub');
    expect(new Date(data.updated).toISOString().replace('.000', '')).toBe(annex.generated.at);
    expect(data).not.toHaveProperty('tom_classification');
  });

  it('stamps it as doc-kitty-tom-annex, copying by, at and source_digest, with content_hash over the page', () => {
    expect(data.generated).toEqual({
      by: annex.generated.by,
      at: annex.generated.at,
      source_digest: annex.generated.source_digest,
      content_hash: pageContentHash(hub),
    });
    expect(hub).toMatch(/\ngenerated:\n {2}by: ".+"\n {2}at: ".+"\n {2}source_digest: ".+"\n {2}content_hash: ".+"\n/);
  });

  it('opens with a caution block carrying the label, the notice and every ⚖ item', () => {
    expect(content).toMatch(/> \[!CAUTION\]/);
    expect(content).toContain(TOM_ANNEX_LABEL);
    expect(content).toContain(TOM_ANNEX_NOTICE.replace(/'/g, "'"));
    for (const item of TOM_ANNEX_COUNSEL) expect(content).toContain(item);
  });

  it('groups measures by nature in the fixed order, then by scope, with evidence links and notes', () => {
    const headings = content.split('\n').filter((l: string) => l.startsWith('## ') || l.startsWith('### '));
    expect(headings).toEqual([
      '## Technical measures',
      '### System',
      '## Organisational measures',
      '### Organisation',
      '## Uncovered measures',
    ]);
    expect(content).toContain('[Audit logging](https://docs.example.org/docs/architecture/audit-logging/): Audit events are kept for 13 months.');
    expect(content).toContain('ISO27001 A.14');
  });

  it('omits a nature with no measure and lists uncovered measures', () => {
    expect(content).not.toMatch(/## (Legal|Physical) measures/);
    expect(content).toMatch(/## Uncovered measures[\s\S]*\*\*Label backup\*\* \(`backup`\), technical/);
  });

  it('escapes Markdown in labels and notes, and collapses whitespace', () => {
    const g = graph(
      [page('p', { title: 'A [tricky] *title*', updated: '2026-01-01T00:00:00Z' }), measureNode(record('m', { label: 'Use_snake & <tags>' }))],
      [classified('p', 'm', { note: 'line one\n\tline `two`' })],
    );
    const text = renderHubPage(stamped(g, catalog([record('m', { label: 'Use_snake & <tags>' })])));
    expect(text).toContain('**Use\\_snake & \\<tags\\>**');
    expect(text).toContain('[A \\[tricky\\] \\*title\\*]');
    expect(text).toContain(': line one line \\`two\\`');
  });

  it('encodes spaces and parentheses in link destinations (review cycle 1, R5)', () => {
    const g = graph(
      [page('p', { href: '/a b (c)/', updated: '2026-01-01T00:00:00Z' }), measureNode(record('m'))],
      [classified('p', 'm')],
    );
    const text = renderHubPage(stamped(g, catalog([record('m')])));
    expect(text).toMatch(/\]\(https:\/\/docs\.example\.org\/docs\/a%20b%20%28c%29\/\)/);
    // A backslash would escape the next character in a Markdown destination (R24, WP07 cycle 2 finding 3).
    const slashed = renderHubPage({
      ...annex,
      scopes: { ...annex.scopes, system: [{ ...annex.scopes.system[0], evidence: [{ ...annex.scopes.system[0].evidence[0], url: 'https://x.test/a\\b/' }] }] },
    });
    expect(slashed).toContain('](https://x.test/a%5Cb/)');
  });

  it('never reads the clock, and refuses an index without an instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
    const first = renderHubPage(annex);
    vi.setSystemTime(new Date('2044-01-01T00:00:00Z'));
    expect(renderHubPage(annex)).toBe(first);
    expect(first).not.toMatch(/2031|2044/);
    vi.useRealTimers();
    expect(() => renderHubPage({ ...annex, generated: { ...annex.generated, at: null } })).toThrow(/\[dk-tom-annex\].*date/);
  });
});

afterEach(() => vi.useRealTimers());

/**
 * Per-page Atom entry builder and eligibility (page-chrome WP08, FR-020). Pure:
 * `page-atom.ts` imports `astro:content`, which does not resolve under bare vitest.
 */
import { describe, expect, it, vi } from 'vitest';
import type { DocKittyFrontmatter } from '../lib/metadata.js';

vi.mock('astro:content', () => ({ getCollection: async () => [] }));

const { buildAtomEntry } = await import('../lib/routes/page-atom.js');
const { xmlEscape } = await import('../lib/routes/shared.js');
const { atomEligible } = await import('../lib/routes/atom-eligible.js');

const FULL = {
  title: 'Getting started',
  url: 'https://docs.example/base/guides/getting-started/',
  updated: '2026-10-31T00:00:00.000Z',
  siteTitle: 'Example docs',
  description: 'How to begin.',
  html: '<h1>Hi</h1>',
};

describe('buildAtomEntry', () => {
  it('writes the contract document for a full entry', () => {
    expect(buildAtomEntry(FULL)).toBe(`<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xml:base="https://docs.example/base/guides/getting-started/">
  <id>https://docs.example/base/guides/getting-started/</id>
  <title>Getting started</title>
  <updated>2026-10-31T00:00:00.000Z</updated>
  <author><name>Example docs</name></author>
  <link rel="alternate" type="text/html" href="https://docs.example/base/guides/getting-started/"/>
  <summary>How to begin.</summary>
  <content type="html">&lt;h1&gt;Hi&lt;/h1&gt;</content>
</entry>
`);
  });

  it('leaves out summary when there is no description', () => {
    const input = { ...FULL, description: undefined };
    const xml = buildAtomEntry(input);
    expect(xml).not.toContain('<summary');
    expect(xml).toContain('<content type="html">');
  });

  it('escapes &, < and ]]> in the title and the HTML', () => {
    const xml = buildAtomEntry({ ...FULL, title: 'Q&A <b> ]]>', html: '<p>a & b ]]> c</p>' });
    expect(xml).toContain('<title>Q&amp;A &lt;b&gt; ]]&gt;</title>');
    expect(xml).toContain('<content type="html">&lt;p&gt;a &amp; b ]]&gt; c&lt;/p&gt;</content>');
    expect(xml).not.toContain(']]>');
  });

  it('leaves out <content> when the page has no HTML (MDX), keeping summary and the alternate link', () => {
    const xml = buildAtomEntry({ ...FULL, html: undefined });
    expect(xml).not.toContain('<content');
    expect(xml).toContain('<summary>How to begin.</summary>');
    expect(xml).toContain('rel="alternate"');
  });

  it('removes characters XML 1.0 forbids from every field, keeping tab, LF and CR', () => {
    const xml = buildAtomEntry({ ...FULL, title: 'a\fb\x1bc\ud800d\ufffee', description: 'x\x00y\ttab', html: '<p>p\x0Bq\r\nr</p>' });
    expect(xml).toContain('<title>abcde</title>');
    expect(xml).toContain('<summary>xy\ttab</summary>');
    expect(xml).toContain('&lt;p&gt;pq\r\nr&lt;/p&gt;');
    // eslint-disable-next-line no-control-regex -- asserting no control character remains
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  it('is deterministic', () => {
    expect(buildAtomEntry(FULL)).toBe(buildAtomEntry({ ...FULL }));
  });
});

describe('atomEligible', () => {
  const entry = (id: string, data: Record<string, unknown>) => ({
    id,
    data: { title: 'T', ...data } as unknown as DocKittyFrontmatter,
  });
  it('accepts a published page with a date, from updated or generated.at', () => {
    expect(atomEligible(entry('guides/a', { doc_status: 'active', updated: '2026-10-31T00:00:00Z' }))).toBe(true);
    expect(atomEligible(entry('guides/b', { doc_status: 'active', generated: { by: 'x', at: '2026-10-31T00:00:00Z' } }))).toBe(true);
  });
  it('rejects a draft, a page with no date, and a page whose updated is epoch 0 with no stamp', () => {
    expect(atomEligible(entry('adr/t', { doc_status: 'draft', updated: '2026-10-31T00:00:00Z' }))).toBe(false);
    expect(atomEligible(entry('guides/u', { doc_status: 'active' }))).toBe(false);
    expect(atomEligible(entry('guides/z', { doc_status: 'active', updated: '1970-01-01T00:00:00Z' }))).toBe(false);
  });
});

describe('xmlEscape: XML 1.0 characters', () => {
  it('keeps valid astral characters and pairs', () => {
    expect(xmlEscape('a\u{1F600}b')).toBe('a\u{1F600}b');
    const zwj = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    expect(xmlEscape(zwj)).toBe(zwj);
    expect(xmlEscape('\u{10FFFF}')).toBe('\u{10FFFF}');
  });
  it('removes a lone low surrogate, and keeps the valid pair in high-high-low', () => {
    expect(xmlEscape('a\uDC00b')).toBe('ab');
    expect(xmlEscape('\uD83D\uD83D\uDE00')).toBe('\u{1F600}');
    expect(xmlEscape('a\uD83Db')).toBe('ab');
  });
  it('keeps U+0085, U+FFFD, tab, LF and CR, and removes U+FFFE and U+FFFF', () => {
    expect(xmlEscape('\u0085\uFFFD\t\n\r')).toBe('\u0085\uFFFD\t\n\r');
    expect(xmlEscape('a\uFFFEb\uFFFFc')).toBe('abc');
  });
});

/**
 * The exact bytes of `api/subprocessors.json` and `subprocessors.xml` (ADR-0086,
 * FR-009, FR-011, FR-013, NFR-001). The renderers are pure: the routes add nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// `routes/shared.ts` (absolute, xmlEscape) statically imports `astro:content`,
// which does not resolve under vitest; the renderers never call it.
vi.mock('astro:content', () => ({ getCollection: async () => [] }));

const { renderSubprocessorsApi, renderSubprocessorsFeed } = await import('../lib/subprocessors-render.js');

const SITE = new URL('https://site.example/');

const INPUT = {
  records: [
    {
      id: 'acme-hosting',
      name: 'Acme Hosting B.V.',
      address: '1 Example Street, Amsterdam',
      contact: 'privacy@acme-hosting.example',
      processing: 'Hosting of the production database and backups.',
      location: ['NL', 'DE'],
      location_note: 'Backups replicate to Frankfurt.',
      responsibilities: 'Acme operates the infrastructure; we configure access.',
      since: '2025-01-15',
      external_references: [
        { type: 'biblio' as const, id: 'acme-dpa', title: 'Acme DPA', url: 'https://acme-hosting.example/dpa' },
      ],
      tom_classification: [{ measure: 'physical-security', scope: 'system' as const }],
    },
    {
      id: 'beta-mail',
      name: 'Ampersand & <Co>',
      processing: 'Transactional email.',
      location: ['IE'],
      responsibilities: 'They deliver; we choose what is sent.',
      since: '2027-03-01',
    },
    {
      id: 'gamma',
      name: 'Gamma Analytics',
      processing: 'Usage analytics.',
      location: ['US'],
      responsibilities: 'They store events.',
      since: '2023-01-10',
      until: '2025-09-30',
    },
  ],
  changes: [
    { date: '2027-03-01', kind: 'added' as const, id: 'beta-mail', name: 'Ampersand & <Co>' },
    { date: '2025-09-30', kind: 'removed' as const, id: 'gamma', name: 'Gamma Analytics' },
    { date: '2025-01-15', kind: 'added' as const, id: 'acme-hosting', name: 'Acme Hosting B.V.' },
    { date: '2023-01-10', kind: 'added' as const, id: 'gamma', name: 'Gamma Analytics' },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('renderSubprocessorsApi', () => {
  it('emits the contract shape, in order, with every record and change', () => {
    const doc = JSON.parse(renderSubprocessorsApi(INPUT, { site: SITE }));
    expect(Object.keys(doc)).toEqual(['title', 'source', 'notice', 'count', 'records', 'changes', '_links']);
    expect(doc.title).toBe('Sub-processors');
    expect(doc.source).toBe('_meta/subprocessors.yaml');
    expect(doc.notice).toBe("Structure only, not legal advice. The site owner's contract governs.");
    expect(doc.count).toBe(3);
    expect(doc.records).toEqual(INPUT.records);
    expect(doc.changes).toEqual(INPUT.changes);
    expect(doc._links).toEqual({
      self: { href: 'https://site.example/api/subprocessors.json' },
      feed: { href: 'https://site.example/subprocessors.xml' },
    });
  });

  it('keeps record key order and omits absent optional keys', () => {
    const doc = JSON.parse(renderSubprocessorsApi(INPUT, { site: SITE }));
    expect(Object.keys(doc.records[1])).toEqual(['id', 'name', 'processing', 'location', 'responsibilities', 'since']);
    expect(JSON.stringify(doc)).not.toContain('null');
  });

  it('serialises like the other api/*.json routes: two-space indent, no trailing newline', () => {
    const text = renderSubprocessorsApi(INPUT, { site: SITE });
    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2));
  });

  it('honours a title option', () => {
    expect(JSON.parse(renderSubprocessorsApi(INPUT, { site: SITE, title: 'Our providers' })).title).toBe('Our providers');
  });

  it('carries the base in its links on a based deployment', () => {
    vi.stubEnv('BASE_URL', '/docs/');
    const doc = JSON.parse(renderSubprocessorsApi(INPUT, { site: SITE }));
    expect(doc._links.self.href).toBe('https://site.example/docs/api/subprocessors.json');
    expect(doc._links.feed.href).toBe('https://site.example/docs/subprocessors.xml');
  });

  it('renders an empty catalog', () => {
    const doc = JSON.parse(renderSubprocessorsApi({ records: [], changes: [] }, { site: SITE }));
    expect(doc).toMatchObject({ count: 0, records: [], changes: [] });
  });
});

describe('renderSubprocessorsFeed', () => {
  const feed = () => renderSubprocessorsFeed(INPUT, { site: SITE, siteTitle: 'Example Docs' });
  const items = (xml: string) => [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);

  it('emits a channel with the self link and the contract description, and no build date', () => {
    const xml = feed();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')).toBe(true);
    expect(xml).toContain('<title>Example Docs: sub-processor changes</title>');
    expect(xml).toContain('<link>https://site.example/</link>');
    expect(xml).toContain('<atom:link href="https://site.example/subprocessors.xml" rel="self" type="application/rss+xml" />');
    expect(xml).toContain(
      '<description>Additions and removals of sub-processors, including announced future changes.</description>',
    );
    expect(xml).not.toContain('lastBuildDate');
    expect(xml.endsWith('</rss>\n')).toBe(true);
  });

  it('emits one item per change, in change order', () => {
    const titles = items(feed()).map((item) => /<title>(.*)<\/title>/.exec(item)?.[1]);
    expect(titles).toEqual([
      'Added: Ampersand &amp; &lt;Co&gt;',
      'Removed: Gamma Analytics',
      'Added: Acme Hosting B.V.',
      'Added: Gamma Analytics',
    ]);
  });

  it('gives each item a stable guid, a midnight-UTC date, a category and a description', () => {
    const [future, removed] = items(feed());
    expect(future).toContain(
      '<guid isPermaLink="false">https://site.example/subprocessors.xml#beta-mail-added-2027-03-01</guid>',
    );
    expect(future).toContain('<pubDate>Mon, 01 Mar 2027 00:00:00 GMT</pubDate>');
    expect(future).toContain('<category>added</category>');
    expect(future).toContain(
      '<description>Ampersand &amp; &lt;Co&gt; (beta-mail), from 2027-03-01. Processing: Transactional email. Location: IE.</description>',
    );
    expect(removed).toContain('<category>removed</category>');
    expect(removed).toContain(
      '<description>Gamma Analytics (gamma), until 2025-09-30. Processing: Usage analytics. Location: US.</description>',
    );
  });

  it('links items to the API document by default, and to a page when given one', () => {
    expect(items(feed())[0]).toContain('<link>https://site.example/api/subprocessors.json</link>');
    const paged = renderSubprocessorsFeed(INPUT, { site: SITE, siteTitle: 'Example Docs', itemLink: '/reference/subprocessors/' });
    expect(items(paged)[0]).toContain('<link>https://site.example/reference/subprocessors/</link>');
  });

  it('joins several location codes with commas', () => {
    const acme = items(feed())[2];
    expect(acme).toContain('Location: NL, DE.');
  });

  it('renders an empty catalog as a valid channel with no items', () => {
    const xml = renderSubprocessorsFeed({ records: [], changes: [] }, { site: SITE, siteTitle: 'Example Docs' });
    expect(items(xml)).toEqual([]);
    expect(xml).toContain('</channel>');
  });

  it('carries the base in every URL on a based deployment', () => {
    vi.stubEnv('BASE_URL', '/docs/');
    const xml = feed();
    expect(xml).toContain('<atom:link href="https://site.example/docs/subprocessors.xml"');
    expect(xml).toContain('<link>https://site.example/docs/api/subprocessors.json</link>');
    expect(xml).not.toMatch(/https:\/\/site\.example\/(?!docs\/)[a-z]/);
  });
});

describe('byte stability (NFR-001, C-005)', () => {
  const both = () => [
    renderSubprocessorsApi(INPUT, { site: SITE }),
    renderSubprocessorsFeed(INPUT, { site: SITE, siteTitle: 'Example Docs' }),
  ];

  it('renders the same bytes on days years apart', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T03:00:00Z'));
    const early = both();
    vi.setSystemTime(new Date('2031-07-15T22:59:59Z'));
    const late = both();
    expect(late).toEqual(early);
  });

  it('changes when the catalog changes (positive control)', () => {
    const changed = {
      ...INPUT,
      changes: INPUT.changes.map((c) => (c.id === 'beta-mail' ? { ...c, date: '2027-04-01' } : c)),
    };
    const [api, feed] = both();
    expect(renderSubprocessorsApi(changed, { site: SITE })).not.toBe(api);
    expect(renderSubprocessorsFeed(changed, { site: SITE, siteTitle: 'Example Docs' })).not.toBe(feed);
  });
});

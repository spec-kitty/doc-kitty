/**
 * `/api/scenarios.json` — the scenario index (ADR-0046, gherkin-feature-pages
 * WP10), and its one-line `llms.txt` advertisement.
 *
 * Exercises the REAL route: `astro:content` is neutralized with a `vi.hoisted`
 * factory (mirrors `route-feeds.test.ts`/`absolute-url-base.test.ts`). Its
 * `render` stub returns the headings each test entry carries, standing in for
 * Astro's `rehypeHeadingIds` output — the anchors must come from THERE (03 §5),
 * so the fixtures use slugs no slugger would compute from the heading text.
 * Scenario detail is re-parsed from real `.feature` files written to a temp dir,
 * through a pass-through spy on `loadFeatures` (to prove parse-once).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { runtimeGraph } from './helpers/module-graph.js';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

type Heading = { depth: number; slug: string; text: string };
type Entry = { id: string; data: Record<string, unknown>; headings?: Heading[] };

const { entries } = vi.hoisted(() => ({ entries: [] as Entry[] }));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
  render: async (entry: Entry) => ({ headings: entry.headings ?? [] }),
}));

vi.mock('../lib/gherkin/load.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gherkin/load.mjs')>();
  return { ...actual, loadFeatures: vi.fn(actual.loadFeatures) };
});

const { loadFeatures } = await import('../lib/gherkin/load.mjs');
const { scenarioIndexRoute, resolveSourcePath } = await import(
  '../lib/routes/scenario-index.js'
);
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');

const SITE = new URL('https://docs.example/');

const BOOK = `# language: en
@dk:context=shipping @FR-003
Feature: Book a consignment
  As a shipper
  I want to book cargo

  Background:
    Given a sailing with 40 TEU remaining

  Rule: A booking within capacity is confirmed

    @smoke @smoke @FR-010
    Scenario: Book cargo that fits
      Given a consignment of 12 TEU
      When the shipper books the consignment
      Then the booking is confirmed

    Scenario: Attach the shipper's packing list
      Given a confirmed booking
      When the shipper attaches the packing list:
        """json
        { "lines": [] }
        """
      Then the booking shows 0 lines

  Rule: A booking over capacity is refused

    Scenario Outline: Refuse cargo that does not fit
      Given a consignment of <size> TEU
      Then the booking is refused with reason "<reason>"

      @edge
      Examples: Over capacity
        | size | reason             |
        | 41   | insufficient space |
        | 120  | insufficient space |
`;

const LEAVE = `Feature: Request annual leave

  Scenario: Approve a request within the allowance
    Given an employee with 10 days remaining
    When they request 3 days
    Then the request is approved
`;

const BOOK_HEADINGS: Heading[] = [
  { depth: 1, slug: 'book-a-consignment', text: 'Book a consignment' },
  { depth: 2, slug: 'background', text: 'Background' },
  { depth: 2, slug: 'rule-a', text: 'Rule: A booking within capacity is confirmed' },
  { depth: 3, slug: 'anchor-fits', text: 'Scenario: Book cargo that fits' },
  // remark-smartypants curls the apostrophe in the rendered heading text.
  { depth: 3, slug: 'anchor-packing', text: 'Scenario: Attach the shipper’s packing list' },
  { depth: 2, slug: 'rule-b', text: 'Rule: A booking over capacity is refused' },
  { depth: 3, slug: 'anchor-refuse', text: 'Scenario Outline: Refuse cargo that does not fit' },
];

const LEAVE_HEADINGS: Heading[] = [
  { depth: 1, slug: 'request-annual-leave', text: 'Request annual leave' },
  { depth: 2, slug: 'anchor-approve', text: 'Scenario: Approve a request within the allowance' },
];

let root: string;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

function writeFeature(rel: string, text: string): string {
  const abs = path.join(root, ...rel.split('/'));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  return `sha256:${sha(text).slice(0, 12)}`;
}

/** A generated feature page as the integration would emit it. */
function featurePage(
  id: string,
  resource: string,
  at: string,
  headings: Heading[],
  extra: Record<string, unknown> = {},
): Entry {
  return {
    id,
    headings,
    data: {
      title: id.split('/').pop(),
      kind: 'Specification',
      doc_status: 'active',
      sources: [{ resource, title: 'Gherkin source' }],
      generated: { by: 'doc-kitty/gherkin', at },
      ...extra,
    },
  };
}

async function getJson(options: Parameters<typeof scenarioIndexRoute>[0] = {}) {
  const route = scenarioIndexRoute({ sourceRoot: root, ...options });
  const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
  return JSON.parse(await res.text());
}

async function llmsText(): Promise<string> {
  const route = llmsTxtRoute({ title: 'Docs' });
  const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
  return res.text();
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-scenario-index-'));
  vi.mocked(loadFeatures).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  entries.length = 0;
  rmSync(root, { recursive: true, force: true });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('scenarioIndexRoute — shape', () => {
  it('lists every scenario with rule, anchor (from rendered headings), tags, steps and examples', async () => {
    const at = writeFeature('features/shipping/book-consignment.feature', BOOK);
    entries.push(
      featurePage('behaviour/shipping/book-consignment', 'features/shipping/book-consignment.feature', at, BOOK_HEADINGS, {
        title: 'Book a consignment',
        glossary_context: 'shipping',
        tags: ['FR-003'],
        related: ['adr/0001-use-astro-starlight', 'plans/missions/mission-alpha'],
      }),
    );

    const body = await getJson();
    expect(body.version).toBe('1');
    expect(body.generated_from).toBe('doc-kitty/gherkin');
    expect(body.count).toBe(1);
    const [feature] = body.features;
    expect(feature).toMatchObject({
      id: 'behaviour/shipping/book-consignment',
      title: 'Book a consignment',
      url: 'https://docs.example/behaviour/shipping/book-consignment/',
      source: 'features/shipping/book-consignment.feature',
      doc_status: 'active',
      glossary_context: 'shipping',
      tags: ['FR-003'],
      related: ['adr/0001-use-astro-starlight', 'plans/missions/mission-alpha'],
    });
    expect(feature.scenarios).toHaveLength(3);
    expect(feature.scenarios[0]).toEqual({
      name: 'Book cargo that fits',
      rule: 'A booking within capacity is confirmed',
      anchor: 'anchor-fits',
      line: 13,
      tags: ['FR-010', 'smoke'],
      outline: false,
      steps: [
        { keyword: 'Given', text: 'a consignment of 12 TEU' },
        { keyword: 'When', text: 'the shipper books the consignment' },
        { keyword: 'Then', text: 'the booking is confirmed' },
      ],
      examples: [],
    });
    // Matched through smartypants' curly apostrophe; background steps are not
    // folded into the scenario.
    expect(feature.scenarios[1].anchor).toBe('anchor-packing');
    expect(feature.scenarios[1].steps[0]).toEqual({ keyword: 'Given', text: 'a confirmed booking' });
    // Outline: placeholders kept verbatim, Examples rows NOT expanded.
    expect(feature.scenarios[2]).toEqual({
      name: 'Refuse cargo that does not fit',
      rule: 'A booking over capacity is refused',
      anchor: 'anchor-refuse',
      line: 28,
      tags: [],
      outline: true,
      steps: [
        { keyword: 'Given', text: 'a consignment of <size> TEU' },
        { keyword: 'Then', text: 'the booking is refused with reason "<reason>"' },
      ],
      examples: [
        {
          name: 'Over capacity',
          tags: ['edge'],
          header: ['size', 'reason'],
          rows: [
            ['41', 'insufficient space'],
            ['120', 'insufficient space'],
          ],
        },
      ],
    });
  });

  it('gives a scenario outside any rule `rule: null` and absent page fields their nulls/empties', async () => {
    const at = writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', at, LEAVE_HEADINGS));
    const [feature] = (await getJson()).features;
    expect(feature.glossary_context).toBeNull();
    expect(feature.tags).toEqual([]);
    expect(feature.related).toEqual([]);
    expect(feature.scenarios).toEqual([
      expect.objectContaining({ rule: null, anchor: 'anchor-approve', outline: false }),
    ]);
  });

  it('skips a description heading that is not the scenario heading (document-order match)', async () => {
    const at = writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(
      featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', at, [
        LEAVE_HEADINGS[0],
        { depth: 2, slug: 'decoy', text: 'Notes' },
        LEAVE_HEADINGS[1],
      ]),
    );
    expect((await getJson()).features[0].scenarios[0].anchor).toBe('anchor-approve');
  });

  it('base-prefixes the feature URL like every other route', async () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    const at = writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', at, LEAVE_HEADINGS));
    expect((await getJson()).features[0].url).toBe(
      'https://docs.example/doc-kitty/behaviour/hr/request-leave/',
    );
  });
});

describe('scenarioIndexRoute — feature URL follows the route rule (FR-001, issue 134)', () => {
  it('serves an /index feature page at its folder and the root id at /, beside an ordinary page', async () => {
    const at = writeFeature('features/hr/request-leave.feature', LEAVE);
    for (const id of ['behaviour/hr/request-leave', 'behaviour/hr/index', 'index']) {
      entries.push(featurePage(id, 'features/hr/request-leave.feature', at, LEAVE_HEADINGS));
    }
    const urlOf = new Map(
      (await getJson()).features.map((f: { id: string; url: string }) => [f.id, f.url]),
    );
    expect(urlOf.get('behaviour/hr/request-leave')).toBe('https://docs.example/behaviour/hr/request-leave/'); // control
    expect(urlOf.get('behaviour/hr/index')).toBe('https://docs.example/behaviour/hr/');
    expect(urlOf.get('')).toBe('https://docs.example/');
  });
});

describe('scenarioIndexRoute — selection and order', () => {
  it('lists only published, discoverable GENERATED feature pages, ordered by id (code-unit)', async () => {
    const book = writeFeature('features/shipping/book-consignment.feature', BOOK);
    const leave = writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(
      featurePage('behaviour/shipping/book-consignment', 'features/shipping/book-consignment.feature', book, BOOK_HEADINGS),
      featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', leave, LEAVE_HEADINGS),
      // Draft (`@wip`): generated but never served to agents.
      featurePage('behaviour/hr/draft', 'features/hr/request-leave.feature', leave, LEAVE_HEADINGS, {
        doc_status: 'draft',
      }),
      // Opted out of agent discovery.
      featurePage('behaviour/hr/hidden', 'features/hr/request-leave.feature', leave, LEAVE_HEADINGS, {
        agent: { discoverable: false },
      }),
      // A hand-authored Specification page (no generated stamp) and a hub.
      { id: 'behaviour/manual', data: { title: 'Manual', kind: 'Specification', doc_status: 'active' } },
      { id: 'behaviour', data: { title: 'Behaviour', kind: 'Hub', doc_status: 'active', generated: { by: 'doc-kitty/gherkin', at: 'sha256:x' } } },
    );
    const body = await getJson();
    expect(body.features.map((f: { id: string }) => f.id)).toEqual([
      'behaviour/hr/request-leave',
      'behaviour/shipping/book-consignment',
    ]);
    expect(body.count).toBe(2);
  });

  it('emits an empty index for a site without feature pages', async () => {
    entries.push({ id: 'guides/x', data: { title: 'X', doc_status: 'active' } });
    expect(await getJson()).toEqual({
      version: '1',
      generated_from: 'doc-kitty/gherkin',
      count: 0,
      features: [],
    });
  });
});

describe('scenarioIndexRoute — source resolution and parse-once', () => {
  it('parses each referenced file once per build, in one loadFeatures call', async () => {
    const book = writeFeature('features/shipping/book-consignment.feature', BOOK);
    const leave = writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(
      featurePage('behaviour/shipping/book-consignment', 'features/shipping/book-consignment.feature', book, BOOK_HEADINGS),
      featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', leave, LEAVE_HEADINGS),
    );
    await getJson();
    expect(loadFeatures).toHaveBeenCalledTimes(1);
    await getJson();
    expect(loadFeatures).toHaveBeenCalledTimes(1); // memoised, hashes still match
  });

  it('strips `sourceUrlPrefix` and resolves against `sourceRoot`', async () => {
    const prefix = 'https://github.com/o/r/blob/main/';
    const at = writeFeature('example/features/hr/request-leave.feature', LEAVE);
    entries.push(
      featurePage('behaviour/hr/request-leave', `${prefix}example/features/hr/request-leave.feature`, at, LEAVE_HEADINGS),
    );
    const body = await getJson({ sourceUrlPrefix: prefix });
    expect(body.features[0].source).toBe(`${prefix}example/features/hr/request-leave.feature`);
    expect(body.features[0].scenarios).toHaveLength(1);
  });

  it('resolveSourcePath refuses a URL the prefix does not explain', () => {
    expect(() =>
      resolveSourcePath('https://elsewhere/x.feature', { sourceRoot: '/r', page: 'p' }),
    ).toThrow(/\[dk-gherkin\] scenario index: p cites source .*sourceUrlPrefix/);
    expect(resolveSourcePath('features/a.feature', { sourceRoot: '/r', page: 'p' })).toBe(
      path.resolve('/r', 'features', 'a.feature'),
    );
  });

  it('a missing source is a build error naming the page, not a silent omission', async () => {
    entries.push(featurePage('behaviour/hr/gone', 'features/hr/gone.feature', 'sha256:0', LEAVE_HEADINGS));
    await expect(getJson()).rejects.toThrow(
      /\[dk-gherkin\] scenario index: behaviour\/hr\/gone cites source "features\/hr\/gone.feature".*does not exist/,
    );
  });

  it('a source edited since its page was generated is a build error (stale page)', async () => {
    writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', 'sha256:000000000000', LEAVE_HEADINGS));
    await expect(getJson()).rejects.toThrow(/changed since behaviour\/hr\/request-leave was generated/);
  });

  it('a scenario with no rendered heading is a build error (page out of date)', async () => {
    const at = writeFeature('features/hr/request-leave.feature', LEAVE);
    entries.push(featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', at, [LEAVE_HEADINGS[0]]));
    await expect(getJson()).rejects.toThrow(
      /no rendered heading for "Scenario: Approve a request within the allowance" \(features\/hr\/request-leave.feature:3\)/,
    );
  });
});

describe('llms.txt — scenario index advertisement', () => {
  const baseCorpus: Entry[] = [
    { id: 'guides/getting-started', data: { title: 'Getting started', description: 'Start here.', doc_status: 'active' } },
  ];
  // The pre-WP10 llms.txt for this corpus, byte for byte.
  const PRE_WP10 = [
    '# Docs',
    '',
    'Full machine index: https://docs.example/api/index.json',
    '',
    '## Guides',
    '',
    '- [Getting started](https://docs.example/guides/getting-started/): Start here.',
    '',
  ].join('\n');

  it('is byte-identical to the pre-WP10 output on a site without feature pages', async () => {
    entries.push(...baseCorpus);
    expect(await llmsText()).toBe(PRE_WP10);
  });

  it('stays byte-identical when the only Specification pages are drafts or hand-authored', async () => {
    entries.push(
      ...baseCorpus,
      featurePage('behaviour/hr/draft', 'features/hr/draft.feature', 'sha256:0', [], { doc_status: 'draft' }),
      { id: 'context/manual-spec', data: { title: 'Manual', kind: 'Specification', doc_status: 'draft' } },
    );
    expect(await llmsText()).toBe(PRE_WP10);
  });

  it('advertises /api/scenarios.json (base-prefixed) once a published generated feature page exists', async () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    entries.push(
      ...baseCorpus,
      featurePage('behaviour/hr/request-leave', 'features/hr/request-leave.feature', 'sha256:0', []),
    );
    const txt = await llmsText();
    expect(txt).toContain(
      'Full machine index: https://docs.example/doc-kitty/api/index.json\n\n' +
        'Scenario index: https://docs.example/doc-kitty/api/scenarios.json\n\n',
    );
    expect(txt.match(/Scenario index:/g)).toHaveLength(1);
  });
});

describe('llms.txt module graph', () => {
  it('does not pull the Gherkin parser or the .feature loader into every site', () => {
    const llms = fileURLToPath(new URL('../lib/routes/llms-txt.ts', import.meta.url));
    const { files, packages } = runtimeGraph(llms);
    const rel = [...files].map((f) => path.relative(path.dirname(llms), f).split(path.sep).join('/'));
    // Non-vacuity: the walk reached the shared predicate.
    expect(rel).toContain('scenario-index-filter.ts');
    expect(rel).not.toContain('scenario-index.ts');
    expect(rel).not.toContain('../gherkin/load.mjs');
    expect([...packages].filter((p) => p.startsWith('@cucumber/'))).toEqual([]);
  });
});

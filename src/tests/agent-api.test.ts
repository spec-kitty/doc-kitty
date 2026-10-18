import { describe, it, expect, vi } from 'vitest';
import { toAgentRecord, type DocEntry } from '../lib/metadata.js';

describe('toAgentRecord', () => {
  it('builds a record for a normal page', () => {
    const entry: DocEntry = {
      slug: 'guides/deployment',
      data: {
        title: 'Deployment',
        description: 'How to ship to each environment.',
        type: 'Guide',
        doc_status: 'active',
        kind: 'How-To',
        tags: ['ci'],
        related: ['operations/runbooks/deploy'],
        updated: '2026-08-01',
        agent: { priority: 0.7 },
      },
    };
    expect(toAgentRecord(entry)).toEqual({
      slug: 'guides/deployment',
      route: '/guides/deployment/',
      section: 'guides',
      title: 'Deployment',
      description: 'How to ship to each environment.',
      type: 'Guide',
      doc_status: 'active',
      kind: 'How-To',
      tags: ['ci'],
      related: ['operations/runbooks/deploy'],
      priority: 0.7,
      updated: '2026-08-01T00:00:00Z',
      source: '/api/pages/guides/deployment.json',
    });
  });

  it('routes the bundle root to "/" and source id "home"', () => {
    const record = toAgentRecord({ slug: '', data: { title: 'Documentation' } });
    expect(record.route).toBe('/');
    expect(record.section).toBe('');
    expect(record.source).toBe('/api/pages/home.json');
  });

  it('routes an /index page at its folder, the reserved root id at "/" (FR-001, issue 134)', () => {
    const routeOf = (slug: string) => toAgentRecord({ slug, data: { title: 'T' } }).route;
    expect(routeOf('guide/setup')).toBe('/guide/setup/'); // positive control
    expect(routeOf('guide/index')).toBe('/guide/');
    expect(routeOf('index')).toBe('/');
  });

  it('supplies defaults for missing optional fields', () => {
    const record = toAgentRecord({ slug: 'x', data: { title: 'X' } });
    expect(record.description).toBe('');
    expect(record.type).toBeNull();
    // Absent doc_status defaults to 'draft' — consistent with isPublished's
    // draft default (an unmarked page is a draft, not silently published).
    expect(record.doc_status).toBe('draft');
    expect(record.kind).toBe('');
    expect(record.tags).toEqual([]);
    expect(record.related).toEqual([]);
    expect(record.priority).toBe(0.5);
    expect(record.updated).toBeNull();
  });
});

// FR-009/FR-024: `updated` is serialised as a full UTC instant, and the index
// version moves '2' -> '3' because that published-contract format changed.
vi.mock('astro:content', () => ({
  getCollection: async () => [
    { id: 'a', data: { title: 'A', doc_status: 'active', updated: new Date('2026-10-18T09:30:00Z') } },
  ],
}));

describe('agentIndexRoute — version and updated format', () => {
  it('reports version 3 and a UTC-instant updated (timestamp and date-only alike)', async () => {
    const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
    const res = await (agentIndexRoute({ title: 'Docs' }) as (c: { site: URL }) => Promise<Response>)({
      site: new URL('https://docs.example/'),
    });
    const json = JSON.parse(await res.text());
    expect(json.version).toBe('3');
    expect(json.pages[0].updated).toBe('2026-10-18T09:30:00Z');
    expect(toAgentRecord({ slug: 'd', data: { title: 'D', updated: '2026-10-18' } }).updated)
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });
});

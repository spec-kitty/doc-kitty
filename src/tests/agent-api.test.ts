import { describe, it, expect } from 'vitest';
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
      updated: '2026-08-01',
      source: '/api/pages/guides/deployment.json',
    });
  });

  it('routes the bundle root to "/" and source id "home"', () => {
    const record = toAgentRecord({ slug: '', data: { title: 'Documentation' } });
    expect(record.route).toBe('/');
    expect(record.section).toBe('');
    expect(record.source).toBe('/api/pages/home.json');
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

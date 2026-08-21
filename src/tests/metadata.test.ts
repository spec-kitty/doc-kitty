import { describe, it, expect } from 'vitest';
import {
  readmeToIndexId,
  isPublished,
  isAgentDiscoverable,
  agentPriority,
  pageSourceId,
  sectionOf,
  sectionRank,
  rankForAgents,
  rankForFeed,
  type DocEntry,
} from '../lib/metadata.js';

describe('readmeToIndexId (README-as-index)', () => {
  it('maps the bundle-root README to the empty slug', () => {
    expect(readmeToIndexId('README.md')).toBe('');
  });
  it('maps a section README to its directory slug', () => {
    expect(readmeToIndexId('architecture/README.md')).toBe('architecture');
    expect(readmeToIndexId('plans/epics/README.md')).toBe('plans/epics');
  });
  it('leaves normal pages as directory + name', () => {
    expect(readmeToIndexId('architecture/overview.md')).toBe('architecture/overview');
    expect(readmeToIndexId('guides/deployment.mdx')).toBe('guides/deployment');
  });
});

describe('publication + agent discovery gating', () => {
  it('drafts are neither published nor discoverable', () => {
    const draft = { title: 'x', status: 'draft' as const };
    expect(isPublished(draft)).toBe(false);
    expect(isAgentDiscoverable(draft)).toBe(false);
  });
  it('active/deprecated/superseded are published', () => {
    for (const status of ['active', 'deprecated', 'superseded'] as const) {
      expect(isPublished({ title: 'x', status })).toBe(true);
    }
  });
  it('agent.discoverable=false hides an active page from agents', () => {
    const data = { title: 'x', status: 'active' as const, agent: { discoverable: false } };
    expect(isPublished(data)).toBe(true);
    expect(isAgentDiscoverable(data)).toBe(false);
  });
  it('missing status defaults to draft (unpublished)', () => {
    expect(isPublished({ title: 'x' })).toBe(false);
  });
});

describe('agentPriority clamping', () => {
  it('defaults to 0.5 and clamps to 0..1', () => {
    expect(agentPriority({ title: 'x' })).toBe(0.5);
    expect(agentPriority({ title: 'x', agent: { priority: 2 } })).toBe(1);
    expect(agentPriority({ title: 'x', agent: { priority: -1 } })).toBe(0);
  });
});

describe('sections', () => {
  it('sectionOf reads the first path segment', () => {
    expect(sectionOf('')).toBe('');
    expect(sectionOf('architecture/overview')).toBe('architecture');
    expect(sectionOf('guides')).toBe('guides');
  });
  it('sectionRank orders root first, then canonical order, unknown last', () => {
    expect(sectionRank('')).toBeLessThan(sectionRank('context'));
    expect(sectionRank('context')).toBeLessThan(sectionRank('architecture'));
    expect(sectionRank('changelog')).toBeLessThan(sectionRank('nope'));
  });
});

describe('pageSourceId', () => {
  it('maps the root slug to "home"', () => {
    expect(pageSourceId('')).toBe('home');
    expect(pageSourceId('guides')).toBe('guides');
  });
});

describe('ranking', () => {
  const entries: DocEntry[] = [
    { slug: 'guides/deploy', data: { title: 'Deploy', status: 'active', agent: { priority: 0.2 }, updated: '2026-08-01' } },
    { slug: '', data: { title: 'Home', status: 'active', agent: { priority: 0.9 }, updated: '2026-01-01' } },
    { slug: 'draft', data: { title: 'Draft', status: 'draft' } },
    { slug: 'context/domain', data: { title: 'Domain', status: 'active', agent: { priority: 0.5 }, updated: '2026-05-01' } },
  ];

  it('rankForAgents drops drafts and orders by section then priority', () => {
    const ranked = rankForAgents(entries).map((e) => e.slug);
    // root ("") first, then context, then guides
    expect(ranked).toEqual(['', 'context/domain', 'guides/deploy']);
  });

  it('rankForFeed drops drafts and sorts by updated desc', () => {
    const ranked = rankForFeed(entries).map((e) => e.slug);
    expect(ranked).toEqual(['guides/deploy', 'context/domain', '']);
  });
});

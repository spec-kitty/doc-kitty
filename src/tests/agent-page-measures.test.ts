import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DK_DOCS_ROOT_ENV } from '../lib/internal-env.mjs';
import { clearMeasuresCatalogCache, loadMeasuresCatalog } from '../lib/measures-loader.mjs';

// `/api/pages/<id>.json` lists a page's resolved TOM classification (ADR-0080,
// FR-008); a page without the field keeps its payload unchanged (FR-010).
type Entry = { id: string; data: Record<string, unknown>; body?: string; filePath?: string };
const { entries } = vi.hoisted(() => ({ entries: [] as Entry[] }));
vi.mock('astro:content', () => ({ getCollection: async () => entries }));

const { agentPageRoute, resolvePageMeasures } = await import('../lib/routes/agent-page.js');

const ROOT = fileURLToPath(new URL('./fixtures/measures/no-catalog/docs', import.meta.url));
const SITE = new URL('https://docs.example/');
const previousRoot = process.env[DK_DOCS_ROOT_ENV];

const page = (id: string, extra: Record<string, unknown> = {}): Entry => ({
  id,
  filePath: path.join(ROOT, `${id}.md`),
  body: 'Body.',
  data: { title: id, description: `About ${id}.`, doc_status: 'active', kind: 'Reference', ...extra },
});

async function get(entry: Entry): Promise<Record<string, unknown>> {
  const { GET } = agentPageRoute();
  const ctx = { props: { id: entry.id, body: entry.body ?? '' }, site: SITE };
  const res = await (GET as unknown as (c: typeof ctx) => Promise<Response>)(ctx);
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

beforeEach(() => {
  process.env[DK_DOCS_ROOT_ENV] = ROOT;
  clearMeasuresCatalogCache();
  entries.splice(0, entries.length);
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env[DK_DOCS_ROOT_ENV];
  else process.env[DK_DOCS_ROOT_ENV] = previousRoot;
});

describe('resolvePageMeasures', () => {
  const catalog = () => loadMeasuresCatalog(ROOT);

  it('maps each entry to { measure, label, nature, scope, note? } in authored order', () => {
    const out = resolvePageMeasures(
      { tom_classification: ['transmission-protection', { measure: 'accountability', scope: 'organisation', note: 'n' }] },
      catalog(),
      'security/tls.md',
    );
    expect(out).toEqual([
      { measure: 'transmission-protection', label: 'Protection of data during transmission', nature: 'technical', scope: 'system' },
      { measure: 'accountability', label: 'Accountability', nature: 'organisational', scope: 'organisation', note: 'n' },
    ]);
    expect(Object.keys(out![1]!)).toEqual(['measure', 'label', 'nature', 'scope', 'note']);
  });

  it('returns undefined for a page without the field', () => {
    expect(resolvePageMeasures({}, catalog(), 'a.md')).toBeUndefined();
  });

  it('throws naming the page and the unknown id', () => {
    expect(() => resolvePageMeasures({ tom_classification: ['transmision-protection'] }, catalog(), 'security/tls.md')).toThrow(
      '[dk-measures] security/tls.md: unknown measure id "transmision-protection" (not in the shipped default catalog)',
    );
  });
});

describe('agentPageRoute: tom_classification', () => {
  it('carries the resolved classification on a classified page', async () => {
    const classified = page('security/tls', {
      tom_classification: ['transmission-protection', { measure: 'accountability', scope: 'organisation', note: 'n' }],
      sources: [{ resource: 'https://example.com', title: 'Example' }],
    });
    entries.push(classified, page('security/plain'));
    const payload = await get(classified);
    expect(payload.tom_classification).toEqual([
      { measure: 'transmission-protection', label: 'Protection of data during transmission', nature: 'technical', scope: 'system' },
      { measure: 'accountability', label: 'Accountability', nature: 'organisational', scope: 'organisation', note: 'n' },
    ]);
    // Placed after `sources`, ahead of `markdown`: existing key order is untouched.
    const keys = Object.keys(payload);
    expect(keys.indexOf('tom_classification')).toBe(keys.indexOf('sources') + 1);
  });

  it('adds no key to a page without the field', async () => {
    const plain = page('security/plain');
    entries.push(plain, page('security/tls', { tom_classification: ['events-logging'] }));
    const payload = await get(plain);
    expect('tom_classification' in payload).toBe(false);
  });

  it('fails the page build on an unknown id, naming the page and the id', async () => {
    const bad = page('security/tls', { tom_classification: ['transmision-protection'] });
    entries.push(bad);
    await expect(get(bad)).rejects.toThrow(/security\/tls\.md: unknown measure id "transmision-protection"/);
  });
});

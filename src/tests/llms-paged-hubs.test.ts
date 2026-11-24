/**
 * llms.txt and byte identity for the paged hub listing (#342, WP05; FR-013, T024,
 * T025). The golden values were produced by the code before WP05 (lane-b at
 * 2654a68f, WP02 approved) from the same corpus, so they pin that a site without a
 * paged hub serves the very same index, llms.txt, per-page artifact and build id
 * (review cycle 1, issue 3: the identity checks no longer compare the new code
 * with itself).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { DK_HUB_DATA_ENV, deleteInternalEnv, setInternalEnv } from '../lib/internal-env.mjs';
import type { HubCap } from '../lib/child-cap.js';

const pad = (n: number) => String(n).padStart(3, '0');
const { entries } = vi.hoisted(() => ({ entries: [] as Array<{ id: string; body: string; data: Record<string, unknown> }> }));
vi.mock('astro:content', () => ({ getCollection: async () => entries }));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const { agentPageRoute } = await import('../lib/routes/agent-page.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');
const { writeHubData } = await import('../lib/routes/shared.js');

restoreInternalEnv();

/** Produced by lane-b 2654a68f (no WP05 code) for `corpus()` below. */
const GOLDEN = {
  buildId: 'ebabd49e87efc22cdec52a560c62e9e1180a4fa40b619bdf22b7aa53b9f02ca1',
  index: '76a67aa12513a99956036316816cdfa1cb2683e1ed83feaf8d09dee81ca59ebe',
  llms: '0c0717cd9a0b32d4b7804b36946c41952574df44dc98587e04f15030c7f9d939',
  page: '33452c3d1884971b5b71091ed85967392256b1198acafdcb4384b9b9a97ae294',
  paths: 124,
};

const SITE = new URL('https://docs.example.test/');
const doc = (id: string, title: string, kind = 'Guide', description = `About ${title}.`) => ({
  id,
  body: `${title} body.`,
  data: { title, description, doc_status: 'active', updated: '2026-11-24', kind },
});
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

function corpus(): void {
  entries.length = 0;
  entries.push(doc('index', 'Home'), doc('guides', 'Guides', 'Hub'), doc('guides/one', 'One'), doc('missions', 'Missions', 'Hub', 'Every mission.'));
  for (let i = 1; i <= 120; i += 1) entries.push(doc(`missions/m-${pad(i)}`, `Mission ${pad(i)}`));
}
const hub = (count: number, pageSize: number, capped = true): HubCap => ({
  cap: 50,
  count,
  capped,
  pageSize,
  children: Array.from({ length: count }, (_, i) => ({ slug: `missions/m-${pad(i + 1)}`, label: `Mission ${pad(i + 1)}` })),
});
const dir = mkdtempSync(path.join(tmpdir(), 'dk-llms-paged-'));
const publish = (data: Array<[string, HubCap]> | undefined) =>
  data === undefined ? deleteInternalEnv(DK_HUB_DATA_ENV) : setInternalEnv(DK_HUB_DATA_ENV, writeHubData(dir, data));

const llms = async () => (await llmsTxtRoute({ title: 'Docs' })({ site: SITE } as never)).text();

/** The surfaces' fingerprints, as the golden records them. */
async function surfaces() {
  const index = await (await agentIndexRoute({ title: 'Docs' })({ site: SITE } as never)).text();
  const route = agentPageRoute();
  const paths = (await route.getStaticPaths({} as never)) as Array<{ params: { slug: string }; props: Record<string, unknown> }>;
  const one = paths.find((p) => p.params.slug === 'missions/m-001')!;
  const page = await (await route.GET({ props: one.props, site: SITE } as never)).text();
  return { buildId: JSON.parse(index).buildId as string, index: sha(index), llms: sha(await llms()), page: sha(page), paths: paths.length };
}

afterEach(() => publish(undefined));

describe('a site without a paged hub is byte-identical to before WP05 (T025)', () => {
  it.each([
    ['no hub data', undefined],
    ['a capped hub whose page size covers its children', [['missions', hub(120, 500)]]],
    ['an uncapped hub', [['missions', hub(120, 50, false)]]],
  ] as Array<[string, Array<[string, HubCap]> | undefined]>)('with %s', async (_label, data) => {
    corpus();
    publish(data);
    expect(await surfaces()).toEqual(GOLDEN);
  });
});

describe('llms.txt (T024)', () => {
  it('lists each listing page once, right after its hub, and every child once', async () => {
    corpus();
    publish([['missions', hub(120, 50)]]);
    const lines = (await llms()).split('\n');
    const at = lines.indexOf('- [Missions](https://docs.example.test/missions/): Every mission.');
    expect(at).toBeGreaterThan(-1);
    expect(lines.slice(at + 1, at + 3)).toEqual([
      '- [Missions, page 2](https://docs.example.test/missions/page/2/): children 51–100 of 120',
      '- [Missions, page 3](https://docs.example.test/missions/page/3/): children 101–120 of 120',
    ]);
    for (let i = 1; i <= 120; i += 1) {
      expect(lines.filter((l) => l.startsWith(`- [Mission ${pad(i)}](`))).toHaveLength(1);
    }
  });

  it('lists no listing line for a hub left out of llms.txt (it hangs off the hub\'s own line)', async () => {
    corpus();
    const hubDoc = entries.find((e) => e.id === 'missions')!;
    hubDoc.data = { ...hubDoc.data, agent: { discoverable: false } };
    publish([['missions', hub(120, 50)]]);
    expect(await llms()).not.toContain('page/2');
  });
});

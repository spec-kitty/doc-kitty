/**
 * T021 - Failure matrix (SC-004): one fixture+assertion per named error, each
 * surfaced on first reproduction within a hard time budget (V8: an untested
 * taxonomy entry fails by absence of evidence).
 *
 * Rows:
 *   UNKNOWN_CONTRACT_MAJOR   version "99" fixture AND a non-numeric-version fixture
 *   UNREACHABLE_ENDPOINT     a 500-serving socket AND a dead port
 *   MALFORMED_CORPUS         a per-page artifact with a required field removed
 *   PAGES_LINKS_GATED        per-page links disabled; degrade announcement
 *   BUILD_IDENTITY_MISMATCH  mixed-buildId fixture WITH buildId emission enabled (V6)
 *   PAGE_NOT_FOUND           unknown id via get_page and via resources/read
 *
 * Budgets: 2 s for fs rows, 10 s for https rows (both far under the WP's
 * 35 s https worst case); vitest's per-test timeout is the hang backstop and
 * the elapsed assertion is the contract under test. Measured numbers print
 * to the test output.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpCorpusSource } from '../../src/corpus/http-source.js';
import { FsCorpusSource } from '../../src/corpus/fs-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import type { LoadEvent } from '../../src/corpus/source.js';
import { resultJson } from '../surface/helpers.js';
import { fixture } from '../corpus/helpers.js';
import { exampleFixtureDir, runFsServer, wp05Fixture } from './harness.js';
import type { RunningServer } from './harness.js';
import { deadLoopbackBase, serveFixture } from './serve-fixture.js';
import { expectedSiteSlug, pageUriFor, projectCorpus } from './projection.js';

const FS_BUDGET_MS = 2_000;
const HTTPS_BUDGET_MS = 10_000; // comfortably under the WP's 35 s https worst case

/** Run `probe`, assert it settles within `budgetMs`, and print the measurement. */
async function withinBudget<T>(label: string, budgetMs: number, probe: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const result = await probe();
  const elapsed = performance.now() - started;
  console.info(`[WP05 T021] ${label}: ${elapsed.toFixed(1)} ms (budget ${budgetMs} ms)`);
  expect(elapsed, `${label} exceeded its hard time budget`).toBeLessThan(budgetMs);
  return result;
}

describe('T021 failure matrix (SC-004)', () => {
  describe('UNKNOWN_CONTRACT_MAJOR', () => {
    it('version "99" fixture: refused at handshake, named on first failure', async () => {
      await withinBudget('UNKNOWN_CONTRACT_MAJOR (version 99, fs)', FS_BUDGET_MS, async () => {
        await expect(loadSnapshot(new FsCorpusSource(fixture('unknown-major')))).rejects.toMatchObject({
          code: 'UNKNOWN_CONTRACT_MAJOR',
          message: expect.stringContaining("'99'"),
        });
      });
    });

    it('non-numeric version fixture: refused at handshake, named on first failure', async () => {
      await withinBudget('UNKNOWN_CONTRACT_MAJOR (version beta, fs)', FS_BUDGET_MS, async () => {
        await expect(loadSnapshot(new FsCorpusSource(fixture('non-numeric-version')))).rejects.toMatchObject({
          code: 'UNKNOWN_CONTRACT_MAJOR',
          message: expect.stringContaining('no numeric contract major'),
        });
      });
    });
  });

  describe('UNREACHABLE_ENDPOINT', () => {
    it('socket listening but serving 500: exactly attempt + ONE retry, then the named error', async () => {
      const served = await serveFixture(wp05Fixture('search-controls'), {
        rewriteFrom: 'https://conformance.example.net/library',
        failStatus: { status: 500, paths: ['/api/index.json'] },
      });
      try {
        await withinBudget('UNREACHABLE_ENDPOINT (500-serving socket)', HTTPS_BUDGET_MS, async () => {
          await expect(loadSnapshot(new HttpCorpusSource(served.base, { timeoutMs: 5_000 }))).rejects.toMatchObject({
            code: 'UNREACHABLE_ENDPOINT',
            message: expect.stringContaining('after the one documented retry'),
          });
        });
        expect(served.requests.get('/api/index.json')).toBe(2); // attempt + exactly one retry
      } finally {
        await served.stop();
      }
    }, 40_000);

    it('dead port (connection refused): the named error immediately, never a hang', async () => {
      const dead = await deadLoopbackBase();
      await withinBudget('UNREACHABLE_ENDPOINT (dead port)', HTTPS_BUDGET_MS, async () => {
        await expect(loadSnapshot(new HttpCorpusSource(dead, { timeoutMs: 5_000 }))).rejects.toMatchObject({
          code: 'UNREACHABLE_ENDPOINT',
        });
      });
    }, 40_000);
  });

  describe('MALFORMED_CORPUS', () => {
    it('required field removed from a page artifact: named with the artifact path and key', async () => {
      await withinBudget('MALFORMED_CORPUS (markdown removed, fs)', FS_BUDGET_MS, async () => {
        await expect(loadSnapshot(new FsCorpusSource(fixture('malformed-markdown')))).rejects.toMatchObject({
          code: 'MALFORMED_CORPUS',
          message: expect.stringContaining('api/pages/context/audience.json: markdown'),
        });
      });
    });
  });

  describe('PAGES_LINKS_GATED', () => {
    it('per-page links disabled: degrade announced (load warning + capabilities), page call named', async () => {
      const events: LoadEvent[] = [];
      let running: RunningServer | undefined;
      await withinBudget('PAGES_LINKS_GATED (degrade announcement, fs)', FS_BUDGET_MS, async () => {
        running = await runFsServer(fixture('gated-pages'), { logger: (e) => events.push(e) });
      });
      try {
        // Announcement one: the load log names the degrade.
        expect(events.some((e) => e.event === 'warning' && (e.message ?? '').includes('PAGES_LINKS_GATED'))).toBe(true);
        // Announcement two: capabilities on get_site_info.
        const info = resultJson(await running!.client.callTool('get_site_info')) as {
          capabilities: Record<string, unknown>;
        };
        expect(info.capabilities.pages).toBe(false);
        // Page-level call: the named error, never synthesized content.
        const page = await running!.client.callTool('get_page', { id: 'home' });
        expect(page.isError).toBe(true);
        expect(page.content?.[0]?.text?.startsWith('PAGES_LINKS_GATED: ')).toBe(true);
      } finally {
        await running!.close();
      }
    });
  });

  describe('BUILD_IDENTITY_MISMATCH', () => {
    it('mixed-buildId fixture with identity emission enabled: named, naming the diverging artifact', async () => {
      await withinBudget('BUILD_IDENTITY_MISMATCH (torn build, fs)', FS_BUDGET_MS, async () => {
        await expect(loadSnapshot(new FsCorpusSource(fixture('torn-build')))).rejects.toMatchObject({
          code: 'BUILD_IDENTITY_MISMATCH',
          message: expect.stringContaining('api/pages/context/audience.json'),
        });
      });
    });
  });

  describe('PAGE_NOT_FOUND', () => {
    let running: RunningServer | undefined;
    beforeAll(async () => {
      running = await runFsServer(exampleFixtureDir());
    });
    afterAll(async () => {
      await running?.close();
    });

    it('unknown id via get_page: the named error inside the tool result', async () => {
      const page = await withinBudget('PAGE_NOT_FOUND (get_page, fs)', FS_BUDGET_MS, async () => {
        return running!.client.callTool('get_page', { id: 'no/such/page' });
      });
      expect(page.isError).toBe(true);
      expect(page.content?.[0]?.text?.startsWith('PAGE_NOT_FOUND: ')).toBe(true);
      expect(page.content?.[0]?.text).toContain('no/such/page');
    });

    it('unknown docs:// uri via resources/read', async () => {
      const info = resultJson(await running!.client.callTool('get_site_info')) as {
        capabilities?: { resources?: unknown };
      };
      expect(info.capabilities?.resources).toBe(true);
      const project = await projectCorpus({ kind: 'fs', dir: exampleFixtureDir() });
      if (running!.view.kind !== 'fs') throw new Error('unreachable');
      const slug = expectedSiteSlug(project, running!.view);
      const read = await withinBudget('PAGE_NOT_FOUND (resources/read, fs)', FS_BUDGET_MS, async () => {
        try {
          return await running!.client.request('resources/read', { uri: pageUriFor(slug, 'no/such/page') });
        } catch (error) {
          return error as Error;
        }
      });
      // Resource reads surface failures as protocol errors; the named code
      // must travel in the message text either way.
      const text = read instanceof Error ? read.message : JSON.stringify(read);
      expect(text).toContain('PAGE_NOT_FOUND');
    });
  });
});

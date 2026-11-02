/**
 * T020 - Seeded-fault self-test (auto-vacuity control; reviewer pin V4's
 * teeth, implementer-lens writable mechanism).
 *
 * The suite's golden comparisons are worthless if they cannot go red. This
 * file re-runs THE SAME sweep the golden suite runs, but against a server
 * launched with the dev-only fault hook engaged:
 *
 *   createServer(snapshot, { ...config, faults: { uppercaseTitles: true } })
 *
 * The hook (mcp/src/server.ts, WP05's sanctioned lane-crossing edit) uppercases
 * every projected page title at the assembly seam, so the tools' projection
 * READS faulted titles while the in-test projection (fixture-derived) keeps
 * the true titles. The field-level byte comparisons must therefore report
 * mismatches - if they do not, this WP fails its own gate.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resultJson } from '../surface/helpers.js';
import { compareFields, formatComparisons } from './compare.js';
import { exampleFixtureDir, runFsServerWithFaults, samplePageIds } from './harness.js';
import { expectedPage, projectCorpus } from './projection.js';
import type { ProjectedCorpus } from './projection.js';
import { conformanceSweep } from './sweep.js';
import type { FieldComparison } from './compare.js';

describe('T020 seeded-fault self-test (auto-vacuity control)', () => {
  describe('fault engaged: uppercaseTitles', () => {
    let corpus: ProjectedCorpus;
    let sampleIds: string[];
    let mismatches: FieldComparison[];

    beforeAll(async () => {
      const dir = exampleFixtureDir();
      const faulted = await runFsServerWithFaults(dir, { uppercaseTitles: true });
      corpus = await projectCorpus({ kind: 'fs', dir });
      sampleIds = samplePageIds(corpus);
      try {
        // The SAME sweep the golden suite runs - one seam, two verdicts.
        mismatches = await conformanceSweep(faulted.client, corpus, faulted.view, {
          sampleIds,
          searchQueries: ['mission alpha'],
          sectionFilters: ['', 'guides'],
        });
      } finally {
        await faulted.close();
      }
    });

    it('the field-level comparisons GO RED with the fault on', () => {
      // If this stays green, the golden suite proves nothing. Do not weaken.
      expect(mismatches.length).toBeGreaterThan(0);
    });

    it('the seeded fault surfaces through title fields (the seam it seeds)', () => {
      const nonTitle = mismatches.filter(
        (m) =>
          !m.path.includes('title') &&
          // search recall is case-insensitive: the seed changes letter case
          // only, so search result SHAPES stay matched; any other mismatch is
          // out of contract for this fault and indicates harness leakage.
          !m.path.startsWith('search_pages'),
      );
      expect(nonTitle, formatComparisons(nonTitle)).toEqual([]);
    });

    it('non-title content still byte-equals under the fault (the seed is surgical)', async () => {
      const dir = exampleFixtureDir();
      const faulted = await runFsServerWithFaults(dir, { uppercaseTitles: true });
      try {
        for (const id of sampleIds.slice(0, 3)) {
          const page = resultJson(await faulted.client.callTool('get_page', { id }));
          const expected = expectedPage(corpus, faulted.view, id);
          const markdownOnly = compareFields(expected.markdown, (page as { markdown: unknown }).markdown, `get_page(${id}).markdown`);
          expect(formatComparisons(markdownOnly)).toBe('(all fields byte-equal)');
          const titleMismatch = compareFields(expected.title, (page as { title: unknown }).title, `get_page(${id}).title`);
          expect(titleMismatch.length, `seeded fault must flip ${id}.title`).toBe(1);
        }
      } finally {
        await faulted.close();
      }
    });
  });
});

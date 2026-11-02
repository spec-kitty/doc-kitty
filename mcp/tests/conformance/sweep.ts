/**
 * The golden conformance sweep (T020): one full field-level byte comparison
 * of every always-on tool against the independent in-test projection
 * (V4 - expectations computed here ONLY from fixture artifact bytes, never
 * from server output; no vitest snapshots anywhere).
 *
 * The SAME sweep function backs the golden assertions (must report zero
 * mismatches) and the seeded-fault self-test (must report at least one), so
 * the auto-vacuity proof genuinely re-runs the suite's own comparisons.
 *
 * Resources (WP04) are NOT part of the sweep: they are asserted separately,
 * conditional on the announced capability flag.
 */
import type { SurfaceClient } from '../surface/harness.js';
import { resultJson } from '../surface/helpers.js';
import { compareFields } from './compare.js';
import type { FieldComparison } from './compare.js';
import {
  expectedListPages,
  expectedPage,
  expectedScenarios,
  expectedSearch,
  expectedSiteInfo,
} from './projection.js';
import type { LaunchView, ProjectedCorpus } from './projection.js';

export interface SweepOptions {
  /** Page ids to exercise through get_page (sampled by the caller). */
  sampleIds: readonly string[];
  /** Search probes (each compared against the in-test recall expectation). */
  searchQueries: readonly string[];
  /** Section ids exercised as the list_pages filter (root '' included by caller). */
  sectionFilters: readonly string[];
}

/**
 * Run every golden comparison once and return ALL field mismatches (empty
 * when the server is byte-honest). Expectations come from projection.ts;
 * actuals come from the wire.
 */
export async function conformanceSweep(
  client: SurfaceClient,
  corpus: ProjectedCorpus,
  view: LaunchView,
  options: SweepOptions,
): Promise<FieldComparison[]> {
  const out: FieldComparison[] = [];

  // get_site_info: field-level byte equality; the resources flag is read, not
  // asserted (WP04 conditionality) - but it must be ANNOUNCED (present).
  const info = resultJson(await client.callTool('get_site_info')) as Record<string, unknown>;
  const expectedInfo = expectedSiteInfo(corpus, view);
  const actualCapabilities = info.capabilities as Record<string, unknown> | undefined;
  compareFields(
    expectedInfo.capabilities,
    { pages: actualCapabilities?.pages, scenarios: actualCapabilities?.scenarios },
    'get_site_info.capabilities',
    out,
  );
  const expectedInfoRest: Record<string, unknown> = { ...expectedInfo };
  delete expectedInfoRest.capabilities;
  const actualInfoRest: Record<string, unknown> = { ...info };
  delete actualInfoRest.capabilities;
  compareFields(expectedInfoRest, actualInfoRest, 'get_site_info', out);
  if (typeof actualCapabilities?.resources !== 'boolean') {
    out.push({ path: 'get_site_info.capabilities.resources', problem: 'capability flag not announced as a boolean' });
  }

  // list_pages: the whole registry, byte-equal in order.
  const listed = resultJson(await client.callTool('list_pages'));
  compareFields(expectedListPages(corpus, view), listed, 'list_pages', out);

  // list_pages with each requested section filter.
  for (const section of options.sectionFilters) {
    const filtered = resultJson(await client.callTool('list_pages', { section }));
    compareFields(expectedListPages(corpus, view, section), filtered, `list_pages(section ${JSON.stringify(section)})`, out);
  }

  // get_page over the sample.
  for (const id of options.sampleIds) {
    const page = resultJson(await client.callTool('get_page', { id }));
    compareFields(expectedPage(corpus, view, id), page, `get_page(${id})`, out);
  }

  // search_pages per probe (recall + precision by byte equality).
  for (const query of options.searchQueries) {
    const searched = resultJson(await client.callTool('search_pages', { query }));
    compareFields(expectedSearch(corpus, view, query), searched, `search_pages(${JSON.stringify(query)})`, out);
  }

  // list_scenarios.
  const scenarios = resultJson(await client.callTool('list_scenarios'));
  compareFields(expectedScenarios(corpus, view), scenarios, 'list_scenarios', out);

  return out;
}

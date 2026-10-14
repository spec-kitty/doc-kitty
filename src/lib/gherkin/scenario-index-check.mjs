/**
 * The scenario index a site advertises must exist (#126, ADR-0054).
 *
 * `llms.txt` (`routes/llms-txt.ts`) advertises `/api/scenarios.json` whenever a
 * published generated feature page exists. The route itself is mounted by the
 * site (`scenarioIndexRoute()`, ADR-0046 decision 9), as every doc-kitty route
 * is: the toolkit injects none (the glossary precedent, ADR-0026). A site that
 * turns on `gherkin.sources` and skips that step would send agents to a 404, so
 * the `doc-kitty:gherkin` integration runs {@link checkScenarioIndexAdvertised}
 * over the build output in `astro:build:done`.
 *
 * Reads the BUILT files, so it agrees with whatever `llms.txt` actually says and
 * whatever route the site actually mounted. Plain `.mjs`, `node:fs` only.
 *
 * @module gherkin/scenario-index-check
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { GHERKIN_LOG_PREFIX as PREFIX } from './text.mjs';

/** The line `llms.txt` starts its scenario-index advertisement with. */
export const SCENARIO_INDEX_LLMS_PREFIX = 'Scenario index: ';

/** Where the scenario index lands in the build output. */
const INDEX_RELPATH = path.join('api', 'scenarios.json');

/**
 * Throw when `<outDir>/llms.txt` advertises the scenario index and
 * `<outDir>/api/scenarios.json` is not a file. No `llms.txt`, or one without the
 * line, passes.
 *
 * @param {string} outDir The build output directory (Astro's `dir`).
 * @returns {void}
 */
export function checkScenarioIndexAdvertised(outDir) {
  const llms = path.join(outDir, 'llms.txt');
  if (!existsSync(llms)) return;
  const advertised = readFileSync(llms, 'utf8')
    .split('\n')
    .some((line) => line.startsWith(SCENARIO_INDEX_LLMS_PREFIX));
  if (!advertised) return;
  const index = path.join(outDir, INDEX_RELPATH);
  if (existsSync(index) && statSync(index).isFile()) return;
  throw new Error(
    `${PREFIX} llms.txt advertises /api/scenarios.json, but the build has no api/scenarios.json, ` +
      'so agents would be sent to a page that does not exist. Mount the scenario index: add ' +
      'src/pages/api/scenarios.json.ts with `export const GET = scenarioIndexRoute();` (imported from ' +
      "'@spec-kitty/doc-toolkit/routes'), passing the same sourceRoot and sourceUrlPrefix as gherkin. " +
      'See "src/pages/* — add the route endpoints" in the consumer setup guide.',
  );
}

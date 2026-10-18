/**
 * The scenario index's page filter, kept apart from `scenario-index.ts` so the
 * `llms.txt` route (every site mounts it) can ask "does this site have any
 * indexed feature pages?" WITHOUT pulling `@cucumber/gherkin` and the `.feature`
 * loader into its module graph. Only the frontmatter helpers and the
 * dependency-free `isGeneratedStamp` check are imported here.
 */
import type { DocKittyFrontmatter } from '../metadata.js';
import { isAgentDiscoverable } from '../metadata.js';
import { isGeneratedStamp } from '../generator-stamp.mjs';

/**
 * True for a page the scenario index lists: a GENERATED feature page (not a
 * hand-authored `kind: Specification` page) that is published and not opted
 * out of agent discovery. Shared by `/api/scenarios.json` and `llms.txt`, which
 * advertises the index only when at least one such page exists.
 */
export function isScenarioIndexed(data: DocKittyFrontmatter): boolean {
  return (
    data.kind === 'Specification' &&
    isGeneratedStamp(data.generated?.by) &&
    isAgentDiscoverable(data)
  );
}

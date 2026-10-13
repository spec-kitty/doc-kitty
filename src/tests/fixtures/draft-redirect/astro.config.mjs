// @ts-check
/*
 * Astro config for the "redirect that ends at a draft" half of
 * `draft-publication-build.test.ts`. It builds the EXAMPLE site
 * (`astro build --config <this file>`, run in `example/`) with one difference
 * from `example/astro.config.mjs`: one more redirect, from an old URL to
 * `/adr/template/`, which is a draft page.
 *
 * The example itself has no such redirect any more: its `plans/missions/` pages
 * were promoted to active, so both of its redirects into that section end at
 * published pages. With drafts off, the toolkit must still warn about this one,
 * leave its stub out of the build, and the redirect-coverage gate must report
 * the old URL as unpublished.
 *
 * `redirects.json` next to this file holds the same extra entry without the
 * site base, in the shape the gate's `--declared-redirects` flag reads.
 */
import { readFileSync } from 'node:fs';
import example from '../../../../example/astro.config.mjs';

const extra = JSON.parse(readFileSync(new URL('./redirects.json', import.meta.url), 'utf8'));

export default {
  ...example,
  redirects: {
    ...example.redirects,
    ...Object.fromEntries(Object.entries(extra).map(([from, to]) => [from, `${example.base}${to}`])),
  },
};

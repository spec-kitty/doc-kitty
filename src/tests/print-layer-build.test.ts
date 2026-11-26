/**
 * `print: true` on its own turns the print layer on in a real build, and a build without
 * it carries none of the layer (ADR-0081 as amended, review of #462 LOW-4). The unit
 * tests cover the option and the manifest separately; this pins the wiring between them
 * on the chrome fixture.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildChromeFixture, NON_HUB_PAGE } from './fixtures/chrome/harness.mjs';

const BUILD_TIMEOUT = 240_000;
/**
 * Markers of the layer: a rule of `print.css`, and the print client's own click selector
 * (`beforeprint` alone would not do: the disclosure control has a print fallback too).
 */
const PRINT_RULE = /@page\s*\{\s*size:\s*A4/;
const HOOK = /\[data-dk-print\]/;

/** The page and every emitted CSS and JS file, as one text. */
function builtText(dist: string): string {
  const assets = path.join(dist, '_astro');
  const files = readdirSync(assets).filter((name) => /\.(css|js)$/.test(name));
  return [readFileSync(path.join(dist, NON_HUB_PAGE), 'utf8'), ...files.map((name) => readFileSync(path.join(assets, name), 'utf8'))].join('\n');
}

describe('the print option in a real build', () => {
  it(
    'print: true alone brings the print rules and the force-light hook',
    () => {
      const build = buildChromeFixture({ options: { print: true } });
      expect(build.status, build.output).toBe(0);
      const text = builtText(build.dist);
      expect(text).toMatch(PRINT_RULE);
      expect(text).toMatch(HOOK);
    },
    BUILD_TIMEOUT,
  );

  it(
    'control: without it, the build carries neither',
    () => {
      const build = buildChromeFixture({ options: {} });
      expect(build.status, build.output).toBe(0);
      const text = builtText(build.dist);
      expect(text).not.toMatch(PRINT_RULE);
      expect(text).not.toMatch(HOOK);
    },
    BUILD_TIMEOUT,
  );
});

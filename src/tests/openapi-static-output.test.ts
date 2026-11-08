/**
 * The static-output guard (mission openapi-second-slice-01M6WXJ4, WP01/T004,
 * C-005): every built OpenAPI reference page is a static page.
 *
 * A reference page is published HTML: whatever it shows was decided at build
 * time. This suite reads every `reference/api/**.html` of a real fixture build
 * (its own root, tagged apart from the seam suite's builds so parallel suites
 * never share one) and refuses the three signs of a page that talks to the
 * network at request time:
 *
 *  - `fetch(` or `XMLHttpRequest` anywhere in the page;
 *  - an inline script naming a raw document URL (`openapi.yaml`/`.json`) —
 *    the spec the page renders must never be re-fetched client-side;
 *  - a request console or other `consoleSignals` (the same reading
 *    `src/scripts/assert-openapi-artifacts.mjs` applies to the example).
 *
 * Green today (the pinned renderer writes static HTML); the guard holds for
 * every later work package of the mission.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consoleSignals } from '../scripts/assert-openapi-artifacts.mjs';
import { buildOpenApiFixture, readAll, removeOpenApiFixtureBuilds } from './helpers/openapi-build';

/** The same two-version request the seam suite builds, under this suite's own tag. */
const REQUEST = {
  fixture: 'two-versions',
  openapi: {
    llmsOperations: true,
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: true },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  },
};

describe('openapi static output (mission openapi-second-slice-01M6WXJ4, WP01)', () => {
  let htmlPages: Map<string, string>;

  beforeAll(() => {
    const built = buildOpenApiFixture(REQUEST, 'static-output');
    expect(built.status, `astro build output:\n${built.output}`).toBe(0);
    htmlPages = new Map(
      [...readAll(built.dist)]
        .filter(([rel]) => rel.startsWith('reference/api/') && rel.endsWith('.html'))
        .map(([rel, bytes]) => [rel, bytes.toString('utf8')]),
    );
  }, 300_000);

  afterAll(() => {
    removeOpenApiFixtureBuilds();
  });

  it('built reference pages to read (positive control)', () => {
    // Two versions, an overview and an operation page each at least.
    expect(htmlPages.size).toBeGreaterThanOrEqual(4);
  });

  it('carries no client-side fetching', () => {
    for (const [rel, html] of htmlPages) {
      expect(html, `${rel} has no fetch call`).not.toContain('fetch(');
      expect(html, `${rel} has no XMLHttpRequest`).not.toContain('XMLHttpRequest');
    }
  });

  it('never names a raw document URL in a script', () => {
    for (const [rel, html] of htmlPages) {
      const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
      for (const [index, body] of scripts.entries()) {
        expect(body, `${rel} inline script #${index} names no raw openapi document`).not.toMatch(/openapi\.(ya?ml|json)/);
      }
    }
  });

  it('shows no request console', () => {
    for (const [rel, html] of htmlPages) {
      expect(consoleSignals(html), `${rel} console signals`).toEqual([]);
    }
  });
});

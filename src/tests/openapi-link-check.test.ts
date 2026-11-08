/**
 * The build-time link gate for rendered OpenAPI pages (mission
 * openapi-second-slice-01M6WXJ4, WP06; FR-009, FR-028, NFR-006).
 *
 * These are real Astro builds, not checks of the checker: the broken cases are
 * red until `openApiPlugin` runs the gate after the raw-document publisher.
 * `assert-no-broken-links.mjs` independently checks the successful root and
 * based outputs too, including the relative-Markdown, route, fragment and raw
 * document targets.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findBrokenLinks } from '../scripts/assert-no-broken-links.mjs';
import { findOpenApiBrokenLinks } from '../lib/integrations/openapi-link-check.js';
import {
  buildOpenApiFixture,
  removeOpenApiFixtureBuilds,
  type OpenApiBuildResult,
  type OpenApiFixtureRequest,
} from './helpers/openapi-build';

const BASE = '/docs-base';
const PAGE_ROUTE = '/reference/api/v1/operations/listparcels/';

/** A minimal spec whose operation description carries the links under test. */
function spec(description: string): string {
  return `openapi: 3.1.0
info:
  title: Link fixture API
  version: 1.0.0
paths:
  /parcels:
    get:
      operationId: listParcels
      summary: List parcels
      description: |
${description
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n')}
      responses:
        '200':
          description: The parcels.
`;
}

function request(description: string, base?: string): OpenApiFixtureRequest {
  return {
    fixture: 'two-versions',
    ...(base === undefined ? {} : { options: { base } }),
    openapi: { specs: [{ path: 'openapi/v1.yaml', label: 'v1', released: true }] },
    files: { 'openapi/v1.yaml': spec(description) },
  };
}

function validDescription(base = ''): string {
  return [
    `[Root-relative route and fragment](${base}/guides/#parcels)`,
    `[Published raw document](${base}/reference/api/v1/openapi.yaml)`,
    '<span id="local-target"></span> [Same-page fragment](#local-target)',
    '[External](https://example.test/spec) [Protocol relative](//example.test/spec)',
    '[Mail](mailto:docs@example.test) [Other scheme](ftp:example.test/file)',
  ].join(' ');
}

// From /reference/api/v1/operations/listparcels/ back to the docs root.
// The general-purpose independent gate deliberately does not rewrite .md links,
// so this WP06-specific build is separate from its root/based gate runs below.
const VALID_MARKDOWN = '[Relative Markdown](../../../../../guides.md#parcels)';

const BROKEN_DESCRIPTION = [
  '[Relative Markdown](./missing.md)',
  '[Root relative](/definitely-missing/)',
  '[Same-page fragment](#definitely-missing)',
  '[Cross-page fragment](/guides/#definitely-missing)',
  '[Query secret](/missing/?token=do-not-print)',
].join(' ');

const DANGEROUS_DESCRIPTION = [
  '[JavaScript](javascript:alert(1))',
  '[Data](data:text/html;base64,PHNjcmlwdD4=)',
  '[VBScript](vbscript:msgbox(1))',
].join(' ');

describe('OpenAPI built-page link check (WP06)', () => {
  let root: OpenApiBuildResult;
  let based: OpenApiBuildResult;
  let markdown: OpenApiBuildResult;
  let broken: OpenApiBuildResult;
  let dangerous: OpenApiBuildResult;

  beforeAll(() => {
    root = buildOpenApiFixture(request(validDescription()), 'link-check-root');
    based = buildOpenApiFixture(request(validDescription(BASE), BASE), 'link-check-based');
    markdown = buildOpenApiFixture(request(VALID_MARKDOWN), 'link-check-markdown');
    broken = buildOpenApiFixture(request(BROKEN_DESCRIPTION), 'link-check-broken');
    dangerous = buildOpenApiFixture(request(DANGEROUS_DESCRIPTION), 'link-check-dangerous');
  }, 600_000);

  afterAll(() => {
    removeOpenApiFixtureBuilds();
  });

  it('[WP06] accepts every resolvable class and skips external links in a root build', () => {
    expect(root.status, `root build output:\n${root.output}`).toBe(0);
    expect(findBrokenLinks(root.dist, '')).toEqual([]);
  });

  it('[WP06] strips the base and reports zero broken links in a based build', () => {
    expect(based.status, `based build output:\n${based.output}`).toBe(0);
    expect(findBrokenLinks(based.dist, BASE)).toEqual([]);
  });

  it('[WP06] maps a relative Markdown link and its fragment to the built route', () => {
    expect(markdown.status, `relative Markdown build output:\n${markdown.output}`).toBe(0);
  });

  it('[WP06] fails relative Markdown, root-relative and fragment failures with route and target', () => {
    expect(broken.status, `broken links must fail the build:\n${broken.output}`).not.toBe(0);
    for (const target of ['./missing.md', '/definitely-missing/', '#definitely-missing', '/guides/#definitely-missing']) {
      expect(broken.output).toContain(`[dk-openapi] ${PAGE_ROUTE}: broken link ${target}`);
    }
    // The target is named, but FR-028 keeps its query string out of diagnostics.
    expect(broken.output).toContain(`[dk-openapi] ${PAGE_ROUTE}: broken link /missing/?…`);
    expect(broken.output).not.toContain('do-not-print');
  });

  it('[WP06] fails javascript, data and vbscript links with route and target', () => {
    expect(dangerous.status, `dangerous links must fail the build:\n${dangerous.output}`).not.toBe(0);
    for (const target of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:msgbox(1)']) {
      expect(dangerous.output).toContain(`[dk-openapi] ${PAGE_ROUTE}: broken link ${target}`);
    }
  });
});

describe('executable-scheme variants on crafted HTML', () => {
  // Not an Astro build: the full builds above cover the plain spellings, and
  // a spec description only yields these variants after Markdown rendering
  // escapes them. Crafting the built HTML pins the decoding steps a browser
  // applies before classifying the URL: named and numeric entities resolve
  // first, then URL-ignored ASCII controls are stripped from the scheme.
  let dist: string;

  beforeAll(() => {
    dist = mkdtempSync(path.join(tmpdir(), 'dk-openapi-scheme-'));
    const page = path.join(dist, 'reference/api/v1/operations/listparcels');
    mkdirSync(page, { recursive: true });
    writeFileSync(
      path.join(page, 'index.html'),
      [
        '<main><article>',
        '<p><a href="JavaScript:alert(1)">mixed case</a></p>',
        '<p><a href="java&#x09;script:alert(2)">tab entity inside the scheme</a></p>',
        '<p><a href="&#106;avascript:alert(3)">numeric entity for the first letter</a></p>',
        '</article></main>',
      ].join('\n'),
    );
  });

  afterAll(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it('[WP06] fails cased and entity-encoded javascript: links after entity decoding', () => {
    // The messages carry the decoded targets: the tab entity stays in the
    // text (only the scheme test strips controls), the numeric entity is
    // resolved to "j" before classification.
    expect(findOpenApiBrokenLinks(dist, { section: 'reference/api' })).toEqual([
      `[dk-openapi] ${PAGE_ROUTE}: broken link JavaScript:alert(1)`,
      `[dk-openapi] ${PAGE_ROUTE}: broken link java\tscript:alert(2)`,
      `[dk-openapi] ${PAGE_ROUTE}: broken link javascript:alert(3)`,
    ]);
  });
});

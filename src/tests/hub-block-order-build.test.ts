/**
 * Hub block order (page-chrome WP02; FR-012, FR-013, SC-002, ADR-0076): on a hub the
 * child cards come before the metadata blocks, and every other page keeps its bytes.
 * Everything is read from real built HTML, and each absence or no-change claim has a
 * positive control on the same build.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildChromeFixture, GOLDEN_DIR, NON_HUB_PAGE, normaliseBuildIds, normaliseFooterAndHeadLinks, normaliseMetadataBlocks } from './fixtures/chrome/harness.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
// A dedicated out-of-tree output dir, as the other example build suites use.
const OUT_DIR_NAME = 'dist-wp02-hub-order-test';
const OUT_DIR = path.join(REPO_ROOT, 'example', OUT_DIR_NAME);
const BUILD_TIMEOUT = 240_000;

const AUDIENCE = 'dk-panel--audience';
const HUB = 'class="dk-hub"';
const RELATED = 'dk-panel--related';
const REFS = 'dk-panel--external-references';
const GLOSSARY = 'dk-panel--glossary';
const METADATA_BLOCKS = [RELATED, REFS, GLOSSARY];

/** Index of the first `needle`; a missing one fails the test, so no order check passes vacuously. */
function at(html: string, needle: string): number {
  const index = html.indexOf(needle);
  expect(index, `${needle} is missing from the page`).toBeGreaterThan(-1);
  return index;
}
const read = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');

function built(request: Parameters<typeof buildChromeFixture>[0] = {}) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  return build;
}

/** Markdown for a fixture hub that carries all four blocks. */
const hubPage = (title: string, body: string) => `---
title: ${title}
description: ${title} fixture page.
doc_status: active
updated: 2026-10-31T00:00:00Z
kind: Hub
audience:
  - profile: reader
    guidance_text: Read the blocks below.
related:
  - guides/getting-started
external_references:
  - url: https://example.test/inline
    title: An inline reference
---

# ${title}

${body}
`;

describe('the example site (FR-012)', () => {
  let exampleBuild: { status: number | null; stderr: string };
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true });
    const env = { ...process.env, DK_OUTDIR: OUT_DIR_NAME };
    delete env.BASE_URL;
    exampleBuild = spawnSync('pnpm', ['--filter', 'example', 'build'], { cwd: REPO_ROOT, encoding: 'utf8', env });
  }, BUILD_TIMEOUT);

  it('builds', () => {
    expect(exampleBuild.status, exampleBuild.stderr).toBe(0);
    expect(existsSync(path.join(OUT_DIR, 'index.html'))).toBe(true);
  });

  it('rhetoric/book-one/: audience, body, child cards, then every metadata block', () => {
    const html = read(OUT_DIR, 'rhetoric/book-one/index.html');
    const body = at(html, 'Book I lays the groundwork');
    const hub = at(html, HUB);
    expect(at(html, AUDIENCE)).toBeLessThan(body);
    expect(body).toBeLessThan(hub);
    for (const block of METADATA_BLOCKS) expect(at(html, block), block).toBeGreaterThan(hub);
  });

  it('behaviour/shipping/ (generated): the cards come before the glossary panel', () => {
    const html = read(OUT_DIR, 'behaviour/shipping/index.html');
    expect(at(html, HUB)).toBeLessThan(at(html, GLOSSARY));
  });
});

describe('the chrome fixture', () => {
  it('a non-hub page matches its pre-mission golden, and has panels (FR-013)', () => {
    const { dist } = built({ options: { sidebar: { collapsed: false } } });
    const html = `${normaliseBuildIds(read(dist, NON_HUB_PAGE))}\n`;
    for (const block of [AUDIENCE, RELATED, REFS, GLOSSARY]) expect(html, block).toContain(block);
    const golden = readFileSync(path.join(GOLDEN_DIR, 'page.html'), 'utf8');
    expect(
      normaliseFooterAndHeadLinks(normaliseMetadataBlocks(html), 'actual') === normaliseFooterAndHeadLinks(normaliseMetadataBlocks(golden), 'golden'),
      'the page differs from the golden outside its blocks and footer links',
    ).toBe(true);
  }, BUILD_TIMEOUT);

  it('a hub with children: cards before the blocks, after the body (FR-012)', () => {
    const { dist } = built({
      files: { 'docs/guides/README.md': hubPage('Guides', 'A hub with children. It talks about cargo, so it has glossary links.') },
    });
    const html = read(dist, 'guides/index.html');
    const body = at(html, 'A hub with children.');
    const hub = at(html, HUB);
    expect(at(html, AUDIENCE)).toBeLessThan(body);
    expect(body).toBeLessThan(hub);
    for (const block of METADATA_BLOCKS) expect(at(html, block), block).toBeGreaterThan(hub);
  }, BUILD_TIMEOUT);

  it('a hub with no children still renders its blocks after the body', () => {
    const { dist } = built({
      files: { 'docs/guides/empty-hub/README.md': hubPage('Empty hub', 'A hub with no children. It talks about cargo.') },
    });
    const html = read(dist, 'guides/empty-hub/index.html');
    expect(html, 'the hub has no cards').not.toContain(HUB);
    const body = at(html, 'A hub with no children.');
    for (const block of [RELATED, REFS]) expect(at(html, block), block).toBeGreaterThan(body);
  }, BUILD_TIMEOUT);

  it('a Hub layout that places nothing still gets its blocks (FR-013)', () => {
    const { dist } = built({
      options: { theme: { name: 'bare-hub', layouts: { Hub: '/src/layouts/BareHub.astro' } } },
      files: {
        'src/layouts/BareHub.astro': '---\n---\n<div data-bare-hub><slot /></div>\n',
        'docs/guides/README.md': hubPage('Guides', 'A hub with children.'),
      },
    });
    const html = read(dist, 'guides/index.html');
    expect(html, 'the theme layout is in use').toContain('data-bare-hub');
    expect(html, 'the bare layout has no cards').not.toContain(HUB);
    const body = at(html, 'A hub with children.');
    for (const block of [AUDIENCE, RELATED, REFS]) expect(at(html, block), block).toBeGreaterThan(-1);
    for (const block of [RELATED, REFS]) expect(at(html, block), block).toBeGreaterThan(body);
  }, BUILD_TIMEOUT);
});

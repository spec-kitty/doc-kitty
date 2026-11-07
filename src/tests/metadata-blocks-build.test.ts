/**
 * Collapsible metadata blocks (page-chrome WP04; FR-014, FR-015, FR-018): what the
 * built HTML and Pagefind's fragment hold. Each absence has a control on the same
 * build. Behaviour in a browser is in `tests/a11y/metadata-blocks.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { buildChromeFixture, DEEP_PAGE, emittedCss, NON_HUB_PAGE, normaliseMetadataBlocks } from './fixtures/chrome/harness.mjs';

const BUILD_TIMEOUT = 240_000;
const NO_GLOSSARY = { '.contextive/definitions.yaml': null };
/** What `guides/getting-started` declares, and how each block counts it. */
const AUDIENCE = { id: 'dk-block-audience', label: 'Who is this for', count: 1, row: 'dk-audience__item' };
const RELATED = { id: 'dk-block-related', label: 'Related', count: 1, row: 'dk-related__item', nav: 'Related pages' };
const REFS = { id: 'dk-block-external-references', label: 'External references', count: 2, row: 'dk-references__item', nav: 'External references' };
const GLOSSARY = { id: 'dk-block-glossary', label: 'Glossary links used', count: 1, row: 'dk-glossary-links__item', nav: 'Glossary links used' };
const STANDALONE_BLOCKS = [AUDIENCE, RELATED, REFS];
const ALL_BLOCKS = [...STANDALONE_BLOCKS, GLOSSARY];
const SCRIPT = /<script type="module" src="[^"]*\/MetadataBlock\.astro[^"]*"><\/script>/g;

function built(request: Parameters<typeof buildChromeFixture>[0] = {}) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  return build;
}
const read = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');

/** One `<details>`, from its open tag to its close; the blocks hold no nested one. */
function details(html: string, id: string) {
  const open = html.indexOf(`<details id="${id}"`);
  expect(open, `${id} is not on the page`).toBeGreaterThan(-1);
  return html.slice(open, html.indexOf('</details>', open));
}
const isOpen = (block: string) => /^<details id="[^"]+" open\b/.test(block);

function expectBlock(html: string, spec: (typeof ALL_BLOCKS)[number], open: boolean) {
  const block = details(html, spec.id);
  expect(isOpen(block), `${spec.id} open`).toBe(open);
  expect(block, `${spec.id} summary`).toContain(`<summary><span class="dk-eyebrow">${spec.label}</span> (${spec.count})</summary>`);
  expect(block.split(`class="${spec.row}`).length - 1, `${spec.id}: the count is the number of rows`).toBe(spec.count);
  expect(html, `${spec.id} expanded label`).toContain(`data-label-expanded="Hide ${spec.label} (${spec.count})"`);
  expect(html, `${spec.id} collapsed label`).toContain(`data-label-collapsed="Show ${spec.label} (${spec.count})"`);
  if ('nav' in spec) expect(block, `${spec.id} landmark`).toContain(`role="navigation" aria-label="${spec.nav}"`);
  else expect(block, `${spec.id} is not a landmark`).not.toContain('role="navigation"');
}

/** Markdown for a fixture hub with no glossary term in it. */
const hubPage = `---
title: Guides
description: Guides fixture page.
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

# Guides

A hub with children.
`;

describe('blocks start collapsed by default (FR-014)', () => {
  it('each is a closed details with its label and count, on the glossary path', () => {
    const html = read(built().dist, NON_HUB_PAGE);
    expect(html, 'the glossary form renders').toContain('class="dk-on-this-page"');
    for (const block of ALL_BLOCKS) expectBlock(html, block, false);
  }, BUILD_TIMEOUT);

  it('a page holds one script tag and the sheet, however many blocks it has', () => {
    const { dist } = built();
    const html = read(dist, NON_HUB_PAGE);
    expect(html.match(/data-dk-disclosure/g)).toHaveLength(ALL_BLOCKS.length);
    expect(html.match(SCRIPT)).toHaveLength(1);
    expect(html).toMatch(/<style>[^<]*\.dk-disclosure/);
    expect(emittedCss(dist), 'the sheet is inline, not an emitted file').not.toContain('dk-disclosure');
  }, BUILD_TIMEOUT);

  it('a page holds one script tag with the custom sidebar (titleIsIndex) too', () => {
    const { dist } = built({ options: { sidebar: { titleIsIndex: true } } });
    const html = read(dist, NON_HUB_PAGE);
    expect(html.match(/data-dk-disclosure/g), 'control: the blocks and the sidebar both render controls').not.toHaveLength(0);
    for (const block of ALL_BLOCKS) details(html, block.id);
    const scripts = html.match(SCRIPT) ?? [];
    expect(scripts, 'the client runs once').toHaveLength(1);
    const chunks = readdirSync(path.join(dist, '_astro')).filter((file) => file.startsWith('MetadataBlock.astro') && file.endsWith('.js'));
    expect(chunks, 'one chunk').toHaveLength(1);
  }, BUILD_TIMEOUT);

  it('a page with no entries renders no control and loads no script', () => {
    const { dist } = built();
    const empty = read(dist, DEEP_PAGE);
    expect(empty).not.toContain('data-dk-disclosure');
    expect(empty).not.toMatch(SCRIPT);
    expect(empty).not.toContain('(0)');
    expect(read(dist, NON_HUB_PAGE), 'control: a page with entries has both').toMatch(SCRIPT);
  }, BUILD_TIMEOUT);
});

describe('metadataBlocks.collapsed: false (FR-015)', () => {
  it('opens every block on the same page, and changes nothing else', () => {
    const open = read(built({ options: { metadataBlocks: { collapsed: false } } }).dist, NON_HUB_PAGE);
    const closed = read(built().dist, NON_HUB_PAGE);
    for (const block of ALL_BLOCKS) expectBlock(open, block, true);
    expect(open, 'control: this is another build').not.toBe(closed);
    expect(open.replace(/(<details id="dk-block-[^"]+") open\b/g, '$1')).toBe(closed);
  }, BUILD_TIMEOUT);
});

describe('with no glossary: the standalone blocks', () => {
  it('a non-hub page: closed, counted, inside the layout, with no glossary block', () => {
    const html = read(built({ files: NO_GLOSSARY }).dist, NON_HUB_PAGE);
    expect(html, 'the standalone form renders').not.toContain('class="dk-on-this-page"');
    expect(html).not.toContain('dk-panel--glossary');
    for (const block of STANDALONE_BLOCKS) expectBlock(html, block, false);
    expect(html.indexOf(REFS.id), 'standalone order: Related, then External references').toBeGreaterThan(html.indexOf(RELATED.id));
    expect(html.match(SCRIPT)).toHaveLength(1);
    // The standalone blocks keep their scoped list reset, where OnThisPage's is inline.
    expect(details(html, RELATED.id)).not.toContain('style="list-style:none');
    expect(details(read(built().dist, NON_HUB_PAGE), RELATED.id), 'control').toContain('style="list-style:none');
  }, BUILD_TIMEOUT);

  it('a hub: real Related and ExternalReferences outside the layout, after the cards', () => {
    const html = read(built({ files: { ...NO_GLOSSARY, 'docs/guides/README.md': hubPage } }).dist, 'guides/index.html');
    expect(html).not.toContain('class="dk-on-this-page"');
    const cards = html.indexOf('class="dk-hub"');
    expect(cards, 'the hub has its cards').toBeGreaterThan(-1);
    expect(html.indexOf(AUDIENCE.id), 'the audience is before the cards').toBeLessThan(cards);
    expect(html.indexOf(RELATED.id), 'related').toBeGreaterThan(cards);
    expect(html.indexOf(REFS.id), 'references').toBeGreaterThan(html.indexOf(RELATED.id));
    expectBlock(html, AUDIENCE, false);
    expectBlock(html, RELATED, false);
    expectBlock(html, { ...REFS, count: 1 }, false);
    expect(html.match(SCRIPT)).toHaveLength(1);
  }, BUILD_TIMEOUT);

  it('opens with the option there too (FR-015)', () => {
    const html = read(built({ options: { metadataBlocks: { collapsed: false } }, files: NO_GLOSSARY }).dist, NON_HUB_PAGE);
    for (const block of STANDALONE_BLOCKS) expectBlock(html, block, true);
  }, BUILD_TIMEOUT);
});

describe("a collapsed block stays in the page's search fragment (FR-018)", () => {
  /** The decompressed fragment of one page: a url-scoped search, not the whole index. */
  function fragment(dist: string, urlSuffix: string): string {
    const dir = path.join(dist, 'pagefind', 'fragment');
    const texts = readdirSync(dir)
      .filter((name) => name.endsWith('.pf_fragment'))
      .map((name) => gunzipSync(readFileSync(path.join(dir, name))).toString('utf8'));
    const own = texts.filter((text) => /"url":"([^"]*)"/.exec(text)?.[1].endsWith(urlSuffix));
    expect(own, `one fragment for ${urlSuffix}`).toHaveLength(1);
    return own[0];
  }

  it('holds a word only that closed block has, a word outside it, and not another page\'s', () => {
    const { dist } = built();
    const html = read(dist, NON_HUB_PAGE);
    const text = fragment(dist, '/guides/getting-started/');

    const sentinel = 'An inline reference';
    const refs = details(html, REFS.id);
    expect(isOpen(refs), 'the block is closed').toBe(false);
    expect(refs, 'the word is in the block').toContain(sentinel);
    expect(normaliseMetadataBlocks(html), 'and only there').not.toContain(sentinel);
    expect(text).toContain(sentinel);

    expect(text, 'control: a word outside the block').toContain('A non-hub page with all four metadata blocks');
    const elsewhere = 'A published page with no feed date';
    expect(read(dist, 'guides/undated/index.html'), 'the other page has it').toContain(elsewhere);
    expect(html).not.toContain(elsewhere);
    expect(text, 'control: a word not on the page').not.toContain(elsewhere);
  }, BUILD_TIMEOUT);
});

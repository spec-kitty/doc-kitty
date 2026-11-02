/**
 * resources/read (T018/T019): byte-projection rules and the named error
 * taxonomy.
 *
 *   - HTTPS-mode byte-equality has no fixture path in-process (the harness is
 *     fs-driven); the fs passthrough branch IS the same serve-raw code path,
 *     and WP05's conformance suite drives the real HTTPS goldens. Both fs
 *     projection rules are pinned here instead:
 *       1. no effective link rewrite -> served body byte-equals the disk
 *          artifact;
 *       2. explicit --link-base -> content fields byte-equal the disk
 *          artifact fields, exactly the carve-out link fields (links, source,
 *          url, _links hrefs) carry the re-origining, and the whole body
 *          equals the in-test independent projection.
 *   - sections resolve to their metadata document with pinned byte shape.
 *   - unknown URIs are PAGE_NOT_FOUND; pages-family reads on a pages-gated
 *     corpus are PAGES_LINKS_GATED (named error leading the wire message).
 *   - identity: two servers over the same site mint identical URIs (the
 *     canonical-slug rule), nested ids resolve through the /pages/ prefix.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixture } from '../corpus/helpers.js';
import { SurfaceClient, WireError } from '../surface/harness.js';
import { connectResources, readResource } from './helpers.js';

const SLUG = 'spec-kitty-github-io-doc-kitty';

/** The carve-out link-field set, named in contracts/mcp-surface.md (FR-010 data / FR-007). */
const LINK_CONTAINER_KEYS = new Set(['links', '_links']);
const LINK_STRING_KEYS = new Set(['source', 'url']);

describe('resources/read byte projection (fs mode)', () => {
  it('serves the page body byte-equal to the disk artifact when no rewrite applies', async () => {
    // The fixture's declared origin IS the effective link base: re-origining
    // is the identity, so FR-010's fs rule reduces to byte-equality.
    const { client } = await connectResources('example');
    try {
      const contents = await readResource(client, `docs://${SLUG}/pages/guides/getting-started`);
      expect(contents).toHaveLength(1);
      expect(contents[0]!.uri).toBe(`docs://${SLUG}/pages/guides/getting-started`);
      expect(contents[0]!.mimeType).toBe('application/json');
      expect(contents[0]!.text).toBe(
        readFileSync(`${fixture('example')}/api/pages/guides/getting-started.json`, 'utf8'),
      );
    } finally {
      await client.close();
    }
  });

  it('rewrites exactly the carve-out link fields under an explicit link base', async () => {
    const linkBase = 'https://docs.example.test/elsewhere';
    // uris.ts pin: with an explicit --link-base the refs carry the rewrite
    // target and the docs:// identity follows it.
    const rewoundSlug = 'docs-example-test-elsewhere';
    const { client } = await connectResources('example', { linkBase });
    try {
      const pageId = 'guides/getting-started';
      const contents = await readResource(client, `docs://${rewoundSlug}/pages/${pageId}`);
      const served = contents[0]!.text!;
      const diskRaw = readFileSync(`${fixture('example')}/api/pages/${pageId}.json`, 'utf8');

      // Link fields differ: the declared origin rebases to the launch override.
      const declared = 'https://spec-kitty.github.io/doc-kitty';
      const servedJson = JSON.parse(served) as Record<string, unknown>;
      const diskJson = JSON.parse(diskRaw) as Record<string, unknown>;
      expect(servedJson.source).toBe(`${linkBase}/api/pages/${pageId}.json`);
      expect(servedJson.url).toBe(`${linkBase}/guides/getting-started/`);
      expect(diskJson.source).toBe(`${declared}/api/pages/${pageId}.json`);

      // Content fields byte-equal (FR-010 carve-out: markdown and metadata
      // values are never rewritten).
      expect(servedJson.markdown).toBe(diskJson.markdown);
      expect(servedJson.title).toBe(diskJson.title);
      expect(servedJson.keywords).toEqual(diskJson.keywords);

      // The whole body equals the in-test independent projection: parse the
      // disk bytes, rebase ONLY the documented link fields, serialize with
      // the adapter's documented formatting (two-space JSON).
      const expectation = rebaseLinkFields(JSON.parse(diskRaw) as unknown, declared, linkBase);
      expect(served).toBe(JSON.stringify(expectation, null, 2));
    } finally {
      await client.close();
    }
  });

  it('frames nested page ids through the single /pages/ form', async () => {
    const { client } = await connectResources('example');
    try {
      const contents = await readResource(client, `docs://${SLUG}/pages/context/audience`);
      expect(contents[0]!.text).toBe(readFileSync(`${fixture('example')}/api/pages/context/audience.json`, 'utf8'));
    } finally {
      await client.close();
    }
  });
});

describe('resources/read sections', () => {
  it('serves a section metadata document byte-pinned to the registry fields', async () => {
    const { client } = await connectResources('example');
    try {
      const contents = await readResource(client, `docs://${SLUG}/sections/guides`);
      expect(contents).toHaveLength(1);
      expect(contents[0]!.uri).toBe(`docs://${SLUG}/sections/guides`);
      expect(contents[0]!.mimeType).toBe('application/json');
      // Byte-pinned shape: registry fields, pinned key order, two-space JSON.
      expect(contents[0]!.text).toBe(JSON.stringify({ id: 'guides', label: 'Guides', order: 40 }, null, 2));
    } finally {
      await client.close();
    }
  });

  it('serves the synthesized site-root section by its well-known empty id', async () => {
    const { client, snapshot } = await connectResources('example');
    try {
      expect(snapshot.sections[0]).toEqual({ id: '', label: '', order: 0 });
      const contents = await readResource(client, `docs://${SLUG}/sections/`);
      expect(contents[0]!.text).toBe(JSON.stringify({ id: '', label: '', order: 0 }, null, 2));
    } finally {
      await client.close();
    }
  });
});

describe('resources/read named errors', () => {
  it('PAGE_NOT_FOUND for unknown pages, sections, foreign slugs and non-docs URIs', async () => {
    const { client } = await connectResources('example');
    try {
      for (const uri of [
        `docs://${SLUG}/pages/guides/no-such-page`,
        `docs://${SLUG}/pages/`, // empty page id - page ids are never empty
        `docs://${SLUG}/sections/no-such-section`,
        'docs://some-other-site/pages/home', // not this server's site
        'https://spec-kitty.github.io/doc-kitty/api/pages/home.json', // not a docs:// resource at all
      ]) {
        const error = await readError(client, uri);
        expect(error.message).toMatch(/^PAGE_NOT_FOUND: /);
        expect(error.message).toContain(uri);
        expect(error.message).toContain('spec-kitty-github-io-doc-kitty');
      }
    } finally {
      await client.close();
    }
  });

  it('PAGES_LINKS_GATED for pages-family reads on a pages-gated corpus', async () => {
    const { client } = await connectResources('gated-pages');
    try {
      for (const uri of ['docs://spec-kitty-github-io-doc-kitty/pages/home', 'docs://any-slug/pages/anything']) {
        const error = await readError(client, uri);
        expect(error.message).toMatch(/^PAGES_LINKS_GATED: /);
        expect(error.message).toContain(uri);
      }
      // Sections are not page-gated - on a pageless fs corpus no identity is
      // mintable at all, so the section family is a plain not-found.
      const error = await readError(client, 'docs://spec-kitty-github-io-doc-kitty/sections/guides');
      expect(error.message).toMatch(/^PAGE_NOT_FOUND: /);
    } finally {
      await client.close();
    }
  });
});

describe('resource identity (canonical slug rule)', () => {
  it('two servers over the same site mint identical URIs', async () => {
    const first = await connectResources('example');
    const second = await connectResources('example');
    try {
      expect(await listTemplatesUris(first.client)).toEqual(await listTemplatesUris(second.client));
      const firstList = (await first.client.request('resources/list', {})) as { resources: unknown[] };
      const secondList = (await second.client.request('resources/list', {})) as { resources: unknown[] };
      expect(firstList).toEqual(secondList);
      expect(firstList.resources.length).toBeGreaterThan(0);

      // The contract pins exactly one page-identity form: /pages/, plural.
      const uris = (firstList.resources as Array<{ uri: string }>).map((r) => r.uri);
      expect(uris.some((u) => /\/page\//.test(u))).toBe(false);
    } finally {
      await first.client.close();
      await second.client.close();
    }
  });
});

/** Send resources/read and return the wire error (JSON-RPC error object). */
async function readError(client: SurfaceClient, uri: string): Promise<WireError> {
  try {
    await readResource(client, uri);
  } catch (error) {
    expect(error).toBeInstanceOf(WireError);
    return error as WireError;
  }
  throw new Error(`expected resources/read of ${uri} to fail`);
}

async function listTemplatesUris(client: SurfaceClient): Promise<string[]> {
  const result = (await client.request('resources/templates/list', {})) as {
    resourceTemplates: Array<{ uriTemplate: string }>;
  };
  return result.resourceTemplates.map((t) => t.uriTemplate);
}

/**
 * In-test independent projection of the FR-007 rewrite (never imported from
 * the implementation): rebase, in place, strings under `source`/`url` and
 * `href` values inside `links`/`_links` containers, from the declared base to
 * the link base; everything else passes through untouched.
 */
function rebaseLinkFields(value: unknown, declared: string, target: string): unknown {
  walk(value, false);
  return value;
  function walk(node: unknown, inLinkContainer: boolean): void {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inLinkContainer);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'href' && inLinkContainer && typeof child === 'string') {
        (node as Record<string, unknown>)[key] = rebase(child);
      } else if (LINK_STRING_KEYS.has(key) && typeof child === 'string') {
        (node as Record<string, unknown>)[key] = rebase(child);
      } else {
        walk(child, inLinkContainer || LINK_CONTAINER_KEYS.has(key));
      }
    }
  }
  function rebase(text: string): string {
    if (text === declared) return target;
    if (text.startsWith(`${declared}/`)) return `${target}${text.slice(declared.length)}`;
    return text;
  }
}

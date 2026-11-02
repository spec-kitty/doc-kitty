/**
 * resources/list + resources/templates/list (T019): the size gate's two
 * branches. Listed mode on the full example corpus (70 pages <= 1000
 * default): every page and every section is listed with name/uri/description
 * from the published fields, and the one pinned template is advertised.
 * Gated mode (threshold forced below the example page count): the list is
 * EMPTY while the template stays registered. A pageless fs corpus (gated
 * fixture) mints no identities at all: both listings empty out.
 */
import { describe, expect, it } from 'vitest';
import { listResources, listResourceTemplates, connectResources } from './helpers.js';

const EXAMPLE_SLUG = 'spec-kitty-github-io-doc-kitty';

describe('resources/list in listed mode (example corpus, default threshold)', () => {
  it('declares the resources capability in the handshake', async () => {
    const { client } = await connectResources('example');
    try {
      expect(client.initializeResult.capabilities.resources).toEqual({ listChanged: false });
    } finally {
      await client.close();
    }
  });

  it('lists every page with the canonical /pages/ URI and published fields, then every section', async () => {
    const { client, snapshot } = await connectResources('example');
    try {
      const resources = await listResources(client);

      // Gating reads the SNAPSHOT's post-filter page count, and the listing
      // covers exactly pages + sections, pages in registry order first.
      expect(snapshot.pages.length).toBeLessThanOrEqual(1000);
      expect(resources.length).toBe(snapshot.pages.length + snapshot.sections.length);

      const listedPages = resources.slice(0, snapshot.pages.length);
      expect(listedPages.map((r) => r.uri)).toEqual(
        snapshot.pages.map((page) => `docs://${EXAMPLE_SLUG}/pages/${page.id}`),
      );
      for (const [index, page] of snapshot.pages.entries()) {
        const entry = listedPages[index]!;
        expect(entry).toEqual({
          uri: `docs://${EXAMPLE_SLUG}/pages/${page.id}`,
          name: page.title,
          description: page.description,
          mimeType: 'application/json',
        });
      }

      const listedSections = resources.slice(snapshot.pages.length);
      expect(listedSections.map((r) => r.uri)).toEqual(
        snapshot.sections.map((section) => `docs://${EXAMPLE_SLUG}/sections/${section.id}`),
      );
      for (const [index, section] of snapshot.sections.entries()) {
        const entry = listedSections[index]!;
        expect(entry.uri).toBe(`docs://${EXAMPLE_SLUG}/sections/${section.id}`);
        expect(entry.name).toBe(section.label);
        expect(entry.mimeType).toBe('application/json');
        // description is the registry purpose - omitted when the registry omits it
        // (the whole example registry carries no purpose fields).
        expect(entry.description).toBeUndefined();
      }
    } finally {
      await client.close();
    }
  });

  it('advertises exactly the pinned docs://<site-slug>/pages/{id} template', async () => {
    const { client } = await connectResources('example');
    try {
      const templates = await listResourceTemplates(client);
      expect(templates).toEqual([
        {
          name: 'page',
          uriTemplate: `docs://${EXAMPLE_SLUG}/pages/{id}`,
          title: 'DocKitty page',
          description: expect.stringContaining('read-by-URI'),
          mimeType: 'application/json',
        },
      ]);
    } finally {
      await client.close();
    }
  });
});

describe('resources/list in gated mode (threshold forced below the page count)', () => {
  it('lists nothing, still advertises the template, and keeps read-by-URI working', async () => {
    const loaded = await connectResources('example');
    const pageCount = loaded.snapshot.pages.length;
    await loaded.client.close();
    const { client, snapshot } = await connectResources('example', { threshold: pageCount - 1 });
    try {
      expect(await listResources(client)).toEqual([]);

      const templates = await listResourceTemplates(client);
      expect(templates.map((t) => t.uriTemplate)).toEqual([`docs://${EXAMPLE_SLUG}/pages/{id}`]);

      // Above the threshold read-by-URI keeps working (R4): every minted URI resolves.
      const page = snapshot.pages.find((p) => p.id === 'guides/getting-started')!;
      const contents = (await client.request('resources/read', {
        uri: `docs://${EXAMPLE_SLUG}/pages/${page.id}`,
      })) as { contents: Array<{ uri: string; text?: string }> };
      expect(contents.contents).toHaveLength(1);
      expect(contents.contents[0]!.uri).toBe(`docs://${EXAMPLE_SLUG}/pages/${page.id}`);
      expect(contents.contents[0]!.text).toBe(page.raw);

      // The capability stays declared in gated mode too.
      expect(client.initializeResult.capabilities.resources).toEqual({ listChanged: false });
    } finally {
      await client.close();
    }
  });

  it('gates on the snapshot count, not a config echo (boundary: threshold == page count lists)', async () => {
    const loaded = await connectResources('example');
    const pageCount = loaded.snapshot.pages.length;
    await loaded.client.close();
    const { client, snapshot } = await connectResources('example', { threshold: pageCount });
    try {
      const resources = await listResources(client);
      expect(resources.length).toBe(snapshot.pages.length + snapshot.sections.length);
    } finally {
      await client.close();
    }
  });
});

describe('resources surface on a pageless fs corpus (gated-pages fixture)', () => {
  it('mints no identities: capability declared, both listings empty, reads named-gated', async () => {
    const { client, snapshot } = await connectResources('gated-pages');
    try {
      expect(snapshot.pagesGated).toBe(true);
      expect(snapshot.pages).toHaveLength(0);
      expect(client.initializeResult.capabilities.resources).toEqual({ listChanged: false });

      // No identity can be minted without page refs - never from the local dir.
      expect(await listResources(client)).toEqual([]);
      expect(await listResourceTemplates(client)).toEqual([]);
    } finally {
      await client.close();
    }
  });
});

import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DocKittyTheme } from '../lib/theme.js';
import { faviconHref, docKittyFavicon, DK_FAVICON_BASENAME } from '../lib/favicon.js';

/**
 * Regression cover for the nightly-smoke Lighthouse failure.
 *
 * The Spec Kitty brand declares `assets.favicon` as a PACKAGE SPECIFIER
 * (`@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg`), but
 * Starlight's `favicon` option is a path served from the site root — it is
 * emitted verbatim into `<link rel="icon" href>` (base-prefixed by Starlight).
 * Handing it a bare specifier produced a live 404
 * (`/doc-kitty/@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg`),
 * which Lighthouse counts as a console error and which failed the
 * `errors-in-console <= 0` assertion every night.
 *
 * The fix: the toolkit resolves the specifier and EMITS the file at a stable
 * site-root path, and hands Starlight that path instead.
 */

describe('faviconHref', () => {
  it('is undefined when the theme declares no favicon', () => {
    expect(faviconHref(undefined)).toBeUndefined();
  });

  it('maps a bare package specifier to the emitted site-root path', () => {
    expect(faviconHref('@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg')).toBe(
      `/${DK_FAVICON_BASENAME}.svg`,
    );
  });

  it('never hands Starlight a bare specifier (the 404 that broke the nightly)', () => {
    const href = faviconHref('@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg');
    expect(href).not.toContain('@commondocs-kitty');
    expect(href!.startsWith('/')).toBe(true);
  });

  it('keeps the source extension so Starlight derives the right MIME type', () => {
    expect(faviconHref('some-theme/assets/mark.ico')).toBe(`/${DK_FAVICON_BASENAME}.ico`);
  });

  it('passes a site-root path through untouched (already a public/ asset)', () => {
    expect(faviconHref('/favicon.svg')).toBe('/favicon.svg');
    expect(faviconHref('/brand/mark.ico')).toBe('/brand/mark.ico');
  });
});

describe('docKittyFavicon integration', () => {
  /** A throwaway package whose `exports` map mirrors the toolkit's `./themes/*`. */
  function fixturePackage(): { specifier: string; resolveFrom: string; bytes: string } {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-favicon-'));
    const pkgDir = path.join(root, 'node_modules', '@fixture', 'toolkit');
    mkdirSync(path.join(pkgDir, 'assets'), { recursive: true });
    writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@fixture/toolkit', exports: { './assets/*': './assets/*' } }),
    );
    const bytes = '<svg xmlns="http://www.w3.org/2000/svg"><title>fixture</title></svg>';
    writeFileSync(path.join(pkgDir, 'assets', 'favicon.svg'), bytes);
    return {
      specifier: '@fixture/toolkit/assets/favicon.svg',
      // `resolveFrom` must be a module INSIDE the temp tree for node_modules
      // lookup to find the fixture package.
      resolveFrom: pathToFileURL(path.join(root, 'astro.config.mjs')).href,
      bytes,
    };
  }

  it('copies the resolved favicon into the build output at the emitted path', async () => {
    const { specifier, resolveFrom, bytes } = fixturePackage();
    const outDir = mkdtempSync(path.join(tmpdir(), 'dk-dist-'));

    const integration = docKittyFavicon(specifier, { resolveFrom });
    await integration.hooks['astro:build:done']!({
      dir: pathToFileURL(`${outDir}/`),
      logger: { warn: vi.fn(), info: vi.fn() },
    } as never);

    const emitted = path.join(outDir, `${DK_FAVICON_BASENAME}.svg`);
    expect(existsSync(emitted)).toBe(true);
    expect(readFileSync(emitted, 'utf8')).toBe(bytes);
  });

  it('is a no-op when the theme declares no favicon', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'dk-dist-'));
    const integration = docKittyFavicon(undefined, {});
    await integration.hooks['astro:build:done']!({
      dir: pathToFileURL(`${outDir}/`),
      logger: { warn: vi.fn(), info: vi.fn() },
    } as never);
    expect(existsSync(path.join(outDir, `${DK_FAVICON_BASENAME}.svg`))).toBe(false);
  });

  it('is a no-op for a site-root path (the consumer already ships it in public/)', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'dk-dist-'));
    const integration = docKittyFavicon('/favicon.svg', {});
    await integration.hooks['astro:build:done']!({
      dir: pathToFileURL(`${outDir}/`),
      logger: { warn: vi.fn(), info: vi.fn() },
    } as never);
    expect(existsSync(path.join(outDir, `${DK_FAVICON_BASENAME}.svg`))).toBe(false);
  });

  it('warns instead of throwing when the specifier cannot be resolved', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'dk-dist-'));
    const warn = vi.fn();
    const integration = docKittyFavicon('@nope/missing/assets/favicon.svg', {});
    await integration.hooks['astro:build:done']!({
      dir: pathToFileURL(`${outDir}/`),
      logger: { warn, info: vi.fn() },
    } as never);
    expect(warn).toHaveBeenCalled();
    expect(existsSync(path.join(outDir, `${DK_FAVICON_BASENAME}.svg`))).toBe(false);
  });
});

// --- The config wiring: what Starlight actually receives. ---------------------

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

type Captured = {
  favicon?: string;
  head?: { tag: string; attrs: Record<string, string> }[];
};

function starlightConfigOf(integrations: unknown[]): Captured {
  const entry = integrations.find(
    (i): i is { __starlightConfig: Captured } =>
      typeof i === 'object' && i !== null && '__starlightConfig' in i,
  );
  if (!entry) throw new Error('no Starlight integration captured');
  return entry.__starlightConfig;
}

const specifierFaviconTheme: DocKittyTheme = {
  name: 'fixture-brand',
  assets: { favicon: '@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg' },
};

describe('defineDocKittyIntegrations favicon + discovery head', () => {
  it('hands Starlight the emitted path, not the package specifier', () => {
    const config = starlightConfigOf(
      defineDocKittyIntegrations({ title: 'Docs', theme: specifierFaviconTheme }),
    );
    expect(config.favicon).toBe(`/${DK_FAVICON_BASENAME}.svg`);
  });

  it('registers the favicon-emitting integration alongside Starlight', () => {
    const integrations = defineDocKittyIntegrations({
      title: 'Docs',
      theme: specifierFaviconTheme,
    }) as { name: string }[];
    expect(integrations.map((i) => i.name)).toContain('doc-kitty:favicon');
  });

  it('base-prefixes the rss.xml and llms.txt discovery links', () => {
    const config = starlightConfigOf(
      defineDocKittyIntegrations({ title: 'Docs', base: '/doc-kitty' }),
    );
    const hrefs = (config.head ?? []).map((h) => h.attrs?.href);
    expect(hrefs).toContain('/doc-kitty/rss.xml');
    expect(hrefs).toContain('/doc-kitty/llms.txt');
  });

  it('emits root-relative discovery links when there is no base', () => {
    const config = starlightConfigOf(defineDocKittyIntegrations({ title: 'Docs' }));
    const hrefs = (config.head ?? []).map((h) => h.attrs?.href);
    expect(hrefs).toContain('/rss.xml');
    expect(hrefs).toContain('/llms.txt');
  });
});

/**
 * The `doc-kitty:subprocessors` integration (ADR-0086 decision 4): file-gated,
 * fails the build at `astro:config:setup` with one aggregate error, and injects
 * the API and feed routes only when the catalog exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SUBPROCESSORS_API_ENTRYPOINT,
  SUBPROCESSORS_FEED_ENTRYPOINT,
  SUBPROCESSORS_MODULE_ID,
  subprocessorsIntegration,
} from '../lib/integrations/subprocessors.js';

const VALID = `- id: acme-hosting
  name: Acme Hosting B.V.
  processing: Hosting.
  location: [NL]
  responsibilities: Acme operates the infrastructure.
  since: 2025-01-15
  tom_classification: [physical-security]
- id: beta-mail
  name: Beta Mail Ltd
  processing: Transactional email.
  location: [IE]
  responsibilities: Beta delivers mail.
  since: 2027-03-01
`;

/** A throwaway site: `<dir>/docs/...` plus any `src/...` files. */
function site(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-subprocessors-site-'));
  mkdirSync(path.join(dir, 'docs', '_meta'), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

function setup(dir: string) {
  const ctx = {
    config: { root: pathToFileURL(`${dir}${path.sep}`), srcDir: pathToFileURL(`${path.join(dir, 'src')}${path.sep}`) },
    injectRoute: vi.fn(),
    updateConfig: vi.fn(),
    addWatchFile: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn() },
  };
  const integration = subprocessorsIntegration('docs', 'Example Docs');
  const hook = integration.hooks['astro:config:setup'] as unknown as (c: typeof ctx) => void;
  return { ctx, run: () => hook(ctx), name: integration.name };
}

/** What the virtual module hands the injected routes. */
function moduleData(ctx: ReturnType<typeof setup>['ctx']) {
  const plugin = ctx.updateConfig.mock.calls[0][0].vite.plugins[0];
  const id = plugin.resolveId(SUBPROCESSORS_MODULE_ID);
  const source = plugin.load(id) as string;
  expect(source.startsWith('export const subprocessorsData = ')).toBe(true);
  return JSON.parse(source.replace(/^export const subprocessorsData = /, '').replace(/;\n$/, ''));
}

describe('doc-kitty:subprocessors', () => {
  it('is named for the logs', () => {
    expect(setup(site({})).name).toBe('doc-kitty:subprocessors');
  });

  it('does nothing at all without a catalog', () => {
    const { ctx, run } = setup(site({ 'docs/README.md': '# Home\n' }));
    run();
    expect(ctx.injectRoute).not.toHaveBeenCalled();
    expect(ctx.updateConfig).not.toHaveBeenCalled();
    expect(ctx.addWatchFile).not.toHaveBeenCalled();
    expect(ctx.logger.info).not.toHaveBeenCalled();
    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  it('injects both prerendered routes for a valid catalog, and watches it (positive control)', () => {
    const dir = site({ 'docs/_meta/subprocessors.yaml': VALID });
    const { ctx, run } = setup(dir);
    run();
    expect(ctx.injectRoute.mock.calls.map((c) => c[0])).toEqual([
      { pattern: '/api/subprocessors.json', entrypoint: SUBPROCESSORS_API_ENTRYPOINT, prerender: true },
      { pattern: '/subprocessors.xml', entrypoint: SUBPROCESSORS_FEED_ENTRYPOINT, prerender: true },
    ]);
    expect(SUBPROCESSORS_API_ENTRYPOINT).toBe('@spec-kitty/doc-toolkit/routes/subprocessors-api-injected');
    expect(SUBPROCESSORS_FEED_ENTRYPOINT).toBe('@spec-kitty/doc-toolkit/routes/subprocessors-feed-injected');
    expect(ctx.addWatchFile).toHaveBeenCalledWith(path.join(dir, 'docs', '_meta', 'subprocessors.yaml'));
    expect(ctx.logger.info).toHaveBeenCalledTimes(1);
    expect(ctx.logger.info.mock.calls[0][0]).toMatch(/2 sub-processor record\(s\)/);
  });

  it('hands the routes the resolved records, the changes and the site title', () => {
    const { ctx, run } = setup(site({ 'docs/_meta/subprocessors.yaml': VALID }));
    run();
    const data = moduleData(ctx);
    expect(data.siteTitle).toBe('Example Docs');
    expect(data.records.map((r: { id: string }) => r.id)).toEqual(['acme-hosting', 'beta-mail']);
    expect(data.records[0].tom_classification).toEqual([{ measure: 'physical-security', scope: 'system' }]);
    expect(data.changes.map((c: { date: string; kind: string; id: string }) => `${c.date} ${c.kind} ${c.id}`)).toEqual([
      '2027-03-01 added beta-mail',
      '2025-01-15 added acme-hosting',
    ]);
  });

  it('throws one aggregate error, naming every problem, and injects nothing', () => {
    const { ctx, run } = setup(
      site({ 'docs/_meta/subprocessors.yaml': VALID.replace('[NL]', '[nl]').replace('beta-mail', 'acme-hosting') }),
    );
    let message = '';
    try {
      run();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message.split('\n')).toEqual([
      '[dk-subprocessors] invalid sub-processor catalog:',
      '[dk-subprocessors] docs/_meta/subprocessors.yaml: subprocessor "acme-hosting": "location" has "nl"; write country codes in upper case ("NL")',
      '[dk-subprocessors] docs/_meta/subprocessors.yaml: subprocessor "acme-hosting": duplicate id "acme-hosting"',
    ]);
    expect(ctx.injectRoute).not.toHaveBeenCalled();
    expect(ctx.updateConfig).not.toHaveBeenCalled();
  });

  it.each([
    ['src/pages/api/subprocessors.json.ts', '/subprocessors.xml'],
    ['src/pages/api/subprocessors.json/index.js', '/subprocessors.xml'],
    ['src/pages/subprocessors.xml.ts', '/api/subprocessors.json'],
  ])('keeps a site-owned %s and injects only %s', (own, injected) => {
    const { ctx, run } = setup(
      site({ 'docs/_meta/subprocessors.yaml': VALID, [own]: 'export const GET = () => new Response("own");\n' }),
    );
    run();
    expect(ctx.injectRoute.mock.calls.map((c) => c[0].pattern)).toEqual([injected]);
    expect(ctx.logger.info.mock.calls.map((c) => c[0]).join('\n')).toContain(`${own} is mounted by the site`);
  });

  it('still fails on an invalid catalog when the site mounts both routes itself', () => {
    const { run } = setup(
      site({
        'docs/_meta/subprocessors.yaml': VALID.replace('[NL]', '[XX]'),
        'src/pages/api/subprocessors.json.ts': 'export const GET = () => new Response("own");\n',
        'src/pages/subprocessors.xml.ts': 'export const GET = () => new Response("own");\n',
      }),
    );
    expect(run).toThrow(/not an assigned ISO 3166-1 alpha-2 code/);
  });
});

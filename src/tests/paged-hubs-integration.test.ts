/**
 * The paged-hubs route integration (#342, WP04, T017): the route is injected on
 * every site, prerendered, from a package export that resolves to a real file.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGED_HUB_ENTRYPOINT, PAGED_HUB_PATTERN, pagedHubsIntegration } from '../lib/integrations/paged-hubs.js';
import { defineDocKittyIntegrations } from '../lib/config.js';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

restoreInternalEnv();
const SRC = fileURLToPath(new URL('..', import.meta.url));

describe('pagedHubsIntegration (T017)', () => {
  it('injects /[...hub]/page/[page], prerendered, from the package export', () => {
    const injected: unknown[] = [];
    const hook = pagedHubsIntegration().hooks['astro:config:setup'] as (arg: unknown) => void;
    hook({ injectRoute: (route: unknown) => injected.push(route) });
    expect(injected).toEqual([{ pattern: '/[...hub]/page/[page]', entrypoint: '@spec-kitty/doc-toolkit/routes/paged-hub', prerender: true }]);
    expect(PAGED_HUB_PATTERN).toBe('/[...hub]/page/[page]');
  });

  it('is registered by defineDocKittyIntegrations on every site', () => {
    const names = defineDocKittyIntegrations({ title: 'Docs' }).map((i) => (i as { name: string }).name);
    expect(names).toContain('doc-kitty:paged-hubs');
  });

  it('exports the entrypoint to an existing route file', () => {
    const pkg = JSON.parse(readFileSync(path.join(SRC, 'package.json'), 'utf8')) as { exports: Record<string, string> };
    const target = pkg.exports[PAGED_HUB_ENTRYPOINT.replace('@spec-kitty/doc-toolkit', '.')];
    expect(target).toBe('./lib/routes/paged-hub.astro');
    expect(existsSync(path.join(SRC, target!))).toBe(true);
  });
});

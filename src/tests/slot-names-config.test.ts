/**
 * #114 — a theme slot name outside the `dk:` surface fails at config time.
 *
 * The theme type rejects an unknown slot name in a TypeScript theme
 * (`header-carrier.test.ts`), but a site's `astro.config.mjs` is plain
 * JavaScript and nothing type-checks it during a build. Before this fix a
 * misspelt slot (`dk:site-heading` for `dk:site-header`) was merged, carried in
 * the manifest under a name no carrier reads, and the stock component rendered
 * with no message.
 *
 * These tests go through `defineDocKittyIntegrations`, the function a config
 * file calls, with the theme as a plain object (what a `.mjs` config passes).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { defineDocKittyIntegrations, DK_DOCS_ROOT_ENV } from '../lib/config.js';
import { DK_SLOT_NAMES, type DocKittyTheme } from '../lib/theme.js';
import { restoreIndexBasenameEnv } from './helpers/restore-index-env';

restoreIndexBasenameEnv();
const docsRootBefore = process.env[DK_DOCS_ROOT_ENV];
afterEach(() => {
  if (docsRootBefore === undefined) delete process.env[DK_DOCS_ROOT_ENV];
  else process.env[DK_DOCS_ROOT_ENV] = docsRootBefore;
});

/** A theme as a `.mjs` config writes it: no type stands between the author and the slot name. */
function plainTheme(slots: Record<string, string>): DocKittyTheme {
  return JSON.parse(JSON.stringify({ name: 'site', slots })) as DocKittyTheme;
}

function configure(theme: DocKittyTheme): unknown[] {
  return defineDocKittyIntegrations({ title: 'Docs', theme });
}

describe('#114 — slot names are checked when the config is evaluated', () => {
  it('accepts a valid slot name (positive control on the same fixture)', () => {
    expect(configure(plainTheme({ 'dk:site-header': './SiteHeader.astro' }))).toBeInstanceOf(Array);
  });

  it('rejects a misspelt slot name, naming it and every valid name', () => {
    let message = '';
    try {
      configure(plainTheme({ 'dk:site-heading': './SiteHeader.astro' }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message, 'the config must throw').not.toBe('');
    expect(message).toContain('"dk:site-heading"');
    for (const name of DK_SLOT_NAMES) expect(message).toContain(name);
  });
});

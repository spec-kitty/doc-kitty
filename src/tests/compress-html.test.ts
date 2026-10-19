/**
 * HTML whitespace parity (#145, spike B11). Astro 7 defaults to
 * `compressHTML: 'jsx'`, which drops inline whitespace between elements
 * ("status:activeUpdated"). DocKitty pins `compressHTML: true`.
 */
import { describe, expect, it, vi } from 'vitest';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { defineDocKittyIntegrations } from '../lib/config.js';
import { compressHtmlIntegration } from '../lib/integrations/compress-html.js';

restoreInternalEnv();

describe('compressHtmlIntegration', () => {
  it('sets compressHTML to true in astro:config:setup', () => {
    const updateConfig = vi.fn();
    const setup = compressHtmlIntegration.hooks['astro:config:setup'] as (p: unknown) => void;
    setup({ updateConfig });
    expect(updateConfig).toHaveBeenCalledWith({ compressHTML: true });
  });

  it('is registered exactly once by defineDocKittyIntegrations', () => {
    const list = (defineDocKittyIntegrations({ title: 'Docs' }) as { name?: string }[]).map((i) => i.name);
    expect(list.filter((n) => n === 'doc-kitty:compress-html')).toHaveLength(1);
  });
});

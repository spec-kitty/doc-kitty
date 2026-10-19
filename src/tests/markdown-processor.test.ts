/**
 * The Markdown processor pin (ADR-0060, #119). Astro 7 renders Markdown with
 * Sätteri by default and drops every remark/rehype plugin; DocKitty's plugins
 * survive only because `doc-kitty:markdown-processor` sets `unified()` from the
 * FIRST integration, before any stage (or Starlight) appends a plugin.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { defineDocKittyIntegrations } from '../lib/config.js';
import { markdownProcessorIntegration } from '../lib/integrations/markdown-pipeline.js';

restoreInternalEnv();

const PROCESSOR = 'doc-kitty:markdown-processor';

const names = (integrations: unknown[]) =>
  (integrations as { name?: unknown }[]).map((i) => i.name).filter((n): n is string => typeof n === 'string');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('markdownProcessorIntegration', () => {
  it('sets markdown.processor to a unified() processor in astro:config:setup', () => {
    const updateConfig = vi.fn();
    const setup = markdownProcessorIntegration.hooks['astro:config:setup'] as (p: unknown) => void;
    setup({ updateConfig });
    expect(updateConfig).toHaveBeenCalledTimes(1);
    const processor = updateConfig.mock.calls[0][0]?.markdown?.processor;
    expect(processor?.name).toBe('unified');
  });

  it('is the first integration on the plain path', () => {
    const list = names(defineDocKittyIntegrations({ title: 'Docs' }));
    expect(list[0]).toBe(PROCESSOR);
    expect(list.filter((n) => n === PROCESSOR)).toHaveLength(1);
  });

  it('is the first integration with every plugin-registering seam on', () => {
    // Client diagram mode, so the result does not depend on a local Chromium.
    vi.stubEnv('DK_DIAGRAM_BUILD_RENDER', 'off');
    const list = names(defineDocKittyIntegrations({ title: 'Docs', markua: true, diagrams: true, gherkin: true }));
    expect(list[0]).toBe(PROCESSOR);
    expect(list.filter((n) => n === PROCESSOR)).toHaveLength(1);
    expect(list.indexOf(PROCESSOR)).toBeLessThan(list.indexOf('@astrojs/starlight'));
  });
});

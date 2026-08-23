import { describe, it, expect, vi } from 'vitest';
import type { DocKittyTheme } from '../lib/theme.js';

/**
 * T036 — Components-map invariant (ADR-0013 seam 3 / ADR-0015 decision 3/4).
 *
 * `defineDocKittyIntegrations` must register EXACTLY the four chrome carriers
 * (`Head`, `PageTitle`, `MarkdownContent`, `Footer`) on the Starlight
 * integration's `components` map — in EVERY case (no theme, a brand-like theme,
 * and even when a consumer's `starlight` escape hatch tries to add a fifth
 * override). A theme addresses the carriers' `dk:` slot names, never Starlight's
 * `components` map, so no pass-through may expand it. This is the config-level
 * decision point where seam 3 is actually made — proven here, not just observed
 * in the rendered dist.
 *
 * `defineDocKittyIntegrations` hides its Starlight config inside the integration
 * factory's closure, so we mock `@astrojs/starlight` to capture the config it is
 * called with. `@astrojs/sitemap` and the manifest integration run for real
 * (they only return integration objects). The Starlight entry is located by the
 * captured config it carries, NOT by array index.
 */
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

// Imported AFTER the mock is declared (vi.mock is hoisted, so this is safe).
const { defineDocKittyIntegrations } = await import('../lib/config.js');

const EXPECTED_CARRIER_KEYS = ['Footer', 'Head', 'MarkdownContent', 'PageTitle'];

/** Extract the Starlight integration's captured `components` map from the
 * integrations array, locating the entry by the config it carries (not index). */
function carrierKeysOf(integrations: unknown[]): string[] {
  const starlightEntry = integrations.find(
    (i): i is { __starlightConfig: { components?: Record<string, unknown> } } =>
      typeof i === 'object' &&
      i !== null &&
      '__starlightConfig' in i &&
      typeof (i as { __starlightConfig: unknown }).__starlightConfig === 'object',
  );
  if (!starlightEntry) {
    throw new Error('no Starlight integration found in defineDocKittyIntegrations() output');
  }
  const components = starlightEntry.__starlightConfig.components ?? {};
  return Object.keys(components).sort();
}

// A brand-LIKE fixture (not the real Spec Kitty brand — do not couple this test
// to WP04). It carries tokens/customCss/slots/layouts a theme legitimately sets;
// none of these may add a fifth `components` carrier.
const brandLikeTheme: DocKittyTheme = {
  name: 'fixture-brand',
  tokens: { '--dk-color-accent': '#abcdef', '--dk-radius-md': '0.75rem' },
  customCss: ['fixture/tokens.css', 'fixture/brand.css'],
  assets: { logo: 'fixture/logo.svg', favicon: 'fixture/favicon.svg' },
  slots: { 'dk:site-footer': 'fixture/SiteFooter.astro' },
  layouts: { Persona: 'fixture/Persona.astro' },
};

describe('defineDocKittyIntegrations components map (seam 3)', () => {
  it('registers exactly the four carriers with NO theme', () => {
    const integrations = defineDocKittyIntegrations({ title: 'Docs' });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
  });

  it('registers exactly the four carriers WITH a brand-like theme', () => {
    const integrations = defineDocKittyIntegrations({ title: 'Docs', theme: brandLikeTheme });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
  });

  it('does not let a consumer starlight escape hatch add a fifth carrier', () => {
    const integrations = defineDocKittyIntegrations({
      title: 'Docs',
      theme: brandLikeTheme,
      // A pass-through override attempting to register a fifth component must NOT
      // expand the map — `components: carriers` is applied AFTER `...overrides`.
      starlight: { components: { Sidebar: 'consumer/Sidebar.astro' } as never },
    });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
  });
});

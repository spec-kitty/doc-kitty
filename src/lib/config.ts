/**
 * Starlight configuration preset for Doc Kitty.
 *
 * `defineDocKittyIntegrations()` returns the Astro integrations array a docs
 * site needs: Starlight (themed, with the convention's head links) plus
 * `@astrojs/sitemap`. A site's `astro.config.mjs` spreads it and can override
 * anything.
 */
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';

export interface DocKittyOptions {
  /** Site title shown in the header. */
  title: string;
  /** Optional tagline / description. */
  description?: string;
  /** Social + repo links, forwarded to Starlight. */
  social?: StarlightUserConfig['social'];
  /** Sidebar config; omit to let Starlight autogenerate from the tree. */
  sidebar?: StarlightUserConfig['sidebar'];
  /** Escape hatch: deep overrides merged over the Starlight defaults. */
  starlight?: Partial<StarlightUserConfig>;
}

/** `<head>` links advertising the feeds and agent-API on every page. */
const discoveryHead: NonNullable<StarlightUserConfig['head']> = [
  {
    tag: 'link',
    attrs: {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'RSS',
      href: '/rss.xml',
    },
  },
  // Advertise the agent index so crawlers/agents can find it from any page.
  {
    tag: 'link',
    attrs: { rel: 'alternate', type: 'text/plain', title: 'llms.txt', href: '/llms.txt' },
  },
];

export function defineDocKittyIntegrations(options: DocKittyOptions) {
  const { title, description, social, sidebar, starlight: overrides } = options;

  const starlightConfig: StarlightUserConfig = {
    title,
    ...(description ? { description } : {}),
    ...(social ? { social } : {}),
    ...(sidebar ? { sidebar } : {}),
    head: discoveryHead,
    customCss: ['@commondocs-kitty/toolkit/styles/theme.css'],
    ...overrides,
  };

  return [starlight(starlightConfig), sitemap()];
}

// @ts-check
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@commondocs-kitty/toolkit/config';

// GitHub Pages: set these to your repo. For a project page the site is
// https://<owner>.github.io and the base is /<repo>. For a user/org page or a
// custom domain, set `site` and drop `base`.
//
// TODO(adopter): replace OWNER with the GitHub account that hosts this repo.
const SITE = 'https://OWNER.github.io';
const BASE = '/doc-kitty';

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: defineDocKittyIntegrations({
    title: 'Doc Kitty Example',
    description: 'A minimal docsite built with the Common Docs — Kitty Variation.',
    social: {
      github: 'https://github.com/OWNER/doc-kitty',
    },
  }),
});

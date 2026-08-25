// @ts-check
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@commondocs-kitty/toolkit/config';
import { specKittyTheme } from '@commondocs-kitty/toolkit/themes/spec-kitty/index.ts';

// GitHub Pages: set these to your repo. For a project page the site is
// https://<owner>.github.io and the base is /<repo>. For a user/org page or a
// custom domain, set `site` and drop `base`.
//
// TODO(adopter): replace `spec-kitty` with the GitHub account that hosts YOUR
// fork. These are real values, not placeholders, because this example IS the
// deployed doc-kitty docsite — a literal `OWNER` here shipped a canonical URL, a
// sitemap and a repo link that all 404'd on the live site (caught by the nightly
// link smoke, which resolves the true Pages URL from the deployment).
const OWNER = 'spec-kitty';
const REPO = 'doc-kitty';
const SITE = `https://${OWNER}.github.io`;
const BASE = `/${REPO}`;

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: defineDocKittyIntegrations({
    title: 'Doc Kitty Example',
    description: 'A minimal docsite built with the Common Docs — Kitty Variation.',
    // Same value as `base` above, so the sitemap draft filter strips the base
    // prefix and compares each page's route to the draft routes with ANCHORED
    // equality (not a suffix match).
    base: BASE,
    social: {
      github: `https://github.com/${OWNER}/${REPO}`,
    },
    theme: specKittyTheme,
    // Opt-in Mermaid diagrams (M5): renders the `%%`-annotated ```mermaid fence
    // on the Overview page as an accessible, token-themed `<figure>`.
    diagrams: true,
  }),
});

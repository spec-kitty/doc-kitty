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

// WP10 SC-003 portability seam: the Markua preset is ON by default here (the
// atomic on-switch this WP flips). Setting `DK_MARKUA=off` builds the SAME corpus
// with the preset OFF so the preset-off portability gate can prove every Markua
// line renders as literal text (never broken markup). `DK_OUTDIR` lets that
// second build land in its own dist dir so the two builds do not overwrite each
// other. Neither env var is set in the normal build — markua stays true.
const MARKUA_ON = process.env.DK_MARKUA !== 'off';
const OUT_DIR = process.env.DK_OUTDIR ? `./${process.env.DK_OUTDIR}` : undefined;

export default defineConfig({
  site: SITE,
  base: BASE,
  ...(OUT_DIR ? { outDir: OUT_DIR } : {}),
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
    // Opt-in Markua syntax (WP10 atomic on-switch): asides/callouts/figures/
    // crosslink-ids across the showcase corpus. Every earlier WP stayed dormant
    // until this flip. `DK_MARKUA=off` builds the same corpus preset-off for the
    // SC-003 literal-text portability gate.
    markua: MARKUA_ON,
  }),
});

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

// Redirect-coverage fixture (adopter-loader-migration #42, WP02 — FR-009,
// data-model.md E-03/E-08). Astro's native `redirects` config emits a static
// redirect stub for each entry (D-04); `src/scripts/check-redirect-coverage.mjs`
// walks the committed `example/url-baseline.txt` against the built `dist/` and
// follows this map's target chain to a live terminus (target-aware — a
// redirect to a dead page is a live 404, closed by construction per B1).
//
// WP02 seeds a SELF-CONTAINED fixture (E-08): the "from" is an old alias URL
// that never had its own content, and the "to" is a page that already exists
// today — green standalone, independent of any later rename WP.
//
// WP04 out-of-map edit (recorded, justified per E-08 — this file is WP02-owned):
// extends the map for its section rename (plans/features -> plans/missions),
// per the frozen E-08 datum. `plans/features/` did not exist in the example
// before WP04, so these two entries are added by WP04 in the SAME change that
// creates `plans/missions/` — there is no intermediate commit where the old
// URL exists without its redirect (never red between merges).
// review-cycle-1 Fix C (out-of-map edit, justified per E-08 — this file is
// WP02-owned): Astro's `redirects` config auto-prefixes the `from` key with
// `base`, but does NOT auto-prefix the `to` target — it is emitted verbatim
// into both the generated redirect stub's fallback link AND its canonical URL
// (`site` + `to`). With `to` left base-less, all three redirects landed on a
// base-less dist href (a live 404 on a based deployment) — the same class of
// bug #61 fixed for glossary/component hrefs, here in the one remaining
// base-less surface. `BASE` is prepended so the target agrees with every other
// in-site link on this site.
const REDIRECTS = {
  '/guides/old-getting-started/': `${BASE}/guides/getting-started/`,
  '/plans/features/mission-alpha/': `${BASE}/plans/missions/mission-alpha/`,
  '/plans/features/mission-beta/': `${BASE}/plans/missions/mission-beta/`,
};

export default defineConfig({
  site: SITE,
  base: BASE,
  ...(OUT_DIR ? { outDir: OUT_DIR } : {}),
  redirects: REDIRECTS,
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
    // WP01 flexible-section-identity (adopter-loader-migration #42, anti-laziness
    // M3): both basenames collapse to their section slug in the SAME build, so
    // WP04's `index.md`-based rename target coexists with the existing
    // README-based sections. WP02 owns this line; WP04 supplies the `index.md`
    // content only (data-model.md E-08 ownership split).
    indexBasename: ['README', 'index'],
  }),
});

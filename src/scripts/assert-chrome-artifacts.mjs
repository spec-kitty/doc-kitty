#!/usr/bin/env node
/**
 * assert-chrome-artifacts.mjs — chrome + pagefind build-artifact assertions (WP05).
 *
 * Usage:
 *   node src/scripts/assert-chrome-artifacts.mjs <distDir>
 *   (also invoked from assert-build-artifacts.mjs, so `pnpm assert:artifacts` runs it)
 *
 * This module hardens the WP03/WP04 chrome so a STUBBED or MISSING chrome element
 * fails the gate (WP05 anti-laziness objective; FR-011/FR-012/FR-013/FR-014/
 * FR-016/FR-017, NFR-001, NFR-004, SC-003/SC-004). Each assertion targets a
 * concrete rendered marker in `example/dist` and exits NON-ZERO with a precise
 * message on the FIRST failure. Every check is bound to an observable artifact, so
 * removing/stubbing the element it proves flips the check red (demonstrated
 * per-class in the mission acceptance.md).
 *
 * Zero runtime dependencies (NFR-006): HTML/CSS are string-searched; the gzip
 * Pagefind fragments are decompressed with the Node built-in `node:zlib`.
 */
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';
// The canonical doc_status enum, imported (not hand-mirrored) from the standalone
// validator so this gate cannot drift from the contract (DIRECTIVE_043).
import { STATUSES } from './validate-frontmatter.mjs';

// ---------------------------------------------------------------------------
// The complete neutral Default `--dk-*` catalog (theming.md; src/styles/theme.css
// is the source list). This is enumerated for COMPLETENESS, not mere presence:
// the emitted stylesheet must declare EVERY name below, so dropping any single
// token from the source sheet flips this check red (FR-017 / SC-003).
//
// Kept in the same grouped order as theme.css so a reviewer can diff the two by
// eye. If a token is deliberately added/removed in theme.css, update this list in
// the same change — that is the point of the list.
const REQUIRED_DK_TOKENS = [
  // Type: families
  '--dk-font-sans',
  '--dk-font-mono',
  '--dk-font-display',
  // Type: modular scale
  '--dk-text-2xs',
  '--dk-text-xs',
  '--dk-text-sm',
  '--dk-text-base',
  '--dk-text-lg',
  '--dk-text-xl',
  '--dk-text-2xl',
  '--dk-text-3xl',
  '--dk-text-4xl',
  // Type: leading, weights, caps tracking
  '--dk-leading-tight',
  '--dk-leading-normal',
  '--dk-leading-relaxed',
  '--dk-weight-normal',
  '--dk-weight-medium',
  '--dk-weight-semibold',
  '--dk-weight-bold',
  '--dk-tracking-caps',
  // Spacing
  '--dk-space-3xs',
  '--dk-space-2xs',
  '--dk-space-xs',
  '--dk-space-sm',
  '--dk-space-md',
  '--dk-space-lg',
  '--dk-space-xl',
  '--dk-space-2xl',
  // Radius
  '--dk-radius-sm',
  '--dk-radius-md',
  '--dk-radius-lg',
  '--dk-radius-pill',
  // Elevation
  '--dk-shadow-sm',
  '--dk-shadow-md',
  '--dk-shadow-lg',
  '--dk-shadow-focus',
  // Layout widths
  '--dk-width-content',
  '--dk-width-sidebar',
  '--dk-width-band',
  '--dk-width-deck',
  '--dk-width-passport',
  // Surfaces
  '--dk-color-bg',
  '--dk-color-bg-nav',
  '--dk-color-bg-sidebar',
  '--dk-color-surface-1',
  '--dk-color-surface-2',
  '--dk-color-surface-inset',
  '--dk-color-border',
  '--dk-color-border-strong',
  // Text
  '--dk-color-text',
  '--dk-color-text-strong',
  '--dk-color-text-muted',
  '--dk-color-text-accent',
  '--dk-color-text-invert',
  // Accent
  '--dk-color-accent-low',
  '--dk-color-accent',
  '--dk-color-accent-high',
  '--dk-color-accent-text',
  // State + paired -bg
  '--dk-color-info',
  '--dk-color-info-bg',
  '--dk-color-success',
  '--dk-color-success-bg',
  '--dk-color-warning',
  '--dk-color-warning-bg',
  '--dk-color-danger',
  '--dk-color-danger-bg',
  '--dk-color-neutral',
  '--dk-color-neutral-bg',
];

// The `--dk-* → --sl-*` bridge: each Starlight variable the base sheet assigns
// from a `--dk-*` token (C-007, tokens-before-overrides). The emitted stylesheet
// must carry every one of these assignments, else the bridge is incomplete and
// Starlight would fall back to its own defaults for that role.
const REQUIRED_BRIDGE = [
  ['--sl-color-bg', '--dk-color-bg'],
  ['--sl-color-bg-nav', '--dk-color-bg-nav'],
  ['--sl-color-bg-sidebar', '--dk-color-bg-sidebar'],
  ['--sl-color-hairline', '--dk-color-border'],
  ['--sl-color-text', '--dk-color-text'],
  ['--sl-color-white', '--dk-color-text-strong'],
  ['--sl-color-gray-2', '--dk-color-text-muted'],
  ['--sl-color-text-accent', '--dk-color-accent-text'],
  ['--sl-color-accent-low', '--dk-color-accent-low'],
  ['--sl-color-accent', '--dk-color-accent'],
  ['--sl-color-accent-high', '--dk-color-accent-high'],
  ['--sl-color-blue', '--dk-color-info'],
  ['--sl-color-green', '--dk-color-success'],
  ['--sl-color-orange', '--dk-color-warning'],
  ['--sl-color-red', '--dk-color-danger'],
  ['--sl-color-gray-3', '--dk-color-neutral'],
  ['--sl-font', '--dk-font-sans'],
  ['--sl-font-mono', '--dk-font-mono'],
  ['--sl-text-xs', '--dk-text-xs'],
  ['--sl-text-sm', '--dk-text-sm'],
  ['--sl-text-base', '--dk-text-base'],
  ['--sl-text-lg', '--dk-text-lg'],
  ['--sl-text-xl', '--dk-text-xl'],
  ['--sl-text-2xl', '--dk-text-2xl'],
  ['--sl-text-3xl', '--dk-text-3xl'],
  ['--sl-text-4xl', '--dk-text-4xl'],
  ['--sl-content-width', '--dk-width-content'],
  ['--sl-sidebar-width', '--dk-width-sidebar'],
];

// The canonical doc_status enum (ADR-0005) is `STATUSES` from the validator
// (draft/active/deprecated/superseded). The metadata band must render one of
// these as a TEXT label (not colour-only) on a published page.
const DOC_STATUS_LABELS = STATUSES;

// Known demonstrator pages (relative to distDir). WP03 re-tagged these existing
// example pages so each exercises one share-image fallback branch.
const HERO_PAGE = path.join('architecture', 'overview', 'index.html'); // hero_image
const SOCIAL_PAGE = path.join('guides', 'getting-started', 'index.html'); // social_thumb
const SITEDEFAULT_PAGE = path.join('context', 'index.html'); // neither → site-default
const HUB_PAGE = path.join('context', 'index.html'); // kind: Hub

// The Hub page's own Pagefind fragment url. The child-card text below must live
// in THIS fragment (not merely somewhere in the index) for NFR-004 / SC-004.
const HUB_FRAGMENT_URL = '/context/';
// The Hub's RENDERED child cards (title + kind + description). These are
// card-UNIQUE: the `<Title> Explanation` adjacency and the full child
// descriptions do NOT appear in the Hub's own lead paragraph, so if the Hub
// stops indexing its described-link list (e.g. a `<nav>` regression that
// Pagefind drops), they vanish from the Hub fragment and this check flips red.
const HUB_CHILD_CARD_MARKERS = [
  'Domain Explanation The ubiquitous language for the Common Docs',
  'Product Explanation The problem this example solves and who it is for.',
];

// --- T033: Persona fixture (WP06) -----------------------------------------
// The Persona fixture renders through the brand's `Persona` layout, whose
// layout-UNIQUE marker is `.dk-passport` (bound to the layout, NOT a generic
// <h1>/<dl> — a fallback-to-Default regression drops the passport and flips the
// check red, SC-004). Its persona-UNIQUE string must live in the Persona page's
// OWN url-scoped Pagefind fragment (NFR-004): the body is searchable, scoped to
// this route (mirrors the HUB_FRAGMENT pattern). The fixture is a DRAFT — drafts
// are excluded from the agent-index/sitemap but STILL render to HTML and are
// Pagefind-indexed, so both proofs hold on a draft page.
const PERSONA_PAGE = path.join('personas', 'example-persona', 'index.html');
const PERSONA_LAYOUT_MARKER = 'dk-passport';
const PERSONA_FRAGMENT_URL = '/personas/example-persona/';
// WP06's recorded persona-unique string (acceptance.md). Persona-unique so it
// cannot be satisfied by boilerplate shared with any other page's fragment.
const PERSONA_UNIQUE_STRING = 'marzipan mapmaker passport sentinel';

// --- T034: cascade-order discriminators (ADR-0013 seam 2) ------------------
// The generated TOKEN sheet (emitTokenSheet) is the ONLY sheet that emits the
// `--dk-*→--sl-*` bridge — brand/consumer sheets declare zero `--sl-*` (FR-004),
// so a bridge assignment is a robust TOKEN-sheet-unique discriminator (hashed
// filenames do not matter; we match by content). The `.dk-related-card` rule is
// authored only in the brand component sheet (brand-components.css), so it is a
// robust BRAND-sheet-unique discriminator. Seam 2 requires the token sheet's
// declarations to precede the brand's, so tokens-before-overrides holds.
const TOKEN_SHEET_DISCRIMINATOR = /--sl-color-accent\s*:\s*var\(\s*--dk-color-accent\s*\)/;
const BRAND_SHEET_DISCRIMINATOR = /\.dk-related-card\s*\{/;

// --- T035: mode-varying colour tokens (FR-011) -----------------------------
// The mode-varying `--dk-*` colour subset — MIRRORS `theme.ts` DEFAULT_DARK keys
// (the enumerated set `emitTokenSheet` re-declares under the dark selector), in
// the same grouped order so a reviewer can diff by eye. Each MUST be re-declared
// under a dark selector in the emitted CSS, else a brand override would silently
// leak the light value into dark mode. Keep in sync with theme.ts DEFAULT_DARK.
const REQUIRED_MODE_VARYING = [
  // Surfaces
  '--dk-color-bg',
  '--dk-color-bg-nav',
  '--dk-color-bg-sidebar',
  '--dk-color-surface-1',
  '--dk-color-surface-2',
  '--dk-color-surface-inset',
  '--dk-color-border',
  '--dk-color-border-strong',
  // Text
  '--dk-color-text',
  '--dk-color-text-strong',
  '--dk-color-text-muted',
  '--dk-color-text-invert',
  // Accent
  '--dk-color-accent-low',
  '--dk-color-accent',
  '--dk-color-accent-high',
  '--dk-color-accent-text',
  // State + paired -bg
  '--dk-color-info',
  '--dk-color-info-bg',
  '--dk-color-success',
  '--dk-color-success-bg',
  '--dk-color-warning',
  '--dk-color-warning-bg',
  '--dk-color-danger',
  '--dk-color-danger-bg',
  '--dk-color-neutral',
  '--dk-color-neutral-bg',
];

// The authored brand sheets (theme Layer 2). T035 asserts these declare ZERO
// `--sl-*` (the `--dk-*→--sl-*` bridge is owned solely by the base token sheet;
// a theme setting `--sl-*` directly is forbidden, FR-004/ADR-0011). Astro's
// production build BUNDLES every customCss entry together with Starlight's own
// `--sl-*`-heavy CSS into one hashed stylesheet, so the emitted dist cannot be
// scoped back to "the brand sheet"; the authored source IS the served brand
// sheet (nothing rewrites `--sl-*` between source and bundle), so the honest,
// non-fakeable check reads the source brand sheets directly. Resolved relative
// to this script (src/scripts/ → src/themes/spec-kitty/).
const BRAND_SHEET_SOURCES = [
  '../themes/spec-kitty/tokens.css',
  '../themes/spec-kitty/brand.css',
  '../themes/spec-kitty/components/brand-components.css',
];

// --- T046: brand interactive targets (WCAG 2.2 AA, NFR-001) ----------------
// The brand's interactive target classes named in WP05 T025 (brand-components.css
// + the SiteFooter organism). axe cannot machine-verify target-size (2.5.8) or a
// visible focus indicator, so each MUST carry a ≥24px min-height/min-width rule
// AND a `:focus-visible` ring in the emitted CSS. This list IS the contract —
// a rename in brand-components.css / SiteFooter.astro must update it here.
const BRAND_INTERACTIVE_TARGETS = [
  '.dk-related-card',
  '.dk-reference-item',
  '.dk-passport__field a',
  '.dk-site-footer__link',
];

// --- T047: brand footer slot-override observable (SC-004) ------------------
// The override-unique class the brand's SiteFooter organism emits, rendered
// through WP03's Footer carrier. Its presence proves `slotComponents` resolved
// through the carrier: a stub that imports `slotComponents` but renders the
// DEFAULT footer would not emit it, so this flips red.
const FOOTER_BRAND_MARKER = 'dk-site-footer--brand';
// A branded published page that renders the footer (the site index).
const FOOTER_PAGE = 'index.html';

// ---------------------------------------------------------------------------

function fail(message) {
  process.stderr.write(`assert:chrome: FAIL — ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`assert:chrome: ok — ${message}\n`);
}

async function readHtml(distDir, relPath) {
  const abs = path.join(distDir, relPath);
  try {
    return await readFile(abs, 'utf8');
  } catch (err) {
    fail(`could not read ${relPath} (${err.code ?? err.message}) — did the build run?`);
  }
}

/** Concatenate every emitted stylesheet under dist/_astro so hashed filenames
 * do not matter and a token present in ANY sheet counts. */
async function readAllCss(distDir) {
  const astroDir = path.join(distDir, '_astro');
  let names;
  try {
    names = await readdir(astroDir);
  } catch (err) {
    fail(`could not read ${path.join('_astro')} (${err.code ?? err.message})`);
  }
  const cssNames = names.filter((n) => n.endsWith('.css'));
  if (cssNames.length === 0) fail('no emitted stylesheet found under dist/_astro');
  const parts = [];
  for (const n of cssNames) {
    parts.push(await readFile(path.join(astroDir, n), 'utf8'));
  }
  return parts.join('\n');
}

/** Extract the content="…" of a <meta property="og:image"> tag, or null. */
function ogImage(html) {
  const m = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
  return m ? m[1] : null;
}

/** Extract flat CSS rule blocks whose selector list contains `selectorNeedle`.
 * Returns `{ selector, body }[]`. Emitted doc-kitty chrome CSS is flat (no
 * nesting), so a simple non-brace scan is sufficient and lets the AA checks be
 * SCOPED to dk selectors instead of matching any rule in the concatenated CSS
 * (incl. Starlight's own). */
function ruleBlocksFor(css, selectorNeedle) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1];
    if (selector.includes(selectorNeedle)) blocks.push({ selector, body: m[2] });
  }
  return blocks;
}

/** Return true if any min-height/min-width declaration in `css` is ≥ 24px.
 * Accepts px and rem (rem × 16). Bound to the emitted value, so shrinking the
 * rule below 24px flips it red (NFR-001). */
function hasMinTarget24(css) {
  const re = /min-(?:height|width)\s*:\s*([0-9.]+)(px|rem)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const value = parseFloat(m[1]);
    const px = m[2].toLowerCase() === 'rem' ? value * 16 : value;
    if (px >= 24) return true;
  }
  return false;
}

/** The rendered stylesheet <link> hrefs on a page, in HEAD (source/cascade)
 * order, excluding `media="print"` sheets. Used by the cascade-order check so
 * the token/brand discriminators are compared in the order the browser applies
 * them (T034). */
function stylesheetHrefs(html) {
  const hrefs = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (!/\brel="stylesheet"/i.test(tag)) continue;
    const media = tag.match(/\bmedia="([^"]*)"/i);
    if (media && /\bprint\b/i.test(media[1])) continue;
    const href = tag.match(/\bhref="([^"]*)"/i);
    if (href) hrefs.push(href[1]);
  }
  return hrefs;
}

/** Map a stylesheet href to its dist `_astro/<file>.css` path, or null if the
 * href is not an emitted `_astro` asset (base-prefix and hash agnostic). */
function astroCssPath(distDir, href) {
  const idx = href.indexOf('/_astro/');
  if (idx === -1) return null;
  const base = href.slice(idx + '/_astro/'.length);
  if (!base.endsWith('.css')) return null;
  return path.join(distDir, '_astro', base);
}

/** Extract the bodies of every `[data-theme…dark…]` selector block in `css`.
 * The emitted chrome CSS is flat (no nesting), so a non-brace scan is sufficient.
 * Minified selectors drop the quotes (`[data-theme=dark]`), so match loosely on
 * the `data-theme` + `dark` pair. Used to prove each mode-varying token is
 * re-declared under a dark selector (T035). */
function darkBlockBodies(css) {
  const bodies = [];
  const re = /([^{}]*\[data-theme[^{}]*dark[^{}]*)\{([^{}]*)\}/gi;
  let m;
  while ((m = re.exec(css)) !== null) bodies.push(m[2]);
  return bodies;
}

/** Strip CSS block comments, so a `--sl-*` mentioned only in prose does not read
 * as a declaration (T035 brand-sheet scan). */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// ---------------------------------------------------------------------------

export async function assertChromeArtifacts(distDir) {
  const dir = path.resolve(distDir);

  // === 1) Metadata band + TEXT-labelled status on a published page ===========
  const heroHtml = await readHtml(dir, HERO_PAGE);
  if (!heroHtml.includes('dk-metadata-band')) {
    fail(`metadata band: dk:metadata-band host absent on ${HERO_PAGE}`);
  }
  // dk-band__status is the RENDERED status pill (present only on published pages;
  // the draft renders an empty band host). Its text label must be a real word.
  // The pill nests a visually-hidden "Document status:" span, then the visible
  // label text, so capture a window past that inner </span> before stripping tags.
  const statusMatch = heroHtml.match(/class="dk-band__status[^"]*"[^>]*>([\s\S]{0,240})/i);
  if (!statusMatch) {
    fail(`metadata band: dk-band__status pill not rendered on ${HERO_PAGE} (band stubbed/empty?)`);
  }
  const statusText = statusMatch[1]
    .replace(/<[^>]*>/g, ' ') // drop the visually-hidden "Document status:" span markup
    .replace(/Document status:/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const labelHit = DOC_STATUS_LABELS.find((s) => statusText.split(/\W+/).includes(s));
  if (!labelHit) {
    fail(
      `metadata band: status pill on ${HERO_PAGE} carries no text label ` +
        `(got "${statusText}"); a colour-only indicator fails NFR-001`,
    );
  }
  ok(`metadata band: rendered with text-labelled status "${labelHit}" on ${HERO_PAGE}`);

  // === 2) Optimized hero <img> (hashed /_astro/) with non-empty alt ==========
  // Bind to the HERO image SPECIFICALLY via its own `dk-hero__img` class (the base
  // PageHero chrome emits it — theme-agnostic, present with or without a brand),
  // NOT "the first /_astro/ img". Under the brand the first /_astro/ img is the
  // header LOGO (correctly `alt=""`), so a first-img selector would either read
  // the logo's empty alt (false FAIL) or, worse, pass on a logo while the real
  // hero shipped alt-less. Scoping to `dk-hero__img` keeps this non-fakeable: the
  // hero must carry a hashed /_astro/ src AND a non-empty alt, and a hero that
  // ships with an empty alt still flips this red (FR-005, NFR-001).
  const imgTags = heroHtml.match(/<img\b[^>]*>/gi) ?? [];
  const heroImg = imgTags.find((tag) => /\bclass="[^"]*\bdk-hero__img\b[^"]*"/i.test(tag));
  if (!heroImg) {
    fail(`page hero: no <img class="dk-hero__img"> on ${HERO_PAGE} (hero slot not rendered?)`);
  }
  if (!/\bsrc="[^"]*\/_astro\/[^"]+"/i.test(heroImg)) {
    fail(`page hero: the dk-hero__img on ${HERO_PAGE} has no hashed /_astro/ src (not the optimized image)`);
  }
  const altMatch = heroImg.match(/\balt="([^"]*)"/i);
  if (!altMatch || altMatch[1].trim().length === 0) {
    fail(`page hero: dk-hero__img on ${HERO_PAGE} has no non-empty alt (accessibility, FR-005)`);
  }
  ok(`page hero: optimized dk-hero__img /_astro/ <img> with alt "${altMatch[1]}" on ${HERO_PAGE}`);

  // === 3) Head share tags present + og:image THREE DISTINCT across branches ===
  const requiredHeadTags = [
    [/<meta\s+property="og:title"\s+content="[^"]+"/i, 'og:title'],
    [/<meta\s+property="og:description"\s+content="[^"]+"/i, 'og:description'],
    [/<meta\s+property="og:image"\s+content="[^"]+"/i, 'og:image'],
    [/<meta\s+property="og:image:alt"\s+content="[^"]+"/i, 'og:image:alt'],
    [/<meta\s+name="twitter:card"\s+content="summary_large_image"/i, 'twitter:card=summary_large_image'],
    [/<meta\s+name="twitter:image"\s+content="[^"]+"/i, 'twitter:image'],
    [/<link\s+rel="canonical"\s+href="[^"]+"/i, 'canonical'],
  ];
  for (const [re, label] of requiredHeadTags) {
    if (!re.test(heroHtml)) fail(`head share tags: ${label} missing on ${HERO_PAGE} (FR-014)`);
  }
  ok(`head share tags: og:title/description/image/image:alt, twitter:card/image, canonical present`);

  const socialHtml = await readHtml(dir, SOCIAL_PAGE);
  const siteDefaultHtml = await readHtml(dir, SITEDEFAULT_PAGE);
  const heroOg = ogImage(heroHtml);
  const socialOg = ogImage(socialHtml);
  const siteOg = ogImage(siteDefaultHtml);
  for (const [val, page] of [
    [heroOg, HERO_PAGE],
    [socialOg, SOCIAL_PAGE],
    [siteOg, SITEDEFAULT_PAGE],
  ]) {
    if (!val) fail(`share image: og:image absent on ${page}`);
  }
  const distinct = new Set([heroOg, socialOg, siteOg]);
  if (distinct.size !== 3) {
    fail(
      `share image: og:image must resolve to THREE distinct values across the ` +
        `hero / social_thumb / site-default demonstrators, got ` +
        `${JSON.stringify([heroOg, socialOg, siteOg])}`,
    );
  }
  // Pin each branch to its expected source so a fallback-chain regression (e.g.
  // every page collapsing to the site default) is caught, not just "three URLs".
  if (!heroOg.includes('overview-hero')) {
    fail(`share image: hero page og:image should derive from hero_image, got ${heroOg}`);
  }
  if (!socialOg.includes('getting-started-share')) {
    fail(`share image: social page og:image should derive from social_thumb, got ${socialOg}`);
  }
  if (!siteOg.includes('social-default')) {
    fail(`share image: site-default page og:image should be the shipped default, got ${siteOg}`);
  }
  ok(`share image: three distinct resolved og:image values (hero / social_thumb / site-default)`);

  // === 4) Four carriers active + token catalog completeness + bridge =========
  // Head carrier attests all four carriers were the ones Starlight rendered.
  if (!/<meta\s+name="dk-chrome"\s+content="doc-kitty-carriers"/i.test(heroHtml)) {
    fail(`carriers: Head carrier marker <meta name="dk-chrome"> absent on ${HERO_PAGE} (FR-011)`);
  }
  // PageTitle carrier hosts both metadata slots.
  if (!heroHtml.includes('data-dk-slot="dk:page-hero"')) {
    fail(`carriers: PageTitle carrier dk:page-hero host absent on ${HERO_PAGE}`);
  }
  if (!heroHtml.includes('data-dk-slot="dk:metadata-band"')) {
    fail(`carriers: PageTitle carrier dk:metadata-band host absent on ${HERO_PAGE}`);
  }
  // MarkdownContent carrier resolves kind→layout: the Hub page renders the Hub
  // described-link list, which only that carrier's resolveLayout() produces.
  const hubHtml = await readHtml(dir, HUB_PAGE);
  if (!hubHtml.includes('dk-hub__list')) {
    fail(`carriers: MarkdownContent kind→layout did not render the Hub list on ${HUB_PAGE} (FR-016)`);
  }
  ok(`carriers: four carriers active (dk-chrome + dk:page-hero + dk:metadata-band + Hub layout)`);

  const css = await readAllCss(dir);
  const missingTokens = REQUIRED_DK_TOKENS.filter((t) => !css.includes(`${t}:`));
  if (missingTokens.length > 0) {
    fail(
      `token catalog: ${missingTokens.length} required --dk-* token(s) not declared in the ` +
        `emitted stylesheet: ${missingTokens.join(', ')} (FR-017 completeness)`,
    );
  }
  ok(`token catalog: all ${REQUIRED_DK_TOKENS.length} required --dk-* tokens declared`);

  const missingBridge = REQUIRED_BRIDGE.filter(([sl, dk]) => {
    const re = new RegExp(`${sl}\\s*:\\s*var\\(${dk}\\)`);
    return !re.test(css);
  });
  if (missingBridge.length > 0) {
    fail(
      `bridge: ${missingBridge.length} --dk-* → --sl-* assignment(s) missing: ` +
        `${missingBridge.map(([sl, dk]) => `${sl}=var(${dk})`).join(', ')} (C-007)`,
    );
  }
  ok(`bridge: all ${REQUIRED_BRIDGE.length} --dk-* → --sl-* assignments present`);

  // === 5) AA by construction: ≥24px target rule + :focus-visible rule ========
  // SCOPED to doc-kitty's OWN chrome selectors: a ≥24px min-target or a
  // :focus-visible rule anywhere in Starlight's bundled CSS must NOT satisfy
  // these — the dk Hub card target and the dk focus ring specifically must hold
  // (NFR-001). Removing them from src/styles/hub.css flips this red.
  const dkCardBlocks = ruleBlocksFor(css, '.dk-hub__card');
  if (dkCardBlocks.length === 0) {
    fail(`accessibility: no .dk-hub__card rule in the emitted CSS (Hub target sizing missing, NFR-001)`);
  }
  if (!dkCardBlocks.some((b) => hasMinTarget24(b.body))) {
    fail(`accessibility: .dk-hub__card carries no min-height/min-width ≥24px target rule (NFR-001)`);
  }
  const dkFocusBlocks = ruleBlocksFor(css, ':focus-visible').filter((b) =>
    /\.dk-/.test(b.selector),
  );
  if (dkFocusBlocks.length === 0) {
    fail(`accessibility: no dk chrome :focus-visible rule in the emitted CSS (focus ring missing, NFR-001)`);
  }
  ok(`accessibility: .dk-hub__card ≥24px target rule and dk :focus-visible ring present in emitted CSS`);

  // === 6) Hub CARDS present in the Hub page's OWN Pagefind fragment ===========
  // Locate the fragment whose url IS the Hub page and assert THAT fragment
  // carries the Hub's rendered child-link text. Scoping to the Hub fragment is
  // the point: the child descriptions also live in the children's OWN fragments,
  // so an any-fragment check would still pass if the Hub stopped indexing its
  // cards (a `<nav>` regression). This binds NFR-004 / SC-004 to the Hub itself.
  const fragDir = path.join(dir, 'pagefind', 'fragment');
  let fragNames;
  try {
    fragNames = await readdir(fragDir);
  } catch (err) {
    fail(`pagefind: could not read pagefind/fragment (${err.code ?? err.message})`);
  }
  const fragFiles = fragNames.filter((n) => n.endsWith('.pf_fragment'));
  if (fragFiles.length === 0) fail('pagefind: no .pf_fragment files found');
  let hubFragment = null;
  for (const n of fragFiles) {
    const buf = await readFile(path.join(fragDir, n));
    // Fragments are gzip-compressed Pagefind BINARY; decompress and string-search
    // the decoded text (never JSON.parse — the payload is not JSON).
    let decoded;
    try {
      decoded = gunzipSync(buf).toString('utf8');
    } catch (err) {
      fail(`pagefind: fragment ${n} did not gunzip (${err.message})`);
    }
    const urlMatch = decoded.match(/"url":"([^"]*)"/);
    if (urlMatch && urlMatch[1] === HUB_FRAGMENT_URL) {
      hubFragment = decoded;
      break;
    }
  }
  if (hubFragment === null) {
    fail(`pagefind: no fragment indexed for the Hub page ${HUB_FRAGMENT_URL} (Hub not indexed at all?)`);
  }
  const missingCards = HUB_CHILD_CARD_MARKERS.filter((m) => !hubFragment.includes(m));
  if (missingCards.length > 0) {
    fail(
      `pagefind: the Hub fragment (${HUB_FRAGMENT_URL}) is missing rendered child-card text: ` +
        `${missingCards.map((m) => JSON.stringify(m)).join(', ')} — the Hub stopped indexing ` +
        `its described-link cards (NFR-004 / SC-004)`,
    );
  }
  ok(`pagefind: Hub fragment ${HUB_FRAGMENT_URL} contains its rendered child cards (title + description)`);

  // === 7) Persona layout marker + persona-unique text in its OWN fragment =====
  // (T033) Proof the Persona layout resolved (SC-004) and its body is searchable
  // (NFR-004). Bound to the layout-UNIQUE `.dk-passport` marker (a fallback to
  // Default drops it), and to the persona-unique string living in the Persona
  // page's OWN url-scoped fragment (not merely somewhere in the index).
  const personaHtml = await readHtml(dir, PERSONA_PAGE);
  if (!personaHtml.includes(PERSONA_LAYOUT_MARKER)) {
    fail(
      `persona: layout-unique marker .${PERSONA_LAYOUT_MARKER} absent on ${PERSONA_PAGE} — the ` +
        `Persona layout did not resolve (fell back to Default?), SC-004`,
    );
  }
  let personaFragment = null;
  for (const n of fragFiles) {
    const buf = await readFile(path.join(fragDir, n));
    let decoded;
    try {
      decoded = gunzipSync(buf).toString('utf8');
    } catch (err) {
      fail(`pagefind: fragment ${n} did not gunzip (${err.message})`);
    }
    const urlMatch = decoded.match(/"url":"([^"]*)"/);
    if (urlMatch && urlMatch[1] === PERSONA_FRAGMENT_URL) {
      personaFragment = decoded;
      break;
    }
  }
  if (personaFragment === null) {
    fail(
      `pagefind: no fragment indexed for the Persona page ${PERSONA_FRAGMENT_URL} — the draft ` +
        `fixture must still be Pagefind-indexed (drafts are excluded only from the agent-index/sitemap)`,
    );
  }
  if (!personaFragment.includes(PERSONA_UNIQUE_STRING)) {
    fail(
      `pagefind: the Persona fragment (${PERSONA_FRAGMENT_URL}) is missing its persona-unique string ` +
        `${JSON.stringify(PERSONA_UNIQUE_STRING)} — the passport body left the searchable region (NFR-004)`,
    );
  }
  ok(
    `persona: .${PERSONA_LAYOUT_MARKER} marker on ${PERSONA_PAGE} and unique text in its own ` +
      `fragment ${PERSONA_FRAGMENT_URL}`,
  );

  // === 8) Cascade order: token sheet BEFORE brand sheet (ADR-0013 seam 2) ======
  // (T034) Identify the TOKEN sheet by a Default-only declaration (the
  // `--dk-*→--sl-*` bridge — no brand sheet emits `--sl-*`) and the BRAND sheet by
  // a brand-only declaration (`.dk-related-card`), then assert the token
  // declarations precede the brand declarations in cascade order.
  //
  // Astro's PRODUCTION build bundles every `customCss` entry (generated token
  // sheet + brand sheets) into ONE hashed stylesheet, so there is no separate
  // per-sheet <link> to order in the multi-layer case — the seam-2 guarantee
  // becomes a SOURCE-ORDER guarantee WITHIN that bundle. This check verifies that
  // order NON-VACUOUSLY (it fails if either discriminator is absent, and fails if
  // the brand declaration precedes the token declaration), whether the sheets are
  // emitted as distinct <link>s (compare link order) or bundled (compare byte
  // offset). [NOTE: the WP text asked this to ERROR on a single bundle to avoid a
  // vacuous pass; the real branded build IS a single bundle, so erroring would
  // fail the gate. The byte-offset check below is strictly STRONGER than a
  // link-order check — it proves the actual declaration order the cascade depends
  // on — and is reported as a deliberate, non-vacuous substitution.]
  const cssHrefs = stylesheetHrefs(heroHtml);
  let tokenLoc = null; // { file, offset }
  let brandLoc = null;
  for (let i = 0; i < cssHrefs.length; i += 1) {
    const p = astroCssPath(dir, cssHrefs[i]);
    if (p === null) continue;
    let sheet;
    try {
      sheet = await readFile(p, 'utf8');
    } catch {
      continue;
    }
    if (tokenLoc === null) {
      const tm = sheet.match(TOKEN_SHEET_DISCRIMINATOR);
      if (tm) tokenLoc = { link: i, offset: tm.index };
    }
    if (brandLoc === null) {
      const bm = sheet.match(BRAND_SHEET_DISCRIMINATOR);
      if (bm) brandLoc = { link: i, offset: bm.index };
    }
  }
  if (tokenLoc === null) {
    fail(
      `cascade: the token-sheet discriminator (${TOKEN_SHEET_DISCRIMINATOR}) was not found in any ` +
        `stylesheet <link> on ${HERO_PAGE} — the generated token sheet/bridge is not being emitted (seam 2)`,
    );
  }
  if (brandLoc === null) {
    fail(
      `cascade: the brand-sheet discriminator (${BRAND_SHEET_DISCRIMINATOR}) was not found in any ` +
        `stylesheet <link> on ${HERO_PAGE} — the brand component sheet is not being emitted (seam 2)`,
    );
  }
  const tokenBeforeBrand =
    tokenLoc.link < brandLoc.link ||
    (tokenLoc.link === brandLoc.link && tokenLoc.offset < brandLoc.offset);
  if (!tokenBeforeBrand) {
    fail(
      `cascade: the brand sheet's declarations precede the token sheet's ` +
        `(token @link${tokenLoc.link}:${tokenLoc.offset}, brand @link${brandLoc.link}:${brandLoc.offset}) — ` +
        `tokens-before-overrides is violated (ADR-0013 seam 2 / C-007)`,
    );
  }
  ok(
    `cascade: token sheet precedes brand sheet ` +
      (tokenLoc.link === brandLoc.link
        ? `within the bundled stylesheet (byte offsets ${tokenLoc.offset} < ${brandLoc.offset})`
        : `by <link> order (${tokenLoc.link} < ${brandLoc.link})`),
  );

  // === 9) Mode-varying completeness + brand sheets set no --sl-* (FR-011/FR-004) =
  // (T035.1) Each mode-varying colour token must be re-declared under a dark
  // selector in the emitted CSS: a dropped dark re-declaration would leak the
  // light value into dark mode. (T035.2) The authored brand sheets must declare
  // ZERO `--sl-*` — the bridge owns `--sl-*`.
  const darkBodies = darkBlockBodies(css);
  if (darkBodies.length === 0) {
    fail(`mode-varying: no [data-theme='dark'] selector block found in the emitted CSS (FR-011)`);
  }
  const darkJoined = darkBodies.join('\n');
  const missingDark = REQUIRED_MODE_VARYING.filter((t) => !darkJoined.includes(`${t}:`));
  if (missingDark.length > 0) {
    fail(
      `mode-varying: ${missingDark.length} mode-varying token(s) not re-declared under a dark ` +
        `selector: ${missingDark.join(', ')} — the light value would leak into dark mode (FR-011)`,
    );
  }
  ok(`mode-varying: all ${REQUIRED_MODE_VARYING.length} mode-varying --dk-* tokens re-declared under dark`);

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  for (const rel of BRAND_SHEET_SOURCES) {
    const abs = path.resolve(scriptDir, rel);
    let source;
    try {
      source = await readFile(abs, 'utf8');
    } catch (err) {
      fail(`--dk-*-only: could not read brand sheet ${rel} (${err.code ?? err.message})`);
    }
    const slDecls = [...stripCssComments(source).matchAll(/(?:^|[{;\s])(--sl-[\w-]+)\s*:/g)].map(
      (m) => m[1],
    );
    if (slDecls.length > 0) {
      fail(
        `--dk-*-only: brand sheet ${rel} declares Starlight variable(s) directly: ` +
          `${[...new Set(slDecls)].join(', ')} — a theme sets --dk-* only; the bridge owns --sl-* (FR-004/ADR-0011)`,
      );
    }
  }
  ok(`--dk-*-only: brand sheets (${BRAND_SHEET_SOURCES.length}) declare zero --sl-* variables`);

  // === 10) Brand AA construction: ≥24px targets + :focus-visible ring =========
  // (T046) axe cannot machine-verify target-size (2.5.8) or a visible focus
  // indicator, so this WP owns them as CSS construction checks, SCOPED to the
  // brand's interactive selectors (a ≥24px rule or focus ring elsewhere in
  // Starlight's bundled CSS must NOT satisfy them). Mirrors the M1 .dk-hub__card
  // pattern (NFR-001).
  for (const selector of BRAND_INTERACTIVE_TARGETS) {
    const blocks = ruleBlocksFor(css, selector);
    if (blocks.length === 0) {
      fail(`accessibility: no \`${selector}\` rule in the emitted CSS (brand target sizing missing, NFR-001)`);
    }
    if (!blocks.some((b) => hasMinTarget24(b.body))) {
      fail(
        `accessibility: \`${selector}\` carries no min-height/min-width ≥24px target rule ` +
          `(WCAG 2.5.8 target size, NFR-001)`,
      );
    }
    // The focus rule's selector must carry BOTH this target AND `:focus-visible`,
    // but not necessarily adjacently: Astro injects a `:where(.astro-…)` scope
    // between the class and the pseudo-class for a component's scoped `<style>`
    // (e.g. the footer organism), so an exact `${selector}:focus-visible` needle
    // would miss it. Requiring both substrings in one rule keeps this scoped to
    // the brand target (a bare `:focus-visible` in Starlight's CSS does not count).
    const focusBlocks = ruleBlocksFor(css, selector).filter((b) =>
      b.selector.includes(':focus-visible'),
    );
    if (focusBlocks.length === 0) {
      fail(
        `accessibility: \`${selector}\` has no :focus-visible ring rule in the emitted CSS ` +
          `(visible focus indicator missing, NFR-001)`,
      );
    }
  }
  ok(
    `accessibility: all ${BRAND_INTERACTIVE_TARGETS.length} brand interactive targets carry a ≥24px ` +
      `rule and a scoped :focus-visible ring`,
  );

  // === 11) Brand footer slot-override observable (SC-004) =====================
  // (T047a) `dk-site-footer--brand` proves the brand SiteFooter organism rendered
  // THROUGH WP03's Footer carrier (slotComponents resolved) — the default footer
  // would not emit it.
  const footerHtml = await readHtml(dir, FOOTER_PAGE);
  if (!footerHtml.includes(FOOTER_BRAND_MARKER)) {
    fail(
      `footer override: the brand footer marker \`${FOOTER_BRAND_MARKER}\` is absent on ${FOOTER_PAGE} — ` +
        `slotComponents did not resolve through the Footer carrier (default footer rendered?), SC-004`,
    );
  }
  ok(`footer override: brand footer marker \`${FOOTER_BRAND_MARKER}\` present on ${FOOTER_PAGE}`);
}

// Standalone entry point: `node src/scripts/assert-chrome-artifacts.mjs <distDir>`.
// import.meta.main is not available on all Node 22 minors, so compare argv paths.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  const distArg = process.argv[2];
  if (!distArg) fail('usage: node src/scripts/assert-chrome-artifacts.mjs <distDir>');
  assertChromeArtifacts(distArg)
    .then(() => {
      process.stdout.write(`assert:chrome: PASS — chrome + pagefind artifacts valid\n`);
    })
    .catch((err) => fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`));
}

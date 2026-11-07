/**
 * The chrome fixture harness (page-chrome WP11): builds the frozen site in
 * `site/` with `astro.config.mjs` under varied options, and reads its baseline.
 *
 * A build happens once per distinct request. Each request has its own root,
 * `example/.dk-test-chrome/<key>/`, and that root is reused while nothing that
 * can change the output has changed (`sourceFingerprint`), so suites share builds
 * across test files and runs. Failed builds are not reused.
 *
 * Node built-ins only: the capture script, Playwright's config and tests import it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const CHROME_DIR = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'chrome');
const SITE_DIR = path.join(CHROME_DIR, 'site');
const EXAMPLE_DIR = path.join(REPO_ROOT, 'example');
const BUILDS_DIR = path.join(EXAMPLE_DIR, '.dk-test-chrome');
const ASTRO_BIN = path.join(EXAMPLE_DIR, 'node_modules', 'astro', 'bin', 'astro.mjs');
const FINGERPRINT_FILE = '.dk-build-fingerprint';

export const GOLDEN_DIR = path.join(CHROME_DIR, 'golden');
/** The toolkit sources a build reads; a change to one is why goldens exist. */
export const TOOLKIT_PATHS = ['src/index.ts', 'src/lib', 'src/components', 'src/layouts', 'src/styles', 'src/themes', 'src/assets', 'src/scripts'];

/**
 * The dists Playwright serves, built by `pnpm build:chrome-dists` into
 * `example/dist-chrome-<name>`. A project serving the wrong one would measure the
 * wrong site, so playwright.config.ts reads the names from here.
 */
export const CHROME_DISTS = {
  'title-as-index': { sidebar: { titleIsIndex: true } },
  unthemed: { theme: null },
};
export const chromeDistPath = (name) => `example/dist-chrome-${name}`;

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(path.join(dir, entry.name)).map((file) => path.join(entry.name, file)) : [entry.name],
  );
}

/** A hash of everything a fixture build reads from the repository, except the options. */
export function sourceFingerprint() {
  const hash = createHash('sha256');
  const add = (abs) => hash.update(path.relative(REPO_ROOT, abs)).update('\0').update(readFileSync(abs)).update('\0');
  for (const rel of [...TOOLKIT_PATHS, 'src/package.json', 'pnpm-lock.yaml', 'src/tests/fixtures/chrome/harness.mjs', 'src/tests/fixtures/chrome/astro.config.mjs', 'src/tests/fixtures/chrome/site']) {
    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) throw new Error(`sourceFingerprint: ${rel} does not exist, so the build cache cannot be trusted`);
    if (statSync(abs).isDirectory()) for (const file of filesUnder(abs).sort()) add(path.join(abs, file));
    else add(abs);
  }
  return hash.digest('hex');
}

/** The environment of a build: only what the request sets, whatever the caller's shell or Vitest holds. */
function buildEnv(options, env) {
  const clean = { ...process.env, CI: '' };
  for (const name of Object.keys(clean)) {
    if (name.startsWith('DK_') || ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'].includes(name)) delete clean[name];
  }
  return { ...clean, DK_PUBLISH_DRAFTS: 'on', ...env, DK_TEST_OPTIONS: JSON.stringify(options), DK_OUTDIR: 'dist' };
}

/**
 * Build the fixture, or reuse the build of the same request.
 *
 * @param {object} [request]
 * @param {Record<string, unknown>} [request.options] spread over the fixture config's options
 * @param {Record<string, string | null>} [request.files] a site variant: site-relative
 *   paths to overwrite, or to delete with `null`
 * @param {Record<string, string>} [request.env] extra build environment, such as `DK_PUBLISH_DRAFTS`
 * @returns {{ status: number | null, output: string, cached: boolean, root: string, dist: string }}
 */
export function buildChromeFixture({ options = {}, files = {}, env = {} } = {}) {
  const key = createHash('sha256').update(JSON.stringify({ options, files, env })).digest('hex').slice(0, 16);
  const root = path.join(BUILDS_DIR, key);
  const dist = path.join(root, 'dist');
  const marker = path.join(root, FINGERPRINT_FILE);
  const fingerprint = sourceFingerprint();
  if (existsSync(marker) && readFileSync(marker, 'utf8') === fingerprint) {
    return { status: 0, output: '', cached: true, root, dist };
  }
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  cpSync(SITE_DIR, root, { recursive: true });
  cpSync(path.join(CHROME_DIR, 'astro.config.mjs'), path.join(root, 'astro.config.mjs'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(root, rel);
    if (contents === null) rmSync(abs, { force: true });
    else {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, contents);
    }
  }
  const run = spawnSync(process.execPath, [ASTRO_BIN, 'build'], { cwd: root, encoding: 'utf8', env: buildEnv(options, env) });
  if (run.status === 0) writeFileSync(marker, fingerprint);
  return { status: run.status, output: stripVTControlCharacters(`${run.stdout}\n${run.stderr}`), cached: false, root, dist };
}

/** The site variant with no index page below the root, so every group takes the plain path (WP06's parity test). */
export function noIndexVariant() {
  const docs = path.join(SITE_DIR, 'docs');
  return Object.fromEntries(
    filesUnder(docs)
      .filter((file) => file.includes(path.sep) && /(^|[\\/])(README|index)\.mdx?$/.test(file))
      .map((file) => [path.join('docs', file), null]),
  );
}

/** Replace what differs between two builds of the same input: scoped classes and hashed asset names. */
export function normaliseBuildIds(text) {
  return text
    .replace(/data-astro-cid-[a-z0-9]+/g, 'data-astro-cid-HASH')
    .replace(/astro-[a-z0-9]{8}\b/g, 'astro-HASH')
    .replace(/(_astro\/[^"'`\s()]*?)\.[A-Za-z0-9_-]+\.([a-z0-9]+)(?=["'`\s()?]|$)/gm, '$1.HASH.$2');
}

/** One page's whole sidebar fragment, `data-hash` included, as built. */
export function sidebarFragment(html) {
  const start = html.indexOf('<sl-sidebar-state-persist');
  const closing = '</sl-sidebar-state-persist>';
  const end = html.indexOf(closing, start);
  if (start === -1 || end === -1) throw new Error('the page has no <sl-sidebar-state-persist> fragment');
  return html.slice(start, end + closing.length);
}

/** The deep page of the sidebar golden, and the non-hub page of the page golden. */
export const DEEP_PAGE = 'guides/authoring/advanced/deep-page/index.html';
export const NON_HUB_PAGE = 'guides/getting-started/index.html';

/** The list and content of the emitted CSS, one text, in an order that does not depend on the hashes. */
export function emittedCss(dist) {
  const blocks = filesUnder(dist)
    .filter((file) => file.endsWith('.css'))
    .map((file) => `/* ===== ${normaliseBuildIds(file.split(path.sep).join('/'))} ===== */\n${normaliseBuildIds(readFileSync(path.join(dist, file), 'utf8'))}`);
  return `${blocks.sort().join('\n')}\n`;
}

/** The three goldens' current values for a built dist, keyed by golden file name. */
export function readBaseline(dist) {
  const read = (page) => readFileSync(path.join(dist, page), 'utf8');
  return {
    'sidebar.html': `${normaliseBuildIds(sidebarFragment(read(DEEP_PAGE)))}\n`,
    'page.html': `${normaliseBuildIds(read(NON_HUB_PAGE))}\n`,
    'css.txt': emittedCss(dist),
  };
}

/** The panels of the page golden's non-hub page, by their `dk-panel--*` modifier. */
export const METADATA_PANELS = ['audience', 'related', 'external-references', 'glossary'];

/** The end of the element opening at `start`, counting only its own tag name. */
export function elementEnd(html, start, tag) {
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error(`an unclosed <${tag}> at offset ${start}`);
}

/**
 * The page with what WP04 is allowed to change removed: each metadata block's region (a `<!--block:name-->` marker stays in its place),
 * the disclosure sheet's inline `<style>`, and the blocks' script tag. Everything else
 * stays, so a comparison of two normalised pages still holds the rest to its bytes
 * (FR-013). A missing panel throws: a block that disappeared must not compare clean.
 */
export function normaliseMetadataBlocks(html, panels = METADATA_PANELS) {
  let page = html;
  for (const panel of panels) {
    const open = new RegExp(`<(section|div)\\b[^>]*\\bclass="dk-panel dk-panel--${panel}[ "]`).exec(page);
    if (!open) throw new Error(`normaliseMetadataBlocks: the page has no ${panel} panel`);
    // A marker stays where the block was, so the block's position is still compared.
    page = `${page.slice(0, open.index)}<!--block:${panel}-->${page.slice(elementEnd(page, open.index, open[1]))}`;
  }
  return page
    .replace(/<style>(?:(?!<\/style>)[\s\S])*?\.dk-disclosure\b(?:(?!<\/style>)[\s\S])*?<\/style>/g, '')
    .replace(/<script type="module" src="[^"]*\/MetadataBlock\.astro[^"]*"><\/script>/g, '');
}

const GROUP_REGION = (name) => new RegExp(`\\s*<nav class="dk-${name}[ "][\\s\\S]*?</nav>\\s*`);
const FOOTER_MARKER = (name) => `<!--footer:${name}-->`;
const HEAD_MARKER = '<!--head:alternates-->';
/** A run of the head's alternates. Starlight's own carry `hreflang`, and are not ours. */
const HEAD_ALTERNATES = /\s*(?:<link rel="alternate" type="[^"]*" title="[^"]*" href="[^"]*"\/?>\s*)+/g;
const DK_CHROME_META = /(<meta name="dk-chrome" content="doc-kitty-carriers">)\s*/;
const SITE_FOOTER_HOST = /<\/footer>\s*(?=<div data-dk-slot="dk:site-footer">)/;

/**
 * What WP09 is allowed to change in a page, as position markers, so a comparison holds
 * the order and everything else to its bytes:
 *  - `actual`, a page built now: each footer group and the run of head alternates
 *    become markers where they stand.
 *  - `golden`, a page from before WP09: the `discoveryHead` links it no longer has
 *    leave, and the markers go where the groups and alternates must now stand.
 * Whitespace next to a marker goes too, since the template differs there. A missing
 * group or anchor throws, as it must not compare clean.
 *
 * Separate from WP04's `normaliseMetadataBlocks`: they touch different regions.
 *
 * @param {string} html
 * @param {'actual' | 'golden'} side
 */
export function normaliseFooterAndHeadLinks(html, side) {
  const must = (pattern, name) => {
    if (!pattern.test(html)) throw new Error(`normaliseFooterAndHeadLinks: the ${side} page has no ${name}`);
  };
  if (side === 'actual') {
    must(GROUP_REGION('machine-links'), 'machine links group');
    must(GROUP_REGION('page-formats'), 'page formats group');
    return html
      .replace(GROUP_REGION('machine-links'), FOOTER_MARKER('machine-links'))
      .replace(GROUP_REGION('page-formats'), FOOTER_MARKER('page-formats'))
      .replace(HEAD_ALTERNATES, HEAD_MARKER);
  }
  must(DK_CHROME_META, 'dk-chrome meta');
  must(SITE_FOOTER_HOST, 'site footer host after an article footer');
  return html
    .replace(HEAD_ALTERNATES, '')
    .replace(DK_CHROME_META, `$1${HEAD_MARKER}`)
    .replace(SITE_FOOTER_HOST, `</footer>${FOOTER_MARKER('machine-links')}${FOOTER_MARKER('page-formats')}`);
}

/**
 * The whole rules WP09 adds to the emitted CSS, as the build writes them: the groups'
 * scoped sheets (their `.astro-HASH` is already `astro-HASH` in `emittedCss`), and the
 * theme's link rules. Each is a literal, not a pattern, so a rule that changes, goes
 * missing or shares a selector with another is not one of them.
 *
 * These strings depend on the bundler's output: the order of declarations, the
 * shorthand it folds them to and the `:where(.astro-HASH)` scoping are Astro's and
 * Vite's minifier's, not ours. A bundler or minifier upgrade can change them
 * without any change to the footer's source. To regenerate: build the chrome
 * fixture (`pnpm build:chrome-dists`, or `buildChromeFixture()`), read
 * `emittedCss(dist)` for the rule's selector in the stylesheet, copy that rule as
 * it stands, and check it against the footer components' styles before pasting it here.
 */
export const FOOTER_CSS_RULES = [
  'a.dk-pill{text-decoration:none}',
  'a.dk-pill:hover{text-decoration:underline}',
  'a.dk-pill:focus-visible{box-shadow:var(--dk-shadow-focus);outline:none}',
  '.dk-machine-links a{color:var(--sl-color-text-accent)}',
  '.dk-machine-links:where(.astro-HASH){gap:var(--dk-space-2xs) var(--dk-space-sm);font-size:var(--dk-text-sm);flex-wrap:wrap;margin-block-start:var(--dk-space-md);display:flex}',
  '.dk-machine-links:where(.astro-HASH) a:where(.astro-HASH){align-items:center;min-block-size:24px;min-inline-size:24px;display:inline-flex}',
  '.dk-machine-links:where(.astro-HASH) a:where(.astro-HASH):focus-visible{outline-offset:2px;outline:2px solid}',
  '.dk-page-formats:where(.astro-HASH){gap:var(--dk-space-2xs) var(--dk-space-xs);font-size:var(--dk-text-sm);flex-wrap:wrap;margin-block-start:var(--dk-space-xs);display:flex}',
  '.dk-page-formats:where(.astro-HASH) a:where(.astro-HASH){align-items:center;min-block-size:24px;min-inline-size:24px;display:inline-flex}',
  ':where(.dk-page-formats) a:focus-visible{outline-offset:2px;outline:2px solid}',
];

/**
 * The emitted CSS without WP09's rules, so a comparison holds the rest to its bytes.
 * They land in the shared stylesheet, not in an inline `<style>`. Each of
 * {@link FOOTER_CSS_RULES} must stand exactly once, as a whole rule (at the start or
 * right after another rule's `}`); one that is missing, changed, repeated or only part
 * of another rule throws, so a sheet that lost or edited one must not compare clean.
 *
 * @param {string} css
 */
export function normaliseFooterCss(css) {
  let out = css;
  for (const rule of FOOTER_CSS_RULES) {
    const at = [];
    for (let i = out.indexOf(rule); i !== -1; i = out.indexOf(rule, i + 1)) at.push(i);
    const whole = at.filter((i) => i === 0 || out[i - 1] === '}');
    if (at.length !== 1 || whole.length !== 1) {
      throw new Error(
        `normaliseFooterCss: expected ${rule} exactly once as a whole rule, found ${at.length} (${whole.length} whole). ` +
          'FOOTER_CSS_RULES are literals of the bundler\'s output: after a bundler or minifier upgrade, rebuild the fixture ' +
          '(pnpm build:chrome-dists), look the rule up in emittedCss(dist) and update the string in harness.mjs.',
      );
    }
    out = out.slice(0, whole[0]) + out.slice(whole[0] + rule.length);
  }
  return out;
}

/** The version of `name` as `example/` resolves it (Starlight does not export ./package.json). */
export function resolvedVersion(name) {
  return JSON.parse(readFileSync(path.join(EXAMPLE_DIR, 'node_modules', name, 'package.json'), 'utf8')).version;
}

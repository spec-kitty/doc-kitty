/**
 * WP06 T036 — the Header carrier, proven against BUILT HTML (FR-024, FR-025,
 * NFR-007, SC-008).
 *
 * Two builds of the same example pages:
 *
 *  - STOCK: `example/astro.config.mjs` as shipped. No theme layer fills
 *    `dk:site-header`, so the carrier must fall through to Starlight's header
 *    and add nothing. The header block of every page is compared with
 *    `fixtures/header-theme/stock-header.html`, which was captured from a build
 *    of the commit BEFORE the carrier existed (2ffe856).
 *  - THEMED: `fixtures/header-theme/astro.config.mjs`, the same options plus a
 *    consumer theme layer that fills `dk:site-header` with a fixture header.
 *
 * The two halves are paired on purpose (SC-008). The neutrality half alone
 * would pass if the carrier were never registered; the themed half fails in
 * that case, because only the carrier can put the fixture header in the page.
 *
 * What is normalised, and why. Exactly one thing: every Astro scoped-class name
 * (`astro-` followed by eight characters of [a-z0-9]) is replaced with the fixed
 * token `astro-HASH`, on BOTH sides of every comparison: the fixture is stored
 * already normalised, and every built header block passes through
 * `normaliseScopeHashes` before it is compared. Astro derives that hash from the
 * component's file path including the absolute path of the checkout, so the
 * same commit built in another directory (the repository root, another
 * worktree, CI) gets different hashes. That is unrelated to the carrier. Nothing
 * else is touched: element structure, attributes, the other class names, text,
 * whitespace and asset file hashes (which are content-derived, so identical at
 * every path) are compared as built. A wrapper element, an extra attribute, a
 * second header or a missing one still changes the block and fails the test.
 *
 * Regenerating the fixture: it is expected to change only when Starlight, the
 * example's title or the brand logo changes. Build the example
 * (`DK_PUBLISH_DRAFTS=off pnpm build`), take the `<header …>…</header>` block of
 * `example/dist/index.html`, replace each `astro-xxxxxxxx` class with
 * `astro-HASH`, and write it over the fixture in a commit that says why.
 * `fixtures/header-theme/README.txt` repeats this next to the file.
 *
 * Both builds run once, each into its own `DK_OUTDIR`, and the file is listed in
 * `vitest.workspace.ts`'s serialized `build` project (shared `example/.astro`).
 *
 * Mission: sidebar-frame-header-carrier-01M4T3CB, WP06.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE_DIR = path.join(REPO_ROOT, 'example');
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/header-theme/', import.meta.url));
const STOCK_OUT = 'dist-wp06-header-stock-test';
const THEMED_OUT = 'dist-wp06-header-theme-test';

/** An Astro scoped-class name. The eight characters encode the checkout path. */
const SCOPE_HASH = /astro-[a-z0-9]{8}/g;
const SCOPE_TOKEN = 'astro-HASH';
/** The only normalisation in this file; see the header comment for what and why. */
const normaliseScopeHashes = (html: string): string => html.replace(SCOPE_HASH, SCOPE_TOKEN);

/**
 * Captured from the pre-carrier build; one block, because every page shares it.
 * Stored normalised; passing it through the function again is a no-op that
 * keeps both sides of each comparison visibly on the same footing.
 */
const STOCK_HEADER = normaliseScopeHashes(
  readFileSync(path.join(FIXTURE_DIR, 'stock-header.html'), 'utf8'),
);
/** The pages named in the hand-off: home, a deep page with a sidebar, and the 404. */
const PINNED_PAGES = ['index.html', 'guides/getting-started/index.html', '404.html'];
const MARKER = 'data-dk-test-header="wp06"';
/** The root element of Starlight's stock `Header.astro`. */
const STOCK_HEADER_ROOT = '<div class="header sl-flex';

interface Build {
  status: number | null;
  stderr: string;
  pages: Map<string, string>;
}

function htmlFiles(dir: string, rel = ''): string[] {
  return readdirSync(path.join(dir, rel)).flatMap((name) => {
    const child = path.join(rel, name);
    if (statSync(path.join(dir, child)).isDirectory()) return htmlFiles(dir, child);
    return name.endsWith('.html') ? [child] : [];
  });
}

function runBuild(outName: string, args: string[]): Build {
  const outDir = path.join(EXAMPLE_DIR, outName);
  rmSync(outDir, { recursive: true, force: true });
  // Vitest writes its own `import.meta.env` into `process.env` (NODE_ENV=test,
  // MODE=test, DEV=1, PROD='', BASE_URL=/). A child `astro build` that inherits
  // them is not a production build: Starlight's search renders its dev-mode
  // notice instead of the search container, and BASE_URL overrides the site
  // base. They are removed so the child builds exactly as `pnpm build` does,
  // which is the build the fixture was captured from.
  const env: Record<string, string | undefined> = {
    ...process.env,
    DK_OUTDIR: outName,
    DK_PUBLISH_DRAFTS: 'off',
  };
  for (const name of ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL']) delete env[name];
  const run = spawnSync('pnpm', args, { cwd: REPO_ROOT, encoding: 'utf8', env });
  const pages = new Map<string, string>();
  if (run.status === 0 && existsSync(outDir)) {
    for (const rel of htmlFiles(outDir).sort()) {
      pages.set(rel.split(path.sep).join('/'), readFileSync(path.join(outDir, rel), 'utf8'));
    }
  }
  return { status: run.status, stderr: run.stderr, pages };
}

/**
 * The first `<header …>…</header>` block of a page with its scoped-class hashes
 * normalised, or `null` when the page has none.
 */
function headerBlock(html: string): string | null {
  const start = html.indexOf('<header');
  if (start === -1) return null;
  return normaliseScopeHashes(
    html.slice(start, html.indexOf('</header>', start) + '</header>'.length),
  );
}

/** Pages rendered through Starlight's page frame (decks and redirect stubs are not). */
const isFramed = (html: string): boolean => html.includes('<div class="page sl-flex');
const count = (html: string, needle: string): number => html.split(needle).length - 1;

let stock: Build;
let themed: Build;

beforeAll(() => {
  stock = runBuild(STOCK_OUT, ['--filter', 'example', 'build']);
  themed = runBuild(THEMED_OUT, [
    '--filter',
    'example',
    'exec',
    'astro',
    'build',
    '--config',
    path.relative(EXAMPLE_DIR, path.join(FIXTURE_DIR, 'astro.config.mjs')),
  ]);
}, 360_000);

describe('WP06 — Header carrier, no theme header (FR-025, NFR-007)', () => {
  it('the example build succeeds and has framed pages', () => {
    expect(stock.status, `build stderr:\n${stock.stderr}`).toBe(0);
    expect([...stock.pages.values()].filter(isFramed).length).toBeGreaterThan(40);
  });

  it('the fixture is stored normalised and the build really emits scoped hashes', () => {
    const raw = readFileSync(path.join(FIXTURE_DIR, 'stock-header.html'), 'utf8');
    expect(raw.match(SCOPE_HASH)).toBeNull();
    expect(count(raw, SCOPE_TOKEN)).toBeGreaterThan(0);
    // The built page carries real hashes, so the normalisation has something to do
    // and the comparison below is not between two already-identical strings.
    expect(stock.pages.get('index.html')!.match(SCOPE_HASH)).not.toBeNull();
  });

  it('every framed page has that same header block', () => {
    for (const page of PINNED_PAGES) {
      expect(stock.pages.has(page), `${page} was not built`).toBe(true);
      expect(isFramed(stock.pages.get(page)!), `${page} is framed`).toBe(true);
    }
    const differing = [...stock.pages]
      .filter(([, html]) => isFramed(html))
      .filter(([, html]) => headerBlock(html) !== STOCK_HEADER)
      .map(([page]) => page);
    expect(differing).toEqual([]);
  });

  it('a page with no header block is a page Starlight does not frame', () => {
    const unframedWithHeader = [...stock.pages]
      .filter(([, html]) => !isFramed(html) && headerBlock(html) !== null)
      .map(([page]) => page);
    expect(unframedWithHeader).toEqual([]);
  });

});

describe('WP06 — Header carrier, theme fills dk:site-header (FR-024)', () => {
  it('the themed build succeeds and builds the same pages', () => {
    expect(themed.status, `build stderr:\n${themed.stderr}`).toBe(0);
    expect([...themed.pages.keys()]).toEqual([...stock.pages.keys()]);
  });

  it('renders the theme header exactly once on every framed page', () => {
    const framed = [...themed.pages].filter(([, html]) => isFramed(html));
    expect(framed.map(([page]) => page)).toEqual(
      [...stock.pages].filter(([, html]) => isFramed(html)).map(([page]) => page),
    );
    for (const [page, html] of framed) expect(count(html, MARKER), page).toBe(1);
  });

  it("drops Starlight's stock header from every page", () => {
    for (const [page, html] of themed.pages) {
      expect(html.includes(STOCK_HEADER_ROOT), page).toBe(false);
    }
    // Paired control: the same probe does find the stock header in the stock build.
    for (const page of PINNED_PAGES) {
      expect(stock.pages.get(page)!.includes(STOCK_HEADER_ROOT), page).toBe(true);
    }
  });

  it.each(PINNED_PAGES)('%s: the theme header sits directly in the frame header', (page) => {
    const block = headerBlock(themed.pages.get(page)!)!;
    // Starlight's `PageFrame` supplies `<header class="header …">` around any
    // header override. Its opening tag is read from the STOCK BUILD's own page
    // (not from the fixture), so the two builds are compared with each other;
    // `headerBlock` normalises the scoped-class hash on both.
    const stockBlock = headerBlock(stock.pages.get(page)!)!;
    const frameOpen = stockBlock.slice(0, stockBlock.indexOf('>') + 1);
    expect(frameOpen).toBe(`<header class="header ${SCOPE_TOKEN}">`);
    // Nothing between that element and the fixture's own root: no wrapper, no
    // marker element, no whitespace.
    expect(block).toBe(
      `${frameOpen}<div ${MARKER}><a href="/doc-kitty">Fixture header</a></div></header>`,
    );
  });

  it('keeps the skip link and the mobile menu control, which live outside the header', () => {
    for (const page of PINNED_PAGES) {
      const html = themed.pages.get(page)!;
      const before = stock.pages.get(page)!;
      expect(count(html, '<a href="#_top"'), page).toBe(count(before, '<a href="#_top"'));
      expect(count(html, '<starlight-menu-button'), page).toBe(
        count(before, '<starlight-menu-button'),
      );
    }
    expect(count(themed.pages.get('index.html')!, '>Skip to content</a>')).toBe(1);
    expect(count(themed.pages.get('guides/getting-started/index.html')!, '<starlight-menu-button')).toBe(1);
  });
});

/**
 * Slot names are rejected where a theme is written: `DocKittyTheme.slots` is
 * keyed by the `DkSlotName` union, and the manifest performs no name check of
 * its own. Vitest does not type-check, so this compiles two one-line themes with
 * the TypeScript API and reads the diagnostics.
 */
describe('WP06 — slot names (theme definition type)', () => {
  function diagnosticsFor(slotName: string): string[] {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-wp06-slot-'));
    const file = path.join(dir, 'theme-under-test.ts');
    const themeModule = fileURLToPath(new URL('../lib/theme.ts', import.meta.url));
    writeFileSync(
      file,
      `import type { DocKittyTheme } from ${JSON.stringify(themeModule)};\n` +
        `export const theme: DocKittyTheme = { slots: { ${JSON.stringify(slotName)}: 'x/Header.astro' } };\n`,
    );
    try {
      const program = ts.createProgram([file], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowImportingTsExtensions: true,
      });
      return program
        .getSemanticDiagnostics(program.getSourceFile(file))
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('accepts dk:site-header', () => {
    expect(diagnosticsFor('dk:site-header')).toEqual([]);
  });

  it('rejects a slot name outside the surface', () => {
    const messages = diagnosticsFor('dk:site-heading');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("'\"dk:site-heading\"' does not exist in type");
  });
});

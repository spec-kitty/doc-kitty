#!/usr/bin/env node
/**
 * capture-stock-header.mjs — recapture the stock-header fixture and its stamp.
 *
 * Usage:
 *   pnpm fixture:stock-header
 *   node src/scripts/capture-stock-header.mjs
 *
 * Builds the example with the `Header` carrier switched off
 * (`DK_INTERNAL_STOCK_HEADER=on`, read in `src/lib/config.ts`), so the page
 * carries Starlight's own header and nothing of the toolkit's. It then writes,
 * together:
 *
 *  - `src/tests/fixtures/header-theme/stock-header.html`: the first
 *    `<header …>…</header>` block of `index.html`, every Astro scoped class
 *    (`astro-` plus eight [a-z0-9]) replaced with `astro-HASH`, no trailing
 *    newline. `header-carrier.test.ts` compares every framed page against it.
 *  - `stock-header.meta.json`: the stamp (Starlight and Astro as `example/`
 *    resolves them, the toolkit's `compressHTML` pin, `carrier: "disabled"`,
 *    the page). `stock-header-stamp.test.ts` fails fast when one of them moves.
 *
 * It prints "fixture unchanged", or the changed parts of the block, plus the
 * stamp. Review a changed block before committing it (#207).
 *
 * The build goes into its own `DK_OUTDIR`, removed before and after. Exits
 * non-zero when the build fails, when the page has no header block, or when the
 * block is not Starlight's stock header.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
// The pin is read from the integration that sets it, not restated here. Node
// strips the file's types itself (it has only a type-only import).
import { compressHtmlIntegration } from '../lib/integrations/compress-html.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE_DIR = path.join(REPO_ROOT, 'example');
const FIXTURE_DIR = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'header-theme');
const FIXTURE = path.join(FIXTURE_DIR, 'stock-header.html');
const STAMP = path.join(FIXTURE_DIR, 'stock-header.meta.json');
const OUT_NAME = 'dist-stock-header-capture';
const OUT_DIR = path.join(EXAMPLE_DIR, OUT_NAME);
const CAPTURED_FROM = 'example/dist/index.html';

// The same normalisation and extraction as `header-carrier.test.ts` (its
// `normaliseScopeHashes` and `headerBlock` are local to that test file, so they
// are restated here once; keep the two in step).
const SCOPE_HASH = /astro-[a-z0-9]{8}/g;
const normaliseScopeHashes = (html) => html.replace(SCOPE_HASH, 'astro-HASH');
function headerBlock(html) {
  const start = html.indexOf('<header');
  if (start === -1) return null;
  const end = html.indexOf('</header>', start);
  if (end === -1) return null;
  return normaliseScopeHashes(html.slice(start, end + '</header>'.length));
}

// The root element of Starlight's stock `Header.astro`, and the attribute prefix
// toolkit markup uses. The carrier itself is markup-neutral by design (no
// wrapper, no marker; see `src/components/Header.astro`), so no marker can tell
// a carrier build from a stock one: the build env is what switches it off, and
// WP03's config test proves the switch drops `Header`. This check only refuses
// a block that is not Starlight's header at all.
const STOCK_HEADER_ROOT = '<div class="header ';
const TOOLKIT_MARKUP = 'data-dk-';

function fail(message) {
  console.error(`capture-stock-header: ${message}`);
  process.exitCode = 1;
}

/** The version of `name` as `example/` resolves it (Starlight does not export ./package.json). */
function packageVersion(name) {
  const require = createRequire(path.join(EXAMPLE_DIR, 'package.json'));
  for (const dir of require.resolve.paths(name) ?? []) {
    const manifest = path.join(dir, name, 'package.json');
    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8')).version;
  }
  throw new Error(`${name} is not resolvable from example/`);
}

function pinnedCompressHtml() {
  let value;
  compressHtmlIntegration.hooks['astro:config:setup']({ updateConfig: (patch) => (value = patch.compressHTML) });
  return value;
}

/** Build the example without the Header carrier; the status of `pnpm`. */
function build() {
  // As `header-carrier.test.ts`'s `runBuild`: drop the variables Vitest leaks
  // into `process.env`, in case this is ever called from a test.
  const env = { ...process.env, DK_OUTDIR: OUT_NAME, DK_PUBLISH_DRAFTS: 'off', DK_INTERNAL_STOCK_HEADER: 'on' };
  for (const name of ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL']) delete env[name];
  const run = spawnSync('pnpm', ['--filter', 'example', 'build'], { cwd: REPO_ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
  return run.status;
}

/** The changed tags of two blocks, one tag per line, with a little context. */
function tagDiff(before, after) {
  const a = before.split(/(?<=>)/);
  const b = after.split(/(?<=>)/);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(`  ${a[i++]}`);
      j++;
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) lines.push(`- ${a[i++]}`);
    else lines.push(`+ ${b[j++]}`);
  }
  const keep = lines.map((line, n) => lines.slice(Math.max(0, n - 2), n + 3).some((l) => !l.startsWith('  ')));
  return lines.map((line, n) => (keep[n] ? line : keep[n - 1] ? '  …' : null)).filter((line) => line !== null).join('\n');
}

function main() {
  const stamp = {
    starlight: packageVersion('@astrojs/starlight'),
    astro: packageVersion('astro'),
    compressHTML: pinnedCompressHtml(),
    carrier: 'disabled',
    capturedFrom: CAPTURED_FROM,
  };
  if (typeof stamp.compressHTML !== 'boolean') return fail(`compressHTML pin is not a boolean: ${stamp.compressHTML}`);

  const status = build();
  if (status !== 0) return fail(`example build failed (exit ${status})`);
  const page = path.join(OUT_DIR, 'index.html');
  if (!existsSync(page)) return fail(`${path.relative(REPO_ROOT, page)} was not built`);
  const block = headerBlock(readFileSync(page, 'utf8'));
  if (block === null) return fail('index.html has no <header …>…</header> block');
  if (!block.includes(STOCK_HEADER_ROOT) || block.includes(TOOLKIT_MARKUP)) {
    return fail(`the header block is not Starlight's stock header:\n${block}`);
  }

  const previous = existsSync(FIXTURE) ? readFileSync(FIXTURE, 'utf8') : '';
  writeFileSync(FIXTURE, block);
  writeFileSync(STAMP, `${JSON.stringify(stamp, null, 2)}\n`);
  console.log(previous === block ? 'fixture unchanged' : `fixture changed (- old, + new):\n${tagDiff(previous, block)}`);
  console.log(`stamp: ${JSON.stringify(stamp)}`);
}

try {
  rmSync(OUT_DIR, { recursive: true, force: true });
  main();
} finally {
  rmSync(OUT_DIR, { recursive: true, force: true });
}

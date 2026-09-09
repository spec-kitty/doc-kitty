#!/usr/bin/env node
/**
 * assert-consumer-theme.mjs — the consumer-theme distinctness verifier
 * (contract C-6, SC-003; mission consumption-test / WP02, FR-002).
 *
 * Usage:  node assert-consumer-theme.mjs <dist-dir>
 *
 * Auto-discovered and run by the orchestrator (run-consumption-test.mjs step 6,
 * glob `assert-consumer-*.mjs`) against the fixture's built `dist/`.
 *
 * WHAT IT PROVES (non-fakeable): that the CONSUMER layer — the editorial "press"
 * theme (src/theme/) — actually WON the `default → brand → consumer` cascade in
 * the BUILT output, not merely that a theme was declared. For each of the named
 * `--dk-*` tokens the press theme sets, the value a browser would resolve under
 * `:root` (and, for mode-varying tokens, under `:root[data-theme='dark']`) must:
 *   1. EQUAL the press value  (the consumer override landed), AND
 *   2. DIFFER from the toolkit DEFAULT for that key  (`press === default` is a
 *      FAIL — it would not prove the consumer overrode anything).
 * Setting any press token back to its default value turns this verifier RED.
 *
 * HOW IT READS THE CASCADE. `emitTokenSheet` ships the generated token sheet as
 * a bundled/virtual CSS module (no standalone file on disk), and Astro may either
 * inline small stylesheets into `<style>` or link them as `<link rel=stylesheet>`.
 * So we reconstruct the cascade the way a browser does: parse a built HTML page,
 * walk its `<style>` blocks and stylesheet `<link>`s IN DOCUMENT ORDER, read each
 * one's CSS, concatenate, and take the LAST declaration of each token under the
 * relevant `:root` selector (all these declarations share specificity, so source
 * order decides — exactly why the consumer sheet must load last). This makes the
 * check corpus-agnostic: it depends only on the emitted CSS, not on doc content.
 *
 * VALUES ARE NORMALIZED before comparison (`norm`) because the CSS minifier may
 * lowercase and shorten hex (`#ffffff`→`#fff`), drop a leading zero
 * (`0.125rem`→`.125rem`), and re-quote/re-space font stacks. Normalization is
 * applied identically to the emitted value and to the embedded expectations, so
 * equality is exact-after-normalization.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── The named tokens the press theme overrides (contract C-6: ≥5). ───────────
// `mode: 'invariant'` → the brand does NOT restate the key in a `customCss`
// sheet, so the generated `:root` (carrying the merged press value) is the only
// declaration; verified under `:root` alone.
// `mode: 'varying'`   → declared in `press.css` under BOTH `:root` and
// `:root[data-theme='dark']` (either a genuinely per-mode colour, or a key the
// brand restates per-mode so the consumer must beat it in both blocks); verified
// under both selectors, each against its own press/default value.
//
// NOTE (pre-PR squad, MINOR): the `default:` values below are pinned literals
// from the toolkit's ADR-0013 default token catalog (src/lib/theme.ts
// DEFAULT_BASE/DEFAULT_DARK), NOT read from the installed toolkit at runtime. The
// anti-fake core (the press value must actually appear in the built dist) does
// not depend on them; they only power the extra "press ≠ default" arm. If a
// toolkit default is ever changed to coincide with a press value here, update
// these literals in the same change so the drift is caught in review.
const TOKENS = [
  {
    token: '--dk-font-display',
    mode: 'invariant',
    role: 'display font',
    press: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif',
    default: 'var(--dk-font-sans)',
  },
  {
    token: '--dk-radius-md',
    mode: 'invariant',
    role: 'radius',
    press: '0.125rem',
    default: '0.5rem',
  },
  {
    token: '--dk-tracking-caps',
    mode: 'invariant',
    role: 'caps tracking',
    press: '0.2em',
    default: '0.06em',
  },
  {
    token: '--dk-color-accent',
    mode: 'varying',
    role: 'accent',
    press: { light: '#a6231f', dark: '#a6231f' },
    default: { light: '#3159c4', dark: '#7aa0f2' },
  },
  {
    token: '--dk-color-accent-text',
    mode: 'varying',
    role: 'accent ink',
    press: { light: '#ffffff', dark: '#ffffff' },
    default: { light: '#1d3d94', dark: '#a9c2f7' },
  },
  {
    token: '--dk-color-surface-1',
    mode: 'varying',
    role: 'surface',
    press: { light: '#faf7f0', dark: '#232019' },
    default: { light: '#f7f8fa', dark: '#1b212e' },
  },
  {
    token: '--dk-color-text-strong',
    mode: 'varying',
    role: 'heading colour',
    press: { light: '#1a1410', dark: '#f4efe6' },
    default: { light: '#101828', dark: '#f2f4f8' },
  },
];

function die(msg) {
  console.error(`\n✖ assert-consumer-theme: ${msg}`);
  process.exit(1);
}

/** Recursively collect files under `dir` whose name matches `pred`. */
function walk(dir, pred, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, pred, out);
    else if (pred(entry)) out.push(full);
  }
  return out;
}

/**
 * Reconstruct a page's stylesheet cascade: return the concatenated CSS of every
 * `<style>` block and same-site stylesheet `<link>` in document order. Links are
 * resolved to files in `dist` by basename (asset names are content-hashed and
 * unique), which sidesteps any `base`-prefix maths in the href.
 */
function cascadeForPage(htmlPath, cssByBase) {
  const html = readFileSync(htmlPath, 'utf8');
  const parts = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>|<link\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      parts.push(m[1]); // inline <style> content
      continue;
    }
    const attrs = m[2] || '';
    if (!/rel\s*=\s*['"][^'"]*stylesheet[^'"]*['"]/i.test(attrs)) continue;
    const href = (attrs.match(/href\s*=\s*['"]([^'"]+)['"]/i) || [])[1];
    if (!href || /^https?:/i.test(href)) continue;
    const base = path.basename(href.split(/[?#]/)[0]);
    const file = cssByBase.get(base);
    if (file) parts.push(readFileSync(file, 'utf8'));
  }
  return parts.join('\n');
}

/**
 * The value a browser resolves for `token` under the given selector kind
 * ('light' → bare `:root`; 'dark' → `:root[data-theme='dark']`): the value from
 * the LAST such rule that declares the token (same specificity → source order
 * wins). Returns `undefined` if never declared under that selector.
 */
function effectiveValue(css, token, kind) {
  const selRe =
    kind === 'dark'
      ? /:root\[data-theme\s*=\s*['"]?dark['"]?\]\s*\{([^{}]*)\}/gi
      : /:root\s*\{([^{}]*)\}/gi;
  const declRe = new RegExp(`(?:^|[;{\\s])${token}\\s*:\\s*([^;}]*)`, 'i');
  let value;
  let block;
  while ((block = selRe.exec(css))) {
    const decl = declRe.exec(block[1]);
    if (decl) value = decl[1].trim();
  }
  return value;
}

/** Normalize a CSS value so minifier transforms don't break exact comparison. */
function norm(v) {
  if (v == null) return v;
  let s = String(v).trim().toLowerCase();
  s = s.replace(/["']/g, '"'); // unify quote style
  s = s.replace(/\s*,\s*/g, ','); // spaces around commas
  s = s.replace(/\s+/g, ' '); // collapse whitespace
  s = s.replace(/(^|[,\s(])0+\.(\d)/g, '$1.$2'); // 0.5rem → .5rem
  s = s.replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, '#$1$1$2$2$3$3'); // #fff → #ffffff
  return s;
}

function main() {
  const distArg = process.argv[2];
  if (!distArg) die('usage: assert-consumer-theme.mjs <dist-dir>');
  const dist = path.resolve(distArg);
  if (!existsSync(dist)) die(`dist dir not found: ${dist}`);

  const htmlFiles = walk(dist, (f) => f.endsWith('.html')).sort();
  if (htmlFiles.length === 0) die(`no .html pages found under ${dist}`);

  const cssByBase = new Map();
  for (const f of walk(dist, (f) => f.endsWith('.css'))) cssByBase.set(path.basename(f), f);

  // Pick the first page whose reconstructed cascade actually carries the themed
  // token sheet (proven by the presence of an overridden key). Fail loudly if no
  // page does — a themed build that emitted no `--dk-*` cascade is a real defect.
  let css = '';
  let page = '';
  for (const html of htmlFiles) {
    const c = cascadeForPage(html, cssByBase);
    if (/--dk-color-accent\b/.test(c) && /--dk-radius-md\b/.test(c)) {
      css = c;
      page = html;
      break;
    }
  }
  if (!css) {
    die(
      `no built page exposes the generated --dk-* token cascade (looked at ${htmlFiles.length} pages).\n` +
        `  Is the press theme wired into astro.config.mjs and did the build emit the token sheet?`,
    );
  }

  console.log(`\n── assert-consumer-theme: cascade from ${path.relative(dist, page)}`);

  const failures = [];
  const checks = []; // one entry per (token, selector) proof line

  function assertSelector(token, role, selectorKind, pressVal, defaultVal) {
    const actual = effectiveValue(css, token, selectorKind);
    const where = selectorKind === 'dark' ? ":root[data-theme='dark']" : ':root';
    if (actual === undefined) {
      failures.push(`${token} (${role}) — no declaration found under ${where}`);
      return;
    }
    const a = norm(actual);
    if (a !== norm(pressVal)) {
      failures.push(
        `${token} (${role}) under ${where}: emitted "${actual}" ≠ press value "${pressVal}" (consumer override did NOT win)`,
      );
      return;
    }
    if (a === norm(defaultVal)) {
      failures.push(
        `${token} (${role}) under ${where}: emitted "${actual}" EQUALS the toolkit default — press must differ from default (SC-003)`,
      );
      return;
    }
    checks.push(`✓ ${token} (${role}) ${where} = "${actual}" (press, ≠ default "${defaultVal}")`);
  }

  for (const t of TOKENS) {
    if (t.mode === 'invariant') {
      assertSelector(t.token, t.role, 'light', t.press, t.default);
    } else {
      assertSelector(t.token, t.role, 'light', t.press.light, t.default.light);
      assertSelector(t.token, t.role, 'dark', t.press.dark, t.default.dark);
    }
  }

  for (const line of checks) console.log(`  ${line}`);

  if (failures.length > 0) {
    console.error(`\n✖ consumer-theme distinctness FAILED (${failures.length}):`);
    for (const f of failures) console.error(`   • ${f}`);
    process.exit(1);
  }

  const varying = TOKENS.filter((t) => t.mode === 'varying').length;
  console.log(
    `\n✓ consumer-theme distinctness PASSED — ${TOKENS.length} --dk-* tokens carry the press value ` +
      `and differ from the toolkit default (${varying} verified in both light and dark).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

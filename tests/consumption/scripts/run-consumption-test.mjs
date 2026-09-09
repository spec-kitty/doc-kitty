#!/usr/bin/env node
/**
 * run-consumption-test.mjs — the clean-room consumption-test orchestrator
 * (contract C-1; the mission MVP proof, SC-001). Shared by CI and local runs so
 * the two can never diverge.
 *
 * Usage:
 *   node tests/consumption/scripts/run-consumption-test.mjs
 *   DK_CONSUMPTION_BOOTSTRAP=1 node tests/consumption/scripts/run-consumption-test.mjs
 *     ^ one-time: install WITHOUT --frozen-lockfile to (re)generate the committed
 *       fixture pnpm-lock.yaml. The default path is ALWAYS --frozen-lockfile.
 *
 * Sequence (any non-zero prerequisite step aborts with a non-zero exit):
 *   1. Pack the toolkit (`npm pack` in src/) → normalize to a stable
 *      `<fixture>/toolkit.tgz`.
 *   2. Install into the fixture in genuine isolation:
 *      `pnpm install --frozen-lockfile --ignore-workspace`, resolving
 *      `@commondocs-kitty/toolkit` from `file:./toolkit.tgz`.
 *   3. Isolation assertions (contract C-0 / NFR-001, NON-FAKEABLE):
 *        - realpath(node_modules/@commondocs-kitty/toolkit) is INSIDE the fixture,
 *        - is NOT under the repo `src/`,
 *        - is NOT a symlink (the fully-resolved target is a concrete dir),
 *        - its package.json version === the packed 0.1.0,
 *        - a grep proves ZERO `../src` toolkit-source imports in the fixture.
 *      Any miss fails closed.
 *   4. Source-hidden build: rename repo `src/` away so it is UNRESOLVABLE, run
 *      `astro build` in the fixture, and ALWAYS restore `src/` in a finally. A
 *      green build with the toolkit source hidden is the SC-001 proof — the
 *      `../src` grep alone is not.
 *   5. Run the four tarball-portable gate scripts from the INSTALLED package
 *      (node_modules/@commondocs-kitty/toolkit/scripts/*.mjs) against the
 *      fixture's docs/ and dist/.
 *   6. Auto-discover and run every tests/consumption/scripts/assert-consumer-*.mjs
 *      against dist/ (so later WPs' checkers plug in without editing this file).
 *
 * Steps 5 and 6 are AGGREGATED into a single non-zero exit on any failure so one
 * run reports every gate that failed, not just the first.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); // tests/consumption/scripts
const CONSUMPTION_DIR = path.dirname(SCRIPT_DIR); // tests/consumption
const REPO_ROOT = path.resolve(CONSUMPTION_DIR, '..', '..'); // repo root
const SRC_DIR = path.join(REPO_ROOT, 'src');
const SRC_HIDDEN = path.join(REPO_ROOT, 'src.hidden');
const FIXTURE_DIR = path.join(CONSUMPTION_DIR, 'consumer-fixture');
const TARBALL = path.join(FIXTURE_DIR, 'toolkit.tgz');
const DIST_DIR = path.join(FIXTURE_DIR, 'dist');
const DOCS_DIR = path.join(FIXTURE_DIR, 'docs');
const BASELINE = path.join(FIXTURE_DIR, 'url-baseline.txt');
const PKG_SCRIPTS = path.join(FIXTURE_DIR, 'node_modules', '@commondocs-kitty', 'toolkit', 'scripts');

// MUST match `base` in the fixture's astro.config.mjs (INV-2).
const BASE = '/consumer-fixture';
const EXPECTED_VERSION = '0.1.0';
const TOOLKIT_MODULE = path.join(FIXTURE_DIR, 'node_modules', '@commondocs-kitty', 'toolkit');

const BOOTSTRAP = process.env.DK_CONSUMPTION_BOOTSTRAP === '1';

function log(msg) {
  console.log(`\n── ${msg}`);
}

/** Run a command, inheriting stdio. Returns the exit status (number). */
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) {
    console.error(`✖ failed to spawn ${cmd}: ${res.error.message}`);
    return 1;
  }
  return res.status ?? 1;
}

/** Run a prerequisite step; abort the whole orchestrator on any non-zero exit. */
function runOrDie(cmd, args, opts, what) {
  const status = run(cmd, args, opts);
  if (status !== 0) {
    console.error(`\n✖ ${what} failed (exit ${status}). Aborting.`);
    process.exit(status || 1);
  }
}

function die(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

// ── src/ restore safety (pre-PR squad, security lens) ───────────────────────
// The source-hidden build renames repo `src/` → `src.hidden`. A bare `finally`
// is NOT enough: a build failure calls die()→process.exit() (skips finally) and
// Ctrl-C (SIGINT) kills Node without running it — either would leave `src/`
// renamed and brick the working tree. Restore idempotently from an `exit`
// handler (fires on process.exit, incl. die()) plus signal handlers.
function restoreSrc() {
  try {
    if (existsSync(SRC_HIDDEN) && !existsSync(SRC_DIR)) {
      renameSync(SRC_HIDDEN, SRC_DIR);
    }
  } catch {
    /* best-effort: never throw from an exit/signal handler */
  }
}
let srcRestoreHooked = false;
function hookSrcRestore() {
  if (srcRestoreHooked) return;
  srcRestoreHooked = true;
  process.on('exit', restoreSrc);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
      restoreSrc();
      process.exit(130);
    });
  }
}

// ── supply-chain subset guard (pre-PR squad, DIRECTIVE_051) ─────────────────
// `--ignore-workspace` forces `dangerouslyAllowAllBuilds` (pnpm 11 drops the
// scoped onlyBuiltDependencies), so this converts "trust the reviewer to spot a
// new postinstall in the lock diff" into an enforced invariant: after install,
// the set of installed packages that declare install/pre/post-install lifecycle
// scripts MUST be a subset of the repo-trusted {esbuild, sharp}. A future lock
// change that pulls in a new build-scripted transitive fails closed here.
const ALLOWED_BUILD_SCRIPT_PKGS = new Set(['esbuild', 'sharp']);
function assertBuildScriptAllowlist() {
  const base = path.join(FIXTURE_DIR, 'node_modules', '.pnpm');
  if (!existsSync(base)) return; // nothing installed (e.g. dry contexts)
  const found = new Set();
  const check = (pkgDir, name) => {
    const pj = path.join(pkgDir, 'package.json');
    if (!existsSync(pj)) return;
    try {
      const s = JSON.parse(readFileSync(pj, 'utf8')).scripts || {};
      if (s.preinstall || s.install || s.postinstall) found.add(name);
    } catch {
      /* ignore unreadable manifest */
    }
  };
  for (const d of readdirSync(base)) {
    const inner = path.join(base, d, 'node_modules');
    if (!existsSync(inner)) continue;
    for (const n of readdirSync(inner)) {
      if (n.startsWith('@')) {
        const scope = path.join(inner, n);
        for (const m of readdirSync(scope)) check(path.join(scope, m), `${n}/${m}`);
      } else {
        check(path.join(inner, n), n);
      }
    }
  }
  const unexpected = [...found].filter((n) => !ALLOWED_BUILD_SCRIPT_PKGS.has(n.split('/').pop()));
  if (unexpected.length > 0) {
    die(
      `supply-chain guard: unexpected lifecycle-script package(s) in the installed ` +
        `fixture: ${unexpected.join(', ')}. Only ${[...ALLOWED_BUILD_SCRIPT_PKGS].join(', ')} ` +
        `are repo-trusted (DIRECTIVE_051). Review the lockfile change before allowing this.`,
    );
  }
  console.log(
    `✓ supply-chain guard: lifecycle-script packages ⊆ {${[...ALLOWED_BUILD_SCRIPT_PKGS].join(', ')}}`,
  );
}

// ── Step 1: pack ──────────────────────────────────────────────────────────
function pack() {
  log('Step 1/6: pack the toolkit (npm pack in src/) → toolkit.tgz');
  const res = spawnSync('npm', ['pack', '--json', '--pack-destination', FIXTURE_DIR], {
    cwd: SRC_DIR,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    console.error(res.stderr || '');
    die('npm pack failed');
  }
  let filename;
  try {
    filename = JSON.parse(res.stdout)[0].filename;
  } catch {
    die(`could not parse npm pack --json output:\n${res.stdout}`);
  }
  // npm reports the package id as the filename for scoped packages; the file on
  // disk is the sanitized `commondocs-kitty-toolkit-<v>.tgz`. Resolve the real
  // artifact from the destination dir rather than trusting the reported name.
  const packed = readdirSync(FIXTURE_DIR).find(
    (f) => f.endsWith('.tgz') && f !== 'toolkit.tgz',
  );
  const source = packed ? path.join(FIXTURE_DIR, packed) : path.join(FIXTURE_DIR, filename);
  if (!existsSync(source)) die(`packed tarball not found (looked for ${source})`);
  if (existsSync(TARBALL)) rmSync(TARBALL);
  renameSync(source, TARBALL);
  console.log(`✓ packed → ${path.relative(REPO_ROOT, TARBALL)}`);
}

// ── Step 2: install (isolated) ──────────────────────────────────────────────
function install() {
  const frozen = BOOTSTRAP ? '--no-frozen-lockfile' : '--frozen-lockfile';
  log(`Step 2/6: pnpm install ${frozen} --ignore-workspace (isolated fixture)`);
  // `--ignore-workspace` (required by C-0) makes pnpm 11 ignore this fixture's
  // pnpm-workspace.yaml ENTIRELY — including its `onlyBuiltDependencies` — so a
  // scoped build-script allow-list cannot be honored here (verified: neither the
  // workspace-yaml list, an .npmrc list, nor a `--config.onlyBuiltDependencies`
  // CLI array approves the builds under `--ignore-workspace`). The ONLY working
  // toggle is `dangerouslyAllowAllBuilds`. In THIS tree pnpm reports exactly the
  // repo-trusted esbuild (two pinned majors) + sharp build scripts — Astro's
  // pinned, lockfile-frozen bundler and image service (research §Supply-chain) —
  // so allowing all builds runs precisely those. No unpinned or floating dep is
  // reachable (NFR-004: frozen lockfile). Kept on the CLI (never in a committed
  // config) so the blast radius is one command in this test-only orchestrator,
  // and assertBuildScriptAllowlist() below fails closed on any NEW build script.
  runOrDie(
    'pnpm',
    ['install', frozen, '--ignore-workspace', '--config.dangerouslyAllowAllBuilds=true'],
    { cwd: FIXTURE_DIR },
    'pnpm install',
  );
  assertBuildScriptAllowlist();
}

// ── Step 3: isolation assertions (C-0, non-fakeable) ────────────────────────
function assertIsolation() {
  log('Step 3/6: isolation assertions (contract C-0 / NFR-001)');
  if (!existsSync(TOOLKIT_MODULE)) {
    die(`@commondocs-kitty/toolkit is not installed at ${TOOLKIT_MODULE}`);
  }
  const resolved = realpathSync(TOOLKIT_MODULE);
  const fixtureReal = realpathSync(FIXTURE_DIR);
  const srcReal = existsSync(SRC_DIR) ? realpathSync(SRC_DIR) : SRC_DIR;

  // (a) resolved target must live INSIDE the fixture (its own .pnpm store), so a
  //     workspace symlink to the repo src/ (which lands OUTSIDE the fixture)
  //     cannot satisfy it.
  if (!(resolved === fixtureReal || resolved.startsWith(fixtureReal + path.sep))) {
    die(
      `toolkit resolves OUTSIDE the fixture: ${resolved}\n` +
        `  expected under: ${fixtureReal}\n` +
        `  (a workspace symlink to the repo src/ would land here — install must use --ignore-workspace)`,
    );
  }
  // (b) and it must NOT be under the repo src/ (the source tree the tarball proves independence from).
  if (resolved === srcReal || resolved.startsWith(srcReal + path.sep)) {
    die(`toolkit resolves UNDER the repo src/ (${resolved}) — building against source, not the tarball`);
  }
  // (c) the fully-resolved target must be a concrete directory, not a further symlink.
  if (lstatSync(resolved).isSymbolicLink()) {
    die(`resolved toolkit path is itself a symlink: ${resolved}`);
  }
  // (d) version must be exactly the packed 0.1.0.
  const pkg = JSON.parse(readFileSync(path.join(resolved, 'package.json'), 'utf8'));
  if (pkg.version !== EXPECTED_VERSION) {
    die(`installed toolkit version is ${pkg.version}, expected ${EXPECTED_VERSION}`);
  }
  console.log(`✓ resolved: ${path.relative(REPO_ROOT, resolved)} (v${pkg.version}, not a symlink, inside fixture, not under src/)`);

  // (e) grep: ZERO repo-relative `../src` toolkit-source imports in the fixture's
  //     authored files (never the installed node_modules / build output).
  const grepTargets = ['astro.config.mjs', 'src', 'docs']
    .map((p) => path.join(FIXTURE_DIR, p))
    .filter((p) => existsSync(p));
  const grep = spawnSync(
    'grep',
    [
      '-rEn',
      '--include=*.ts',
      '--include=*.tsx',
      '--include=*.astro',
      '--include=*.mjs',
      '--include=*.js',
      '--include=*.md',
      '(\\.\\./)+src(/|\'|")|@commondocs-kitty/toolkit/src',
      ...grepTargets,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  // grep exit 1 = no matches (PASS); 0 = matches found (FAIL); >1 = error.
  if (grep.status === 0) {
    die(`found repo-relative toolkit-source import(s) in the fixture:\n${grep.stdout}`);
  }
  if (grep.status && grep.status > 1) {
    die(`grep failed (exit ${grep.status}): ${grep.stderr}`);
  }
  console.log('✓ grep: 0 `../src` toolkit-source imports in the fixture');
}

// ── Step 4: source-hidden build (SC-001 proof) ──────────────────────────────
function build() {
  log('Step 4/6: astro build with repo src/ made UNRESOLVABLE (SC-001 proof)');
  if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true, force: true });
  hookSrcRestore(); // restore src/ even on die()/Ctrl-C, not just the finally
  let hidden = false;
  try {
    if (existsSync(SRC_HIDDEN)) {
      die(`${SRC_HIDDEN} already exists — a prior run did not restore src/; resolve manually`);
    }
    if (existsSync(SRC_DIR)) {
      renameSync(SRC_DIR, SRC_HIDDEN);
      hidden = true;
      console.log('✓ repo src/ hidden → src.hidden');
    }
    const status = run('pnpm', ['run', 'build'], { cwd: FIXTURE_DIR });
    if (status !== 0) {
      die(`fixture build failed (exit ${status}) — a packaging gap or unresolved export (fail-closed)`);
    }
  } finally {
    if (hidden && existsSync(SRC_HIDDEN)) {
      renameSync(SRC_HIDDEN, SRC_DIR);
      console.log('✓ repo src/ restored');
    }
  }
  if (!existsSync(DIST_DIR)) die('build produced no dist/');
  console.log('✓ clean-room build succeeded with src/ hidden');
}

// ── Steps 5 + 6: gates + auto-discovered consumer checkers (aggregated) ─────
function gate(label, scriptPath, args) {
  if (!existsSync(scriptPath)) {
    console.error(`✖ ${label}: gate script missing at ${scriptPath}`);
    return false;
  }
  // CRITICAL: invoke via the REAL path. The installed gate scripts are reached
  // through pnpm's node_modules symlink into the .pnpm store, so Node sets
  // `import.meta.url` to the RESOLVED (real) path while `process.argv[1]` keeps
  // the symlink path — the scripts' `if (import.meta.url === argv[1])` CLI guard
  // would then NEVER fire and each gate would exit 0 having done NOTHING (a
  // false green). Resolving the realpath here makes the two agree so the gate
  // actually runs. (For the non-symlinked consumer checkers this is a no-op.)
  const realScript = realpathSync(scriptPath);
  log(`Gate: ${label}`);
  const status = run('node', [realScript, ...args]);
  if (status !== 0) {
    console.error(`✖ ${label} failed (exit ${status})`);
    return false;
  }
  return true;
}

function gates() {
  const results = [];
  // Step 5: the four tarball-portable gates, invoked from the installed package.
  results.push(
    gate('validate-frontmatter', path.join(PKG_SCRIPTS, 'validate-frontmatter.mjs'), [
      DOCS_DIR,
      '--index-basename',
      'README,index',
    ]),
  );
  results.push(gate('check-links', path.join(PKG_SCRIPTS, 'check-links.mjs'), [DOCS_DIR]));
  results.push(
    gate('check-redirect-coverage', path.join(PKG_SCRIPTS, 'check-redirect-coverage.mjs'), [
      BASELINE,
      DIST_DIR,
    ]),
  );
  results.push(
    gate('assert-no-broken-links', path.join(PKG_SCRIPTS, 'assert-no-broken-links.mjs'), [
      DIST_DIR,
      '--base',
      BASE,
    ]),
  );

  // Step 6: auto-discover consumer-owned checkers (WP02/WP04 plug in here).
  const discovered = readdirSync(SCRIPT_DIR)
    .filter((f) => /^assert-consumer-.*\.mjs$/.test(f))
    .sort();
  if (discovered.length === 0) {
    console.log('\n(no assert-consumer-*.mjs checkers discovered yet — WP02/WP04 add them)');
  }
  for (const f of discovered) {
    results.push(gate(f, path.join(SCRIPT_DIR, f), [DIST_DIR]));
  }

  return results.every(Boolean);
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  console.log(`Consumption test — repo root: ${REPO_ROOT}`);
  if (BOOTSTRAP) console.log('(bootstrap mode: install will regenerate the lockfile)');
  pack();
  install();
  assertIsolation();
  build();
  const allPassed = gates();
  if (!allPassed) {
    console.error('\n✖ consumption test FAILED (one or more gates did not pass).');
    process.exit(1);
  }
  console.log('\n✓ consumption test PASSED — clean-room build from the tarball with src/ hidden (SC-001).');
}

main();

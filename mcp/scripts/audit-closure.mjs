#!/usr/bin/env node
/**
 * audit-closure.mjs - the NFR-003 supply-chain hard gate for
 * `@spec-kitty/doc-kitty-mcp` (mission doc-kitty-mcp-server WP06/T024).
 *
 * Runs AFTER `pnpm install` (the workspace install is its input). Call site:
 * root `pnpm assert:supply-chain` (wired in WP02); the consumption lane
 * exercises it via tests/consumption/mcp-package.test.ts so no workflow file
 * carries the invocation (`.github/workflows/**` is outside this WP's scope).
 *
 * Three assertions, all evaluated, all reported (never stop at the first):
 *
 *   1. DECLARED DEPENDENCY: the mcp importer declares EXACTLY ONE runtime
 *      dependency, `@modelcontextprotocol/server`, and its lockfile specifier
 *      is an exact pin (no range prefix). NFR-003: "exactly one new declared
 *      runtime dependency, pinned to an exact version".
 *
 *   2. CLOSURE BUDGET: the set of lockfile entries attributable to the mcp
 *      package - everything reachable from its declared runtime deps through
 *      the lockfile's `snapshots` dependency graph, MINUS entries already
 *      required by the OTHER workspace importers (zod dedupes against the
 *      toolkit's own zod and must not count) - is at most BUDGET.
 *      BUDGET is frozen at 5 by the NFR-003 squad ruling: if reality exceeds
 *      it, the gate goes red and the PR must raise it visibly, never widen
 *      silently (WP06 reviewer guidance).
 *
 *   3. INSTALL SCRIPTS: none of the attributable entries' installed
 *      `package.json` files declares `preinstall` / `install` / `postinstall`.
 *      Read from the installed `node_modules/.pnpm/` tree, not the lockfile
 *      (lockfiles do not record scripts); the install is therefore a hard
 *      precondition, enforced with a clear error when absent.
 *
 * The lockfile is parsed with a line-oriented state machine over pnpm's
 * machine-generated formatting (2-space indentation): no `yaml` dependency is
 * imported, so the audit tool itself adds zero supply-chain surface.
 *
 * Exit 0 on green (prints the audited count and membership); exit 1 on any
 * violation, listing every offender.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_PACKAGE = '@spec-kitty/doc-kitty-mcp';
const SDK_NAME = '@modelcontextprotocol/server';
/** NFR-003 squad ruling, V5: the budget of record. NEVER widen silently. */
const BUDGET = 5;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCKFILE = path.join(REPO_ROOT, 'pnpm-lock.yaml');
const PNPM_DIR = path.join(REPO_ROOT, 'node_modules', '.pnpm');

// -- minimal lockfile reader --------------------------------------------------
//
// Only three shapes are recognised, which is all the walk needs:
//   - top-level sections `importers:` / `snapshots:` (column 0);
//   - importer entries `  <name>:` with `    dependencies:` / `    devDependencies:`
//     subsections holding `      <dep>:` + `        specifier:`/`version:` pairs;
//   - snapshot entries `  <pkg@version>:` with `    dependencies:` /
//     `    optionalDependencies:` subsections holding `      <dep>: <resolved>`.
// Values starting with `link:` or `file:` are workspace/local and terminate
// the walk (the mcp package's own devDep `link:../src` is not registry surface).

/** Strip one level of pnpm's single-quote quoting. */
function unquote(text) {
  return text.startsWith("'") && text.endsWith("'") ? text.slice(1, -1) : text;
}

function parseLockfile(text) {
  const lines = text.split('\n');
  const importers = new Map(); // name -> { dependencies: Map, devDependencies: Map }
  const snapshots = new Map(); // 'name@version' -> Set of 'child@resolved'

  let section = null; // 'importers' | 'snapshots'
  let importer = null; // current importer record
  let depGroup = null; // current Map receiving dependency entries
  let pendingDep = null; // importer dep header awaiting its `version:` line
  let snapshotKey = null;

  for (const raw of lines) {
    if (raw === '' || raw.startsWith('#')) continue;
    const top = /^(\w[\w-]*):$/.exec(raw);
    if (top) {
      section = top[1];
      importer = null;
      depGroup = null;
      pendingDep = null;
      snapshotKey = null;
      continue;
    }
    if (section === 'importers') {
      const header = /^ {2}(\S.*):$/.exec(raw);
      if (header) {
        importer = { dependencies: new Map(), devDependencies: new Map() };
        importers.set(unquote(header[1]), importer);
        depGroup = null;
        pendingDep = null;
        continue;
      }
      const group = /^ {4}(dependencies|devDependencies):$/.exec(raw);
      if (group && importer) {
        depGroup = importer[group[1]];
        pendingDep = null;
        continue;
      }
      const depHeader = /^ {6}(\S.*):$/.exec(raw);
      if (depHeader && depGroup) {
        pendingDep = unquote(depHeader[1]);
        depGroup.set(pendingDep, { specifier: null, resolved: null });
        continue;
      }
      const specifierLine = /^ {8}specifier: (.+)$/.exec(raw);
      if (specifierLine && depGroup && pendingDep !== null) {
        depGroup.get(pendingDep).specifier = specifierLine[1].trim();
        continue;
      }
      const versionLine = /^ {8}version: (.+)$/.exec(raw);
      if (versionLine && depGroup && pendingDep !== null) {
        depGroup.get(pendingDep).resolved = versionLine[1].trim();
        pendingDep = null;
        continue;
      }
      if (/^ {4}\S/.test(raw)) depGroup = null; // another subsection (e.g. `releasedAt`); stop collecting deps
      continue;
    }
    if (section === 'snapshots') {
      const header = /^ {2}(\S.*):$/.exec(raw);
      if (header) {
        snapshotKey = unquote(header[1]);
        if (!snapshots.has(snapshotKey)) snapshots.set(snapshotKey, new Set());
        depGroup = null;
        continue;
      }
      const group = /^ {4}(dependencies|optionalDependencies):$/.exec(raw);
      if (group && snapshotKey) {
        depGroup = group[1];
        continue;
      }
      const entry = /^ {6}(\S.*?): (.+)$/.exec(raw);
      if (entry && snapshotKey && (depGroup === 'dependencies' || depGroup === 'optionalDependencies')) {
        const resolved = entry[2].trim();
        if (!resolved.startsWith('link:') && !resolved.startsWith('file:')) {
          snapshots.get(snapshotKey).add(`${unquote(entry[1])}@${resolved}`);
        }
        continue;
      }
      if (/^ {4}\S/.test(raw)) depGroup = null; // transitivePeerDependencies, engines, ... - not runtime edges
      continue;
    }
  }
  return { importers, snapshots };
}

// -- closure walk -------------------------------------------------------------

/** All lockfile entries reachable from `roots` through the snapshot graph. */
function reachable(roots, snapshots) {
  const seen = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const child of snapshots.get(node) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return seen;
}

// -- install-script scan ------------------------------------------------------

/**
 * Resolve an attributable `name@version` lockfile entry to its installed
 * package.json under `node_modules/.pnpm/`. Peer-less entries land in the
 * plain dir (`@scope+name@version`); peer-suffixed entries get pnpm's hashed
 * `_`-joined encoding, so fall back to prefix matching and refuse ambiguity
 * or absence loudly (never silently skip the scripts check).
 */
function installedManifest(entry) {
  const at = entry.lastIndexOf('@');
  const name = entry.slice(0, at);
  const version = entry.slice(at + 1);
  const bareVersion = version.includes('(') ? version.slice(0, version.indexOf('(')) : version;
  const plain = path.join(PNPM_DIR, `${name.replaceAll('/', '+')}@${version}`);
  const candidates = [];
  if (existsSync(plain)) candidates.push(plain);
  if (candidates.length === 0) {
    const prefix = `${name.replaceAll('/', '+')}@${bareVersion}`;
    for (const dir of readdirSync(PNPM_DIR)) {
      if (dir === prefix || dir.startsWith(`${prefix}_`)) {
        candidates.push(path.join(PNPM_DIR, dir));
      }
    }
  }
  if (candidates.length !== 1) {
    throw new Error(
      `cannot locate exactly one installed copy of ${entry} under ${PNPM_DIR} ` +
        `(found ${candidates.length}); refusing to skip the install-script check`,
    );
  }
  const manifestPath = path.join(candidates[0], 'node_modules', ...name.split('/'), 'package.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`expected installed manifest missing: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

/**
 * Reject specifiers that are not an exact pin: ranges, tags, and URLs all
 * resolve non-exactly. An exact version is the bare `x.y.z` string.
 */
function isExactPin(specifier, resolved) {
  return specifier === resolved;
}

// -- audit --------------------------------------------------------------------

const violations = [];
const notes = [];

if (!existsSync(LOCKFILE)) {
  console.error(`audit-closure: pnpm-lock.yaml not found at ${LOCKFILE} - run from the repo root tooling (root script assert:supply-chain).`);
  process.exit(1);
}
const { importers, snapshots } = parseLockfile(readFileSync(LOCKFILE, 'utf8'));

const mcp = importers.get('mcp');
if (!mcp) {
  console.error('audit-closure: no `mcp` importer in pnpm-lock.yaml - the MCP workspace package is missing.');
  process.exit(1);
}

// 1. Declared-dependency assertion.
const declared = [...mcp.dependencies.entries()];
if (declared.length !== 1 || declared[0]?.[0] !== SDK_NAME) {
  violations.push(
    `declared runtime dependencies must be exactly { ${SDK_NAME}: <exact pin> }; ` +
      `found: ${declared.map(([n, v]) => `${n}@${v.resolved}`).join(', ') || '(none)'}`,
  );
} else if (!isExactPin(declared[0][1].specifier ?? '', declared[0][1].resolved ?? '')) {
  violations.push(
    `${SDK_NAME} must be pinned exactly; importer specifier '${declared[0][1].specifier}' ` +
      `is not the resolved version '${declared[0][1].resolved}'`,
  );
}
notes.push(`declared runtime deps: ${declared.map(([n, v]) => `${n}@${v.resolved}`).join(', ') || '(none)'}`);

// 2. Closure budget: mcp runtime closure minus what other importers require.
const closureRoots = (records) =>
  records
    .filter(([, v]) => v.resolved && !v.resolved.startsWith('link:') && !v.resolved.startsWith('file:'))
    .map(([name, v]) => `${name}@${v.resolved}`);
const mcpClosure = reachable(closureRoots(declared), snapshots);
const others = reachable(
  [...importers.entries()]
    .filter(([name]) => name !== 'mcp')
    .flatMap(([, rec]) => closureRoots([...rec.dependencies.entries(), ...rec.devDependencies.entries()])),
  snapshots,
);
const attributable = [...mcpClosure].filter((entry) => !others.has(entry)).sort();
attributable.forEach((entry) => notes.push(`attributable: ${entry}`));
if (attributable.length > BUDGET) {
  violations.push(
    `lockfile-closure budget exceeded: ${attributable.length} new entries attributable to ${MCP_PACKAGE} ` +
      `(budget ${BUDGET}, NFR-003): ${attributable.join(', ')}. ` +
      'Do NOT widen the budget silently - stop and raise it in the PR (squad ruling V5).',
  );
}

// 3. Zero install scripts across the attributable set.
if (!existsSync(PNPM_DIR)) {
  console.error('audit-closure: node_modules/.pnpm not found - run `pnpm install` before this audit.');
  process.exit(1);
}
let scriptViolations = 0;
for (const entry of attributable) {
  let manifest;
  try {
    manifest = installedManifest(entry);
  } catch (error) {
    violations.push(String(error.message ?? error));
    scriptViolations += 1;
    continue;
  }
  const scripts = manifest.scripts ?? {};
  const offending = ['preinstall', 'install', 'postinstall'].filter((phase) => scripts[phase]);
  if (offending.length > 0) {
    violations.push(
      `${entry} declares install script(s) ${offending.map((p) => `${p}: ${JSON.stringify(scripts[p])}`).join(', ')} - ` +
        'the MCP closure must be install-script-free (NFR-003, supply-chain-install-safety)',
    );
    scriptViolations += 1;
  }
}
notes.push(`install scripts in closure: ${scriptViolations === 0 ? 'none' : 'see violations'}`);

// -- report -------------------------------------------------------------------

for (const note of notes) console.log(`audit-closure: ${note}`);
if (violations.length > 0) {
  console.error('\naudit-closure: NFR-003 supply-chain audit FAILED:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}
console.log(
  `audit-closure: PASS - ${attributable.length} lockfile entries attributable to ${MCP_PACKAGE} ` +
    `(budget ${BUDGET}), one exact-pinned SDK dependency, zero install scripts.`,
);

#!/usr/bin/env node
/**
 * assert-guide-no-internal-paths.mjs — the adopter-guide path lint
 * (mission consumption-test / WP07, T029; machine-checks SC-005, mirrors INV-1).
 *
 * Usage:  node tests/consumption/scripts/assert-guide-no-internal-paths.mjs [guide-path]
 *         (defaults to docs/guides/consumer-setup.md, resolved from the repo root)
 *
 * WHAT IT PROVES (non-fakeable). The consumer-setup guide instructs an external
 * adopter to wire the toolkit through its PUBLISHED surface only. Every step must
 * reference either a published `@commondocs-kitty/toolkit/*` entry point or a file
 * the adopter owns (`src/…`, `astro.config.mjs`). This lint fails the moment the
 * guide names a REPO-INTERNAL TOOLKIT PATH — the same class of path INV-1 keeps
 * off the fixture's module-resolution graph — so a well-meaning edit that pastes
 * an internal import (`../src/…`, `@commondocs-kitty/toolkit/src/…`) into the
 * guide turns this check RED instead of shipping a broken adopter instruction.
 *
 * WHY THESE PATTERNS AND NOT A BARE "src". A consumer LEGITIMATELY owns `src/…`
 * files (`src/content.config.ts`, `src/pages/**`, `src/theme/**`) and imports
 * from PUBLIC subpath exports (`@commondocs-kitty/toolkit/config|schema|routes|
 * themes/…|layouts/…|deck/…`), none of which reach into toolkit internals. The
 * violation signature is specifically a path that climbs OUT of the adopter's
 * project into a `src` tree, or that reaches INTO the package's own `src`/`lib`,
 * or a doc-kitty repository-internal source path. Matching bare `src/` would
 * false-positive on the very files the guide is supposed to show.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_GUIDE = 'docs/guides/consumer-setup.md';

/**
 * Each rule is a repo-internal-path signature. `test` is applied per line; the
 * first match on a line reports that line and fails the run.
 *
 * - `../src` (and deeper `../../src`): a relative path that climbs OUT of the
 *   adopter's project into a `src` tree — the canonical INV-1 violation.
 * - `../lib`, `../scripts`: the same climb into a toolkit sibling dir.
 * - `@commondocs-kitty/toolkit/src` | `/lib`: importing package INTERNALS instead
 *   of the public subpath exports.
 * - `example/src`: the doc-kitty repository's own example internals (the word
 *   `example/` alone is allowed — the strict-mode caveat names it in prose).
 * - `src/scripts/`: a doc-kitty repository-internal toolkit script path.
 */
const RULES = [
  { name: 'parent-relative reach into src', test: /\.\.(?:\/\.\.)*\/src\b/ },
  { name: 'parent-relative reach into lib', test: /\.\.(?:\/\.\.)*\/lib\b/ },
  { name: 'parent-relative reach into scripts', test: /\.\.(?:\/\.\.)*\/scripts\b/ },
  { name: 'toolkit package-internal src import', test: /@commondocs-kitty\/toolkit\/src\b/ },
  { name: 'toolkit package-internal lib import', test: /@commondocs-kitty\/toolkit\/lib\b/ },
  { name: 'doc-kitty example-internal path', test: /\bexample\/src\b/ },
  { name: 'doc-kitty repository-internal script path', test: /\bsrc\/scripts\// },
];

function main(argv) {
  const guideArg = argv[2] ?? DEFAULT_GUIDE;
  const guidePath = path.isAbsolute(guideArg) ? guideArg : path.join(REPO_ROOT, guideArg);

  let text;
  try {
    text = readFileSync(guidePath, 'utf8');
  } catch (err) {
    console.error(`✖ cannot read guide "${guidePath}": ${err.message}`);
    process.exit(2);
  }

  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.test.test(line)) {
        hits.push({ line: i + 1, rule: rule.name, text: line.trim() });
        break; // one report per line is enough to fail
      }
    }
  });

  const rel = path.relative(REPO_ROOT, guidePath) || guidePath;
  if (hits.length > 0) {
    console.error(`✖ ${rel}: ${hits.length} repo-internal toolkit path(s) — a guide step must reference a published entry point or a consumer-owned file (SC-005 / INV-1):`);
    for (const h of hits) {
      console.error(`  line ${h.line} [${h.rule}]: ${h.text}`);
    }
    process.exit(1);
  }

  console.log(`✓ ${rel}: no repo-internal toolkit paths — published-surface-only (SC-005 / INV-1).`);
  process.exit(0);
}

main(process.argv);

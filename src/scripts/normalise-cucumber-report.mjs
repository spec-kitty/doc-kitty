#!/usr/bin/env node
/**
 * normalise-cucumber-report.mjs — make a Cucumber Messages (NDJSON) report
 * regenerate byte-identically on any machine (#231).
 *
 * Usage:
 *   node src/scripts/normalise-cucumber-report.mjs <report.ndjson> --at <instant> [--root <dir>]
 *   node src/scripts/normalise-cucumber-report.mjs <report.ndjson> --at <instant> --check
 *
 * A run records its machine and its moment. This rewrites what the results
 * overlay (ADR-0055) does not read, and keeps what it does:
 *   - `meta.os`, `meta.cpu` and `meta.runtime` become `{ name: "unspecified" }`;
 *     `meta.implementation` (the pinned cucumber-js) and `meta.ci` are kept;
 *   - every `timestamp` becomes `--at` (whole seconds), so the overlay's
 *     "as of" day is the one the caller names, and every `duration` becomes 0;
 *   - every generated id (`id`, `…Id`, `…Ids`) is renumbered in order of first
 *     appearance; Cucumber writes its envelopes in a fixed order, so the same
 *     features give the same ids;
 *   - `--root` (default: the working directory), the directory Cucumber ran in,
 *     is removed from every string, so stack traces name `steps/steps.js:21:38`.
 *
 * `--at` falls back to `SOURCE_DATE_EPOCH` (seconds). Without either it fails:
 * a default instant would be a date nobody chose.
 */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const UNSPECIFIED = Object.freeze({ name: 'unspecified' });

/**
 * @param {string | undefined} at
 * @param {Record<string, string | undefined>} env
 * @returns {number} whole seconds since the epoch
 */
function instantSeconds(at, env) {
  if (at !== undefined) {
    if (!INSTANT.test(at)) throw new Error(`--at ${at} is not a UTC instant (YYYY-MM-DDTHH:MM:SSZ)`);
    return Math.floor(Date.parse(at) / 1000);
  }
  const epoch = env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && /^\d+$/.test(epoch)) return Number(epoch);
  throw new Error('name the run instant with --at <YYYY-MM-DDTHH:MM:SSZ> or SOURCE_DATE_EPOCH');
}

/**
 * @param {string | undefined} root
 * @returns {string[]} the prefixes to remove, longest first
 */
function rootPrefixes(root) {
  if (!root) return [];
  const bare = root.replace(/[\\/]+$/, '');
  if (bare === '') return [];
  return [`${pathToFileURL(bare).href}/`, `${bare}/`, `${bare}\\`];
}

/**
 * Normalise a Cucumber Messages report.
 *
 * @param {string} text The NDJSON report.
 * @param {{ at?: string, root?: string, env?: Record<string, string | undefined> }} [options]
 * @returns {string}
 */
export function normaliseCucumberReport(text, { at, root, env = process.env } = {}) {
  const seconds = instantSeconds(at, env);
  const prefixes = rootPrefixes(root);
  /** @type {Map<string, string>} */
  const ids = new Map();
  const idOf = (/** @type {string} */ id) => {
    if (!ids.has(id)) ids.set(id, String(ids.size));
    return /** @type {string} */ (ids.get(id));
  };
  const isIdKey = (/** @type {string} */ key) => key === 'id' || /[a-z]Id$/.test(key);
  const isIdsKey = (/** @type {string} */ key) => /[a-z]Ids$/.test(key);
  const unrooted = (/** @type {string} */ s) => prefixes.reduce((out, p) => out.split(p).join(''), s);

  /**
   * @param {unknown} value
   * @param {string} key
   * @returns {unknown}
   */
  const visit = (value, key) => {
    if (typeof value === 'string') return isIdKey(key) ? idOf(value) : unrooted(value);
    if (Array.isArray(value)) {
      return isIdsKey(key)
        ? value.map((v) => (typeof v === 'string' ? idOf(v) : visit(v, '')))
        : value.map((v) => visit(v, ''));
    }
    if (value === null || typeof value !== 'object') return value;
    if (key === 'timestamp') return { seconds, nanos: 0 };
    if (key === 'duration') return { seconds: 0, nanos: 0 };
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = visit(v, k);
    return out;
  };

  const lines = text.replace(/^﻿/, '').split('\n');
  const body = lines
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const envelope = /** @type {Record<string, any>} */ (visit(JSON.parse(line), ''));
      if (envelope.meta && typeof envelope.meta === 'object') {
        for (const field of ['os', 'cpu', 'runtime']) {
          if (field in envelope.meta) envelope.meta[field] = { ...UNSPECIFIED };
        }
      }
      return JSON.stringify(envelope);
    });
  return body.length > 0 ? `${body.join('\n')}\n` : '';
}

function parseArgs(argv) {
  /** @type {{ report?: string, at?: string, root: string, check: boolean }} */
  const args = { root: process.cwd(), check: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--at') args.at = argv[++i];
    else if (a === '--root') args.root = argv[++i];
    else if (a === '--check') args.check = true;
    else args.report = a;
  }
  return args;
}

function main(argv) {
  const { report, at, root, check } = parseArgs(argv);
  if (!report) {
    console.error('usage: normalise-cucumber-report.mjs <report.ndjson> --at <instant> [--root <dir>] [--check]');
    process.exit(2);
  }
  const current = readFileSync(report, 'utf8');
  let next;
  try {
    next = normaliseCucumberReport(current, { at, root });
  } catch (error) {
    console.error(`✖ ${report}: ${/** @type {Error} */ (error).message}`);
    process.exit(2);
  }
  if (check) {
    if (next !== current) {
      console.error(`✖ ${report} is not normalised. Run without --check and commit the result.`);
      process.exit(1);
    }
    console.log(`✓ ${report} is normalised.`);
    return;
  }
  if (next !== current) writeFileSync(report, next);
  console.log(next !== current ? `✓ normalised ${report}.` : `✓ ${report} already normalised (no change).`);
}

// CLI guard: compare against the REAL path of argv[1], so a symlinked bin still runs.
function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main(process.argv);
}

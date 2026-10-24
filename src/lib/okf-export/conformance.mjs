// @ts-check
/**
 * In-repo OKF v0.2 conformance checker (FR-026, SC-002): OKF §11 plus the §8
 * entry-list shape of index bodies. Reserved names (`index.md`, `log.md`) are
 * exempt from the `type` rule. Used by tests now; the CLI `--check` and the
 * build hook call it in WP08.
 *
 * Rules (contracts/okf-export.md):
 *  1. every non-reserved `.md` has parseable frontmatter with a non-empty `type`;
 *  2. a non-root `index.md` has no frontmatter;
 *  3. the root `index.md` frontmatter is exactly `okf_version: "0.2"`;
 *  4. every `index.md` body is a §8 entry list (headings and blank lines allowed).
 *
 * Link resolution is separate and advisory: OKF §6.1 says consumers MUST tolerate
 * broken links, so a dangling link is a `Warning` (rule `unresolved-link`) from
 * `checkOkfLinks`, never a §11 `Violation`. `checkOkfBundle` keeps returning only
 * errors; `checkOkfBundleReport` returns both.
 *
 * @module okf-export/conformance
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { OKF_VERSION, compareCodeUnit } from '../vocabulary-core.mjs';
import { climb, relativeLinks, rootLinks } from './links.mjs';

/**
 * @typedef {object} Violation
 * @property {string} path bundle path of the offending file
 * @property {1 | 2 | 3 | 4} rule
 * @property {string} message
 */

/**
 * @typedef {object} Warning advisory finding (does not fail conformance)
 * @property {string} path bundle path of the file holding the link
 * @property {'warning'} severity
 * @property {'unresolved-link'} rule
 * @property {string} message names the link destination
 * @property {string} target the link as written (root-relative), for tools that group findings
 */

const RESERVED = new Set(['index.md', 'log.md']);
const ENTRY = /^[-*] \[[^\]]+\]\([^)\s]+\)(?:\s*(?:[-:]|—)\s.*)?$/;

/**
 * @param {string} dir
 * @returns {Map<string, string>} bundle-relative path -> text, `.md` files only
 */
function readBundleDir(dir) {
  const out = new Map();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = path.join(entry.parentPath, entry.name);
    out.set(path.relative(dir, full).split(path.sep).join('/'), readFileSync(full, 'utf8'));
  }
  return out;
}

/**
 * @param {string} text
 * @returns {{data: Record<string, any>, content: string, hasFrontmatter: boolean} | null} `null` when unparseable
 */
function parse(text) {
  try {
    const { data, content } = matter(text);
    return { data, content, hasFrontmatter: /^---\r?\n/.test(text) };
  } catch {
    return null;
  }
}

/**
 * @param {string} file
 * @param {string} body
 * @returns {Violation[]}
 */
function entryListViolations(file, body) {
  return body
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => line !== '' && !line.startsWith('#') && !ENTRY.test(line))
    .map(({ line, n }) => ({ path: file, rule: /** @type {const} */ (4), message: `line ${n} is not a §8 entry: ${line}` }));
}

/**
 * @param {string} file
 * @param {string} text
 * @returns {Violation[]}
 */
function checkIndex(file, text) {
  const parsed = parse(text);
  if (!parsed) return [{ path: file, rule: 2, message: 'index.md frontmatter is unparseable' }];
  const keys = Object.keys(parsed.data);
  const bodyViolations = entryListViolations(file, parsed.content);
  if (file !== 'index.md') {
    const own = parsed.hasFrontmatter ? [{ path: file, rule: /** @type {const} */ (2), message: 'a non-root index.md must have no frontmatter' }] : [];
    return [...own, ...bodyViolations];
  }
  const exact = keys.length === 1 && parsed.data.okf_version === OKF_VERSION;
  const own = exact ? [] : [{ path: file, rule: /** @type {const} */ (3), message: `root index.md frontmatter must be exactly okf_version: "${OKF_VERSION}"` }];
  return [...own, ...bodyViolations];
}

/**
 * @param {string} file
 * @param {string} text
 * @returns {Violation[]}
 */
function checkConcept(file, text) {
  const parsed = parse(text);
  if (!parsed?.hasFrontmatter) return [{ path: file, rule: 1, message: 'missing or unparseable frontmatter' }];
  const type = parsed.data.type;
  if (typeof type === 'string' && type.trim() !== '') return [];
  return [{ path: file, rule: 1, message: 'frontmatter has no non-empty `type`' }];
}

/**
 * Check a bundle against OKF v0.2 §11 rules 1-3 and the §8 entry-list shape.
 *
 * @param {Map<string, string | Uint8Array> | Record<string, string | Uint8Array> | string} bundle
 *   a path -> text map, or a directory to read
 * @returns {Violation[]} sorted by path, then rule; `[]` when conformant
 */
export function checkOkfBundle(bundle) {
  const files =
    typeof bundle === 'string' ? readBundleDir(bundle) : bundle instanceof Map ? bundle : new Map(Object.entries(bundle));
  const violations = [];
  for (const [file, raw] of files) {
    if (!file.endsWith('.md')) continue;
    const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
    const base = file.slice(file.lastIndexOf('/') + 1);
    if (base === 'index.md') violations.push(...checkIndex(file, text));
    else if (!RESERVED.has(base)) violations.push(...checkConcept(file, text));
  }
  return violations.sort((a, b) => compareCodeUnit(a.path, b.path) || a.rule - b.rule);
}

/**
 * @param {Map<string, string | Uint8Array> | Record<string, string | Uint8Array> | string} bundle
 * @returns {Map<string, string | Uint8Array>}
 */
const toFiles = (bundle) =>
  typeof bundle === 'string' ? readBundleDir(bundle) : bundle instanceof Map ? bundle : new Map(Object.entries(bundle));

/**
 * @param {Map<string, string | Uint8Array>} files
 * @param {string | undefined} target bundle-root-relative path, no leading or trailing slash; `undefined` never resolves
 */
const inBundle = (files, target) => target !== undefined && (files.has(target) || files.has(`${target}/index.md`) || (target === '' && files.has('index.md')));

/**
 * The bundle path a relative link names, resolved against the linking file's directory.
 *
 * @param {string} file bundle path of the linking file
 * @param {string} link destination as written
 * @returns {string | undefined} `undefined` when the link climbs above the bundle root
 */
function relativeTarget(file, link) {
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
  const raw = climb(dir, link.replace(/[?#].*$/, ''));
  if (raw === undefined) return undefined;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the encoded form
  }
  return decoded.replace(/^\//, '').replace(/\/$/, '');
}

/**
 * Advisory link check: every root-relative (`/...`) and relative `.md`/`.mdx` body link
 * outside code must name a file in the bundle (`/x.md`, or a directory with `index.md`);
 * relative ones resolve against the linking file's directory, and one that climbs above
 * the bundle root is unresolved. Relative asset links (`./img.png`), external links,
 * `//` links and `#anchors` are not checked.
 *
 * @param {Map<string, string | Uint8Array> | Record<string, string | Uint8Array> | string} bundle
 * @returns {Warning[]} sorted by path, then message; `[]` when every link resolves
 */
export function checkOkfLinks(bundle) {
  const files = toFiles(bundle);
  /** @type {Warning[]} */
  const warnings = [];
  for (const [file, raw] of files) {
    if (!file.endsWith('.md') || file.endsWith('/log.md') || file === 'log.md') continue;
    const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
    const content = parse(text)?.content ?? text;
    /** @type {Array<[string, string | undefined]>} */
    const pairs = [
      ...rootLinks(content).map((l) => /** @type {[string, string]} */ ([l, l.replace(/[?#].*$/, '').replace(/^\//, '').replace(/\/$/, '')])),
      ...relativeLinks(content).map((l) => /** @type {[string, string | undefined]} */ ([l, relativeTarget(file, l)])),
    ];
    for (const [link, target] of new Map(pairs)) {
      if (!inBundle(files, target)) warnings.push({ path: file, severity: 'warning', rule: 'unresolved-link', message: `link target is not in the bundle: ${link}`, target: link });
    }
  }
  return warnings.sort((a, b) => compareCodeUnit(a.path, b.path) || compareCodeUnit(a.message, b.message));
}

/**
 * Both result sets in one call, for the CLI to print: `errors` fail the check,
 * `warnings` are advisory.
 *
 * @param {Parameters<typeof checkOkfBundle>[0]} bundle
 * @returns {{errors: Violation[], warnings: Warning[]}}
 */
export function checkOkfBundleReport(bundle) {
  return { errors: checkOkfBundle(bundle), warnings: checkOkfLinks(bundle) };
}

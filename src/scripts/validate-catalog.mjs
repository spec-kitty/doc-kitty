#!/usr/bin/env node
/**
 * Build-free citation-catalog validator for DocKitty.
 * Runs in the `doc-sanity` CI lane (no `astro build`, NFR-002).
 *
 * Usage:
 *   node src/scripts/validate-catalog.mjs [<root> ...]   # default: docs example/docs
 *
 * For each root it loads that root's catalog (`<root>/_meta/bibliography.yaml`
 * and `<root>/_meta/tools.yaml`), then walks every `.md`/`.mdx` under the root
 * and resolves each `external_references` entry:
 *
 *   - inline `{ url, title, note? }`  → self-contained, no catalog lookup
 *   - catalog `{ type: biblio, id }`  → must exist in bibliography[id]
 *   - catalog `{ type: tool,   id }`  → must exist in tools[id]
 *
 * A missing id or an unknown catalog `type` (anything but `biblio`/`tool`) is a
 * blocking ERROR — the same verdict the TS `resolveCitation` (src/lib/metadata.ts)
 * throws at build. This module deliberately RE-IMPLEMENTS that resolution rather
 * than importing the toolkit (which pulls Astro and cannot run in bare Node);
 * parity between the two is the contract (contracts/catalog-and-citation.contract.md)
 * and is asserted by src/tests/catalog.test.ts. `gray-matter` (the same YAML
 * engine the sibling validate-frontmatter.mjs gate uses) parses frontmatter and
 * the catalog files — no ad-hoc YAML re-implementation.
 *
 * It also resolves each page's `tom_classification` (ADR-0080) against the root's
 * measures catalog: `<root>/_meta/measures.yaml` when present, else the shipped
 * default. Unlike citations, this check does NOT re-implement anything: the
 * measures core and loader are bare-Node safe, so the gate imports the very
 * module the build routes use, and the two cannot disagree on a verdict
 * (NFR-002, pinned by measures-parity.test.ts). The message is the same too,
 * except that the gate names a page from the repository root
 * (`example/docs/x.md`) and the build from the docs root (`x.md`). A malformed
 * consumer catalog is reported even when no page uses it.
 *
 * It also checks the root's optional sub-processor catalog,
 * `<root>/_meta/subprocessors.yaml` (ADR-0086). This does NOT re-implement
 * anything either: the gate calls `checkSubprocessorCatalog`, the one entry point
 * the build integration calls too, and passes its problems through untouched, so
 * the two report the same problems in the same words. Only the catalog's name in
 * a message differs: the gate names it from the repository root. A root without
 * the file adds nothing.
 */
import { readdirSync, statSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { walkMarkdownPaths } from '../lib/docs-walk.mjs';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { buildMeasuresIndex, classificationProblems } from '../lib/measures-core.mjs';
import { readMeasuresCatalog } from '../lib/measures-loader.mjs';
import { checkSubprocessorCatalog } from '../lib/subprocessors-loader.mjs';

/** The two catalog collections and the field that keys each record. */
const CATALOG_TYPES = ['biblio', 'tool'];

/**
 * Every docs page under `dir`, as paths from `dir`: the shared docs-page walk
 * (no `log.md`, dot or `_meta` entries). An unreadable `dir` still throws, so the
 * caller reports it instead of treating it as an empty tree.
 */
function walk(dir) {
  readdirSync(dir);
  return walkMarkdownPaths(resolve(dir)).map((rel) => join(dir, rel));
}

/**
 * Parse a top-level YAML sequence file (a catalog registry) via gray-matter's
 * YAML engine by wrapping it as a frontmatter block. Returns `[]` for a missing
 * file so a root without that catalog simply has no records (and any citation
 * into it then reports as an unresolved id — the correct, build-fatal verdict).
 */
function loadCatalogFile(path) {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const parsed = matter(['---', raw, '---', ''].join('\n'));
  const data = parsed.data;
  if (data == null) return [];
  if (!Array.isArray(data)) {
    throw new Error(`catalog file must be a YAML list of records, got ${typeof data}`);
  }
  return data;
}

/**
 * Build the id-keyed catalog for a root and collect structural problems
 * (missing required fields, duplicate ids). Mirrors `buildCatalog` +
 * the record shapes in src/lib/catalog.ts / schema.ts.
 */
function loadCatalog(root, problems) {
  const bibliography = Object.create(null);
  const tools = Object.create(null);

  const register = (records, collection, required, label, keyed) => {
    for (const record of records) {
      if (record == null || typeof record !== 'object') {
        problems.push(`${label}: a record is not a mapping (${JSON.stringify(record)})`);
        continue;
      }
      for (const field of required) {
        if (record[field] === undefined || record[field] === null || record[field] === '') {
          problems.push(`${label}: record "${record.id ?? '?'}" is missing required "${field}"`);
        }
      }
      const id = record.id;
      if (typeof id !== 'string' || id === '') continue;
      if (id in keyed) {
        problems.push(`${label}: duplicate id "${id}" (${collection} ids must be unique)`);
        continue;
      }
      keyed[id] = record;
    }
  };

  const bibPath = join(root, '_meta', 'bibliography.yaml');
  const toolsPath = join(root, '_meta', 'tools.yaml');
  try {
    register(loadCatalogFile(bibPath), 'bibliography', ['id', 'title', 'url'], relative('.', bibPath), bibliography);
  } catch (err) {
    problems.push(`${relative('.', bibPath)}: ${err.message}`);
  }
  try {
    register(loadCatalogFile(toolsPath), 'tools', ['id', 'name', 'url'], relative('.', toolsPath), tools);
  } catch (err) {
    problems.push(`${relative('.', toolsPath)}: ${err.message}`);
  }

  return { bibliography, tools };
}

/**
 * Re-implementation of resolveCitation (src/lib/metadata.ts) for one entry.
 * Returns an error string, or null when the entry resolves.
 */
function resolveEntry(entry, catalog) {
  if (entry == null || typeof entry !== 'object') {
    return `external_reference is not a mapping (${JSON.stringify(entry)})`;
  }
  // Inline reference: self-contained, no catalog lookup, no citation key.
  if ('url' in entry && !('type' in entry && 'id' in entry)) {
    return null;
  }
  const { type, id } = entry;
  if (type === 'biblio') {
    return id in catalog.bibliography
      ? null
      : `no bibliography entry for id "${id}" (build-fatal, FR-008)`;
  }
  if (type === 'tool') {
    return id in catalog.tools ? null : `no tool entry for id "${id}" (build-fatal, FR-008)`;
  }
  return `unknown catalog type "${type}" (expected ${CATALOG_TYPES.map((t) => `"${t}"`).join(' or ')}) (build-fatal, FR-008)`;
}

/**
 * Validate every catalog citation and TOM classification under `root` against
 * `root`'s catalogs, and `root`'s sub-processor catalog. Returns how many
 * references, classified pages and sub-processor records it checked.
 *
 * @param {string} root
 * @param {string[]} problems collects every problem
 * @returns {{ citations: number, measures: number, subprocessors: number }}
 */
export function validateRoot(root, problems) {
  const catalog = loadCatalog(root, problems);
  const measuresCatalog = readMeasuresCatalog(resolve(root));
  problems.push(...measuresCatalog.problems);
  const measures = buildMeasuresIndex(measuresCatalog.records);
  const subprocessorCatalog = checkSubprocessorCatalog(
    resolve(root),
    relative('.', join(root, '_meta', 'subprocessors.yaml')).split('\\').join('/'),
  );
  problems.push(...subprocessorCatalog.problems);
  const subprocessors = subprocessorCatalog.records.length;

  let files;
  try {
    files = walk(root);
  } catch (err) {
    problems.push(`cannot read docs dir "${root}": ${err.message}`);
    return { citations: 0, measures: 0, subprocessors };
  }

  let citations = 0;
  let classified = 0;
  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/');
    if (/(^|\/)log\.md$/i.test(rel)) continue; // reserved, frontmatter-free
    const raw = readFileSync(file, 'utf8');
    let parsed;
    try {
      parsed = matter(raw);
    } catch (err) {
      problems.push(`${relative('.', file)}: unparseable frontmatter — ${err.message}`);
      continue;
    }
    const tom = parsed.data?.tom_classification;
    if (tom !== undefined) {
      classified++;
      const page = relative('.', file).split('\\').join('/');
      problems.push(...classificationProblems(tom, measures, page, measuresCatalog.source));
    }
    const refs = parsed.data?.external_references;
    if (!Array.isArray(refs)) continue;
    for (const entry of refs) {
      // Only catalog references consume a citation key; inline ones are skipped
      // by resolveEntry but still counted as processed references.
      citations++;
      const problem = resolveEntry(entry, catalog);
      if (problem) problems.push(`${relative('.', file)}: ${problem}`);
    }
  }
  return { citations, measures: classified, subprocessors };
}

/** CLI entry point: validate each given root (default `docs` + `example/docs`). */
export function run(argv) {
  const roots = argv.slice(2);
  if (roots.length === 0) roots.push('docs', 'example/docs');

  const problems = [];
  let total = 0;
  let classifiedTotal = 0;
  let subprocessorTotal = 0;
  for (const root of roots) {
    const { citations, measures, subprocessors } = validateRoot(root, problems);
    total += citations;
    classifiedTotal += measures;
    subprocessorTotal += subprocessors;
  }

  if (problems.length) {
    console.error(`✖ catalog validation failed (${problems.length} problem(s)):`);
    for (const p of problems) console.error(`    - ${p}`);
    process.exit(1);
  }
  console.log(
    `✓ ${total} external reference(s), ${classifiedTotal} TOM classification(s) and ${subprocessorTotal} sub-processor record(s) resolve across ${roots.length} root(s): ${roots.join(', ')}.`,
  );
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
// CLI guard. Compare against the REAL path of argv[1]: when the package is
// installed behind a symlink (pnpm's node_modules, or a node_modules/.bin shim),
// import.meta.url is the resolved path while argv[1] keeps the symlink path, so a
// plain comparison would never match and the gate would exit 0 having done nothing.
function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  run(process.argv);
}

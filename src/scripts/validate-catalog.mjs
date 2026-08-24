#!/usr/bin/env node
/**
 * Build-free citation-catalog validator for the Common Docs — Kitty Variation.
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
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

/** The two catalog collections and the field that keys each record. */
const CATALOG_TYPES = ['biblio', 'tool'];

/** Recursively collect every `.md`/`.mdx` under `dir` (mirrors validate-frontmatter). */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.mdx?$/i.test(name)) out.push(full);
  }
  return out;
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

/** Validate every catalog citation under `root` against `root`'s catalog. */
export function validateRoot(root, problems) {
  const catalog = loadCatalog(root, problems);

  let files;
  try {
    files = walk(root);
  } catch (err) {
    problems.push(`cannot read docs dir "${root}": ${err.message}`);
    return { citations: 0 };
  }

  let citations = 0;
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
  return { citations };
}

/** CLI entry point: validate each given root (default `docs` + `example/docs`). */
export function run(argv) {
  const roots = argv.slice(2);
  if (roots.length === 0) roots.push('docs', 'example/docs');

  const problems = [];
  let total = 0;
  for (const root of roots) {
    const { citations } = validateRoot(root, problems);
    total += citations;
  }

  if (problems.length) {
    console.error(`✖ catalog validation failed (${problems.length} problem(s)):`);
    for (const p of problems) console.error(`    - ${p}`);
    process.exit(1);
  }
  console.log(
    `✓ ${total} external reference(s) resolve across ${roots.length} root(s): ${roots.join(', ')}.`,
  );
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv);
}

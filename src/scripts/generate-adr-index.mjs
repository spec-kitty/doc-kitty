#!/usr/bin/env node
/**
 * generate-adr-index.mjs — regenerate the ADR index table in `docs/adr/README.md`.
 *
 * Usage:
 *   node src/scripts/generate-adr-index.mjs                 # rewrite in place
 *   node src/scripts/generate-adr-index.mjs --check         # lockfile check (CI)
 *   node src/scripts/generate-adr-index.mjs --dir <adrDir> --readme <path>
 *
 * WHY a generator (not a Hub layout) for the OWN tree:
 *   Only `example/` is Astro-built; doc-kitty's own `docs/` tree is validated
 *   but never rendered. So the own-tree ADR index cannot be produced by the
 *   `kind: Hub` layout — it is a GENERATED artifact whose source of truth is the
 *   ADR files themselves, kept honest by `--check` (a lockfile-style
 *   regeneration-clean gate). This is genuine generation, NOT a hand-maintained
 *   bijection gate (#44 / research Decision 5 / C-004).
 *
 * Source of truth per ADR:
 *   - number  ← filename `NNNN-*.md` (recursive; era subfolders included)
 *   - title   ← frontmatter `title`
 *   - status  ← body `## Status` (first token, `**`-stripped)
 *   - date    ← frontmatter `updated`, UTC-sliced to `YYYY-MM-DD` (idempotent)
 *
 * Zero new dependencies: `gray-matter` is already vendored (used by the
 * frontmatter gate); everything else is string/regex work.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

const ADR_FILE = /^(\d{4})-.*\.mdx?$/i;
const MD_EXT = /\.mdx?$/i;

/** Recursively collect `.md`/`.mdx` files under `dir`. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (MD_EXT.test(name)) out.push(full);
  }
  return out;
}

/**
 * Extract the decision status from an ADR body's `## Status` section: the first
 * non-empty line, `**`/`` ` ``-stripped, truncated to the leading token up to the
 * first `.`, em-dash (`—`), or whitespace. Pins the real-corpus shapes:
 *   `Accepted`                          → `Accepted`
 *   `Accepted. Supersedes …`            → `Accepted`
 *   `**Accepted** — 2026-08-29. …`      → `Accepted`
 *   `Superseded by [ADR-0005](…)`       → `Superseded`
 */
export function extractStatusToken(content) {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^##\s+Status\b/.test(l.trim()));
  if (start === -1) return '';
  for (let j = start + 1; j < lines.length; j++) {
    if (/^#{1,6}\s/.test(lines[j])) break; // next heading — Status section ended
    const trimmed = lines[j].trim();
    if (!trimmed) continue;
    const cleaned = trimmed.replace(/\*\*/g, '').replace(/`/g, '').trim();
    const token = cleaned.match(/^([^\s.—]+)/);
    return token ? token[1] : '';
  }
  return '';
}

/** Format a frontmatter `updated` value to a UTC `YYYY-MM-DD` slice. */
export function formatUpdated(updated) {
  if (updated instanceof Date) return updated.toISOString().slice(0, 10);
  const s = String(updated ?? '');
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/** Escape a table cell so a `|` in a title cannot break the Markdown row. */
function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').trim();
}

/**
 * Discover every ADR under `adrDir` (recursive), excluding `template.md` and any
 * `type: Template` file, returning entries ordered by ascending ADR number.
 */
export function discoverAdrs(adrDir) {
  const entries = [];
  for (const file of walk(adrDir)) {
    const base = file.slice(file.lastIndexOf('/') + 1);
    const m = base.match(ADR_FILE);
    if (!m) continue; // README.md, template.md, and non-ADR files are excluded
    const raw = readFileSync(file, 'utf8');
    const parsed = matter(raw);
    if (parsed.data?.type === 'Template') continue;
    const relpath = relative(adrDir, file).split('\\').join('/');
    entries.push({
      number: m[1],
      title: String(parsed.data?.title ?? '').trim(),
      status: extractStatusToken(parsed.content),
      date: formatUpdated(parsed.data?.updated),
      relpath,
    });
  }
  entries.sort((a, b) => a.number.localeCompare(b.number));
  return entries;
}

/** Render the `ID | Title | Status | Date` table (no trailing newline). */
export function buildAdrTable(entries) {
  const rows = entries.map(
    (e) =>
      `| [${e.number}](./${e.relpath}) | ${escapeCell(e.title)} | ${escapeCell(
        e.status,
      )} | ${escapeCell(e.date)} |`,
  );
  return ['| ID | Title | Status | Date |', '|----|-------|--------|------|', ...rows].join(
    '\n',
  );
}

/**
 * Replace ONLY the contiguous `|`-prefixed table region of `readme` with
 * `table`, preserving the H1 + intro prose above and the trailing prose below.
 */
export function regenerateReadme(readme, table) {
  const lines = readme.split('\n');
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\|/.test(lines[i])) {
      if (start === -1) start = i;
      end = i;
    } else if (start !== -1) {
      break; // first non-table line after the block — region ended
    }
  }
  if (start === -1) {
    throw new Error(
      'generate-adr-index: no `|`-prefixed table region found in the ADR README',
    );
  }
  return [...lines.slice(0, start), ...table.split('\n'), ...lines.slice(end + 1)].join('\n');
}

/**
 * Compute the regenerated README for `{ dir, readme }`. In `--check` mode the
 * caller compares against the on-disk content; otherwise it is written in place.
 */
export function computeReadme(dir, readmePath) {
  const current = readFileSync(readmePath, 'utf8');
  const table = buildAdrTable(discoverAdrs(dir));
  return { current, next: regenerateReadme(current, table) };
}

/** Regenerate in place. Returns `{ changed }`. */
export function generate({ dir, readme }) {
  const { current, next } = computeReadme(dir, readme);
  if (next !== current) writeFileSync(readme, next, 'utf8');
  return { changed: next !== current };
}

/** Lockfile-style check. Returns `{ clean }` (true when already regenerated). */
export function check({ dir, readme }) {
  const { current, next } = computeReadme(dir, readme);
  return { clean: next === current };
}

function parseArgs(argv) {
  const args = { check: false, dir: 'docs/adr', readme: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--dir') args.dir = argv[++i];
    else if (a === '--readme') args.readme = argv[++i];
  }
  if (!args.readme) args.readme = join(args.dir, 'README.md');
  return args;
}

function main(argv) {
  const { check: isCheck, dir, readme } = parseArgs(argv);
  if (isCheck) {
    const { clean } = check({ dir, readme });
    if (!clean) {
      console.error(
        `✖ ${readme} is out of sync with the ADR sources.\n` +
          `  Run \`node src/scripts/generate-adr-index.mjs\` and commit the result ` +
          `(the ADR index is a generated artifact, kept honest by this lockfile check).`,
      );
      process.exit(1);
    }
    console.log(`✓ ${readme} is regeneration-clean (ADR index in sync).`);
    return;
  }
  const { changed } = generate({ dir, readme });
  console.log(
    changed
      ? `✓ regenerated the ADR index in ${readme}.`
      : `✓ ${readme} already up to date (no change).`,
  );
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv);
}

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
 * Source of truth per ADR (all three via the SHARED {@link extractAdrMeta}):
 *   - number  ← the `NNNN-` prefix on the filename/slug leaf (recursive; era
 *               subfolders included) — the SOLE number source for BOTH this
 *               generator AND `Hub.astro` (squad F6: no second number parse).
 *   - title   ← frontmatter `title` (generator-only; not part of the meta triple)
 *   - status  ← body `## Status` (first token, `**`-stripped)
 *   - date    ← frontmatter `updated`, UTC-sliced to `YYYY-MM-DD` (idempotent)
 *
 * Single source (#50, D3/F5/F6): `extractAdrMeta` is the one extractor for
 * number+status+date. `discoverAdrs` (this generator) and `buildAdrHubCards`
 * (consumed by `Hub.astro`) both route through it, so the generated own-tree
 * table and the rendered hub match 1:1 by construction over the published+
 * numbered set — never a re-parse on either side.
 *
 * Zero new dependencies: `gray-matter` is already vendored (used by the
 * frontmatter gate); everything else is string/regex work.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

/** The `NNNN-` ADR number prefix on a filename/slug leaf — the SOLE number source (F6). */
const ADR_NUMBER = /^(\d{4})-/;
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

/**
 * The SOLE extractor of an ADR's `{ number, status, date }` triple, shared by the
 * own-tree generator ({@link discoverAdrs}) and the Hub layout
 * ({@link buildAdrHubCards} → `Hub.astro`). Single-sourcing all three fields —
 * `number` included (squad F6) — makes the generated table and the rendered hub
 * match 1:1 by construction, and removes the split-brain #50 targets.
 *
 * - `number` comes from the `NNNN-` prefix on the leaf of `slug` (a filename on
 *   the generator side, a route slug on the Hub side — both carry the prefix).
 * - `status` is the first token of the body `## Status` section.
 * - `date` is the frontmatter `updated`, UTC-sliced to `YYYY-MM-DD`.
 *
 * Returns `null` for a page that is NOT an included ADR — number-less (README,
 * `template.md`, any non-`NNNN-` file) or `type: Template` — so both callers
 * apply the SAME inclusion rule `discoverAdrs` always had.
 *
 * @param {string} rawMarkdown  The ADR body (frontmatter already stripped:
 *   `matter(...).content` on the generator side, `entry.body` on the Hub side).
 * @param {{ slug?: string, frontmatter?: any }} [ctx]
 * @returns {{ number: string, status: string, date: string } | null}
 */
export function extractAdrMeta(rawMarkdown, { slug = '', frontmatter = {} } = {}) {
  const leaf = String(slug).split('/').pop()?.replace(MD_EXT, '') ?? '';
  const m = leaf.match(ADR_NUMBER);
  if (!m) return null; // number-less (README, template.md, non-ADR) — excluded
  if (frontmatter?.type === 'Template') return null; // Template excluded
  return {
    number: m[1],
    status: extractStatusToken(String(rawMarkdown ?? '')),
    date: formatUpdated(frontmatter?.updated),
  };
}

/** Escape a table cell so a `|` in a title cannot break the Markdown row. */
function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').trim();
}

/**
 * Discover every ADR under `adrDir` (recursive), excluding `README.md`,
 * `template.md`, and any `type: Template` file, returning entries ordered by
 * ascending ADR number. Number+status+date come SOLELY from {@link extractAdrMeta}
 * (the same extractor the Hub uses); only `title`/`relpath` are generator-local.
 */
export function discoverAdrs(adrDir) {
  const entries = [];
  for (const file of walk(adrDir)) {
    const base = file.slice(file.lastIndexOf('/') + 1);
    const raw = readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const meta = extractAdrMeta(parsed.content, { slug: base, frontmatter: parsed.data ?? {} });
    if (!meta) continue; // number-less or type:Template — excluded (single-sourced)
    const relpath = relative(adrDir, file).split('\\').join('/');
    entries.push({
      number: meta.number,
      title: String(parsed.data?.title ?? '').trim(),
      status: meta.status,
      date: meta.date,
      relpath,
    });
  }
  entries.sort((a, b) => a.number.localeCompare(b.number));
  return entries;
}

/**
 * Build the ordered, single-sourced ADR cards a `kind: Hub` ADR section renders.
 * This is the ADR-child pipeline `Hub.astro` ACTUALLY calls — kept here (not
 * re-implemented in the `.astro`) so the hub and the generated own-tree table
 * derive from ONE extractor and ONE inclusion rule.
 *
 * Mirrors {@link discoverAdrs}: number+status+date come from {@link extractAdrMeta}
 * (returning `null` excludes number-less pages and `type: Template`), and the
 * result is ordered by ADR number ascending. So over the published+numbered set
 * the rendered hub matches the generated table 1:1 (NFR-004, squad F5/F6). The
 * inclusion/ordering key (`number`) is never re-derived in `Hub.astro`.
 *
 * @param {Array<{ slug?: string, data?: any, body?: string }>} adrChildren
 *   The Hub's ADR-kind children: route `slug`, frontmatter `data`, and `body`
 *   (the Astro entry body — where the conventional `## Status` lives).
 * @returns {Array<{ slug: string, title: string, description?: string, kind?: string, number: string, status: string, date: string }>}
 */
export function buildAdrHubCards(adrChildren) {
  const cards = [];
  for (const child of adrChildren ?? []) {
    const data = child?.data ?? {};
    const meta = extractAdrMeta(child?.body ?? '', {
      slug: child?.slug ?? '',
      frontmatter: data,
    });
    if (!meta) continue; // number-less or Template — excluded, matching discoverAdrs
    cards.push({
      slug: String(child?.slug ?? ''),
      title: String(data.title ?? ''),
      description: data.description,
      kind: data.kind,
      number: meta.number,
      status: meta.status,
      date: meta.date,
    });
  }
  cards.sort((a, b) => a.number.localeCompare(b.number));
  return cards;
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

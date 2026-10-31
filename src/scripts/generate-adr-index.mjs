#!/usr/bin/env node
/**
 * generate-adr-index.mjs — regenerate the ADR index table in `docs/adr/README.md`.
 *
 * Usage:
 *   node src/scripts/generate-adr-index.mjs                 # rewrite in place
 *   node src/scripts/generate-adr-index.mjs --check         # lockfile check (CI)
 *   node src/scripts/generate-adr-index.mjs --dir <adrDir> --readme <path>
 *   node src/scripts/generate-adr-index.mjs --dir <adrDir> --docs-root <docsRoot>
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
 *   - number  ← the id read from the filename/slug leaf by the tree's ADR id
 *               rule (recursive; era subfolders included) — the SOLE number
 *               source for BOTH this generator AND `Hub.astro` (squad F6: no
 *               second number parse). The rule is the charter's `adr.id` axis
 *               (#248, ADR-0068); without it, the `NNNN-` prefix as always.
 *   - title   ← frontmatter `title` (generator-only; not part of the meta triple)
 *   - status  ← body `## Status` (first token, `**`-stripped); when the body has
 *               no `## Status` section, frontmatter `status` (same token rule)
 *   - date    ← frontmatter `updated`, else `date`, UTC-sliced to `YYYY-MM-DD`
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
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { normaliseInstant, formatInstant } from '../lib/vocabulary-core.mjs';
import { walkMarkdownPaths } from '../lib/docs-walk.mjs';
import { loadCharter } from '../lib/vocabulary-loader.mjs';
import {
  ADR_ID_PRESETS,
  DEFAULT_ADR_ID_RULE,
  compareAdrIds,
  matchAdrId,
  resolveAdrIdRule,
} from '../lib/adr-id.mjs';

export { ADR_ID_PRESETS, resolveAdrIdRule };
const MD_EXT = /\.mdx?$/i;

/** Every ADR page under `dir`, as absolute paths: the shared docs-page walk (no `log.md`, dot or `_meta` entries). */
function walk(dir) {
  return walkMarkdownPaths(resolve(dir)).map((rel) => join(dir, rel));
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
  const start = statusSectionStart(lines);
  if (start === -1) return '';
  for (let j = start + 1; j < lines.length; j++) {
    if (/^#{1,6}\s/.test(lines[j])) break; // next heading — Status section ended
    const trimmed = lines[j].trim();
    if (!trimmed) continue;
    return statusTokenOf(trimmed);
  }
  return '';
}

/** Index of the body's `## Status` heading line, or `-1` when there is none. */
function statusSectionStart(lines) {
  return lines.findIndex((l) => /^##\s+Status\b/.test(l.trim()));
}

/** The leading status token of one line: `**`/`` ` ``-stripped, up to `.`, `—` or whitespace. */
function statusTokenOf(text) {
  const cleaned = text.replace(/\*\*/g, '').replace(/`/g, '').trim();
  const token = cleaned.match(/^([^\s.—]+)/);
  return token ? token[1] : '';
}

/**
 * The decision status of an ADR: the body `## Status` section when the body has
 * one (the primary source, even when it is empty), else the frontmatter
 * `status` string reduced by the same token rule (#248). A non-string
 * frontmatter value is ignored.
 */
function resolveStatus(content, frontmatter) {
  if (statusSectionStart(content.split('\n')) !== -1) return extractStatusToken(content);
  const fm = frontmatter?.status;
  return typeof fm === 'string' ? statusTokenOf(fm.trim()) : '';
}

/** Format a frontmatter `updated` (or `date`) value to a UTC `YYYY-MM-DD` slice. */
export function formatUpdated(updated) {
  const instant = normaliseInstant(updated);
  // A full timestamp still displays as its UTC date, so the README never churns.
  return instant ? formatInstant(instant.date).slice(0, 10) : String(updated ?? '');
}

/**
 * The SOLE extractor of an ADR's `{ number, status, date }` triple, shared by the
 * own-tree generator ({@link discoverAdrs}) and the Hub layout
 * ({@link buildAdrHubCards} → `Hub.astro`). Single-sourcing all three fields —
 * `number` included (squad F6) — makes the generated table and the rendered hub
 * match 1:1 by construction, and removes the split-brain #50 targets.
 *
 * - `number` is the id the `idRule` reads from the leaf of `slug` (a filename on
 *   the generator side, a route slug on the Hub side — both carry the id). The
 *   default rule is the `NNNN-` prefix (#248, ADR-0068).
 * - `status` is the first token of the body `## Status` section; when the body
 *   has no such section, the frontmatter `status` (#248).
 * - `date` is the frontmatter `updated`, else `date`, UTC-sliced to `YYYY-MM-DD`.
 * - `sortKey` holds the id's `date`/`seq` groups, for {@link compareAdrIds}.
 *
 * Returns `null` for a page that is NOT an included ADR — id-less (README,
 * `template.md`, any file the rule does not match) or `type: Template` — so both
 * callers apply the SAME inclusion rule `discoverAdrs` always had.
 *
 * @param {string} rawMarkdown  The ADR body (frontmatter already stripped:
 *   `matter(...).content` on the generator side, `entry.body` on the Hub side).
 * @param {{ slug?: string, frontmatter?: any, idRule?: import('../lib/adr-id.mjs').AdrIdRule }} [ctx]
 * @returns {{ number: string, status: string, date: string, sortKey: { date: string, seq: number | null } } | null}
 */
export function extractAdrMeta(
  rawMarkdown,
  { slug = '', frontmatter = {}, idRule = DEFAULT_ADR_ID_RULE } = {},
) {
  const leaf = String(slug).split('/').pop()?.replace(MD_EXT, '') ?? '';
  const id = matchAdrId(leaf, idRule);
  if (!id) return null; // id-less (README, template.md, non-ADR) — excluded
  if (frontmatter?.type === 'Template') return null; // Template excluded
  return {
    number: id.id,
    status: resolveStatus(String(rawMarkdown ?? ''), frontmatter),
    date: formatUpdated(frontmatter?.updated ?? frontmatter?.date),
    sortKey: { date: id.date, seq: id.seq },
  };
}

/**
 * The ADR id rule a docs tree declares in `<docsRoot>/_meta/charter.yaml`
 * (`adr.id`), or the `NNNN-` default when there is no charter or no axis. A
 * malformed axis throws, naming the file (#248).
 *
 * @param {string} docsRoot
 * @returns {import('../lib/adr-id.mjs').AdrIdRule}
 */
export function loadAdrIdRule(docsRoot) {
  return loadCharter(docsRoot)?.adrId ?? DEFAULT_ADR_ID_RULE;
}

/** Escape a table cell so a `|` in a title cannot break the Markdown row. */
function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').trim();
}

/**
 * Discover every ADR under `adrDir` (recursive), excluding `README.md`,
 * `template.md`, and any `type: Template` file, returning entries ordered by
 * ascending ADR id ({@link compareAdrIds}). Number+status+date come SOLELY from
 * {@link extractAdrMeta} (the same extractor the Hub uses); only `title`/`relpath`
 * are generator-local.
 *
 * @param {string} adrDir
 * @param {{ idRule?: import('../lib/adr-id.mjs').AdrIdRule }} [options]
 */
export function discoverAdrs(adrDir, { idRule = DEFAULT_ADR_ID_RULE } = {}) {
  const entries = [];
  for (const file of walk(adrDir)) {
    const base = file.slice(file.lastIndexOf('/') + 1);
    const raw = readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const meta = extractAdrMeta(parsed.content, { slug: base, frontmatter: parsed.data ?? {}, idRule });
    if (!meta) continue; // number-less or type:Template — excluded (single-sourced)
    const relpath = relative(adrDir, file).split('\\').join('/');
    entries.push({
      number: meta.number,
      title: String(parsed.data?.title ?? '').trim(),
      status: meta.status,
      date: meta.date,
      sortKey: meta.sortKey,
      relpath,
    });
  }
  entries.sort(compareAdrIds);
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
 * @param {{ idRule?: import('../lib/adr-id.mjs').AdrIdRule }} [options] The tree's
 *   ADR id rule ({@link loadAdrIdRule}); the `NNNN-` default when omitted.
 * @returns {Array<{ slug: string, title: string, description?: string, kind?: string, number: string, status: string, date: string, sortKey: { date: string, seq: number | null } }>}
 */
export function buildAdrHubCards(adrChildren, { idRule = DEFAULT_ADR_ID_RULE } = {}) {
  const cards = [];
  for (const child of adrChildren ?? []) {
    const data = child?.data ?? {};
    const meta = extractAdrMeta(child?.body ?? '', {
      slug: child?.slug ?? '',
      frontmatter: data,
      idRule,
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
      sortKey: meta.sortKey,
    });
  }
  cards.sort(compareAdrIds);
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
 *
 * @param {string} dir
 * @param {string} readmePath
 * @param {{ idRule?: import('../lib/adr-id.mjs').AdrIdRule }} [options]
 */
export function computeReadme(dir, readmePath, { idRule = DEFAULT_ADR_ID_RULE } = {}) {
  const current = readFileSync(readmePath, 'utf8');
  const table = buildAdrTable(discoverAdrs(dir, { idRule }));
  return { current, next: regenerateReadme(current, table) };
}

/**
 * The id rule for a run: the charter of `docsRoot`, which defaults to the parent
 * of the ADR folder (`docs/adr` → `docs`).
 */
function ruleFor({ dir, docsRoot }) {
  return loadAdrIdRule(docsRoot ?? dirname(resolve(dir)));
}

/** Regenerate in place. Returns `{ changed }`. */
export function generate({ dir, readme, docsRoot }) {
  const { current, next } = computeReadme(dir, readme, { idRule: ruleFor({ dir, docsRoot }) });
  if (next !== current) writeFileSync(readme, next, 'utf8');
  return { changed: next !== current };
}

/** Lockfile-style check. Returns `{ clean }` (true when already regenerated). */
export function check({ dir, readme, docsRoot }) {
  const { current, next } = computeReadme(dir, readme, { idRule: ruleFor({ dir, docsRoot }) });
  return { clean: next === current };
}

function parseArgs(argv) {
  const args = { check: false, dir: 'docs/adr', readme: null, docsRoot: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--dir') args.dir = argv[++i];
    else if (a === '--readme') args.readme = argv[++i];
    else if (a === '--docs-root') args.docsRoot = argv[++i];
  }
  if (!args.readme) args.readme = join(args.dir, 'README.md');
  return args;
}

function main(argv) {
  const { check: isCheck, dir, readme, docsRoot } = parseArgs(argv);
  if (isCheck) {
    const { clean } = check({ dir, readme, docsRoot });
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
  const { changed } = generate({ dir, readme, docsRoot });
  console.log(
    changed
      ? `✓ regenerated the ADR index in ${readme}.`
      : `✓ ${readme} already up to date (no change).`,
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
  main(process.argv);
}

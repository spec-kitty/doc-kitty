#!/usr/bin/env node
/**
 * changelog.mjs — changelog fragments for the toolkit's CHANGELOG.md (ADR-0072).
 *
 * Usage:
 *   node src/scripts/changelog.mjs --check                      (pnpm validate:changelog)
 *   node src/scripts/changelog.mjs --preview                    (pnpm changelog:preview)
 *   node src/scripts/changelog.mjs --release <x.y.z> [--date YYYY-MM-DD]
 *   Options: --changelog <path> (default CHANGELOG.md), --dir <path> (default docs/changelog/unreleased)
 *
 * A PR records its change as ONE new file under `docs/changelog/unreleased/` instead of
 * editing the shared `## [Unreleased]` section, so parallel PRs never touch the
 * same lines. A fragment is named `<issue>-<slug>.md` (or `<slug>.md`) and reads:
 *
 *   ---
 *   section: Added
 *   ---
 *
 *   - **What a reader sees (#123).** Before, … Now, …
 *
 * `--check` validates every fragment and fails when CHANGELOG.md carries an
 * entry under `[Unreleased]` (it may hold only the note). `--preview` prints
 * CHANGELOG.md with the fragments shown as `[Unreleased]`, as the example site
 * renders it. `--release` writes them into `## [x.y.z] — date`, moves the
 * compare links and deletes the released fragments; released history is kept
 * byte for byte. On any refusal nothing is written.
 *
 * Bare Node, zero dependencies, offline.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_CHANGELOG = 'CHANGELOG.md';
export const DEFAULT_DIR = 'docs/changelog/unreleased';

/** The only content `## [Unreleased]` may hold in the committed CHANGELOG.md. */
export const UNRELEASED_NOTE =
  '<!-- Unreleased entries live in docs/changelog/unreleased/ as one file per change and are written here at release time. Do not add entries here. -->';

/** Section key → published heading, in Keep a Changelog order. */
export const SECTIONS = new Map([
  ['Breaking', '💥 Breaking'],
  ['Added', 'Added'],
  ['Changed', 'Changed'],
  ['Deprecated', 'Deprecated'],
  ['Removed', 'Removed'],
  ['Fixed', 'Fixed'],
  ['Security', 'Security'],
  ['Documentation', 'Documentation'],
]);

const NAME_RE = /^(?:(\d+)-)?[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNRELEASED_HEADING = '## [Unreleased]';
const UNRELEASED_LINK_RE = /^\[Unreleased\]: (\S+)\/compare\/(\S+)\.\.\.HEAD[ \t]*$/gm;

/**
 * Parse one fragment file. Throws with every problem it finds.
 * @returns {{ name: string, number: number | null, section: string, body: string }}
 */
export function parseFragment(name, text) {
  const nameMatch = NAME_RE.exec(name);
  if (!nameMatch) {
    throw new Error(`${name}: name must be kebab-case "<issue>-<slug>.md" or "<slug>.md"`);
  }
  const source = text.replace(/^\uFEFF/, '');
  const fm = /^---[ \t]*\r?\n([\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!fm) throw new Error(`${name}: needs a frontmatter block with "section: <Section>"`);
  const fields = {};
  for (const line of (fm[1] ?? '').split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z_]+):\s*(.*?)\s*$/.exec(line);
    if (!kv) throw new Error(`${name}: frontmatter line ${JSON.stringify(line)} is not "key: value"`);
    fields[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  for (const key of Object.keys(fields)) {
    if (key !== 'section') throw new Error(`${name}: unknown key "${key}" (a fragment has only "section")`);
  }
  const section = fields.section;
  if (!section) throw new Error(`${name}: needs a "section" in its frontmatter`);
  if (!SECTIONS.has(section)) {
    throw new Error(`${name}: section "${section}" is not one of ${[...SECTIONS.keys()].join(', ')}`);
  }
  const body = source.slice(fm[0].length).replace(/\r\n/g, '\n').trim();
  if (body === '') throw new Error(`${name}: the entry is empty`);
  if (!body.startsWith('- ')) throw new Error(`${name}: the entry must start with a "- " bullet`);
  const problem = bodyProblem(body);
  if (problem) throw new Error(`${name}: ${problem}`);
  return { name, number: nameMatch[1] === undefined ? null : Number(nameMatch[1]), section, body };
}

/**
 * What would break CHANGELOG.md if this body were written into it, or null:
 * a heading (it would end the section), an unclosed code fence or HTML comment
 * (it would swallow the release history after it on the site), or a link that
 * climbs out with `../` (entries are read from the repository root).
 */
function bodyProblem(body) {
  let fence = null;
  for (const line of body.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && line.trim() === marker[1]) {
        fence = null;
      }
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) return `the entry may not contain a heading (${JSON.stringify(line.trim())})`;
  }
  if (fence) return `the entry has an unclosed code fence (${fence})`;
  const withoutCode = body.replace(/(`+)[\s\S]*?\1/g, '');
  if (withoutCode.lastIndexOf('<!--') > withoutCode.lastIndexOf('-->')) return 'the entry has an unclosed HTML comment';
  if (/\]\(\s*\.\.\//.test(withoutCode) || /^\s*\[[^\]]+\]:\s*\.\.\//m.test(withoutCode)) {
    return 'link targets are relative to the repository root (docs/…), never "../"';
  }
  return null;
}

/** Every fragment in `dir` (README.md skipped): numbered ones by number, then the rest by name. */
export function readFragments(dir) {
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((n) => n !== 'README.md' && !n.startsWith('.'));
  const fragments = [];
  const errors = [];
  for (const name of names) {
    try {
      if (!statSync(path.join(dir, name)).isFile()) throw new Error(`${name}: is a folder; fragments are files`);
      fragments.push(parseFragment(name, readFileSync(path.join(dir, name), 'utf8')));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (errors.length > 0) throw new Error(errors.sort().join('\n'));
  return fragments.sort((a, b) => {
    if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number;
    if ((a.number === null) !== (b.number === null)) return a.number === null ? 1 : -1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

/** The `### Section` blocks for these fragments, in canonical order. */
export function renderUnreleased(fragments) {
  const blocks = [];
  for (const [key, heading] of SECTIONS) {
    const bodies = fragments.filter((f) => f.section === key).map((f) => f.body);
    if (bodies.length > 0) blocks.push([`### ${heading}`, ...bodies].join('\n\n'));
  }
  return blocks.join('\n\n');
}

/** Offset where the link-reference block at the end of the file starts (its length when there is none). */
function linkRefsStart(changelog) {
  const lines = changelog.split('\n');
  let offset = changelog.length;
  let at = offset;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    offset -= lines[i].length + (i < lines.length - 1 ? 1 : 0);
    if (lines[i].trim() === '') continue;
    if (!/^\[[^\]]+\]: /.test(lines[i])) break;
    at = offset;
  }
  return at;
}

/**
 * Where the `## [Unreleased]` block's content starts and ends, or null. It ends
 * at the next `## ` heading, or at the link references that close the file; a
 * reference line inside the section is part of it.
 */
function unreleasedSpan(changelog) {
  const at = changelog.search(/^## \[Unreleased\][ \t]*$/m);
  if (at === -1) return null;
  const start = at + UNRELEASED_HEADING.length;
  const next = changelog.slice(start).search(/^## /m);
  const end = next === -1 ? Math.max(start, linkRefsStart(changelog)) : start + next;
  return { start, end };
}

/** Problems with the committed CHANGELOG.md: `[Unreleased]` must hold only the note. */
export function changelogProblems(changelog) {
  const span = unreleasedSpan(changelog);
  if (!span) return [`CHANGELOG.md has no "${UNRELEASED_HEADING}" section`];
  const content = changelog.slice(span.start, span.end).replace(/<!--[\s\S]*?-->/g, '').trim();
  if (content !== '') {
    return [
      'CHANGELOG.md has entries under [Unreleased]. Move each into its own file under docs/changelog/unreleased/ ' +
        '(see docs/changelog/unreleased/README.md); [Unreleased] holds only the note.',
    ];
  }
  return [];
}

/** CHANGELOG.md with the fragments shown as `[Unreleased]` (what the site renders). */
export function withUnreleased(changelog, fragments) {
  const span = unreleasedSpan(changelog);
  if (!span) return changelog;
  const rendered = renderUnreleased(fragments);
  const middle = rendered === '' ? '\n\n' : `\n\n${rendered}\n\n`;
  return changelog.slice(0, span.start) + middle + changelog.slice(span.end);
}

/** CHANGELOG.md after releasing `version`: a new section and moved compare links. */
export function releaseChangelog(changelog, fragments, { version, date }) {
  if (!VERSION_RE.test(version)) throw new Error(`"${version}" is not a version (x.y.z or x.y.z-pre, no "v")`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!DATE_RE.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`"${date}" is not a YYYY-MM-DD date`);
  }
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^## \\[${escaped}\\]`, 'm').test(changelog)) {
    throw new Error(`CHANGELOG.md already has a "## [${version}]" section`);
  }
  if (fragments.length === 0) throw new Error('there are no fragments in docs/changelog/unreleased/ to release');
  const problems = changelogProblems(changelog);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  // The real link is the one in the reference block that closes the file, never
  // a quote of it in released history: edit it by position.
  const refsAt = linkRefsStart(changelog);
  const link = [...changelog.matchAll(UNRELEASED_LINK_RE)].filter((m) => m.index >= refsAt).pop();
  if (!link) throw new Error('CHANGELOG.md needs an "[Unreleased]: <repo>/compare/<tag>...HEAD" link');
  const [line, base, previous] = link;
  const links = `[Unreleased]: ${base}/compare/v${version}...HEAD\n[${version}]: ${base}/compare/${previous}...v${version}`;
  const withLinks = changelog.slice(0, link.index) + links + changelog.slice(link.index + line.length);
  const span = unreleasedSpan(withLinks);
  const section = `## [${version}] — ${date}\n\n${renderUnreleased(fragments)}\n\n`;
  return withLinks.slice(0, span.start) + `\n\n${UNRELEASED_NOTE}\n\n` + section + withLinks.slice(span.end);
}

/**
 * Write the released CHANGELOG.md and delete the released fragments, all or
 * nothing: the fragments are deleted first, and a failed delete or write puts
 * every deleted fragment back and leaves CHANGELOG.md as it was. Otherwise a
 * half-done release would list the same entries again at the next one.
 *
 * @param {{ changelogPath: string, dir: string, fragments: { name: string }[], released: string }} release
 * @param {{ unlink?: (p: string) => void, write?: (p: string, text: string) => void }} [fsOps] for tests
 */
export function applyRelease({ changelogPath, dir, fragments, released }, fsOps = {}) {
  const unlink = fsOps.unlink ?? unlinkSync;
  const write = fsOps.write ?? ((p, text) => writeFileSync(p, text));
  const saved = fragments.map((f) => ({ file: path.join(dir, f.name), text: readFileSync(path.join(dir, f.name)) }));
  const deleted = [];
  try {
    for (const f of saved) {
      unlink(f.file);
      deleted.push(f);
    }
    write(changelogPath, released);
  } catch (err) {
    for (const f of deleted) writeFileSync(f.file, f.text);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${detail}; nothing was released (CHANGELOG.md and the fragments are as they were)`);
  }
}

function parseArgs(argv) {
  const opts = { mode: null, changelog: DEFAULT_CHANGELOG, dir: DEFAULT_DIR, version: null, date: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const mode = { '--check': 'check', '--preview': 'preview', '--release': 'release' }[arg];
    if (mode) {
      if (opts.mode && opts.mode !== mode) throw new Error('give only one of --check, --preview, --release');
      opts.mode = mode;
      if (mode === 'release') opts.version = argv[++i] ?? '';
    } else if (arg === '--date') opts.date = argv[++i] ?? '';
    else if (arg === '--changelog') opts.changelog = argv[++i] ?? '';
    else if (arg === '--dir') opts.dir = argv[++i] ?? '';
    else throw new Error(`unknown argument ${JSON.stringify(arg)}`);
  }
  return opts;
}

const USAGE =
  'Usage: changelog.mjs --check | --preview | --release <x.y.z> [--date YYYY-MM-DD] [--changelog <path>] [--dir <path>]';

export function run(argv) {
  let opts;
  try {
    opts = parseArgs(argv.slice(2));
  } catch (err) {
    console.error(`changelog: ${err instanceof Error ? err.message : err}\n${USAGE}`);
    return 2;
  }
  if (!opts.mode) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(opts.changelog)) {
    console.error(`changelog: ${opts.changelog} not found`);
    return 2;
  }
  const changelog = readFileSync(opts.changelog, 'utf8');
  let fragments;
  try {
    fragments = readFragments(opts.dir);
  } catch (err) {
    console.error(`changelog: FAILED — bad fragments in ${opts.dir}/:`);
    for (const line of String(err instanceof Error ? err.message : err).split('\n')) console.error(`  ✖ ${line}`);
    return 1;
  }
  if (opts.mode === 'check') {
    const problems = changelogProblems(changelog);
    if (problems.length > 0) {
      console.error('changelog: FAILED');
      for (const p of problems) console.error(`  ✖ ${p}`);
      return 1;
    }
    console.log(`changelog: OK — ${fragments.length} fragment(s) in ${opts.dir}/, [Unreleased] holds only the note.`);
    return 0;
  }
  if (opts.mode === 'preview') {
    process.stdout.write(withUnreleased(changelog, fragments));
    return 0;
  }
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  let released;
  try {
    released = releaseChangelog(changelog, fragments, { version: opts.version, date });
  } catch (err) {
    console.error(`changelog: release refused — ${err instanceof Error ? err.message : err}`);
    return 1;
  }
  try {
    applyRelease({ changelogPath: opts.changelog, dir: opts.dir, fragments, released });
  } catch (err) {
    console.error(`changelog: release failed — ${err instanceof Error ? err.message : err}`);
    return 1;
  }
  console.log(
    `changelog: released ${opts.version} (${date}) from ${fragments.length} fragment(s); deleted them from ${opts.dir}/.`,
  );
  return 0;
}

function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exit(run(process.argv));
}

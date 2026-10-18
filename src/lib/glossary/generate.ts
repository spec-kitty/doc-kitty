/**
 * Glossary page generator — codegen INTO the docs collection (ADR-0026 Decision 3,
 * AS-6, FR-013). From the one {@link SharedTermIndex} the loader built, this writes
 * real Markdown files under `<outDocsDir>/glossary/`:
 *
 *   - `glossary/<index>.md`          — the hub (`kind: Hub`) listing every context.
 *   - `glossary/<slug>/<index>.md`   — one page per context (`kind: Glossary`,
 *                                       self-declared `glossary_context`).
 *
 * `<index>` is a name the SITE treats as a section index (`index` when the site lists
 * it, else its first index name; see {@link generatedIndexBasename}). Otherwise the
 * toolkit's own view of the hub is `glossary/index`: links it builds point at
 * `/glossary/index/`, the Hub layout lists no children and the sidebar does not
 * treat the page as the folder's index (#129). Starlight itself serves the hub at
 * `/glossary/` either way, and term links work.
 *
 * Because the files land under the globbed `docs/` base, the existing
 * `glob({ base: 'docs' })` loader ingests them, so the sidebar (via Starlight
 * tree-autogeneration of the `docs/glossary/` folder), sitemap draft-filter, agent
 * API, and `llms.txt` pick them up with **zero new wiring** — the reason an injected
 * route was rejected (an `injectRoute` here would be a review finding).
 *
 * This module is **pure** (Astro-free) and a function of the index alone:
 *
 *   - **Presence-gated** (INV-G4): an absent/empty index writes nothing, returns `[]`.
 *   - **Deterministic + idempotent** (NFR-004, INV-G2): contexts are emitted in a
 *     stable name-sorted order and meta keys are sorted, so the same index yields
 *     byte-identical files on every run — no `Date.now()`, no Map-iteration reliance.
 *   - Definitions/meta are emitted as Markdown **body** (never pre-escaped plain
 *     text) so FR-003/FR-004 route them through the site's real markdown pipeline;
 *     each term sits at its stored, de-collided `#<anchor>` — computed once by the
 *     loader (issue #17) and read here, never recomputed (a second slug impl would
 *     be a finding).
 *
 * It is **wired** by WP08's config hook (not here) and **dormant** until WP09 lands
 * the example `.contextive/definitions.yaml`.
 */
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  compareCodeUnit,
  generatedIndexBasename,
  isPlainIndexName,
  normalizeIndexBasenames,
  OKF_VERSION,
} from '../vocabulary-core.mjs';
import { makeStamp } from '../generator-stamp.mjs';
import type { SharedTermIndex, Term } from './types.js';

/**
 * The top-level folder (a section id) this generator writes glossary pages into,
 * under `<outDocsDir>/`. Exported as the single source of the name so the sidebar
 * synthesis (`BUILD_GENERATED_SECTION_IDS` in `../sections.ts`) can seed it as a
 * build-generated section without a second hardcoded literal (review F4).
 */
export const GLOSSARY_OUTPUT_DIRNAME = 'glossary';

/** The site's `indexBasename` setting, as `defineDocKittyIntegrations` accepts it. */
export type GlossaryIndexBasename = string | readonly string[] | undefined;

/** YAML-safe double-quoted scalar (handles quotes, backslashes, colons, unicode). */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Serialize a small ordered field map as a `---` frontmatter block. */
function frontmatter(fields: Array<[string, string]>): string {
  const lines = fields.map(([key, value]) => `${key}: ${value}`);
  return ['---', ...lines, '---'].join('\n');
}

/** Render a term's `meta` (URLs already scheme-checked in WP01) as a Markdown list. */
function renderMeta(meta: Record<string, string>): string[] {
  const keys = Object.keys(meta).sort();
  if (keys.length === 0) return [];
  const items = keys.map((key) => {
    const value = meta[key];
    // Values are hrefs (FR-004, already scheme-checked build-fatal in WP01). Render
    // a CLEAN http(s) URL as a Markdown link; render anything else as inert inline
    // code, NOT verbatim Markdown. Post-squad security MED: a verbatim non-http(s)
    // value that is itself Markdown-link syntax (e.g. `[x](javascript:alert(1))`)
    // passes safeHref as a "relative" link and would re-parse into a live
    // `javascript:` href; a crafted http(s) value with trailing `](…)` could break
    // out of the link too. Requiring a whitespace/bracket/backtick-free URL for the
    // link branch, and inline-coding everything else, closes both — the markdown
    // pipeline treats inline-code content as literal text, no href forms.
    const isCleanUrl = /^https?:\/\/\S+$/i.test(value) && !/[()[\]`<>]/.test(value);
    const rendered = isCleanUrl
      ? `[${value}](${value})`
      : `\`${value.replace(/`/g, "'")}\``;
    return `- **${key}:** ${rendered}`;
  });
  return ['**Meta:**', '', ...items];
}

/**
 * Heading text for a term: collapse whitespace and neutralize `{`/`}` so an
 * author-supplied `{#id}` (or a newline) embedded in the term name can never
 * shadow or desync the heading id — the explicit `{#anchor}` below is the sole
 * id source, and it is the stored, de-collided anchor.
 */
function headingText(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[{}]/g, (c) => `\\${c}`);
}

/**
 * Render one term as a Markdown section anchored at its stored de-collided
 * anchor. Emits the **block-form** attribute-list line (`markua-attributes.ts`
 * §Block form) — a lone `{#anchor}` paragraph immediately above the heading —
 * rather than the inline `## name {#anchor}` form, since this toolkit's
 * attribute-list plugin only consumes the block form (#63, D3): the inline form
 * is never parsed, so it doubled the slugger's heading id (`cargo-cargo`) and
 * rendered the literal `{#cargo}` as visible text. Block-form attaches `id` to
 * the immediately-following heading and is spliced out of the tree, so neither
 * artifact reaches the reader — the visible heading text (`headingText`) is
 * unchanged.
 */
function renderTerm(term: Term, anchor: string): string[] {
  const blocks: string[] = [
    `{#${anchor}}`,
    '',
    `## ${headingText(term.name)}`,
    '',
    term.definition,
  ];

  if (term.aliases && term.aliases.length > 0) {
    blocks.push('', `**Aliases:** ${term.aliases.join(', ')}`);
  }
  if (term.examples && term.examples.length > 0) {
    blocks.push('', '**Examples:**', '', ...term.examples.map((ex) => `- ${ex}`));
  }
  if (term.meta) {
    const meta = renderMeta(term.meta);
    if (meta.length > 0) blocks.push('', ...meta);
  }
  return blocks;
}

/**
 * The frontmatter key set the generator writes, per position (plus the optional
 * `generated` stamp, see {@link hasGeneratorKeys}). This is how a generated page is
 * recognised: an authored page that adds, drops or renames any field is not a match
 * and is never removed. The stamp overrides the former C-003 rule that forbade a
 * `generated:` key (FR-005, #177; recorded in the ADR-0059 addendum); pages written
 * before the stamp existed (no `generated`) are still recognised.
 */
const HUB_KEYS = ['okf_version', 'title', 'description', 'kind', 'doc_status'];
const CONTEXT_KEYS = ['okf_version', 'title', 'description', 'kind', 'glossary_context', 'doc_status'];

/** The producer id of the glossary's `generated.by` stamp (`doc-kitty-glossary/<version>`). */
const GLOSSARY_PRODUCER = 'doc-kitty-glossary';

/** The `generated:` block (stable key order: by, at, content_hash). */
const STAMP_BLOCK = /^generated:\n(?: {2}.*\n)+/m;

/**
 * Add the `generated` stamp to a rendered page. `content_hash` covers the page
 * WITHOUT the stamp, so a rerun over unchanged input hashes identically; `at` is
 * carried over from the page already at `file` until that hash moves.
 */
function stampPage(text: string, file: string, now: Date | undefined): string {
  const hash = createHash('sha256').update(text).digest('hex');
  const stamp = makeStamp({
    producer: GLOSSARY_PRODUCER,
    hash,
    previous: readFrontmatter(file)?.generated as { at?: string; content_hash?: string } | undefined,
    now,
  });
  const block = [
    'generated:',
    `  by: ${yamlString(stamp.by)}`,
    `  at: ${yamlString(stamp.at)}`,
    `  content_hash: ${yamlString(stamp.content_hash)}`,
  ].join('\n');
  const close = text.indexOf('\n---\n', 3);
  return `${text.slice(0, close)}\n${block}${text.slice(close)}`;
}

/** The hub page body: a bullet list linking every context (name-sorted). */
function renderHub(contexts: Array<{ name: string; slug: string; vision?: string }>): string {
  const items = contexts.map(({ name, slug: contextSlug, vision }) => {
    const link = `- [${name}](./${contextSlug}/)`;
    return vision ? `${link} — ${vision}` : link;
  });
  const body = frontmatter([
    ['okf_version', yamlString(OKF_VERSION)],
    ['title', yamlString('Glossary')],
    ['description', yamlString('Bounded-context vocabulary for this documentation.')],
    ['kind', 'Hub'],
    ['doc_status', 'active'],
  ]);
  return (
    `${body}\n\n# Glossary\n\n` +
    'The vocabulary of each bounded context. Terms are grouped by the context that ' +
    'owns them.\n\n' +
    `${items.join('\n')}\n`
  );
}

/** A single context page: self-declared `glossary_context`, vision, term sections. */
function renderContextPage(
  name: string,
  vision: string | undefined,
  terms: Term[],
  anchors: Map<string, string>,
): string {
  const head = frontmatter([
    ['okf_version', yamlString(OKF_VERSION)],
    ['title', yamlString(name)],
    ['description', yamlString(`Glossary terms for the ${name} context.`.slice(0, 180))],
    ['kind', 'Glossary'],
    ['glossary_context', yamlString(name)],
    ['doc_status', 'active'],
  ]);

  const sections: string[] = [`# ${name}`];
  if (vision) sections.push('', vision);
  for (const term of terms) {
    // buildIndex assigns a de-collided anchor for every term and makes empty
    // slugs / duplicate names build-fatal, so a missing entry is a broken
    // invariant, not an author error — fail loud rather than ship `{#}`.
    const anchor = anchors.get(term.name);
    if (anchor === undefined) {
      throw new Error(
        `Glossary generation invariant: no anchor for term "${term.name}" in ` +
          `context "${name}" — buildIndex must assign one for every term`,
      );
    }
    sections.push('', ...renderTerm(term, anchor));
  }

  return `${head}\n\n${sections.join('\n')}\n`;
}

/**
 * Reject any configured index name that is not a single plain path segment, BEFORE a
 * path is built from it: a name such as `../x` would move the write and the prune
 * scan out of `glossary/`. Validates the whole list, not only the chosen name.
 */
function assertPlainIndexNames(indexBasename: GlossaryIndexBasename): void {
  const list = indexBasename === undefined ? [] : [indexBasename].flat();
  for (const entry of list) {
    if (typeof entry !== 'string' || entry.trim() === '') continue;
    if (!isPlainIndexName(entry)) {
      throw new Error(
        `Glossary generation: indexBasename must be a plain file name such as "README" or ` +
          `"index" (one path segment: no "/", no "\\", no leading ".", no surrounding whitespace); got ${JSON.stringify(entry)}. ` +
          'Fix the setting and rebuild.',
      );
    }
  }
}

/** Frontmatter of a file, or `null` when it has none / cannot be parsed. */
function readFrontmatter(file: string): Record<string, unknown> | null {
  try {
    const data = matter(readFileSync(file, 'utf8')).data;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Condition 3 of the prune: the `kind` this position's generated page carries. */
function hasGeneratedKind(data: Record<string, unknown> | null, kind: string): data is Record<string, unknown> {
  return data !== null && data.kind === kind;
}

/** Condition 4: exactly the generator's key set, with or without the stamp (order-insensitive). */
function hasGeneratorKeys(data: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(data);
  // `okf_version` is optional: pages written before it was emitted are still recognised.
  const required = keys.filter((k) => k !== 'okf_version');
  return required.every((k) => own.includes(k)) && own.every((k) => k === 'generated' || keys.includes(k));
}

/** Files directly in `dir` whose base name (sans `.md`) is in `names`, case-insensitively. */
function indexFilesIn(dir: string, names: Set<string>): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .filter((e) => names.has(e.name.slice(0, -3).toLowerCase()))
    .map((e) => join(dir, e.name));
}

/**
 * Codegen the glossary hub + per-context pages into `<outDocsDir>/glossary/`.
 *
 * @param index         the shared term index (from the WP01 loader).
 * @param outDocsDir    the docs-collection base to write under (e.g. repo-root `docs`).
 * @param indexBasename the site's `indexBasename` setting. Required (no default): the
 *                      file name written is `generatedIndexBasename(…, { prefer: 'index' })`,
 *                      so the pages are a section index on THIS site (FR-006).
 * @param warn          where a kept look-alike is reported (default `console.warn`).
 * @param now           injectable clock: a page's `generated.at` takes it only when
 *                      the page's content changed (the on-disk `at` is carried over).
 * @returns the written file paths (hub first, then contexts name-sorted); `[]` when
 *          the index is absent or has no contexts (presence gate, INV-G4).
 * @throws  when an AUTHORED file already sits at a path this generator writes (FR-007);
 *          nothing is written or removed in that case.
 */
export function generateGlossaryPages(
  index: SharedTermIndex,
  outDocsDir: string,
  indexBasename: GlossaryIndexBasename,
  warn: (message: string) => void = (m) => console.warn(m),
  now?: Date,
): string[] {
  // Presence gate (INV-G4): nothing to generate → write nothing, return [].
  if (!index || index.contexts.size === 0) return [];

  // Stable name-sorted context order → byte-identical output run-to-run (NFR-004).
  const contexts = [...index.contexts.entries()]
    .map(([name, data]) => ({
      name,
      slug: data.slug,
      vision: data.domainVisionStatement,
      terms: data.terms,
      anchors: data.anchors,
    }))
    .sort((a, b) => compareCodeUnit(a.name, b.name));

  assertPlainIndexNames(indexBasename);
  const glossaryDir = join(outDocsDir, GLOSSARY_OUTPUT_DIRNAME);
  const target = generatedIndexBasename(indexBasename as string | string[] | undefined, {
    prefer: 'index',
  });
  const targets = [
    { path: join(glossaryDir, `${target}.md`), kind: 'Hub', keys: HUB_KEYS },
    ...contexts.map((c) => ({
      path: join(glossaryDir, c.slug, `${target}.md`),
      kind: 'Glossary',
      keys: CONTEXT_KEYS,
    })),
  ];

  // A symlinked glossary or context folder would take every write and prune outside
  // the docs tree: refuse it, as an authored file is refused, before anything is written.
  for (const dir of [glossaryDir, ...contexts.map((c) => join(glossaryDir, c.slug))]) {
    let isLink: boolean;
    try {
      isLink = lstatSync(dir).isSymbolicLink();
    } catch {
      continue; // not created yet
    }
    if (isLink) {
      throw new Error(
        `Glossary generation: ${dir} is a symbolic link. The glossary generator writes ` +
          'and removes pages in this folder, so it must be a real folder inside the docs ' +
          'tree; replace the link with a folder and rebuild.',
      );
    }
  }

  // FR-007: refuse BEFORE any write or removal if an authored file sits on a target.
  // "Generated" here is conditions 3 + 4 only; the name condition must not apply, or
  // the page the previous run wrote at this very path would stop every second run.
  for (const t of targets) {
    // lstat, not exists: a symlink (even a dangling one) is never a page this generator wrote.
    let isLink: boolean;
    try {
      isLink = lstatSync(t.path).isSymbolicLink();
    } catch {
      continue; // nothing at the path
    }
    const data = isLink ? null : readFrontmatter(t.path);
    if (isLink || !hasGeneratedKind(data, t.kind) || !hasGeneratorKeys(data, t.keys)) {
      throw new Error(
        `Glossary generation: ${t.path} exists and is not a generated glossary page. ` +
          'The glossary generator writes this path; move or remove that file ' +
          '(or rename it) and rebuild.',
      );
    }
  }

  const written: string[] = [];

  mkdirSync(glossaryDir, { recursive: true });
  const hubPath = targets[0].path;
  const hubText = stampPage(renderHub(contexts), hubPath, now);
  writeFileSync(hubPath, hubText, 'utf8');
  written.push(hubPath);

  // What the generator just wrote at each position: the prune removes a stale
  // page only when it is byte-identical to this.
  const positions = [{ dir: glossaryDir, kind: 'Hub', keys: HUB_KEYS, current: hubText }];
  for (const context of contexts) {
    const contextDir = join(glossaryDir, context.slug);
    mkdirSync(contextDir, { recursive: true });
    const pagePath = join(contextDir, `${target}.md`);
    const pageText = stampPage(
      renderContextPage(context.name, context.vision, context.terms, context.anchors),
      pagePath,
      now,
    );
    writeFileSync(pagePath, pageText, 'utf8');
    written.push(pagePath);
    positions.push({ dir: contextDir, kind: 'Glossary', keys: CONTEXT_KEYS, current: pageText });
  }

  pruneStaleIndexPages(
    positions,
    written,
    target,
    indexBasename,
    warn,
  );
  return written;
}

/** A page's text without its `generated:` stamp block. */
function stripStamp(text: string): string {
  return text.replace(STAMP_BLOCK, '');
}

/**
 * Remove generated pages left under a different index name (FR-008). A file goes
 * only if ALL hold: (1) it sits at `glossary/<name>.md` or `glossary/<slug>/<name>.md`
 * for a current context slug (the candidate list below); (2) `<name>` is a site index
 * name or `index`, case-insensitively, and is not the chosen target (and is not the
 * same real file as one just written — a case-insensitive file system); (3) its `kind`
 * is `Hub` / `Glossary` for the position; (4) its keys are exactly the generator's;
 * (5) its bytes are identical to the page just written for that same position
 * (`current`): a page an earlier build left behind is the same text when the
 * glossary source has not changed, and a page someone wrote by hand is not.
 * Matches 1-3 but not 4 are kept with a warning about the fields; matches 1-4 but
 * not 5 are kept with a warning about the content. Folders are never removed.
 */
function pruneStaleIndexPages(
  positions: Array<{ dir: string; kind: string; keys: string[]; current: string }>,
  written: string[],
  chosen: string,
  indexBasename: GlossaryIndexBasename,
  warn: (message: string) => void,
): void {
  const names = new Set(
    [...normalizeIndexBasenames(indexBasename as string | string[] | undefined), 'index']
      .filter((n): n is string => typeof n === 'string' && n !== '')
      .map((n) => n.toLowerCase()),
  );
  names.delete(chosen.toLowerCase());
  const fresh = new Set(written.map((p) => realpathSync(p)));

  for (const t of positions) {
    for (const file of indexFilesIn(t.dir, names)) {
      if (fresh.has(realpathSync(file))) continue;
      const data = readFrontmatter(file);
      if (!hasGeneratedKind(data, t.kind)) continue;
      if (!hasGeneratorKeys(data, t.keys)) {
        warn(
          `Glossary generation: keeping ${file}: it looks like a generated ${t.kind} page ` +
            'but carries different frontmatter fields, so it is treated as authored. ' +
            'The folder now has two index-named files: delete the old one if it is a ' +
            'leftover from an earlier build, or rename it if it is a page you wrote.',
        );
        continue;
      }
      // The stamp (version, instant) is not content: a leftover differs from the page just
      // written only by it, so compare without it.
      if (stripStamp(readFileSync(file, 'utf8')) !== stripStamp(t.current)) {
        warn(
          `Glossary generation: keeping ${file}: it looks like a generated ${t.kind} page ` +
            'but its content differs from the page the generator just wrote at this position, ' +
            'so it is treated as authored. The folder now has two index-named files: delete ' +
            'it if it is left over from an earlier build, or rename it if you wrote it.',
        );
        continue;
      }
      unlinkSync(file);
    }
  }
}

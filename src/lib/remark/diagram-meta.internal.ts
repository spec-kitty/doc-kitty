/**
 * Pure, Astro-free string logic for the diagram-metadata transform (ADR-0023,
 * contract `diagram-meta-transform`; FR-003/004/005/013, NFR-005).
 *
 * `diagram-meta.ts` (the remark plugin) walks the mdast, and for each
 * `lang === 'mermaid'` code node delegates ALL string work to the three
 * functions here; `diagram-figure.ts` (the rehype plugin) consumes the caption
 * shape {@link figureFields} produces. Nothing in this module imports remark,
 * hast, unified, or vfile — it is plain functions over the fence's `value`
 * string, so the vitest matrix exercises it with zero Astro/build runtime.
 *
 * Three responsibilities, one per exported function:
 *   - {@link parseMeta}          — parse the leading `%% key: value` block
 *     (closed set) and strip the matched lines from the source.
 *   - {@link injectAccStatements} — inject Mermaid `accTitle`/`accDescr` a11y
 *     statements AFTER the diagram-type declaration line (Mermaid rejects
 *     statements before it), skipping a leading `%%{ … }%%` init directive
 *     and/or a `---` YAML frontmatter block.
 *   - {@link figureFields}       — project the caption shape the `<figcaption>`
 *     is built from (title is the accessible NAME only, never a caption field).
 *
 * Load-bearing guard: the metadata regex requires whitespace after `%%`
 * (`^%%\s+…`), so Mermaid's reserved init directive `%%{ … }%%` — where `{`
 * follows `%%` with no space — can NEVER be mistaken for a metadata line.
 */

/** The closed set of metadata keys, in caption/emit order. */
export type DiagramMetaKey = 'title' | 'description' | 'attribution' | 'source';

/** Parsed metadata fields (all optional; unknown keys are never captured). */
export interface DiagramMeta {
  title?: string;
  description?: string;
  attribution?: string;
  source?: string;
}

/** The caption projection the rehype `<figcaption>` reads (no `title`). */
export interface FigureFields {
  description?: string;
  attribution?: string;
  source?: string;
}

/** Result of {@link parseMeta}: the captured fields + the source with the
 * matched metadata lines removed (everything else byte-preserved). */
export interface ParseMetaResult {
  fields: DiagramMeta;
  strippedCode: string;
}

/**
 * A leading metadata line: `%%`, at least one space, a reserved key, `:`, and a
 * non-empty value. The mandatory `\s+` after `%%` is the reserved-directive
 * guard — `%%{` (init directive) has `{`, not whitespace, so it never matches.
 */
const META_LINE = /^%%\s+(title|description|attribution|source):\s*(.+)$/;

/**
 * Parse the leading `%% key: value` block and strip the matched lines.
 *
 * The "leading block" runs from the top of the source and ends at the first
 * line that is neither blank nor a `%%` line. Within it, lines matching the
 * closed set are captured (first occurrence wins) and removed; every other line
 * — blank lines, the init directive, and unknown `%% key:` comments — is left
 * exactly in place. Lines after the block are never scanned.
 */
export function parseMeta(code: string): ParseMetaResult {
  const lines = code.split('\n');
  const fields: DiagramMeta = {};
  const kept: string[] = [];
  let inLeadingBlock = true;

  for (const line of lines) {
    if (inLeadingBlock) {
      const match = META_LINE.exec(line);
      if (match) {
        const key = match[1] as DiagramMetaKey;
        if (fields[key] === undefined) fields[key] = match[2].trim();
        // Matched metadata lines are stripped (not pushed to `kept`).
        continue;
      }
      if (line.trim() === '' || line.startsWith('%%')) {
        // Blank lines and non-metadata `%%` lines (comments, init directive)
        // stay in the source and keep the leading block open.
        kept.push(line);
        continue;
      }
      // First non-blank, non-`%%` line: the leading block is over.
      inLeadingBlock = false;
    }
    kept.push(line);
  }

  return { fields, strippedCode: kept.join('\n') };
}

/** True when a line opens a Mermaid init directive (`%%{ … }%%`). */
const isInitDirectiveStart = (line: string): boolean => line.trimStart().startsWith('%%{');

/** True when a line is a YAML frontmatter fence (`---`). */
const isFrontmatterFence = (line: string): boolean => line.trim() === '---';

/** True when a line is an ordinary Mermaid comment (`%%`, not an init directive). */
const isComment = (line: string): boolean => {
  const t = line.trimStart();
  return t.startsWith('%%') && !t.startsWith('%%{');
};

/**
 * Find the index of the diagram-type declaration line — the first "statement"
 * line, reached by skipping any leading blank lines, a `---` frontmatter block,
 * a `%%{ … }%%` init directive (single- or multi-line), and ordinary `%%`
 * comments. Returns the last line index as a safe fallback when the source is
 * nothing but skippable prefix (so injection still appends rather than throws).
 */
function declarationIndex(lines: string[]): number {
  let i = 0;
  for (;;) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    if (isFrontmatterFence(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !isFrontmatterFence(lines[j])) j++;
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }
    if (isInitDirectiveStart(lines[i])) {
      let j = i;
      while (j < lines.length && !lines[j].includes('}%%')) j++;
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }
    if (isComment(lines[i])) {
      i++;
      continue;
    }
    break; // `lines[i]` is the declaration line.
  }
  return i < lines.length ? i : Math.max(0, lines.length - 1);
}

/**
 * Belt-and-suspenders (DR-6): strip any `%%{`/`}%%` sequence a crafted
 * `title`/`description` might carry — the sequence that opens/closes a Mermaid
 * init directive — so an interpolated value can never smuggle one into the
 * generated `accTitle:`/`accDescr:` line, and collapse any run of whitespace/
 * control characters to a single space. A newline is already unreachable here
 * (`META_LINE` only ever captures a single line's worth of value), but this
 * guards defensively against any future caller that skips that regex. The
 * accessible text otherwise passes through intact.
 */
function sanitizeAccValue(value: string): string {
  return value
    .replace(/%%\{|\}%%/g, '')
    // eslint-disable-next-line no-control-regex -- intentional: collapses whitespace/control characters (see comment above).
    .replace(/[\s\x00-\x1f\x7f]+/g, ' ')
    .trim();
}

/**
 * Inject Mermaid `accTitle`/`accDescr` accessibility statements after the
 * diagram-type declaration line.
 *
 * `accTitle` (the accessible NAME) is `title`, falling back to `description`
 * when `title` is absent, so any metadata at all names the SVG. `accDescr` (the
 * accessible DESCRIPTION) is `description`, omitted when there is none. With no
 * name available (neither field) the source is returned unchanged.
 */
export function injectAccStatements(code: string, fields: DiagramMeta): string {
  const name = fields.title ?? fields.description;
  if (name === undefined) return code;

  const inject: string[] = [`accTitle: ${sanitizeAccValue(name)}`];
  if (fields.description !== undefined) {
    inject.push(`accDescr: ${sanitizeAccValue(fields.description)}`);
  }

  const lines = code.split('\n');
  const at = declarationIndex(lines);
  lines.splice(at + 1, 0, ...inject);
  return lines.join('\n');
}

/**
 * Project the caption shape the rehype `<figcaption>` is built from. `title`
 * feeds the accessible name only, so it is deliberately excluded; each of
 * `description`/`attribution`/`source` is carried through only when present.
 */
export function figureFields(fields: DiagramMeta): FigureFields {
  const out: FigureFields = {};
  if (fields.description !== undefined) out.description = fields.description;
  if (fields.attribution !== undefined) out.attribution = fields.attribution;
  if (fields.source !== undefined) out.source = fields.source;
  return out;
}

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * FR-003 (issue 134): no module builds a page address from an id by hand.
 *
 * A page id maps to a route through `routeOfSlug` in `vocabulary-core.mjs`
 * alone (it strips a trailing `/index` and maps the root ids to `/`). A
 * hand-built `/${id}/` skips those rules and advertises an address the site
 * does not serve, which is how issue 134 happened on seven surfaces. The guard
 * fails on any template literal ending in `/${…}/`, whatever the identifier.
 * There is no allow-list: code that builds something else (a base prefix, a
 * `page.pathname`) is written so it does not have that shape.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCANNED_DIRS = ['lib', 'layouts', 'components'];
const EXTENSIONS = new Set(['.ts', '.mjs', '.astro']);
/** The one module that owns the route rule. */
const RULE_OWNER = path.join(SRC, 'lib', 'vocabulary-core.mjs');

/** A template literal that ends in an interpolated path segment: `/${x}/` or `${base}/${x}/`. */
const HAND_BUILT_ADDRESS = /[`}]\/\$\{[^}]*\}\/`/g;

/** Characters after which a `/` starts a regular expression rather than a division. */
const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

/**
 * Blank out comments in JavaScript or TypeScript source, keeping line breaks and
 * every string, template and regular-expression literal intact. Quote characters
 * inside a regex or template must not start a phantom string, which is why this
 * is a scanner and not a regex over the text.
 */
function blankComments(source: string): string {
  let out = '';
  let prev = ''; // last significant character, for regex detection
  let i = 0;
  const n = source.length;
  /** Template nesting: each entry is the brace depth of an open `${`. */
  const templates: number[] = [];
  let braceDepth = 0;
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ');

  const readQuoted = (quote: string): void => {
    out += source[i++];
    while (i < n && source[i] !== quote && source[i] !== '\n') {
      if (source[i] === '\\') out += source[i++];
      if (i < n) out += source[i++];
    }
    if (i < n && source[i] === quote) out += source[i++];
    prev = quote;
  };

  /** Read template text up to its closing backtick or an opening `${`. */
  const readTemplateText = (): void => {
    while (i < n) {
      const ch = source[i];
      if (ch === '\\') {
        out += source[i++];
        if (i < n) out += source[i++];
      } else if (ch === '`') {
        out += source[i++];
        prev = '`';
        return;
      } else if (ch === '$' && source[i + 1] === '{') {
        out += '${';
        i += 2;
        templates.push(braceDepth);
        braceDepth += 1;
        prev = '{';
        return;
      } else {
        out += source[i++];
      }
    }
  };

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (ch === "'" || ch === '"') {
      readQuoted(ch);
    } else if (ch === '`') {
      out += source[i++];
      readTemplateText();
    } else if (ch === '/' && REGEX_PRECEDERS.has(prev)) {
      out += source[i++];
      let inClass = false;
      while (i < n && source[i] !== '\n' && (inClass || source[i] !== '/')) {
        if (source[i] === '\\') out += source[i++];
        else if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        if (i < n) out += source[i++];
      }
      if (i < n && source[i] === '/') out += source[i++];
      prev = '/';
    } else {
      if (ch === '{') braceDepth += 1;
      if (ch === '}') {
        braceDepth -= 1;
        if (templates.length > 0 && templates[templates.length - 1] === braceDepth) {
          templates.pop();
          out += source[i++];
          readTemplateText();
          continue;
        }
      }
      out += ch;
      if (!/\s/.test(ch)) prev = ch;
      i += 1;
    }
  }
  return out;
}

/**
 * The code of one source file with its comments blanked. An `.astro` file keeps
 * its markup as it is (apart from HTML comments): prose there holds apostrophes
 * and URLs that are not JavaScript. Only its front matter is scanned as code.
 */
function codeOf(file: string, source: string): string {
  if (!file.endsWith('.astro')) return blankComments(source);
  const noHtmlComments = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const fence = /^---\s*\n([\s\S]*?)\n---/.exec(noHtmlComments);
  if (!fence) return noHtmlComments;
  const front = fence[0];
  return front.replace(fence[1], blankComments(fence[1])) + noHtmlComments.slice(front.length);
}

/** Every hand-built address in one file, as `file:line  text`. */
function handBuiltAddresses(file: string, source: string): string[] {
  const code = codeOf(file, source);
  const hits: string[] = [];
  for (const match of code.matchAll(HAND_BUILT_ADDRESS)) {
    const line = code.slice(0, match.index).split('\n').length;
    hits.push(`${file}:${line}  ${match[0]}`);
  }
  return hits;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return EXTENSIONS.has(path.extname(entry.name)) && full !== RULE_OWNER ? [full] : [];
  });
}

describe('no hand-built page address (FR-003, issue 134)', () => {
  it('flags a planted hand-built address, in a .ts file and in an .astro front matter', () => {
    expect(handBuiltAddresses('planted.ts', 'const a = `/${entry.slug}/`;\n')).toHaveLength(1);
    expect(handBuiltAddresses('planted.ts', 'const a = `${base}/${id}/`;\n')).toHaveLength(1);
    expect(handBuiltAddresses('planted.astro', '---\nconst a = `/${card.ref}/`;\n---\n<a />\n')).toHaveLength(1);
    expect(handBuiltAddresses('planted.astro', '---\n---\n<a href={`/${card.ref}/`} />\n')).toHaveLength(1);
  });

  it('does not flag the same text in a comment, nor an unrelated template (positive control)', () => {
    const commented = [
      '// `/${entry.slug}/` in a line comment',
      '/** and in a block comment: `/${p.slug}/` */',
      "const url = 'https://x.example/'; // `/${id}/`",
      'const pattern = /["\'`]/; const ok = `./${name}/`;',
      'const asset = `/${name}.svg`;',
    ].join('\n');
    expect(handBuiltAddresses('planted.ts', commented)).toEqual([]);
    expect(handBuiltAddresses('planted.astro', '<!-- `/${card.ref}/` -->\n<p>don\'t</p>\n')).toEqual([]);
  });

  it('finds no hand-built address under src/lib, src/layouts and src/components', () => {
    const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(path.join(SRC, dir)));
    // The scan is not vacuous: it reaches every kind of file it is meant to cover.
    expect(files.some((f) => f.endsWith('metadata.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('route-shaping.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('Hub.astro'))).toBe(true);
    expect(files.some((f) => f.endsWith(path.join('slots', 'Related.astro')))).toBe(true);
    expect(files).not.toContain(RULE_OWNER);

    const hits = files.flatMap((file) =>
      handBuiltAddresses(path.relative(SRC, file), readFileSync(file, 'utf8')),
    );
    expect(hits, `Build page addresses with routeOfSlug (or hrefOfSlug), not by hand:\n${hits.join('\n')}`).toEqual([]);
  });
});

/**
 * Compile JSON schemas and content into Markdown pages.
 *
 * JSON stays in the source folder. The output folder is a generated section:
 * only pages stamped by this producer are written or removed. An unstamped
 * file, a symlink, a reserved section name, or a source that overlaps the
 * output stops the run before any write. Schema files become `type: JSON Schema`
 * pages. Any other JSON document becomes `type: JSON Content` when it fits one
 * of those schemas. A document that fits none, or that fits two schemas
 * equally well, stops the run before the output folder is touched. Hubs list
 * their children.
 *
 * A Markdown file beside a JSON file (`x.md` next to `x.json`, same folder)
 * is copied onto the generated page as Extra Information. On a schema page
 * it follows the Required line. On a content page it follows the source-file line.
 * Each JSON file is also copied to `public/json-files/` and the source line
 * links there. The OKF export of an artifact is `type: Schematic` and names
 * that file in `resource`. The OKF body keeps Extra Information and links to
 * other concepts, and omits the field lists the JSON already carries.
 * Long strings in the drawing wrap onto several lines. The JSON block stays
 * the original document.
 *
 * @module json-schema/generate
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  statSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { compareCodeUnit, formatInstant, readmeToIndexId } from '../vocabulary-core.mjs';
import { JSON_SCHEMA_PRODUCER, isRegenerableStamp, makeStamp, serializeStamp } from '../generator-stamp.mjs';

const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 180;
const LOG = '[dk-json-schema]';

/** JSON directory relative to the project root when `source` is omitted. */
export const DEFAULT_JSON_SCHEMA_SOURCE = 'json-files';

/** Output folder relative to the docs root when `out` is omitted. */
export const DEFAULT_JSON_SCHEMA_OUT = 'json-files-output';

/**
 * How PlantUML draws one JSON document.
 * `json` is the `@startjson` tree. `uml` is the class-diagram `json` box.
 */
/** @type {readonly ['json', 'uml']} */
export const JSON_GRAPH_TYPES = Object.freeze(['json', 'uml']);

/** Drawing used when `graph` is omitted. */
export const DEFAULT_JSON_GRAPH = 'json';

/**
 * Longest line in a JSON drawing. PlantUML 1.2026 draws a JSON string as one
 * line, and a real newline is shown as the two characters `\n`. The two
 * characters `\` and `n` are what make it break the line.
 */
const JSON_DIAGRAM_WRAP = 48;

/**
 * Site path, under `public/`, where each source JSON is published.
 * The human page links `/json-files/<path>`, and the OKF bundle stores the
 * same path so the catalogue can open the file.
 */
export const JSON_PUBLIC_DIR = 'json-files';

/**
 * First path segments `out` may not use. Authored sections, the glossary, and
 * the Gherkin default. `json-files-output` itself is the generated section, so it is
 * absent here. Kept in step with `SECTION_ORDER` minus `json-files-output`.
 */
export const RESERVED_JSON_SCHEMA_SECTIONS = Object.freeze([
  '_meta',
  'glossary',
  'behaviour',
  'context',
  'architecture',
  'adr',
  'plans',
  'api',
  'configuration',
  'integrations',
  'security',
  'guides',
  'operations',
  'migrations',
  'changelog',
  'presentations',
]);

/**
 * @param {string} message
 * @returns {Error}
 */
function fail(message) {
  return new Error(`${LOG} ${message}`);
}

/**
 * Nearest existing ancestor of `target`, used so a not-yet-created output
 * folder can still be checked against the real docs tree.
 *
 * @param {string} target
 * @returns {string}
 */
function existingAncestor(target) {
  let current = path.resolve(target);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

/**
 * Resolve `target` through the real path of its nearest existing ancestor.
 *
 * @param {string} target
 * @returns {string}
 */
function resolveReal(target) {
  const resolved = path.resolve(target);
  const anchor = existingAncestor(resolved);
  const suffix = path.relative(anchor, resolved);
  return path.resolve(realpathSync(anchor), suffix);
}

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function pathContains(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Refuse an output folder that is not a real directory inside the docs tree,
 * uses a reserved section name, or overlaps the JSON source.
 *
 * @param {string} docsRoot
 * @param {string} outDir
 * @param {string} [sourceDir]
 */
export function assertJsonSchemaOutDir(docsRoot, outDir, sourceDir) {
  const docs = resolveReal(docsRoot);
  const out = path.resolve(outDir);
  if (existsSync(out) && lstatSync(out).isSymbolicLink()) {
    throw fail(`output folder must not be a symlink: ${out}`);
  }
  const resolved = resolveReal(out);
  const rel = path.relative(docs, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw fail(`output folder must be a directory inside the docs tree, not "${out}"`);
  }
  const top = rel.split(path.sep)[0];
  if (RESERVED_JSON_SCHEMA_SECTIONS.includes(top)) {
    throw fail(
      `output folder "${top}" is a reserved section; choose another folder inside the docs tree ` +
        `(default ${DEFAULT_JSON_SCHEMA_OUT})`,
    );
  }
  if (sourceDir !== undefined && existsSync(sourceDir)) {
    const source = realpathSync(path.resolve(sourceDir));
    if (pathContains(resolved, source) || pathContains(source, resolved)) {
      throw fail(`JSON source ${source} overlaps the output folder ${resolved}`);
    }
  }
}

/**
 * Markdown beside a JSON file: `x.md` in the same folder as `x.json`.
 * The text is author prose for the generated page. A symlink is refused
 * so the note cannot point outside the source tree.
 *
 * @param {string} jsonAbs
 * @returns {string}
 */
function sidecarNote(jsonAbs) {
  const base = path.basename(jsonAbs);
  if (!base.endsWith('.json')) return '';
  const noteAbs = path.join(path.dirname(jsonAbs), `${base.slice(0, -'.json'.length)}.md`);
  if (!existsSync(noteAbs)) return '';
  const st = lstatSync(noteAbs);
  if (st.isSymbolicLink()) throw fail(`sidecar must not be a symlink: ${noteAbs}`);
  if (!st.isFile()) throw fail(`sidecar is not a file: ${noteAbs}`);
  return readFileSync(noteAbs, 'utf8').replace(/\r\n/g, '\n');
}

/**
 * @param {string} rel JSON path relative to the source
 * @returns {string} site path served from `public/json-files`
 */
export function jsonPublicHref(rel) {
  return `/${JSON_PUBLIC_DIR}/${rel.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

/**
 * @param {string} rel JSON path relative to the source
 * @returns {string[]}
 */
function sourceBlock(rel) {
  return [`Source file: [${escapeLabel(rel)}](${jsonPublicHref(rel)}).`, ''];
}

/** Bounds of the author note. The OKF export keeps this span, including its headings. */
export const EXTRA_START = '<!-- dk-extra-start -->';
export const EXTRA_END = '<!-- dk-extra-end -->';

/**
 * @param {string} note companion Markdown, or empty
 * @returns {string[]}
 */
function extraBlock(note) {
  const text = note.trim();
  if (text === '') return [];
  return ['## Extra Information', '', EXTRA_START, text, EXTRA_END, ''];
}

/**
 * @param {string} sourceDir
 * @returns {{ abs: string, rel: string, mtime: Date, text: string, note: string }[]}
 */
function readJsonFiles(sourceDir) {
  const root = path.resolve(sourceDir);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    throw fail(`JSON source is not a directory: ${root}`);
  }
  /** @type {{ abs: string, rel: string, mtime: Date, text: string, note: string }[]} */
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const abs = path.join(dir, name);
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        let directory = false;
        try {
          directory = statSync(abs).isDirectory();
        } catch {
          directory = false;
        }
        if (name.endsWith('.json') || directory) {
          console.warn(`${LOG} skipping symlink ${rel}; JSON behind a symlink is not read`);
        }
        continue;
      }
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      files.push({
        abs,
        rel: path.relative(root, abs).split(path.sep).join('/'),
        mtime: st.mtime,
        text: readFileSync(abs, 'utf8'),
        note: sidecarNote(abs),
      });
    }
  };
  walk(root);
  files.sort((a, b) => compareCodeUnit(a.rel, b.rel));
  return files;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function jsonPageSlug(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug === '' || slug === 'index' || slug === 'log') {
    throw fail(`"${value}" cannot be a page name`);
  }
  return slug;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function fitDescription(text) {
  let value = text.replace(/\s+/g, ' ').trim();
  const pad = 'Generated from a JSON file.';
  while (value.length < DESCRIPTION_MIN) value = `${value} ${pad}`.trim();
  if (value.length > DESCRIPTION_MAX) {
    const sliced = value.slice(0, DESCRIPTION_MAX);
    const cut = sliced.lastIndexOf(' ');
    value = cut >= DESCRIPTION_MIN ? sliced.slice(0, cut) : sliced;
  }
  return value;
}

/**
 * @param {string} fileName
 * @returns {string}
 */
function schemaStem(fileName) {
  const base = fileName.slice(fileName.lastIndexOf('/') + 1);
  return base.replace(/\.schema\.json$/i, '').replace(/\.json$/i, '');
}

/**
 * A JSON Schema document: a `*.schema.json` file, or a document that points at
 * the JSON Schema meta-schema and carries schema keywords. A content file may
 * point `$schema` at one of these files; that pointer does not make it a schema.
 *
 * @param {unknown} data
 * @param {string} rel
 * @returns {boolean}
 */
function isSchemaDocument(data, rel) {
  if (rel.endsWith('.schema.json')) return true;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
  const record = /** @type {Record<string, unknown>} */ (data);
  const schemaUrl = typeof record.$schema === 'string' ? record.$schema : '';
  if (!/json-schema\.org/i.test(schemaUrl)) return false;
  return ['properties', '$defs', 'definitions', 'allOf', 'anyOf', 'oneOf', 'patternProperties'].some(
    (key) => record[key] !== undefined,
  );
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function jsonTypeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

/**
 * @param {unknown} value
 * @param {unknown} type
 * @returns {boolean}
 */
function matchesType(value, type) {
  const types = Array.isArray(type) ? type : [type];
  const actual = jsonTypeOf(value);
  return types.some((name) => name === actual || (name === 'number' && actual === 'integer'));
}

/**
 * Does `data` satisfy `schema`? Covers the keywords these pages use: type,
 * required, properties, additionalProperties, items, enum, const, and
 * allOf/anyOf/oneOf. An unknown keyword does not reject the document.
 *
 * @param {unknown} data
 * @param {unknown} schema
 * @returns {boolean}
 */
export function fitsJsonSchema(data, schema) {
  if (schema === true) return true;
  if (schema === false) return false;
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return false;
  const spec = /** @type {Record<string, unknown>} */ (schema);
  if (Object.prototype.hasOwnProperty.call(spec, 'const') && JSON.stringify(data) !== JSON.stringify(spec.const)) {
    return false;
  }
  if (Array.isArray(spec.enum) && !spec.enum.some((item) => JSON.stringify(item) === JSON.stringify(data))) return false;
  if (spec.type !== undefined && !matchesType(data, spec.type)) return false;
  if (typeof data === 'string') {
    if (typeof spec.minLength === 'number' && data.length < spec.minLength) return false;
    if (typeof spec.maxLength === 'number' && data.length > spec.maxLength) return false;
  }
  if (typeof data === 'number') {
    if (typeof spec.minimum === 'number' && data < spec.minimum) return false;
    if (typeof spec.maximum === 'number' && data > spec.maximum) return false;
  }
  if (Array.isArray(data)) {
    if (typeof spec.minItems === 'number' && data.length < spec.minItems) return false;
    if (typeof spec.maxItems === 'number' && data.length > spec.maxItems) return false;
    if (spec.items !== null && typeof spec.items === 'object' && !Array.isArray(spec.items)) {
      if (!data.every((item) => fitsJsonSchema(item, spec.items))) return false;
    }
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const record = /** @type {Record<string, unknown>} */ (data);
    const props =
      spec.properties !== null && typeof spec.properties === 'object' && !Array.isArray(spec.properties)
        ? /** @type {Record<string, unknown>} */ (spec.properties)
        : {};
    const required = Array.isArray(spec.required) ? spec.required.map(String) : [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return false;
    }
    if (spec.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) return false;
      }
    }
    for (const key of Object.keys(props)) {
      if (Object.prototype.hasOwnProperty.call(record, key) && !fitsJsonSchema(record[key], props[key])) return false;
    }
  }
  if (Array.isArray(spec.allOf) && !spec.allOf.every((part) => fitsJsonSchema(data, part))) return false;
  if (Array.isArray(spec.anyOf) && spec.anyOf.length > 0 && !spec.anyOf.some((part) => fitsJsonSchema(data, part))) {
    return false;
  }
  if (Array.isArray(spec.oneOf)) {
    const hits = spec.oneOf.filter((part) => fitsJsonSchema(data, part));
    if (hits.length !== 1) return false;
  }
  return true;
}

/**
 * How narrowly a schema describes an object. A content file that fits two
 * schemas uses the higher score. An equal score is ambiguous.
 *
 * @param {unknown} schema
 * @returns {number}
 */
function schemaSpecificity(schema) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return 0;
  const spec = /** @type {Record<string, unknown>} */ (schema);
  const props =
    spec.properties !== null && typeof spec.properties === 'object' && !Array.isArray(spec.properties)
      ? Object.keys(spec.properties).length
      : 0;
  const required = Array.isArray(spec.required) ? spec.required.length : 0;
  let score = props * 2 + required * 3;
  if (spec.type !== undefined) score += 1;
  if (spec.additionalProperties === false) score += 1;
  return score;
}

/**
 * A date or instant carried in JSON, as the UTC instant frontmatter requires.
 *
 * @param {string} value
 * @returns {string | null}
 */
function asInstant(value) {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00Z`;
  const match = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/);
  return match ? `${match[1]}Z` : null;
}

/**
 * @param {string} lang
 * @param {string} text
 * @returns {string}
 */
function fence(lang, text) {
  const body = text.trimEnd();
  const tick = body.includes('```') ? '~~~~' : '```';
  return `${tick}${lang}\n${body}\n${tick}\n`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function jsonFence(text) {
  return fence('json', text);
}

/**
 * Break one paragraph so each piece fits {@link JSON_DIAGRAM_WRAP}.
 * A space wins, then `_`, `/`, or `-`.
 *
 * @param {string} text
 * @returns {string[]}
 */
function wrapDiagramLine(text) {
  const lines = [];
  let rest = text.trim();
  while (rest.length > JSON_DIAGRAM_WRAP) {
    const window = rest.slice(0, JSON_DIAGRAM_WRAP + 1);
    let cut = -1;
    for (const sep of [' ', '_', '/', '-']) {
      const at = window.lastIndexOf(sep);
      if (at >= Math.floor(JSON_DIAGRAM_WRAP * 0.45)) {
        cut = sep === ' ' ? at : at + 1;
        break;
      }
    }
    if (cut < 1) cut = JSON_DIAGRAM_WRAP;
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest !== '' || lines.length === 0) lines.push(rest);
  return lines;
}

/**
 * @param {string} value
 * @returns {string}
 */
function diagramString(value) {
  if (value.length <= JSON_DIAGRAM_WRAP && !/[\r\n]/.test(value)) return value;
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((paragraph) => wrapDiagramLine(paragraph))
    .join('\\n');
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function diagramValue(value) {
  if (typeof value === 'string') return diagramString(value);
  if (Array.isArray(value)) return value.map(diagramValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, diagramValue(item)]));
  }
  return value;
}

/**
 * Pretty JSON for the drawing. A parse failure keeps the original text.
 *
 * @param {string} raw
 * @returns {string}
 */
function diagramBody(raw) {
  try {
    return JSON.stringify(diagramValue(JSON.parse(raw)), null, 2);
  } catch {
    return raw.trim();
  }
}

/**
 * A PlantUML drawing of the artifact.
 *
 * `json` opens with `@startjson`: a tree of nodes and arrows. The renderer
 * still wraps a fence in `@startuml` when the text does not already start
 * that way; PlantUML follows the inner `@startjson` and draws the tree.
 * `uml` is one `json` element inside that UML document, a class-diagram box.
 * String values longer than {@link JSON_DIAGRAM_WRAP} break onto more lines.
 * The JSON block elsewhere on the page stays the original document.
 *
 * @param {string} title
 * @param {string} raw
 * @param {'json' | 'uml'} graph
 * @returns {string}
 */
function jsonDiagram(title, raw, graph) {
  const meta = [`' title: ${title}`, `' description: JSON structure of ${title}.`];
  const body = diagramBody(raw);
  const source =
    graph === 'uml' ? [...meta, `json "Artifact" as J ${body}`] : [...meta, '@startjson', body, '@endjson'];
  return fence('plantuml', source.join('\n'));
}

/**
 * @param {string} label
 * @returns {string}
 */
function escapeLabel(label) {
  return label.replace(/[[\]]/g, '\\$&');
}

/**
 * @param {string} href relative markdown path the link rewriter understands
 * @param {string} title
 * @returns {string}
 */
const pageLink = (href, title) => `[${escapeLabel(title)}](${href})`;

/**
 * Link from one generated page to another. Root-absolute `/…md` hrefs are
 * ignored by `resolveRelativeDocLink`, so the href stays relative to the page.
 *
 * @param {string} fromRel page path under the output folder
 * @param {string} toRel page path under the output folder
 * @returns {string}
 */
function relativeHref(fromRel, toRel) {
  const fromDir = path.posix.dirname(fromRel);
  const href = path.posix.relative(fromDir === '.' ? '' : fromDir, toRel);
  return href.startsWith('.') ? href : `./${href}`;
}

/**
 * One property value as a short inline list.
 *
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value) {
  if (value === null) return '`null`';
  if (typeof value === 'string') return `\`${value.replace(/`/g, "'")}\``;
  if (typeof value === 'number' || typeof value === 'boolean') return `\`${String(value)}\``;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return `\`${item.replace(/`/g, "'")}\``;
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const record = /** @type {Record<string, unknown>} */ (item);
          const label = ['title', 'name', 'id'].map((key) => record[key]).find((text) => typeof text === 'string' && text.trim() !== '');
          const explanation = explanationOf(item);
          if (typeof label === 'string') {
            const shown = `\`${label.replace(/`/g, "'")}\``;
            return explanation === '' ? shown : `${shown} (${explanation})`;
          }
          return explanation;
        }
        return '';
      })
      .filter((part) => part !== '')
      .join(', ');
  }
  if (typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    return Object.keys(record)
      .sort(compareCodeUnit)
      .map((key) => {
        const item = record[key];
        return typeof item === 'string' ? `\`${key}\` = \`${item.replace(/`/g, "'")}\`` : `\`${key}\``;
      })
      .join(', ');
  }
  return '';
}

/**
 * Content body: the source line, any companion note, the properties the
 * document actually carries (with the schema's description), then the diagram
 * and the JSON.
 *
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} schema
 * @param {string} title
 * @param {string} rel JSON path relative to the source
 * @param {string} raw
 * @param {boolean} diagrams include the PlantUML fence
 * @param {'json' | 'uml'} graph PlantUML drawing of the JSON
 * @param {string} note companion Markdown, or empty
 * @returns {string[]}
 */
function contentSummary(data, schema, title, rel, raw, diagrams, graph, note) {
  /** @type {string[]} */
  const lines = [...sourceBlock(rel), ...extraBlock(note)];
  const properties =
    schema.properties !== null && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? /** @type {Record<string, unknown>} */ (schema.properties)
      : null;
  if (properties) {
    const present = Object.keys(properties)
      .filter((key) => Object.prototype.hasOwnProperty.call(data, key))
      .sort(compareCodeUnit);
    if (present.length > 0) {
      lines.push('## Properties', '');
      for (const key of present) {
        const explanation = explanationOf(properties[key]);
        const shown = formatValue(data[key]);
        if (shown !== '' && explanation !== '') lines.push(`- \`${key}\`: ${shown} — ${explanation}`);
        else if (shown !== '') lines.push(`- \`${key}\`: ${shown}`);
        else if (explanation !== '') lines.push(`- \`${key}\`: ${explanation}`);
        else lines.push(`- \`${key}\``);
      }
      lines.push('');
    }
  }
  if (diagrams) lines.push('## Diagram', '', jsonDiagram(title, raw, graph));
  lines.push('## Artifact', '', jsonFence(raw));
  return lines;
}

/**
 * Text that explains a property or list item, when the JSON carries one.
 * JSON Schema properties and content-list objects use `description`.
 *
 * @param {unknown} value
 * @returns {string}
 */
function explanationOf(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return '';
  const text = /** @type {Record<string, unknown>} */ (value).description;
  if (typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ').replace(/`/g, "'");
}

/**
 * @param {string} name
 * @param {unknown} value
 * @returns {string}
 */
function namedListItem(name, value) {
  const explanation = explanationOf(value);
  return explanation === '' ? `- \`${name}\`` : `- \`${name}\`: ${explanation}`;
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} rel
 * @param {string} raw
 * @param {boolean} diagrams include the PlantUML fence
 * @param {'json' | 'uml'} graph PlantUML drawing of the JSON
 * @param {string} note companion Markdown, or empty
 * @returns {string[]}
 */
function schemaSummary(data, rel, raw, diagrams, graph, note) {
  const lines = [...sourceBlock(rel)];
  if (typeof data.description === 'string' && data.description.trim() !== '') {
    lines.push(data.description.trim(), '');
  }
  const required = Array.isArray(data.required) ? data.required.map(String) : [];
  if (required.length > 0) lines.push(`Required: ${required.sort(compareCodeUnit).map((n) => `\`${n}\``).join(', ')}.`, '');
  lines.push(...extraBlock(note));
  const properties = data.properties;
  if (properties !== null && typeof properties === 'object' && !Array.isArray(properties)) {
    lines.push('## Properties', '');
    for (const key of Object.keys(properties).sort(compareCodeUnit)) {
      lines.push(namedListItem(key, /** @type {Record<string, unknown>} */ (properties)[key]));
    }
    lines.push('');
  }
  if (diagrams) {
    const diagramTitle = typeof data.title === 'string' && data.title.trim() !== '' ? data.title.trim() : schemaStem(rel);
    lines.push('## Diagram', '', jsonDiagram(diagramTitle, raw, graph));
  }
  lines.push('## Schema', '', jsonFence(raw));
  return lines;
}

/**
 * A date carried in the JSON, so `updated` does not follow the checkout mtime.
 *
 * @param {Record<string, unknown>} data
 * @returns {string | null}
 */
function jsonUpdated(data) {
  for (const key of ['updated', 'modified', 'last_updated']) {
    const value = data[key];
    if (typeof value !== 'string') continue;
    const instant = asInstant(value);
    if (instant) return instant;
  }
  return null;
}

/**
 * @param {object} page
 * @param {{ by: string, at: string, content_hash: string }} stamp
 * @returns {string}
 */
function renderPage(page, stamp) {
  const lines = [
    `title: ${JSON.stringify(page.title)}`,
    `description: ${JSON.stringify(page.description)}`,
    'doc_status: active',
    `updated: ${JSON.stringify(page.updated)}`,
    'record_kind: page',
    `kind: ${page.kind}`,
    `type: ${JSON.stringify(page.type)}`,
  ];
  if (page.related.length > 0) {
    lines.push('related:');
    for (const ref of page.related) lines.push(`  - ${JSON.stringify(ref)}`);
  }
  if (page.sources.length > 0) {
    lines.push('sources:');
    for (const source of page.sources) {
      lines.push(`  - resource: ${JSON.stringify(source.resource)}`);
      lines.push(`    title: ${JSON.stringify(source.title)}`);
    }
  }
  lines.push(...serializeStamp(stamp));
  return `---\n${lines.join('\n')}\n---\n\n${page.body.trimEnd()}\n`;
}

/**
 * @param {{ abs: string, rel: string, mtime: Date, text: string, note: string }[]} files
 * @param {string} sectionPrefix posix path of the output folder under the docs root
 * @param {boolean} diagrams include PlantUML fences
 * @param {'json' | 'uml'} graph PlantUML drawing of each JSON document
 * @returns {object[]}
 */
function planPages(files, sectionPrefix, diagrams, graph) {
  /** @type {{ file: { abs: string, rel: string, mtime: Date, text: string, note: string }, data: Record<string, unknown> }[]} */
  const parsed = [];
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(file.text);
    } catch (err) {
      throw fail(`${file.rel} is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw fail(`${file.rel} is not a JSON object`);
    parsed.push({ file, data: /** @type {Record<string, unknown>} */ (data) });
  }

  const schemaFiles = parsed.filter((item) => isSchemaDocument(item.data, item.file.rel));
  const instances = parsed.filter((item) => !isSchemaDocument(item.data, item.file.rel));

  const schemaPages = schemaFiles.map((item) => {
    const slug = jsonPageSlug(schemaStem(item.file.rel));
    const rel = `contract/${slug}.md`;
    const title = textField(item.data, 'title') || slug;
    const fileRel = `${sectionPrefix}/${rel}`;
    return {
      ...item,
      rel,
      title,
      docsSlug: readmeToIndexId(fileRel),
      bundleId: fileRel.replace(/\.mdx?$/i, ''),
    };
  });

  /**
   * Drop `$schema` before fitting so a relative pointer is not an extra property.
   *
   * @param {Record<string, unknown>} data
   * @returns {Record<string, unknown>}
   */
  const withoutPointer = (data) => {
    if (!Object.prototype.hasOwnProperty.call(data, '$schema')) return data;
    const copy = { ...data };
    delete copy.$schema;
    return copy;
  };

  /**
   * @param {{ file: { rel: string }, data: Record<string, unknown> }} instance
   * @returns {(typeof schemaFiles)[number]}
   */
  const matchSchema = (instance) => {
    const pointer = typeof instance.data.$schema === 'string' ? instance.data.$schema : '';
    const pointerPath = pointer.split('#')[0];
    const relativePointer = pointerPath !== '' && !/json-schema\.org/i.test(pointer) && !/^[a-z][a-z0-9+.-]*:/i.test(pointerPath);
    const subject = withoutPointer(instance.data);
    if (relativePointer) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(instance.file.rel), pointerPath));
      const named = schemaFiles.find((schema) => schema.file.rel === resolved);
      if (!named) throw fail(`${instance.file.rel} $schema "${pointer}" does not name a schema in the source`);
      if (!fitsJsonSchema(subject, named.data)) {
        throw fail(`${instance.file.rel} does not fit the schema it names (${named.file.rel})`);
      }
      return named;
    }
    const hits = schemaFiles.filter((schema) => fitsJsonSchema(subject, schema.data));
    if (hits.length === 0) throw fail(`${instance.file.rel} does not fit any JSON Schema`);
    hits.sort(
      (a, b) => schemaSpecificity(b.data) - schemaSpecificity(a.data) || compareCodeUnit(a.file.rel, b.file.rel),
    );
    if (hits.length > 1 && schemaSpecificity(hits[0].data) === schemaSpecificity(hits[1].data)) {
      throw fail(`${instance.file.rel} fits ${hits[0].file.rel} and ${hits[1].file.rel} equally; name one with $schema`);
    }
    return hits[0];
  };

  const contentPages = instances.map((item) => {
    const schema = matchSchema(item);
    const schemaPage = schemaPages.find((page) => page.file.rel === schema.file.rel);
    if (!schemaPage) throw fail(`${item.file.rel} matched a schema that has no page`);
    const folder = jsonPageSlug(schemaStem(schema.file.rel));
    const slug = jsonPageSlug(schemaStem(item.file.rel));
    const rel = `content/${folder}/${slug}.md`;
    const title = textField(item.data, 'title') || slug;
    const fileRel = `${sectionPrefix}/${rel}`;
    return { ...item, schema, schemaPage, rel, title, docsSlug: readmeToIndexId(fileRel), group: folder };
  });

  const seen = new Map();
  for (const artifact of [...schemaPages, ...contentPages]) {
    const previous = seen.get(artifact.rel);
    if (previous) throw fail(`${artifact.file.rel} and ${previous} both write ${artifact.rel}`);
    seen.set(artifact.rel, artifact.file.rel);
  }

  /** @type {object[]} */
  const pages = [];
  for (const artifact of schemaPages) {
    const body = [
      `# ${artifact.title}`,
      '',
      ...schemaSummary(artifact.data, artifact.file.rel, artifact.file.text, diagrams, graph, artifact.file.note),
    ].join('\n');
    pages.push({
      rel: artifact.rel,
      docsSlug: artifact.docsSlug,
      title: artifact.title,
      description: fitDescription(`JSON Schema ${artifact.title}.`),
      kind: 'Schematic',
      type: 'JSON Schema',
      updated: jsonUpdated(artifact.data),
      related: [],
      sources: [],
      body,
      group: 'contract',
    });
  }
  for (const artifact of contentPages) {
    const contract = artifact.schemaPage;
    const described = textField(artifact.data, 'description') || `JSON content that fits ${contract.title}.`;
    const summary = contentSummary(
      artifact.data,
      artifact.schema.data,
      artifact.title,
      artifact.file.rel,
      artifact.file.text,
      diagrams,
      graph,
      artifact.file.note,
    );
    pages.push({
      rel: artifact.rel,
      docsSlug: artifact.docsSlug,
      title: artifact.title,
      description: fitDescription(described),
      kind: 'Schematic',
      type: 'JSON Content',
      updated: jsonUpdated(artifact.data),
      related: [contract.docsSlug],
      sources: [{ resource: `/${contract.bundleId}.md`, title: contract.title }],
      body: [
        `# ${artifact.title}`,
        '',
        `Schema: ${pageLink(relativeHref(artifact.rel, contract.rel), contract.title)}.`,
        '',
        ...summary,
      ].join('\n'),
      group: artifact.group,
    });
  }

  const hub = (rel, title, description, type, children) => {
    const ordered = children.slice().sort((a, b) => compareCodeUnit(a.docsSlug, b.docsSlug));
    const links = ordered.map((child) => `- ${pageLink(relativeHref(rel, child.rel), child.title)}`);
    return {
      rel,
      docsSlug: readmeToIndexId(`${sectionPrefix}/${rel}`),
      title,
      description: fitDescription(description),
      kind: 'Hub',
      type,
      updated: null,
      childRels: ordered.map((child) => child.rel),
      related: [],
      sources: [],
      body: [
        `# ${title}`,
        '',
        'This folder is generated. Pages without the generator stamp are left in place and stop the run.',
        '',
        ...links,
        '',
      ].join('\n'),
      group: 'hub',
    };
  };

  const schemas = pages.filter((page) => page.group === 'contract');
  /** @type {object[]} */
  const hubs = [];
  if (schemas.length > 0) {
    hubs.push(
      hub(
        'contract/index.md',
        'Schema contract',
        'JSON Schema pages. Other JSON in the source becomes content when it fits one of these schemas.',
        'JSON Schema',
        schemas,
      ),
    );
  }
  /** @type {object[]} */
  const groupHubs = [];
  for (const schemaPage of schemaPages) {
    const children = pages.filter((page) => page.group === jsonPageSlug(schemaStem(schemaPage.file.rel)));
    if (children.length === 0) continue;
    groupHubs.push(
      hub(
        `content/${jsonPageSlug(schemaStem(schemaPage.file.rel))}/index.md`,
        `${schemaPage.title} content`,
        `JSON content that fits ${schemaPage.title}.`,
        'JSON Content',
        children,
      ),
    );
  }
  hubs.push(...groupHubs);
  if (groupHubs.length > 0) {
    hubs.push(
      hub(
        'content/index.md',
        'JSON content',
        'JSON content that validates against the schemas.',
        'JSON Content',
        groupHubs,
      ),
    );
  }
  const topChildren = hubs.filter((page) => page.rel === 'contract/index.md' || page.rel === 'content/index.md');
  hubs.push(
    hub(
      'index.md',
      'JSON files',
      'Generated pages for JSON schemas and the JSON content that fits them.',
      'JSON Schema',
      topChildren,
    ),
  );
  return [...pages, ...hubs].sort((a, b) => compareCodeUnit(a.rel, b.rel));
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} key
 * @returns {string}
 */
function textField(data, key) {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Hash of the page body and the frontmatter that is not the clock. `updated`
 * and the stamp stay out so an unchanged artifact keeps its date.
 *
 * @param {object} page
 * @returns {string}
 */
function pageHash(page) {
  return createHash('sha256')
    .update(
      [
        page.type,
        page.title,
        page.description,
        page.kind,
        page.related.join('|'),
        page.sources.map((source) => source.resource).join('|'),
        page.body,
      ].join('\n'),
    )
    .digest('hex');
}

/**
 * @param {string} contents
 * @returns {boolean}
 */
function isOwnedPage(contents) {
  try {
    return isRegenerableStamp(matter(contents).data?.generated?.by, JSON_SCHEMA_PRODUCER);
  } catch {
    return false;
  }
}

/**
 * @param {string} outDir
 * @returns {{ owned: string[], authored: string[] }}
 */
function scanOutputDir(outDir) {
  /** @type {string[]} */
  const owned = [];
  /** @type {string[]} */
  const authored = [];
  if (!existsSync(outDir)) return { owned, authored };
  if (lstatSync(outDir).isSymbolicLink()) return { owned, authored: ['.'] };
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(outDir, abs).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        authored.push(rel);
        continue;
      }
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.name.endsWith('.md') && isOwnedPage(readFileSync(abs, 'utf8'))) owned.push(rel);
      else authored.push(rel);
    }
  };
  walk(outDir);
  return { owned: owned.sort(compareCodeUnit), authored: authored.sort(compareCodeUnit) };
}

/**
 * @param {string} outDir
 * @param {string} rel
 */
function assertInside(outDir, rel) {
  const root = path.resolve(outDir);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw fail(`refusing to write ${rel}: it resolves outside the output folder`);
  }
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function pruneEmptyDirs(dir) {
  if (!existsSync(dir) || lstatSync(dir).isSymbolicLink()) return false;
  let empty = true;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      empty = false;
      continue;
    }
    if (entry.isDirectory() && !entry.isSymbolicLink() && pruneEmptyDirs(path.join(dir, entry.name))) continue;
    empty = false;
  }
  if (empty) rmdirSync(dir);
  return empty;
}

/**
 * Keep a previous `updated` when the content hash matches. Otherwise use the
 * JSON date, or the run date for a page that is new or changed.
 *
 * @param {object[]} pages
 * @param {Map<string, { updated?: string, generated?: { content_hash?: string, at?: string } }>} previous
 * @param {Date} now
 */
function assignUpdated(pages, previous, now) {
  const byRel = new Map(pages.map((page) => [page.rel, page]));
  for (const page of pages) {
    if (page.group === 'hub') continue;
    const hash = pageHash(page);
    const prior = previous.get(page.rel);
    const same = prior?.generated?.content_hash === `sha256:${hash.slice(0, 12)}`;
    if (page.updated == null && same && typeof prior?.updated === 'string') {
      page.updated = asInstant(prior.updated) ?? formatInstant(now);
    }
    if (page.updated == null) page.updated = formatInstant(now);
    page.hash = hash;
  }
  const pending = pages.filter((page) => page.group === 'hub');
  const ready = new Set(pages.filter((page) => page.group !== 'hub').map((page) => page.rel));
  while (pending.length > 0) {
    const index = pending.findIndex((page) => page.childRels.every((rel) => ready.has(rel)));
    if (index < 0) throw fail('generated hubs refer to each other in a cycle');
    const page = pending.splice(index, 1)[0];
    const dates = page.childRels.map((rel) => byRel.get(rel)?.updated).filter((date) => typeof date === 'string');
    page.hash = pageHash(page);
    const prior = previous.get(page.rel);
    const same = prior?.generated?.content_hash === `sha256:${page.hash.slice(0, 12)}`;
    if (dates.length === 0 && same && typeof prior?.updated === 'string') {
      page.updated = asInstant(prior.updated) ?? formatInstant(now);
    } else if (dates.length === 0) page.updated = formatInstant(now);
    else page.updated = dates.reduce((latest, date) => (date > latest ? date : latest));
    ready.add(page.rel);
  }
}

/**
 * Copy every source JSON into `public/json-files/`, replacing that folder.
 * The folder is generated. A symlink is refused so the copy cannot leave it.
 *
 * @param {{ rel: string, text: string }[]} files
 * @param {string} destDir absolute `public/json-files` directory
 */
export function publishJsonFiles(files, destDir) {
  const dest = path.resolve(destDir);
  if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) {
    throw fail(`JSON package folder must not be a symlink: ${dest}`);
  }
  rmSync(dest, { recursive: true, force: true });
  for (const file of files) {
    const parts = file.rel.split('/');
    if (parts.some((part) => part === '' || part === '.' || part === '..')) {
      throw fail(`refusing to publish ${file.rel}`);
    }
    const target = path.join(dest, ...parts);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.text);
  }
}

/**
 * Write one Markdown page per JSON file, plus hubs. Owned pages that
 * are no longer planned are removed. Unstamped files are refused.
 *
 * @param {object} options
 * @param {string} options.sourceDir directory of JSON schemas and content
 * @param {string} options.docsRoot docs tree that will contain the pages
 * @param {string} options.outDir folder inside `docsRoot`
 * @param {Date} [options.now] clock for a page whose content changed
 * @param {boolean} [options.diagrams] emit PlantUML fences (default true)
 * @param {'json' | 'uml'} [options.graph] PlantUML drawing (default `json`)
 * @returns {{ sources: string[], pages: number, written: string[], unchanged: string[], removed: string[], files: { rel: string, text: string }[] }}
 */
export function generateJsonSchemaPages({
  sourceDir,
  docsRoot,
  outDir,
  now = new Date(),
  diagrams = true,
  graph = DEFAULT_JSON_GRAPH,
}) {
  if (!JSON_GRAPH_TYPES.includes(graph)) {
    throw fail(`graph must be ${JSON_GRAPH_TYPES.map((name) => `"${name}"`).join(' or ')}`);
  }
  const files = readJsonFiles(sourceDir);
  assertJsonSchemaOutDir(docsRoot, outDir, sourceDir);
  const sectionPrefix = path.relative(resolveReal(path.resolve(docsRoot)), resolveReal(path.resolve(outDir)))
    .split(path.sep)
    .join('/');
  const pages = planPages(files, sectionPrefix, diagrams, graph);
  const { owned, authored } = scanOutputDir(outDir);
  if (authored.length > 0) {
    throw fail(
      `refusing to write into ${outDir}: ${authored.join(', ')} ` +
        `${authored.length === 1 ? 'is' : 'are'} not generated by ${JSON_SCHEMA_PRODUCER} ` +
        '(a generated section has a single owner, and a symlink always counts as authored)',
    );
  }

  /** @type {Map<string, { updated?: string, generated?: { content_hash?: string, at?: string } }>} */
  const previous = new Map();
  for (const rel of owned) {
    const data = matter(readFileSync(path.join(outDir, rel), 'utf8')).data;
    previous.set(rel, { updated: data.updated, generated: data.generated });
  }
  assignUpdated(pages, previous, now);

  const planned = new Set(pages.map((page) => page.rel));
  const removed = owned.filter((rel) => !planned.has(rel));
  for (const rel of [...planned, ...removed]) assertInside(outDir, rel);

  /** @type {string[]} */
  const written = [];
  /** @type {string[]} */
  const unchanged = [];
  for (const page of pages) {
    const prior = previous.get(page.rel);
    const text = renderPage(
      page,
      makeStamp({ producer: JSON_SCHEMA_PRODUCER, hash: page.hash, previous: prior?.generated, now }),
    );
    if (!isOwnedPage(text)) {
      throw fail(`internal error: ${page.rel} would not read back as generated by ${JSON_SCHEMA_PRODUCER}`);
    }
    const dest = path.join(outDir, ...page.rel.split('/'));
    if (existsSync(dest) && readFileSync(dest, 'utf8') === text) {
      unchanged.push(page.rel);
      continue;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${process.pid}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, dest);
    written.push(page.rel);
  }
  for (const rel of removed) unlinkSync(path.join(outDir, ...rel.split('/')));
  if (removed.length > 0) pruneEmptyDirs(outDir);

  return {
    sources: files.map((file) => file.abs),
    pages: pages.length,
    written,
    unchanged,
    removed,
    files: files.map((file) => ({ rel: file.rel, text: file.text })),
  };
}

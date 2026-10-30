// @ts-check
/**
 * `kind: Schematic` core (ADR-0067): load the JSON Schema file a page references and
 * turn it into a small render model. Pure of Astro and mdast, so the remark plugin,
 * the build-time publisher and the OKF export share one reading of the page.
 *
 * `schematic_path` is relative to the PROJECT ROOT (the Astro root), not the page, so
 * moving a page never breaks it. It must stay inside that root, symlinks included.
 *
 * @module schematic/core
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { parseAllDocuments } from 'yaml';

export const SCHEMATIC_KIND = 'Schematic';

/** Accepted extensions and the MIME type each is published with. */
export const SCHEMATIC_MIME = Object.freeze({
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
});

/** Headings the plugin adds; an authored heading of the same text wins. */
export const GENERATED_HEADINGS = Object.freeze(['Diagram', 'Properties', 'Source']);

/**
 * Where the referenced file is published: next to the page route, keeping its extension.
 * `/reference/events/lane/` -> `/reference/events/lane.yaml`.
 *
 * @param {string} route the page route, without base
 * @param {string} ext `.json`, `.yaml` or `.yml`
 * @returns {string}
 */
export function schematicPublishedPath(route, ext) {
  const stem = route.replace(/\/+$/, '');
  return `${stem === '' ? '/index' : stem}${ext.toLowerCase()}`;
}

/**
 * @typedef {object} Ctx
 * @property {string} page docs-relative page path, for error messages
 * @property {string} root absolute project root
 * @property {Map<string, any>} [cache] parsed documents by absolute path
 */

/**
 * @param {Ctx} ctx
 * @param {string} where the path or `$ref` at fault
 * @param {string} message
 * @returns {never}
 */
function fail(ctx, where, message) {
  throw new Error(`[dk-schematic] ${ctx.page}: "${where}" ${message}`);
}

/**
 * Resolve `rel` against `fromDir` and require the real file to sit inside the project root.
 *
 * @param {Ctx} ctx
 * @param {string} rel
 * @param {string} fromDir
 * @returns {string} absolute path of an existing file
 */
function resolveInside(ctx, rel, fromDir) {
  if (path.isAbsolute(rel)) fail(ctx, rel, 'must be relative to the project root');
  const root = realpathSync(ctx.root);
  // `fromDir` sits under the root as spelled; compare against its real path so a symlinked project root does not fail.
  const abs = path.resolve(existsSync(fromDir) ? realpathSync(fromDir) : fromDir, rel);
  const inside = (/** @type {string} */ p) => p === root || p.startsWith(root + path.sep);
  if (!inside(abs)) fail(ctx, rel, 'is outside the project root');
  if (!existsSync(abs)) fail(ctx, rel, 'does not exist');
  const real = realpathSync(abs);
  if (!inside(real)) fail(ctx, rel, 'is outside the project root');
  return real;
}

/**
 * Parse one JSON or YAML file. YAML uses the core schema without merge keys, and a
 * multi-document file is refused.
 *
 * @param {Ctx} ctx
 * @param {string} abs
 * @param {string} where
 * @returns {any}
 */
function loadDoc(ctx, abs, where) {
  ctx.cache ??= new Map();
  if (ctx.cache.has(abs)) return ctx.cache.get(abs);
  const ext = path.extname(abs).toLowerCase();
  if (!Object.hasOwn(SCHEMATIC_MIME, ext)) fail(ctx, where, 'must be a .json, .yaml or .yml file');
  const text = readFileSync(abs, 'utf8');
  let doc;
  try {
    if (ext === '.json') doc = JSON.parse(text);
    else {
      const docs = parseAllDocuments(text, { schema: 'core', merge: false });
      if (docs.length !== 1) throw new Error(`holds ${docs.length} YAML documents, expected one`);
      if (docs[0].errors.length > 0) throw docs[0].errors[0];
      doc = docs[0].toJS();
    }
  } catch (error) {
    fail(ctx, where, `cannot be parsed: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
  }
  ctx.cache.set(abs, doc);
  return doc;
}

/** @param {unknown} v */
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** True for a mapping that looks like a JSON Schema document. */
const isSchemaDocument = (/** @type {any} */ d) =>
  isMap(d) && ['type', 'properties', '$defs', 'definitions', 'allOf', 'oneOf', 'anyOf'].some((k) => k in d);

/**
 * @typedef {object} Loaded
 * @property {string} abs absolute path of the schema file
 * @property {string} rel project-relative POSIX path (the `Source` text)
 * @property {string} ext
 * @property {string} text the file's bytes as text
 * @property {any} doc
 * @property {Ctx} ctx
 */

/**
 * Read the file a `schematic_path` names. Throws a `[dk-schematic]` error naming the
 * page and the path when it is missing, unreadable, outside the root, or not a schema.
 *
 * @param {string} page docs-relative page path
 * @param {unknown} schematicPath the frontmatter value
 * @param {string} root absolute project root
 * @returns {Loaded}
 */
export function loadSchematic(page, schematicPath, root) {
  /** @type {Ctx} */
  const ctx = { page, root };
  if (typeof schematicPath !== 'string' || schematicPath.trim() === '') {
    fail(ctx, String(schematicPath), 'schematic_path must name a file');
  }
  const abs = resolveInside(ctx, schematicPath.trim(), root);
  const doc = loadDoc(ctx, abs, schematicPath);
  if (!isSchemaDocument(doc)) {
    fail(ctx, schematicPath, 'is not a single JSON Schema document (no type, properties, $defs, definitions, allOf, oneOf or anyOf)');
  }
  return {
    abs,
    rel: path.relative(realpathSync(root), abs).split(path.sep).join('/'),
    ext: path.extname(abs).toLowerCase(),
    text: readFileSync(abs, 'utf8'),
    doc,
    ctx,
  };
}

/**
 * @typedef {{ schema: any, file: string, key: string, name: string }} Target
 * @typedef {{ external: string }} External
 */

/**
 * Follow one `$ref` from `file`. `#/…` is a JSON pointer into the same document; a
 * relative path (optionally with `#/…`) names a sibling `.json`/`.yaml` file inside the
 * root; a URL is not fetched.
 *
 * @param {Ctx} ctx
 * @param {string} ref
 * @param {string} file absolute path of the document that holds the `$ref`
 * @returns {Target | External}
 */
export function resolveRef(ctx, ref, file) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return { external: ref };
  const hash = ref.indexOf('#');
  const filePart = hash < 0 ? ref : ref.slice(0, hash);
  const pointer = hash < 0 ? '' : ref.slice(hash + 1);
  const abs = filePart === '' ? file : resolveInside(ctx, filePart, path.dirname(file));
  let node = loadDoc(ctx, abs, filePart || ref);
  if (pointer !== '' && !pointer.startsWith('/')) fail(ctx, ref, 'is not a JSON pointer ($ref "#/…")');
  const segments = pointer === '' ? [] : pointer.slice(1).split('/');
  const decode = (/** @type {string} */ raw) => decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
  for (const raw of segments) {
    const seg = decode(raw);
    if (!isMap(node) && !Array.isArray(node)) fail(ctx, ref, 'does not resolve');
    if (!Object.hasOwn(node, seg)) fail(ctx, ref, 'does not resolve');
    node = node[seg];
  }
  if (!isMap(node)) fail(ctx, ref, 'does not resolve to a schema');
  const name = (segments.length > 0 ? decode(segments.at(-1) ?? '') : '') || path.basename(abs).replace(/\.(schema\.)?(json|ya?ml)$/i, '');
  return { schema: node, file: abs, key: `${abs}#${pointer}`, name };
}

/**
 * @typedef {string | { def: string, label: string } | { href: string }} Segment a type fragment: text, an in-page def, a URL
 * @typedef {{ name: string, required: boolean, type: Segment[], description: string, children: Property[] }} Property
 * @typedef {{ label: string, anchor: string, description: string, properties: Property[] }} Def
 * @typedef {{ title: string, description: string, properties: Property[], defs: Def[] }} Model
 */

/**
 * Build the render model: root title and description, the property list, and one
 * sub-section per `$ref`'d object type. A type met twice (a cycle, or two properties
 * sharing a def) is rendered once and linked after that.
 *
 * @param {Loaded} loaded
 * @returns {Model}
 */
export function buildModel(loaded) {
  const { ctx, abs: rootFile, doc: root } = loaded;
  const rootKey = `${rootFile}#`;
  const slugger = new GithubSlugger();
  for (const heading of GENERATED_HEADINGS) slugger.slug(heading);
  /** @type {Map<string, Def & { target: Target }>} */
  const defs = new Map();
  /** @type {Array<Def & { target: Target }>} */
  const queue = [];

  /** Follow a `$ref` chain to a concrete schema (a loop of bare refs is an error). */
  const deref = (/** @type {any} */ s, /** @type {string} */ file) => {
    /** @type {Target | External | null} */
    let hit = null;
    for (let hops = 0; isMap(s) && typeof s.$ref === 'string'; hops++) {
      if (hops > 32) fail(ctx, s.$ref, 'is a $ref loop');
      hit = resolveRef(ctx, s.$ref, file);
      if ('external' in hit) return hit;
      ({ schema: s, file } = hit);
    }
    return hit ?? { schema: s, file, key: '', name: '' };
  };

  const isObject = (/** @type {any} */ s) => isMap(s.properties) || Array.isArray(s.allOf);

  /** Properties and `required` of an object schema, merging `allOf` members. */
  const members = (/** @type {any} */ s, /** @type {string} */ file, depth = 0) => {
    /** @type {Array<[string, any, string]>} */
    const out = [];
    const required = new Set(Array.isArray(s.required) ? s.required : []);
    for (const part of depth < 8 && Array.isArray(s.allOf) ? s.allOf : []) {
      const t = deref(part, file);
      if ('external' in t) continue;
      const inner = members(t.schema, t.file, depth + 1);
      out.push(...inner.out);
      for (const r of inner.required) required.add(r);
    }
    for (const [name, sub] of Object.entries(isMap(s.properties) ? s.properties : {})) out.push([name, sub, file]);
    return { out, required };
  };

  const register = (/** @type {Target} */ t) => {
    let def = defs.get(t.key);
    if (!def) {
      const label = t.name;
      def = { label, anchor: '', description: typeof t.schema.description === 'string' ? t.schema.description : '', properties: [], target: t };
      // Unique heading text, so its anchor is the slug of exactly that text.
      let text = label;
      for (let n = 2; [...defs.values()].some((d) => d.label === text) || GENERATED_HEADINGS.includes(text); n++) text = `${label} ${n}`;
      def.label = text;
      def.anchor = slugger.slug(text);
      defs.set(t.key, def);
      queue.push(def);
    }
    return def;
  };

  /** @returns {Segment[]} */
  const typeOf = (/** @type {any} */ s, /** @type {string} */ file) => {
    const t = deref(s, file);
    if ('external' in t) return [{ href: t.external }];
    if (t.key === rootKey && isMap(s) && s.$ref) return ['this schema'];
    const sch = t.schema;
    if (t.key !== '' && isObject(sch)) {
      const def = register(t);
      return [{ def: def.anchor, label: def.label }];
    }
    // Bare words stay bare; everything else (numbers, null, objects, text with commas) is JSON.
    if (Array.isArray(sch.enum)) return [`enum: ${sch.enum.map((/** @type {unknown} */ v) => (typeof v === 'string' && /^[A-Za-z_][\w.-]*$/.test(v) ? v : JSON.stringify(v))).join(', ')}`];
    if ('const' in sch) return [`const: ${JSON.stringify(sch.const)}`];
    const alts = ['oneOf', 'anyOf'].map((k) => sch[k]).find(Array.isArray);
    if (alts) return alts.flatMap((/** @type {any} */ a, /** @type {number} */ i) => [...(i ? [' | '] : []), ...typeOf(a, t.file)]);
    if (!isMap(sch.properties)) {
      const values = isMap(sch.additionalProperties) ? sch.additionalProperties : isMap(sch.patternProperties) ? Object.values(sch.patternProperties).find(isMap) : undefined;
      if (values) return ['map of ', ...typeOf(values, t.file)];
    }
    const kind = Array.isArray(sch.type) ? sch.type.join(' | ') : typeof sch.type === 'string' ? sch.type : isObject(sch) ? 'object' : 'any';
    return kind === 'array' && isMap(sch.items) ? ['array of ', ...typeOf(sch.items, t.file)] : [kind];
  };

  /** @returns {Property[]} */
  const propertiesOf = (/** @type {any} */ s, /** @type {string} */ file) => {
    const { out, required } = members(s, file);
    return out.map(([name, sub, subFile]) => {
      const t = deref(sub, subFile);
      const own = isMap(sub) && typeof sub.description === 'string' ? sub.description : '';
      const target = 'schema' in t ? t.schema : {};
      // An inline object (or the one non-null inline alternative of an anyOf/oneOf) lists its own fields.
      const inlineObject = (/** @type {any} */ n) => (isMap(n) && !n.$ref && isObject(n) ? n : undefined);
      const alts = isMap(sub) ? ['anyOf', 'oneOf'].map((k) => sub[k]).find(Array.isArray) : undefined;
      const present = alts?.filter((/** @type {any} */ a) => !(isMap(a) && a.type === 'null'));
      const inline = inlineObject(sub) ?? (present?.length === 1 ? inlineObject(present[0]) : undefined);
      return {
        name,
        required: required.has(name),
        type: typeOf(sub, subFile),
        description: own || (typeof target.description === 'string' ? target.description : ''),
        children: inline ? propertiesOf(inline, subFile) : [],
      };
    });
  };

  const properties = propertiesOf(root, rootFile);
  /** @type {Def[]} */
  const rendered = [];
  for (let def = queue.shift(); def; def = queue.shift()) {
    def.properties = propertiesOf(def.target.schema, def.target.file);
    rendered.push(def);
  }
  return {
    title: typeof root.title === 'string' ? root.title : '',
    description: typeof root.description === 'string' ? root.description : '',
    properties,
    defs: rendered,
  };
}

const WRAP = 48;

/**
 * PlantUML `@startjson` source for the schema: the parsed document, long strings broken
 * onto lines so the drawing stays narrow. Metadata comments feed the figure caption.
 *
 * @param {Loaded} loaded
 * @param {string} title
 * @returns {string}
 */
export function diagramSource(loaded, title) {
  const wrap = (/** @type {string} */ text) => {
    const lines = [];
    for (let rest = text.replace(/\s+/g, ' ').trim(); rest.length > 0; ) {
      if (rest.length <= WRAP) {
        lines.push(rest);
        break;
      }
      const at = rest.lastIndexOf(' ', WRAP);
      const cut = at > WRAP / 2 ? at : WRAP;
      lines.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    return lines.join('\n');
  };
  /** @type {(v: any) => any} */
  const walk = (v) =>
    typeof v === 'string'
      ? wrap(v)
      : Array.isArray(v)
        ? v.map(walk)
        : isMap(v)
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
          : v;
  const safe = title.replace(/[\r\n]+/g, ' ');
  return [`' title: ${safe}`, `' description: Structure of the JSON Schema ${safe}.`, '@startjson', JSON.stringify(walk(loaded.doc), null, 2), '@endjson'].join('\n');
}

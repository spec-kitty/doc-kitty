// @ts-check
/**
 * Validate an evidence index against the shipped schema (`tom-annex.schema.json`,
 * #401). A second layer under the gate's explicit checks (`verify.mjs`): it
 * closes the whole class of shape holes (an unknown key, a wrong type, a missing
 * field) instead of finding them one at a time.
 *
 * The repository has no JSON-schema validator and this adds no dependency, so it
 * implements exactly the keywords the shipped schema uses: `$ref` (into
 * `#/$defs`), `type` (one or a list), `const`, `enum`, `pattern`, `minLength`,
 * `minItems`, `items`, `required`, `properties` and `additionalProperties: false`.
 * `pattern` is a Unicode regex and `minLength` counts code points, as in
 * JSON Schema 2020-12. The whole schema is walked once before use: another
 * keyword anywhere (even off the instance's path), a keyword beside `$ref`, or
 * an unresolvable or cyclic `$ref` throws, so the two cannot drift apart silently.
 *
 * @module tom-annex/schema-check
 */

import shippedSchema from './tom-annex.schema.json' with { type: 'json' };

/** Annotations: accepted anywhere and ignored. */
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description']);

/** The keywords this validator implements, plus the annotations it ignores. */
const KNOWN = new Set([
  '$ref', 'type', 'const', 'enum', 'pattern', 'minLength', 'minItems', 'items', 'required', 'properties',
  'additionalProperties', '$defs', ...ANNOTATIONS,
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

/**
 * @param {Record<string, any>} schema
 * @param {Record<string, any>} root
 */
function resolve(schema, root) {
  let current = schema;
  /** @type {Set<string>} */
  const seen = new Set();
  // Follow a chain of `$ref`s (a → b → …) to the schema at its end.
  while (typeof current.$ref === 'string') {
    const ref = current.$ref;
    if (seen.has(ref)) throw new Error(`[dk-tom-annex] the shipped schema has a $ref cycle through ${ref}`);
    seen.add(ref);
    const name = /^#\/\$defs\/(.+)$/.exec(ref)?.[1];
    const target = name === undefined || !Object.hasOwn(root.$defs ?? {}, name) ? undefined : root.$defs[name];
    if (!target) throw new Error(`[dk-tom-annex] the shipped schema has an unresolvable $ref ${ref}`);
    current = target;
  }
  return current;
}

/**
 * @param {unknown} value
 * @param {Record<string, any>} schema
 * @param {Record<string, any>} root
 * @param {string} at JSON Pointer of `value`
 * @param {string[]} out
 */
function check(value, schema, root, at, out) {
  const s = resolve(schema, root);
  const where = at === '' ? '/' : at;
  if (s.type !== undefined) {
    const allowed = Array.isArray(s.type) ? s.type : [s.type];
    const actual = typeOf(value);
    const ok = allowed.includes(actual) || (actual === 'integer' && allowed.includes('number'));
    if (!ok) {
      out.push(`${where}: expected ${allowed.join(' or ')}, got ${actual}`);
      return;
    }
  }
  if ('const' in s && value !== s.const) out.push(`${where}: expected ${JSON.stringify(s.const)}`);
  if (Array.isArray(s.enum) && !s.enum.includes(value)) out.push(`${where}: expected one of ${s.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  if (typeof value === 'string') {
    // JSON Schema patterns are Unicode regexes, and lengths count code points.
    if (typeof s.pattern === 'string' && !new RegExp(s.pattern, 'u').test(value)) out.push(`${where}: does not match ${s.pattern}`);
    if (typeof s.minLength === 'number' && [...value].length < s.minLength) out.push(`${where}: shorter than ${s.minLength}`);
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === 'number' && value.length < s.minItems) out.push(`${where}: fewer than ${s.minItems} item(s)`);
    if (s.items) value.forEach((item, i) => check(item, s.items, root, `${at}/${i}`, out));
  }
  if (typeOf(value) === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    // Own properties only: `in` would let prototype keys such as "constructor" through.
    for (const key of s.required ?? []) if (!Object.hasOwn(obj, key)) out.push(`${where}: missing required "${key}"`);
    const properties = s.properties ?? {};
    for (const [key, child] of Object.entries(obj)) {
      if (Object.hasOwn(properties, key)) check(child, properties[key], root, `${at}/${key}`, out);
      else if (s.additionalProperties === false) out.push(`${where}: unknown key "${key}"`);
    }
  }
}

const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'null', 'array', 'object']);

/** @param {unknown} v */
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {unknown} v */
const isPrimitive = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
/** @param {unknown} v */
const isCount = (v) => Number.isInteger(v) && /** @type {number} */ (v) >= 0;
/** @param {string} p */
const compilesAsUnicode = (p) => {
  try {
    new RegExp(p, 'u');
    return true;
  } catch {
    return false;
  }
};

/**
 * The value forms this validator implements, per keyword. A known keyword in
 * another form (an object `const`, `items: false`, a `type` typo, ...) would be
 * silently mis-applied, so it throws at load instead.
 *
 * @type {Record<string, (value: unknown) => boolean>}
 */
const FORMS = {
  $ref: (v) => typeof v === 'string',
  type: (v) => (typeof v === 'string' && TYPES.has(v)) || (Array.isArray(v) && v.length > 0 && v.every((t) => typeof t === 'string' && TYPES.has(t))),
  const: isPrimitive,
  enum: (v) => Array.isArray(v) && v.length > 0 && v.every(isPrimitive),
  pattern: (v) => typeof v === 'string' && compilesAsUnicode(v),
  minLength: isCount,
  minItems: isCount,
  items: isPlainObject,
  required: (v) => Array.isArray(v) && v.every((k) => typeof k === 'string'),
  properties: (v) => isPlainObject(v) && Object.values(/** @type {object} */ (v)).every(isPlainObject),
  additionalProperties: (v) => v === false,
  $defs: (v) => isPlainObject(v) && Object.values(/** @type {object} */ (v)).every(isPlainObject),
  $schema: (v) => typeof v === 'string',
  $id: (v) => typeof v === 'string',
  title: (v) => typeof v === 'string',
  description: (v) => typeof v === 'string',
};

/** Schemas already walked by `assertImplemented`. */
const vetted = new WeakSet();

/**
 * Throw if any subschema, reachable or not from a given instance, uses a keyword
 * this validator does not implement. Walks `$defs`, `properties` and `items`.
 *
 * @param {Record<string, any>} schema
 */
function assertImplemented(schema) {
  if (vetted.has(schema)) return;
  /** @param {Record<string, any>} s @param {string} at */
  const walk = (s, at) => {
    for (const key of Object.keys(s)) {
      if (!KNOWN.has(key)) throw new Error(`[dk-tom-annex] the shipped schema uses "${key}" at ${at || '/'}, which schema-check.mjs does not implement`);
      if (!FORMS[key](s[key])) {
        throw new Error(`[dk-tom-annex] the shipped schema has "${key}": ${JSON.stringify(s[key])} at ${at || '/'}, a form schema-check.mjs does not implement`);
      }
    }
    // In 2020-12 a keyword beside `$ref` also applies; `resolve()` follows the ref only, so refuse the shape.
    if (s.$ref !== undefined) {
      const beside = Object.keys(s).filter((k) => !ANNOTATIONS.has(k) && k !== '$ref' && k !== '$defs');
      if (beside.length > 0) throw new Error(`[dk-tom-annex] the shipped schema has ${beside.join(', ')} beside $ref at ${at || '/'}, which schema-check.mjs does not apply`);
      resolve(s, schema);
    }
    for (const [name, sub] of Object.entries(s.$defs ?? {})) walk(sub, `${at}/$defs/${name}`);
    for (const [name, sub] of Object.entries(s.properties ?? {})) walk(sub, `${at}/properties/${name}`);
    if (s.items !== undefined) walk(s.items, `${at}/items`);
  };
  walk(schema, '');
  vetted.add(schema);
}

/**
 * The places where `annex` does not match the shipped schema, as `<JSON Pointer>: <reason>`.
 *
 * @param {unknown} annex a parsed evidence index
 * @param {Record<string, any>} [schema] the schema to check against; the shipped one by default
 * @returns {string[]}
 */
export function schemaProblems(annex, schema = shippedSchema) {
  assertImplemented(schema);
  /** @type {string[]} */
  const out = [];
  check(annex, schema, schema, '', out);
  return out;
}

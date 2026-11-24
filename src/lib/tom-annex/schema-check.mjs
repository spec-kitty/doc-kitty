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
 * A schema that starts using another keyword fails loudly here, so the two cannot
 * drift apart silently.
 *
 * @module tom-annex/schema-check
 */

import shippedSchema from './tom-annex.schema.json' with { type: 'json' };

/** The keywords this validator implements, plus annotations it ignores. */
const KNOWN = new Set([
  '$ref', 'type', 'const', 'enum', 'pattern', 'minLength', 'minItems', 'items', 'required', 'properties',
  'additionalProperties', '$schema', '$id', '$defs', 'title', 'description',
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
  if (typeof schema.$ref !== 'string') return schema;
  const name = /^#\/\$defs\/(.+)$/.exec(schema.$ref)?.[1];
  const target = name === undefined ? undefined : root.$defs?.[name];
  if (!target) throw new Error(`[dk-tom-annex] the shipped schema has an unresolvable $ref ${schema.$ref}`);
  return target;
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
  for (const key of Object.keys(s)) {
    if (!KNOWN.has(key)) throw new Error(`[dk-tom-annex] the shipped schema uses "${key}", which schema-check.mjs does not implement`);
  }
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
    if (typeof s.pattern === 'string' && !new RegExp(s.pattern).test(value)) out.push(`${where}: does not match ${s.pattern}`);
    if (typeof s.minLength === 'number' && value.length < s.minLength) out.push(`${where}: shorter than ${s.minLength}`);
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === 'number' && value.length < s.minItems) out.push(`${where}: fewer than ${s.minItems} item(s)`);
    if (s.items) value.forEach((item, i) => check(item, s.items, root, `${at}/${i}`, out));
  }
  if (typeOf(value) === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    for (const key of s.required ?? []) if (!(key in obj)) out.push(`${where}: missing required "${key}"`);
    const properties = s.properties ?? {};
    for (const [key, child] of Object.entries(obj)) {
      if (key in properties) check(child, properties[key], root, `${at}/${key}`, out);
      else if (s.additionalProperties === false) out.push(`${where}: unknown key "${key}"`);
    }
  }
}

/**
 * The places where `annex` does not match the shipped schema, as `<JSON Pointer>: <reason>`.
 *
 * @param {unknown} annex a parsed evidence index
 * @param {Record<string, any>} [schema] the schema to check against; the shipped one by default
 * @returns {string[]}
 */
export function schemaProblems(annex, schema = shippedSchema) {
  /** @type {string[]} */
  const out = [];
  check(annex, schema, schema, '', out);
  return out;
}

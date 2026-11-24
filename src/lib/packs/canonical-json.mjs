/**
 * RFC 8785 JSON Canonicalization Scheme (JCS), for the pack manifest's own hash
 * (#417). The charter's `pack-manifest` schema defines `manifest_hash` as the
 * SHA-256 of the UTF-8 bytes of this form of the manifest.
 *
 * JCS is ECMAScript's own JSON serialization with three rules on top, so it
 * needs no dependency:
 *
 * - object keys sorted by their UTF-16 code units, recursively (RFC 8785 3.2.3);
 * - no whitespace;
 * - numbers and strings exactly as `JSON.stringify` writes them (3.2.2.2,
 *   3.2.2.3), with a lone surrogate refused rather than escaped (3.2.2.2).
 *
 * What JSON cannot hold (`undefined`, a function, a non-finite number, a
 * bigint) throws: the input is data, and a value with no canonical form has no
 * hash.
 *
 * @module packs/canonical-json
 */

/** Code-unit order, which is what `<` compares for strings. @param {string} a @param {string} b */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** @param {string} s */
function canonicalString(s) {
  if (!s.isWellFormed()) throw new Error('canonicalJson: a string holds a lone surrogate, which RFC 8785 refuses');
  return JSON.stringify(s);
}

/**
 * The RFC 8785 canonical JSON text of a JSON value.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return canonicalString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`canonicalJson: ${value} has no JSON form`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  if (typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    const members = Object.keys(record)
      .sort(byCodeUnit)
      .map((key) => `${canonicalString(key)}:${canonicalJson(record[key])}`);
    return `{${members.join(',')}}`;
  }
  throw new Error(`canonicalJson: a ${typeof value} has no JSON form`);
}

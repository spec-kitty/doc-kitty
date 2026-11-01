/**
 * The ADR id rule: how an ADR's id is read from its file name, and how ids are
 * ordered (#248, ADR-0069).
 *
 * A docs tree picks the rule in `_meta/charter.yaml`:
 *
 * ```yaml
 * adr:
 *   id:
 *     preset: date-seq        # or: pattern: '^(?<id>…)-'
 * ```
 *
 * With no `adr` axis the rule is the `nnnn` preset, `/^(\d{4})-/`, exactly the
 * pattern the ADR index used before the axis existed: same ids, same order.
 *
 * Pure and fs-free: the charter loader (`vocabulary-loader.mjs`) validates the
 * axis with it when it reads `_meta/charter.yaml`, so every gate and the build
 * fail closed on a malformed axis; the ADR extractor (`generate-adr-index.mjs`)
 * applies it.
 *
 * @module adr-id
 */
import { compareCodeUnit } from './vocabulary-core.mjs';

/**
 * The named presets. `nnnn` is the default and its pattern is byte-for-byte the
 * one the index always used. `date-seq` reads `YYYY-MM-DD-N` and orders by date,
 * then by the sequence number as a number (`-2` before `-10`).
 */
export const ADR_ID_PRESETS = Object.freeze({
  nnnn: /^(\d{4})-/,
  'date-seq': /^(?<id>(?<date>\d{4}-\d{2}-\d{2})-(?<seq>\d+))-/,
});

/** The preset used when a tree declares no `adr.id`. */
export const DEFAULT_ADR_ID_PRESET = 'nnnn';

/**
 * A resolved ADR id rule.
 *
 * @typedef {object} AdrIdRule
 * @property {RegExp} pattern Matched against the lowercased file name without its
 *   extension. The id is the `id` named group, else the first capture group.
 * @property {string} [preset] The preset name, when the rule is a preset.
 */

/** The default rule (`nnnn`). */
export const DEFAULT_ADR_ID_RULE = Object.freeze({
  pattern: ADR_ID_PRESETS[DEFAULT_ADR_ID_PRESET],
  preset: DEFAULT_ADR_ID_PRESET,
});

const isMapping = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * Resolve the charter's `adr` axis into an {@link AdrIdRule}. Fails closed: a
 * malformed axis throws a message that starts with `source` and names the key.
 *
 * @param {unknown} raw The value of the charter's top-level `adr` key.
 * @param {string} [source] The charter file, for error messages.
 * @returns {AdrIdRule}
 */
export function resolveAdrIdRule(raw, source = 'charter.yaml') {
  if (raw == null) return DEFAULT_ADR_ID_RULE;
  if (!isMapping(raw)) throw new Error(`${source}: "adr" must be a mapping with an optional "id"`);
  for (const key of Object.keys(raw)) {
    if (key !== 'id') throw new Error(`${source}: unknown key "${key}" under "adr"; expected "id"`);
  }
  const id = /** @type {Record<string, unknown>} */ (raw).id;
  if (id == null) return DEFAULT_ADR_ID_RULE;
  if (!isMapping(id)) {
    throw new Error(`${source}: "adr.id" must be a mapping with "preset" or "pattern"`);
  }
  for (const key of Object.keys(id)) {
    if (key !== 'preset' && key !== 'pattern') {
      throw new Error(`${source}: unknown key "${key}" under "adr.id"; expected "preset" or "pattern"`);
    }
  }
  const { preset, pattern } = /** @type {{ preset?: unknown, pattern?: unknown }} */ (id);
  if ((preset == null) === (pattern == null)) {
    throw new Error(`${source}: "adr.id" takes exactly one of "preset" or "pattern"`);
  }
  if (preset != null) {
    if (typeof preset !== 'string' || !Object.hasOwn(ADR_ID_PRESETS, preset)) {
      throw new Error(
        `${source}: "adr.id.preset" has unknown preset "${String(preset)}"; ` +
          `expected one of ${Object.keys(ADR_ID_PRESETS).join(', ')}`,
      );
    }
    return preset === DEFAULT_ADR_ID_PRESET
      ? DEFAULT_ADR_ID_RULE
      : Object.freeze({ pattern: ADR_ID_PRESETS[preset], preset });
  }
  if (typeof pattern !== 'string' || pattern === '') {
    throw new Error(`${source}: "adr.id.pattern" must be a non-empty string`);
  }
  let compiled;
  try {
    compiled = new RegExp(pattern);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${source}: "adr.id.pattern" is not a valid regular expression — ${detail}`);
  }
  // An alternation with the empty string always matches, so `groups` lists every
  // named group the pattern declares.
  const groups = new RegExp(`${pattern}|`).exec('')?.groups ?? {};
  if (!Object.hasOwn(groups, 'id')) {
    throw new Error(`${source}: "adr.id.pattern" must have a named group "id", e.g. ^(?<id>\\d+)-`);
  }
  const upper = findUpperCaseLiteral(pattern);
  if (upper !== null) {
    throw new Error(
      `${source}: "adr.id.pattern" has an upper-case "${upper}", which can never match: ` +
        `the pattern runs against the lowercased file name, so write the pattern in lower case ` +
        `(e.g. '^(?<id>adr-\\d+)-' for ADR-12-use-x.md)`,
    );
  }
  return Object.freeze({ pattern: compiled });
}

/** `ch` when it has a distinct lower-case form (an upper-case letter), else null. */
const upperOrNull = (ch) => (ch !== ch.toLowerCase() ? ch : null);

/**
 * Find the first upper-case literal in a regex source, or `null` (#248).
 *
 * The rule is matched against the lowercased leaf, so an upper-case literal can
 * never match and the pattern would silently find no ADRs. Not literals, and so
 * skipped: the escapes `\D`, `\W`, `\S`, `\B` and `\cJ`, group names
 * (`(?<Name>`) and back-references (`\k<Name>`). A hex escape (`\x41`, `\u00C9`)
 * is a literal and is checked by the character it stands for, and so is an
 * identity escape such as `\A`.
 *
 * @param {string} source
 * @returns {string | null}
 */
function findUpperCaseLiteral(source) {
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') {
      const next = source[i + 1];
      const hex = next === 'x' ? 2 : next === 'u' ? 4 : 0;
      const digits = hex ? source.slice(i + 2, i + 2 + hex) : '';
      if (hex && new RegExp(`^[0-9a-fA-F]{${hex}}$`).test(digits)) {
        const hit = upperOrNull(String.fromCharCode(parseInt(digits, 16)));
        if (hit) return hit;
        i += 1 + hex;
      } else if (next === 'k' && source[i + 2] === '<') {
        const end = source.indexOf('>', i + 3);
        i = end === -1 ? i + 1 : end;
      } else if (next === 'c') {
        i += 2; // `\cX`: a control character, never a letter.
      } else {
        // `\D`, `\W`, `\S`, `\B` are classes or assertions. Any other escaped
        // letter (`\A`) is an identity escape: the letter itself.
        const hit = next !== undefined && !'DWSB'.includes(next) ? upperOrNull(next) : null;
        if (hit) return hit;
        i += 1;
      }
      continue;
    }
    if (ch === '(' && source.startsWith('?<', i + 1) && !'=!'.includes(source[i + 3])) {
      const end = source.indexOf('>', i + 3);
      if (end !== -1) {
        i = end;
        continue;
      }
    }
    const hit = upperOrNull(ch);
    if (hit) return hit;
  }
  return null;
}

/**
 * Read an ADR id from a file-name leaf (no directory, no extension).
 *
 * The rule is matched against the LOWERCASED leaf. The generator sees the file
 * name (`ADR-12-Use-X`); the hub sees the route slug, which Starlight lowercases
 * (`adr-12-use-x`). Lowercasing both makes them read the same id. The default
 * `nnnn` pattern matches only digits and `-`, so it reads exactly what it did.
 *
 * @param {string} leaf
 * @param {AdrIdRule} rule
 * @returns {{ id: string, date: string, seq: number | null } | null} `null` when
 *   the leaf does not match (not an ADR). `date` and `seq` are the optional
 *   `date`/`seq` named groups, used only for ordering.
 */
export function matchAdrId(leaf, rule) {
  const m = leaf.toLowerCase().match(rule.pattern);
  if (!m) return null;
  const id = m.groups?.id ?? m[1];
  if (id === undefined || id === '') return null;
  // Only a digit run is a sequence; anything else would compare as NaN.
  const seq = m.groups?.seq;
  return { id, date: m.groups?.date ?? '', seq: seq !== undefined && /^\d+$/.test(seq) ? Number(seq) : null };
}

/**
 * Order two ADRs by id: `date` group (code unit), then `seq` group (numeric,
 * no sequence first), then the id itself (code unit). A rule without `date`/`seq` groups, the
 * default included, therefore orders by the id alone, as the index always did.
 *
 * @param {{ number: string, sortKey: { date: string, seq: number | null } }} a
 * @param {{ number: string, sortKey: { date: string, seq: number | null } }} b
 * @returns {number}
 */
export function compareAdrIds(a, b) {
  const byDate = compareCodeUnit(a.sortKey.date, b.sortKey.date);
  if (byDate !== 0) return byDate;
  // An ADR without a sequence sorts before one with a sequence, so a pattern
  // with an optional `seq` group still gives one consistent order.
  if (a.sortKey.seq !== b.sortKey.seq) {
    if (a.sortKey.seq === null) return -1;
    if (b.sortKey.seq === null) return 1;
    return a.sortKey.seq - b.sortKey.seq;
  }
  return compareCodeUnit(a.number, b.number);
}

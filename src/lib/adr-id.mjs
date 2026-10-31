/**
 * The ADR id rule: how an ADR's id is read from its file name, and how ids are
 * ordered (#248, ADR-0068).
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
  return Object.freeze({ pattern: compiled });
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
  const seq = m.groups?.seq;
  return { id, date: m.groups?.date ?? '', seq: seq === undefined ? null : Number(seq) };
}

/**
 * Order two ADRs by id: `date` group (code unit), then `seq` group (numeric),
 * then the id itself (code unit). A rule without `date`/`seq` groups, the
 * default included, therefore orders by the id alone, as the index always did.
 *
 * @param {{ number: string, sortKey: { date: string, seq: number | null } }} a
 * @param {{ number: string, sortKey: { date: string, seq: number | null } }} b
 * @returns {number}
 */
export function compareAdrIds(a, b) {
  const byDate = compareCodeUnit(a.sortKey.date, b.sortKey.date);
  if (byDate !== 0) return byDate;
  if (a.sortKey.seq !== null && b.sortKey.seq !== null && a.sortKey.seq !== b.sortKey.seq) {
    return a.sortKey.seq - b.sortKey.seq;
  }
  return compareCodeUnit(a.number, b.number);
}

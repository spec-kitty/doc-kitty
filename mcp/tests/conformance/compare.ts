/**
 * Field-level byte-equality comparator (T020, reviewer pin V4).
 *
 * Every expectation in the conformance suite is a value computed IN-TEST from
 * the fixture artifacts; this module compares one expected value against one
 * tool-output value recursively and records one line per scalar mismatch:
 *
 *   - strings: UTF-8 BYTE equality (Buffer comparison), never locale or
 *     normalized comparison;
 *   - numbers/booleans/null: strict same-type equality (Object.is semantics);
 *   - arrays: same length, element-wise in order (registry order is part of
 *     the contract, so order is asserted, not sorted away);
 *   - objects: same key SET per level, then per-key recursion (JSON wire key
 *     order carries no meaning; key presence is asserted exactly).
 *
 * A mismatch stops the descent into that subtree (one line per field, not a
 * flood). The golden suite asserts the returned list is EMPTY; the seeded-
 * fault self-test asserts it is NON-empty under the fault flag. No vitest
 * snapshot machinery is involved anywhere.
 */

export interface FieldComparison {
  /** Dotted field path, e.g. "list_pages[3].title". */
  path: string;
  /** What the comparison found. */
  problem: string;
}

function describe(value: unknown): string {
  if (typeof value === 'string') {
    const bytes = Buffer.byteLength(value, 'utf8');
    const preview = value.length > 40 ? `${value.slice(0, 40)}...` : value;
    return `string(${bytes}B) ${JSON.stringify(preview)}`;
  }
  if (Array.isArray(value)) return `array(len ${value.length})`;
  if (typeof value === 'object' && value !== null) return `object(keys ${Object.keys(value).length})`;
  return JSON.stringify(value);
}

function record(out: FieldComparison[], path: string, expected: unknown, actual: unknown, what: string): void {
  out.push({ path, problem: `${what}: expected ${describe(expected)}, got ${describe(actual)}` });
}

function sameUtf8Bytes(a: string, b: string): boolean {
  return Buffer.from(a, 'utf8').equals(Buffer.from(b, 'utf8'));
}

export function compareFields(expected: unknown, actual: unknown, path = '$', out: FieldComparison[] = []): FieldComparison[] {
  if (typeof expected === 'string' || typeof actual === 'string') {
    if (typeof expected !== 'string' || typeof actual !== 'string' || !sameUtf8Bytes(expected, actual)) {
      record(out, path, expected, actual, 'string field does not byte-equal');
    }
    return out;
  }
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
    if (typeof expected !== typeof actual || !Object.is(expected, actual)) {
      record(out, path, expected, actual, 'scalar field differs');
    }
    return out;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      record(out, path, expected, actual, 'array-ness differs');
      return out;
    }
    if (expected.length !== actual.length) {
      record(out, path, expected, actual, 'array length differs');
      return out;
    }
    for (let i = 0; i < expected.length; i++) {
      compareFields(expected[i], actual[i], `${path}[${i}]`, out);
    }
    return out;
  }
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual as Record<string, unknown>).sort();
  if (expectedKeys.join('') !== actualKeys.join('')) {
    record(out, path, expectedKeys, actualKeys, 'object key set differs');
    return out;
  }
  for (const key of expectedKeys) {
    compareFields(
      (expected as Record<string, unknown>)[key],
      (actual as Record<string, unknown>)[key],
      path === '$' ? key : `${path}.${key}`,
      out,
    );
  }
  return out;
}

/** Render mismatches for an assertion message (kept short on purpose). */
export function formatComparisons(comparisons: readonly FieldComparison[]): string {
  if (comparisons.length === 0) return '(all fields byte-equal)';
  const shown = comparisons.slice(0, 12).map((c) => `  ${c.path}: ${c.problem}`);
  const tail = comparisons.length > shown.length ? [`  ...and ${comparisons.length - shown.length} more`] : [];
  return ['field-level byte mismatches:', ...shown, ...tail].join('\n');
}

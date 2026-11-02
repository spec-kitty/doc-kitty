/**
 * Surface-layer validation guards (T016, NFR-003): hand-rolled, no schema
 * library. Same discipline as corpus/source.ts - every violation raises a
 * MALFORMED_CORPUS-family error with a path-precise message that names the
 * offending input position ("<path>: <key> - expected <expectation>").
 *
 * Applied at two boundaries:
 *   - every tool handler input (tools.ts): the wire JSON Schema catches
 *     structural violations first; these guards own the SEMANTIC ones the
 *     schema deliberately does not constrain (non-empty identifiers), so the
 *     client sees the named error taxonomy, never a bare SDK message;
 *   - the launch-configuration boundary (server.ts createServer): the config
 *     values the surface trusts (source kind, threshold, slug inputs) are
 *     asserted before any tool is registered.
 */
import { MalformedCorpusError } from '../errors.js';
import type { LaunchConfiguration } from '../cli.js';

/** Assert a value is a string with at least one non-whitespace character. */
export function assertNonEmptyString(value: unknown, path: string, key: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MalformedCorpusError(`${path}: ${key} - expected a non-empty string`);
  }
}

/** Assert a value is an integer >= 1 (the FR-011 listing threshold shape). */
export function assertIntegerThreshold(value: unknown, path: string, key: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new MalformedCorpusError(`${path}: ${key} - expected an integer >= 1`);
  }
}

/** Assert a value is one of a known closed set (a true enum). */
export function assertKnownEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  key: string,
): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new MalformedCorpusError(`${path}: ${key} - expected one of ${allowed.map((a) => `'${a}'`).join(', ')}`);
  }
}

/**
 * The launch-configuration boundary guard, run once at server build
 * (createServer). The constructor's inputs are TS-typed, but a server host
 * may cross the boundary from untyped configuration - fail fast, name the
 * field.
 */
export function assertLaunchConfiguration(config: LaunchConfiguration): void {
  assertKnownEnum(config.source.kind, ['https', 'fs'], 'launch config', 'source.kind');
  if (config.source.kind === 'https') {
    assertNonEmptyString(config.source.url, 'launch config', 'source.url');
  } else {
    assertNonEmptyString(config.source.dir, 'launch config', 'source.dir');
  }
  assertIntegerThreshold(config.resourceListingThreshold, 'launch config', 'resourceListingThreshold');
  assertNonEmptyString(config.siteSlug, 'launch config', 'siteSlug');
  if (config.linkBase !== undefined) {
    assertNonEmptyString(config.linkBase, 'launch config', 'linkBase');
  }
}

/**
 * guards.ts (T016): hand-rolled validation at the launch-config and tool-input
 * boundaries - MALFORMED_CORPUS-family errors with path-precise messages.
 */
import { describe, expect, it } from 'vitest';
import type { LaunchConfiguration } from '../../src/cli.js';
import { MalformedCorpusError } from '../../src/errors.js';
import {
  assertIntegerThreshold,
  assertKnownEnum,
  assertLaunchConfiguration,
  assertNonEmptyString,
} from '../../src/surface/guards.js';

describe('assertNonEmptyString', () => {
  it('accepts a non-empty string', () => {
    expect(() => assertNonEmptyString('home', 'get_page', 'arguments.id')).not.toThrow();
  });

  it.each<[unknown, string]>([
    ['', 'empty'],
    ['   ', 'whitespace-only'],
    [42, 'non-string'],
    [undefined, 'missing'],
  ])('rejects %s (%s) with a path-precise MALFORMED_CORPUS', (value) => {
    try {
      assertNonEmptyString(value, 'get_page', 'arguments.id');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MalformedCorpusError);
      expect((error as MalformedCorpusError).code).toBe('MALFORMED_CORPUS');
      expect((error as MalformedCorpusError).message).toBe('get_page: arguments.id - expected a non-empty string');
    }
  });
});

describe('assertIntegerThreshold', () => {
  it('accepts 1 and 1000', () => {
    expect(() => assertIntegerThreshold(1, 'launch config', 'resourceListingThreshold')).not.toThrow();
    expect(() => assertIntegerThreshold(1000, 'launch config', 'resourceListingThreshold')).not.toThrow();
  });

  it.each([[0], [-2], [1.5], ['25'], [Number.NaN]])('rejects %s', (value) => {
    expect(() => assertIntegerThreshold(value, 'launch config', 'resourceListingThreshold')).toThrowError(
      'launch config: resourceListingThreshold - expected an integer >= 1',
    );
  });
});

describe('assertKnownEnum', () => {
  it('accepts a member of the closed set', () => {
    expect(() => assertKnownEnum('https', ['https', 'fs'], 'launch config', 'source.kind')).not.toThrow();
  });

  it('rejects a non-member by name', () => {
    expect(() => assertKnownEnum('ftp', ['https', 'fs'], 'launch config', 'source.kind')).toThrowError(
      `launch config: source.kind - expected one of 'https', 'fs'`,
    );
  });
});

describe('assertLaunchConfiguration', () => {
  const good: LaunchConfiguration = {
    source: { kind: 'fs', dir: '/abs/path' },
    linkBase: 'http://localhost:4321',
    resourceListingThreshold: 1000,
    siteSlug: 'abs-path',
  };

  it('accepts a valid configuration', () => {
    expect(() => assertLaunchConfiguration(good)).not.toThrow();
  });

  it('names each broken field', () => {
    expect(() =>
      assertLaunchConfiguration({ ...good, source: { kind: 'ftp' as 'fs', url: 'x' } as unknown as LaunchConfiguration['source'] }),
    ).toThrowError(/launch config: source\.kind - expected one of/);
    expect(() => assertLaunchConfiguration({ ...good, resourceListingThreshold: 0 })).toThrowError(
      /launch config: resourceListingThreshold - expected an integer >= 1/,
    );
    expect(() => assertLaunchConfiguration({ ...good, siteSlug: '' })).toThrowError(
      /launch config: siteSlug - expected a non-empty string/,
    );
    expect(() => assertLaunchConfiguration({ ...good, linkBase: ' ' })).toThrowError(
      /launch config: linkBase - expected a non-empty string/,
    );
    expect(() =>
      assertLaunchConfiguration({ ...good, source: { kind: 'https', url: '' } }),
    ).toThrowError(/launch config: source\.url - expected a non-empty string/);
    expect(() =>
      assertLaunchConfiguration({ ...good, source: { kind: 'fs', dir: '' } }),
    ).toThrowError(/launch config: source\.dir - expected a non-empty string/);
  });
});

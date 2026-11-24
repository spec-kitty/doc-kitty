/**
 * The pack manifest's own hash (#417): `manifest_hash` is SHA-256, lower hex, of
 * the UTF-8 bytes of the RFC 8785 (JCS) canonical JSON of the manifest without
 * `manifest_hash` (the charter's `pack-manifest` schema). `canonicalJson` is
 * held to RFC 8785's own examples, and `packManifestHash` to a real manifest.
 *
 * `fixtures/packs-manifest-hash/cave-kitty.pack-manifest.yaml` is
 * spec-kitty-open-packs' `packs/cave-kitty/pack-manifest.yaml` at `0be738a`
 * (the corpus pin), byte for byte. Its `manifest_hash` was written by the
 * charter's tooling, so matching it proves the recipe, not just self-agreement.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { canonicalJson } from '../lib/packs/canonical-json.mjs';
import { packManifestHash } from '../lib/packs/read.mjs';

const REAL = readFileSync(new URL('./fixtures/packs-manifest-hash/cave-kitty.pack-manifest.yaml', import.meta.url), 'utf8');
const REAL_HASH = '25db458924a165fb9f68b7bc58d7e4883494dd7912214b958cd89a12dd9f74fc';
const failsafe = (text: string) => parse(text, { schema: 'failsafe', resolveKnownTags: false });

describe('canonicalJson (RFC 8785)', () => {
  it('sorts keys by UTF-16 code units, recursively, with no whitespace (RFC 8785 3.2.3)', () => {
    const input = JSON.parse(
      '{"\\u20ac":"Euro Sign","\\r":"Carriage Return","\\ufb33":"Hebrew Letter Dalet With Dagesh","1":"One","\\ud83d\\ude00":"Emoji: Grinning Face","\\u0080":"Control","\\u00f6":"Latin Small Letter O With Diaeresis"}',
    );
    // Read the order from the text: an object built from it would reorder the integer-like "1".
    const text = canonicalJson(input);
    const keys = [...text.matchAll(/"((?:[^"\\]|\\.)*)":/g)].map((m) => JSON.parse(`"${m[1]}"`) as string);
    expect(keys.map((k) => k.codePointAt(0)?.toString(16))).toEqual(['d', '31', '80', 'f6', '20ac', '1f600', 'fb33']);
    expect(canonicalJson({ b: [3, { y: 1, x: null }], a: true })).toBe('{"a":true,"b":[3,{"x":null,"y":1}]}');
  });

  it('serializes numbers as ECMAScript does (RFC 8785 3.2.2.3)', () => {
    expect(canonicalJson([1e21, -0, Number('333333333.33333329'), 1e-7, 0.000001, 100, 4.5])).toBe('[1e+21,0,333333333.3333333,1e-7,0.000001,100,4.5]');
  });

  it('escapes strings as JSON.stringify does, and keeps other characters as they are (RFC 8785 3.2.2.2)', () => {
    // RFC 8785's example: euro sign, $, U+000F, LF, A, ', B, ", backslash, backslash, ", / (built from code points).
    const input = String.fromCodePoint(0x20ac, 0x24, 0x0f, 0x0a, 0x41, 0x27, 0x42, 0x22, 0x5c, 0x5c, 0x22, 0x2f);
    const expected = String.fromCodePoint(0x22, 0x20ac, 0x24) + '\\u000f\\n' + String.fromCodePoint(0x41, 0x27, 0x42) + '\\"' + '\\\\\\\\' + '\\"/"';
    expect(canonicalJson(input)).toBe(expected);
    expect(expected).toHaveLength(24);
  });

  it('refuses what JSON cannot hold: a lone surrogate, a non-finite number, undefined', () => {
    expect(() => canonicalJson('\ud800')).toThrow(/surrogate/);
    expect(() => canonicalJson({ k: '\udc00x' })).toThrow(/surrogate/);
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson([Number.POSITIVE_INFINITY])).toThrow();
    expect(() => canonicalJson({ k: undefined })).toThrow();
  });
});

describe('packManifestHash', () => {
  it('matches the hash a real open-packs manifest carries', () => {
    const manifest = failsafe(REAL);
    expect(manifest.manifest_hash).toBe(REAL_HASH);
    expect(packManifestHash(manifest)).toBe(REAL_HASH);
  });

  it('changes when any value of the manifest changes, and ignores the manifest_hash written', () => {
    const doctored = failsafe(REAL.replace('id: cave-dev', 'id: cave-dew'));
    expect(packManifestHash(doctored)).not.toBe(REAL_HASH);
    const rehashed = failsafe(REAL.replace(REAL_HASH, 'f'.repeat(64)));
    expect(packManifestHash(rehashed)).toBe(REAL_HASH);
    const without = failsafe(REAL.replace(`manifest_hash: ${REAL_HASH}\n`, ''));
    expect(packManifestHash(without)).toBe(REAL_HASH);
  });

  it('does not depend on the key order or the quoting the YAML uses', () => {
    const reordered = REAL.replace(/- kind: (\S+)\n {2}id: (\S+)\n/g, "- id: '$2'\n  kind: \"$1\"\n");
    expect(reordered).not.toBe(REAL);
    expect(packManifestHash(failsafe(reordered))).toBe(REAL_HASH);
  });
});

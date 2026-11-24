/**
 * The evidence-index schema layer (`schema-check.mjs`, WP05 review cycle 4):
 * one valid and one invalid case per keyword it implements, the throw cases,
 * own-property lookups (prototype keys), and the shipped schema compiling.
 */
import { describe, expect, it } from 'vitest';
import { schemaProblems } from '../lib/tom-annex/schema-check.mjs';

const ok = (value: unknown, schema: Record<string, unknown>) => expect(schemaProblems(value, schema)).toEqual([]);
const bad = (value: unknown, schema: Record<string, unknown>, match: RegExp) =>
  expect(schemaProblems(value, schema).join('\n')).toMatch(match);

describe('one valid and one invalid case per keyword', () => {
  it('type: a single type and a list, with integer counting as number', () => {
    ok('x', { type: 'string' });
    bad(1, { type: 'string' }, /expected string, got integer/);
    ok(null, { type: ['string', 'null'] });
    bad(true, { type: ['string', 'null'] }, /expected string or null, got boolean/);
    ok(3, { type: 'number' });
    bad(3.5, { type: 'integer' }, /expected integer, got number/);
  });

  it('const', () => {
    ok('a', { const: 'a' });
    bad('b', { const: 'a' }, /expected "a"/);
  });

  it('enum', () => {
    ok('legal', { enum: ['technical', 'legal'] });
    bad('cosmic', { enum: ['technical', 'legal'] }, /expected one of "technical", "legal"/);
  });

  it('pattern, compiled with the u flag', () => {
    ok('ab-cd', { type: 'string', pattern: '^[a-z]+(-[a-z]+)*$' });
    bad('Ab', { type: 'string', pattern: '^[a-z]+$' }, /does not match/);
    // With `u`, `.` matches one astral code point; without it, two code units.
    ok('😀', { type: 'string', pattern: '^.$' });
  });

  it('minLength, counted in code points', () => {
    ok('ab', { type: 'string', minLength: 2 });
    bad('a', { type: 'string', minLength: 2 }, /shorter than 2/);
    // One astral character is one code point (two UTF-16 units).
    bad('😀', { type: 'string', minLength: 2 }, /shorter than 2/);
  });

  it('minItems', () => {
    ok([1], { type: 'array', minItems: 1 });
    bad([], { type: 'array', minItems: 1 }, /fewer than 1 item/);
  });

  it('items, with the item path', () => {
    ok(['a', 'b'], { type: 'array', items: { type: 'string' } });
    bad(['a', 2], { type: 'array', items: { type: 'string' } }, /\/1: expected string/);
  });

  it('required', () => {
    ok({ a: 1 }, { type: 'object', required: ['a'] });
    bad({}, { type: 'object', required: ['a'] }, /missing required "a"/);
  });

  it('properties, with the property path', () => {
    ok({ a: 'x' }, { type: 'object', properties: { a: { type: 'string' } } });
    bad({ a: 1 }, { type: 'object', properties: { a: { type: 'string' } } }, /\/a: expected string/);
  });

  it('additionalProperties: false', () => {
    const schema = { type: 'object', properties: { a: {} }, additionalProperties: false };
    ok({ a: 1 }, schema);
    bad({ a: 1, b: 2 }, schema, /unknown key "b"/);
    // Without the keyword, extra keys are allowed.
    ok({ a: 1, b: 2 }, { type: 'object', properties: { a: {} } });
  });

  it('$ref into $defs', () => {
    const schema = { $defs: { name: { type: 'string' } }, type: 'object', properties: { n: { $ref: '#/$defs/name' } } };
    ok({ n: 'x' }, schema);
    bad({ n: 1 }, schema, /\/n: expected string/);
  });
});

describe('prototype keys are not own properties (review cycle 4)', () => {
  const schema = { type: 'object', properties: { a: {} }, required: ['a'], additionalProperties: false };

  it('reports constructor, toString, valueOf, hasOwnProperty and __proto__ as unknown keys', () => {
    for (const key of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
      const value = JSON.parse(`{"a": 1, "${key}": 1}`);
      bad(value, schema, new RegExp(`unknown key "${key}"`));
    }
  });

  it('does not take a prototype key as satisfying required', () => {
    bad(JSON.parse('{}'), { type: 'object', required: ['constructor'] }, /missing required "constructor"/);
  });
});

describe('the schema itself', () => {
  it('throws on a keyword it does not implement, anywhere in the schema, even off the instance path', () => {
    expect(() => schemaProblems({}, { type: 'object', properties: { unused: { maxLength: 3 } } })).toThrow(/maxLength/);
    expect(() => schemaProblems({}, { $defs: { x: { oneOf: [] } }, type: 'object' })).toThrow(/oneOf/);
  });

  it('throws on a keyword beside $ref, which 2020-12 would apply and this validator would drop', () => {
    expect(() => schemaProblems('x', { $defs: { s: { type: 'string' } }, $ref: '#/$defs/s', minLength: 2 })).toThrow(/beside \$ref/);
  });

  it('follows a chained $ref to the end', () => {
    const schema = { $defs: { a: { $ref: '#/$defs/b' }, b: { type: 'string' } }, $ref: '#/$defs/a' };
    ok('x', schema);
    bad(5, schema, /expected string/);
  });

  it('throws on a $ref cycle instead of looping', () => {
    expect(() => schemaProblems('x', { $defs: { a: { $ref: '#/$defs/b' }, b: { $ref: '#/$defs/a' } }, $ref: '#/$defs/a' })).toThrow(/cycle/);
  });

  it('throws on an unresolvable $ref', () => {
    expect(() => schemaProblems('x', { $ref: '#/$defs/missing' })).toThrow(/unresolvable \$ref/);
  });

  it('accepts the shipped schema (every keyword in it is implemented)', () => {
    expect(() => schemaProblems({})).not.toThrow();
  });
});

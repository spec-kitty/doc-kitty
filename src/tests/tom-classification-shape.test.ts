import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { docKittyFields } from '../lib/schema.ts';

// The tom_classification field shape (ADR-0080, FR-002, FR-014). Id resolution is
// not checked here: the measures core does that in the routes and the catalog gate.
const parse = (rel: string) =>
  matter(readFileSync(fileURLToPath(new URL(`./fixtures/${rel}`, import.meta.url)), 'utf8')).data as Record<string, unknown>;

const buildSchema = z.object(docKittyFields);

describe('tom_classification shape', () => {
  it('accepts bare ids and { measure, scope?, note? } on the gate', () => {
    const { problems, warnings } = validate('tom-classification.md', parse('valid/tom-classification.md'));
    expect(problems).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it.each(['bad-scope', 'no-measure', 'not-list'])('rejects err/tom-classification-%s.md naming the field', (name) => {
    const { problems } = validate(`tom-classification-${name}.md`, parse(`err/tom-classification-${name}.md`));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('tom_classification');
  });

  it('warns once on a case variant of the key and never fails', () => {
    const { problems, warnings } = validate('tom-classification-case-variant.md', parse('warn/tom-classification-case-variant.md'));
    expect(problems).toEqual([]);
    expect(warnings).toEqual(['unknown key `TOM_classification`: did you mean `tom_classification`?']);
  });

  it('the build schema keeps tom_classification and drops a case variant', () => {
    const valid = buildSchema.safeParse(parse('valid/tom-classification.md'));
    expect(valid.success && valid.data.tom_classification).toEqual([
      'transmission-protection',
      { measure: 'accountability', scope: 'organisation', note: 'Every incident gets a named owner.' },
    ]);
    const variant = buildSchema.safeParse(parse('warn/tom-classification-case-variant.md'));
    expect(variant.success).toBe(true);
    expect(variant.success && 'TOM_classification' in variant.data).toBe(false);
  });
});

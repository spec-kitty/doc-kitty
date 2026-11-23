/**
 * The `Role` kind (ADR-0085, #402): an accountable function, kept apart from the
 * reader-facing `Persona` (ADR-0019). Both arms are exercised on the production
 * path: the build schema twin (`docKittyFields`) and the standalone gate
 * (`validate`). A Role page requires `role` and `responsibilities`; `goals` is
 * optional. The Persona rule is pinned unchanged alongside.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
import { KINDS } from '../lib/vocabulary-core.mjs';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { docKittyFields } from '../lib/schema.ts';

const fixturesUrl = new URL('./fixtures/', import.meta.url);
const buildSchema = z.object(docKittyFields);

function parse(rel: string): Record<string, unknown> {
  return matter(readFileSync(fileURLToPath(new URL(rel, fixturesUrl)), 'utf8')).data as Record<string, unknown>;
}

const validRole = () => parse('valid/role.md');

describe('Role kind (ADR-0085)', () => {
  it('is a canonical kind', () => {
    expect(KINDS).toContain('Role');
  });

  it('a Role page with role and responsibilities, and no goals, passes the gate with no kind warning', () => {
    const { problems, warnings } = validate('role.md', validRole());
    expect(problems).toEqual([]);
    expect(warnings.filter((w: string) => w.includes('kind: Role'))).toEqual([]);
  });

  it('the build schema stays lenient for a Role page (kind is an open string there; the gate holds the rule)', () => {
    expect(buildSchema.safeParse(validRole()).success).toBe(true);
  });

  it('rejects a Role page without `role`', () => {
    const { problems } = validate('role-no-role.md', parse('err/role-no-role.md'));
    expect(problems.some((p: string) => p.startsWith('`role`') && p.includes('role requires'))).toBe(true);
  });

  it('rejects a Role page with an empty `responsibilities` list', () => {
    const { problems } = validate('role-no-responsibilities.md', parse('err/role-no-responsibilities.md'));
    expect(problems.some((p: string) => p.startsWith('`responsibilities`'))).toBe(true);
  });

  it('rejects blank responsibility entries (non-vacuity pair of the empty-list case)', () => {
    const data = { ...validRole(), responsibilities: ['  '] };
    expect(validate('role.md', data).problems.some((p: string) => p.startsWith('`responsibilities`'))).toBe(true);
  });

  it('rejects a blank `role` string', () => {
    const data = { ...validRole(), role: '   ' };
    expect(validate('role.md', data).problems.some((p: string) => p.startsWith('`role`'))).toBe(true);
  });

  it('does not require `goals` on a Role page', () => {
    const { problems } = validate('role.md', validRole());
    expect(problems.some((p: string) => p.startsWith('`goals`'))).toBe(false);
  });
});

describe('Persona rule unchanged (FR-003)', () => {
  const persona = () => parse('persona/valid-persona.md');

  it('a valid Persona still passes', () => {
    expect(validate('valid-persona.md', persona()).problems).toEqual([]);
  });

  it('a Persona without goals still fails on goals, with the existing message', () => {
    const data = persona();
    delete data.goals;
    expect(validate('valid-persona.md', data).problems).toContain(
      '`goals`: persona requires a non-empty list of non-empty strings',
    );
  });

  it('a Persona without role still fails with the existing message', () => {
    const data = persona();
    delete data.role;
    expect(validate('valid-persona.md', data).problems).toContain('`role`: persona requires a non-empty string');
  });
});

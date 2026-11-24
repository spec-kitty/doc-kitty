/**
 * Operating-model templates (#402, ADR-0085, ADR-0080). Twelve templates, each a
 * manifest record plus a Markdown body, rendered into a page by a pure function.
 *
 * - The manifest matches the starter set the spec fixes (ids, paths, kinds,
 *   measures), and every kind, type and measure id resolves.
 * - Every rendered page passes the real frontmatter gate, alone and as a tree,
 *   and its measures resolve against the default catalog.
 * - Template bodies hold structure and prompts only (NFR-004, C-001): headings and
 *   HTML comments, nothing else.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { DOC_TYPES, KINDS } from '../lib/vocabulary-core.mjs';
import { DEFAULT_MEASURES } from '../lib/measures-default.mjs';
import { buildMeasuresIndex, classificationProblems } from '../lib/measures-core.mjs';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { SCAFFOLD_PRODUCER } from '../lib/generator-stamp.mjs';
import {
  OPERATING_MODEL_TEMPLATES,
  TEMPLATE_IDS,
  renderTemplatePage,
  templateById,
} from '../lib/operating-model-templates.mjs';

const NOW = new Date('2026-11-24T09:00:00Z');
const bodiesDir = fileURLToPath(new URL('../lib/templates/operating-model/', import.meta.url));
const measuresIndex = buildMeasuresIndex(DEFAULT_MEASURES);

/** The starter set from issue #402, as fixed in data-model.md. */
const EXPECTED = [
  ['organisation', 'operating-model/organisation', 'Explanation', ['it-security-governance']],
  ['role', 'operating-model/roles/accountable-role', 'Role', ['accountability']],
  ['governance-forums', 'operating-model/governance-forums', 'Reference', ['it-security-governance', 'accountability']],
  ['policy-index', 'operating-model/policy-index', 'Hub', ['it-security-governance']],
  ['access-management', 'operating-model/access-management', 'How-To', ['user-identification-authorisation']],
  ['change-management', 'operating-model/change-management', 'How-To', ['system-configuration', 'testing-evaluation']],
  ['incident-response', 'operations/runbooks/incident-response', 'How-To', ['availability-restoration', 'accountability']],
  [
    'business-continuity',
    'operations/runbooks/business-continuity',
    'How-To',
    ['availability-restoration', 'confidentiality-integrity-availability-resilience'],
  ],
  ['supplier-management', 'operating-model/supplier-management', 'How-To', ['certification-assurance']],
  ['people', 'operating-model/people', 'How-To', ['it-security-governance']],
  ['data-lifecycle', 'operating-model/data-lifecycle', 'How-To', ['limited-retention', 'portability-erasure']],
  ['assurance-audits', 'operating-model/assurance-audits', 'Reference', ['testing-evaluation', 'certification-assurance']],
] as const;

/** The lines of a body that are neither headings, HTML comments nor blank (NFR-004). */
function nonPromptLines(body: string): string[] {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => line.trim() !== '' && !/^#{1,6} /.test(line));
}

/** Parse a rendered page; copy the data, since gray-matter caches by content. */
function frontmatter(page: string): Record<string, unknown> {
  return { ...(matter(page).data as Record<string, unknown>) };
}

describe('operating-model manifest', () => {
  it('holds exactly the 12 starter templates, with unique ids', () => {
    expect(OPERATING_MODEL_TEMPLATES).toHaveLength(12);
    expect(new Set(TEMPLATE_IDS).size).toBe(12);
  });

  it('matches the starter set: id, path, kind and measures, in order', () => {
    expect(OPERATING_MODEL_TEMPLATES.map((t) => [t.id, t.path, t.kind, [...t.measures]])).toEqual(
      EXPECTED.map(([id, path, kind, measures]) => [id, path, kind, [...measures]]),
    );
  });

  it('uses only canonical kinds and types, and measure ids from the default catalog', () => {
    for (const t of OPERATING_MODEL_TEMPLATES) {
      expect(KINDS, t.id).toContain(t.kind);
      expect(DOC_TYPES, t.id).toContain(t.defaultType);
      for (const m of t.measures) expect(measuresIndex.has(m), `${t.id}: ${m}`).toBe(true);
    }
  });

  it('has no Runbook kind: the two runbooks are How-To pages under operations/runbooks/', () => {
    expect(OPERATING_MODEL_TEMPLATES.some((t) => (t.kind as string) === 'Runbook')).toBe(false);
    for (const id of ['incident-response', 'business-continuity']) {
      const t = templateById(id)!;
      expect(t.kind).toBe('How-To');
      expect(t.path.startsWith('operations/runbooks/')).toBe(true);
    }
  });

  it('is frozen, so a caller cannot change a shipped record', () => {
    const t = templateById('role')!;
    expect(Object.isFrozen(OPERATING_MODEL_TEMPLATES)).toBe(true);
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.measures)).toBe(true);
  });

  it('returns undefined for an unknown id', () => {
    expect(templateById('no-such-template')).toBeUndefined();
  });
});

describe('renderTemplatePage', () => {
  it('renders a Role page with role, responsibilities and an organisation-scope accountability entry', () => {
    const data = frontmatter(renderTemplatePage(templateById('role')!, { title: 'Data Protection Officer', now: NOW }));
    expect(data.title).toBe('Data Protection Officer');
    expect(data.kind).toBe('Role');
    expect(typeof data.role === 'string' && (data.role as string).trim().length > 0).toBe(true);
    expect(Array.isArray(data.responsibilities) && (data.responsibilities as unknown[]).length > 0).toBe(true);
    expect(data.tom_classification).toEqual([{ measure: 'accountability', scope: 'organisation' }]);
  });

  it('lists every preset measure at organisation scope, in manifest order', () => {
    const data = frontmatter(renderTemplatePage(templateById('change-management')!, { now: NOW }));
    expect(data.tom_classification).toEqual([
      { measure: 'system-configuration', scope: 'organisation' },
      { measure: 'testing-evaluation', scope: 'organisation' },
    ]);
  });

  it('keeps a title with a colon valid YAML', () => {
    const page = renderTemplatePage(templateById('people')!, { title: 'People: onboarding and offboarding', now: NOW });
    const block = page.split('---\n')[1];
    expect(parseYaml(block).title).toBe('People: onboarding and offboarding');
  });

  it('derives type Runbook under operations/runbooks/, and Operations under operating-model/', () => {
    expect(frontmatter(renderTemplatePage(templateById('incident-response')!, { now: NOW })).type).toBe('Runbook');
    expect(frontmatter(renderTemplatePage(templateById('organisation')!, { now: NOW })).type).toBe('Operations');
  });

  it('lets an explicit type override the derived one', () => {
    const data = frontmatter(renderTemplatePage(templateById('organisation')!, { type: 'Context', now: NOW }));
    expect(data.type).toBe('Context');
  });

  it('starts as a draft and carries the shared scaffold metadata', () => {
    const data = frontmatter(renderTemplatePage(templateById('policy-index')!, { now: NOW }));
    expect(data.doc_status).toBe('draft');
    expect(data.authors).toEqual(['human:TODO-your-id']);
    expect((data.generated as { by: string }).by.startsWith(`${SCAFFOLD_PRODUCER}/`)).toBe(true);
  });

  it('is deterministic for a fixed clock', () => {
    const t = templateById('assurance-audits')!;
    expect(renderTemplatePage(t, { now: NOW })).toBe(renderTemplatePage(t, { now: NOW }));
  });

  it('puts the title heading before the template body', () => {
    const page = renderTemplatePage(templateById('organisation')!, { now: NOW });
    const body = matter(page).content.trimStart();
    expect(body.startsWith('# Organisation and teams\n')).toBe(true);
  });
});

describe('every rendered template passes the gate (FR-012)', () => {
  for (const t of OPERATING_MODEL_TEMPLATES) {
    it(`${t.id}: 0 gate problems and every measure resolves`, () => {
      const data = frontmatter(renderTemplatePage(t, { now: NOW }));
      expect(validate(`${t.path}.md`, data).problems).toEqual([]);
      expect(classificationProblems(data.tom_classification, measuresIndex, t.path, 'default')).toEqual([]);
    });
  }

});

describe('template bodies hold structure and prompts only (NFR-004, C-001)', () => {
  for (const t of OPERATING_MODEL_TEMPLATES) {
    it(`${t.id}: only headings, HTML comments and blank lines`, () => {
      const body = readFileSync(join(bodiesDir, t.body), 'utf8');
      // Non-vacuity: a real skeleton, with real prompts.
      expect((body.match(/^#{2,6} /gm) ?? []).length, 'headings').toBeGreaterThanOrEqual(2);
      expect((body.match(/<!--/g) ?? []).length, 'prompts').toBeGreaterThanOrEqual(2);
      expect(nonPromptLines(body)).toEqual([]);
    });

    it(`${t.id}: opens with the structure-only, not-legal-advice notice`, () => {
      const body = readFileSync(join(bodiesDir, t.body), 'utf8');
      const first = body.match(/<!--([\s\S]*?)-->/)?.[1] ?? '';
      expect(first).toMatch(/Structure and prompts only/);
      expect(first).toMatch(/not legal advice/);
    });
  }

  it('the NFR-004 check catches prose outside a comment (positive control)', () => {
    // Same helper as the body tests, so the control cannot drift from them.
    const body = '## Scope\n\n<!-- Who is in scope? -->\n\nAll changes must be approved by the CAB.\n';
    expect(nonPromptLines(body)).toEqual(['All changes must be approved by the CAB.']);
  });
});

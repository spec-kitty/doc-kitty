/**
 * The pack file classifier (#330, ADR-0079 D1) is held to the charter's own
 * classifier conformance cases, vendored with the contract
 * (`contract/conformance/classifier-cases.yaml`, charter #559). Every case must
 * give its expected outcome, rule, kind, schema and content form, and every rule
 * of `file-kinds.yaml` must have a case (the charter's ClassifierConformanceTest
 * makes the same check).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadContract } from '../lib/packs/contract.mjs';
import { classify, compileGlob, createClassifier } from '../lib/packs/classify.mjs';

const CASES_FILE = fileURLToPath(new URL('../lib/packs/contract/conformance/classifier-cases.yaml', import.meta.url));
type Case = { path: string; expect: string; rule?: string; kind?: string; schema?: string; content_form?: string };
const cases: Case[] = parse(readFileSync(CASES_FILE, 'utf8')).cases;
const { fileKinds } = loadContract();

describe('classifier conformance (charter classifier-cases.yaml)', () => {
  it('reads the whole case file', () => {
    const raw = readFileSync(CASES_FILE, 'utf8');
    expect(cases.length).toBe((raw.match(/^\s*- \{path:/gm) ?? []).length);
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c) => [c.path, c] as const))('%s', (_path, c) => {
    const got = classify(c.path, fileKinds);
    expect({
      expect: got.expect,
      rule: got.rule,
      kind: got.kind,
      schema: got.schema,
      content_form: got.contentForm,
    }).toEqual({
      expect: c.expect,
      rule: c.rule,
      kind: c.kind,
      schema: c.schema,
      content_form: c.content_form,
    });
  });

  it('every rule of file-kinds.yaml decides at least one case', () => {
    const covered = new Set(cases.map((c) => c.rule).filter(Boolean));
    const uncovered = ['files', 'exclusions', 'retired', 'payloads', 'ignored'].flatMap((section) =>
      (fileKinds[section] as { match: string }[]).filter((r) => !covered.has(r.match)).map((r) => `${section}: ${r.match}`),
    );
    expect(uncovered).toEqual([]);
  });
});

describe('compileGlob', () => {
  it('keeps `*` within one segment, a leading dot included', () => {
    expect(compileGlob('*/pack.yaml').test('core/pack.yaml')).toBe(true);
    expect(compileGlob('*/pack.yaml').test('core/sub/pack.yaml')).toBe(false);
    expect(compileGlob('*/assets/**/.*').test('core/assets/.DS_Store')).toBe(true);
  });

  it('matches zero or more whole segments with `**/`', () => {
    expect(compileGlob('**/*.tactic.yaml').test('core/a.tactic.yaml')).toBe(true);
    expect(compileGlob('**/*.tactic.yaml').test('core/x/y/z/a.tactic.yaml')).toBe(true);
    expect(compileGlob('**/*.tactic.yaml').test('a.tactic.yaml')).toBe(true);
  });

  it('treats every other character as literal', () => {
    expect(compileGlob('built-in.source.yaml').test('built-in.source.yaml')).toBe(true);
    expect(compileGlob('built-in.source.yaml').test('built-inXsourceXyaml')).toBe(false);
    expect(compileGlob('*/a+b.yaml').test('core/a+b.yaml')).toBe(true);
  });

  it('is case-sensitive unless asked otherwise', () => {
    expect(compileGlob('**/*.md').test('core/NOTES.MD')).toBe(false);
    expect(compileGlob('**/*.md', { caseInsensitive: true }).test('core/NOTES.MD')).toBe(true);
  });
});

describe('case variants run the full precedence in lower case before the ignored step (PackFileKind.classifyFolded)', () => {
  it('excludes a case variant of an excluded README: the folded run is an exclusion, so ignored applies', () => {
    expect(classify('core/missions/plan/Templates/README.md', fileKinds)).toMatchObject({ expect: 'excluded', rule: '**/*.md' });
    expect(classify('core/Assets/logos/README.md', fileKinds)).toMatchObject({ expect: 'excluded', rule: '**/*.md' });
  });

  it('refuses a case variant the folded run maps or retires', () => {
    expect(classify('core/toolguides/a.guide.MD', fileKinds)).toEqual({ expect: 'unmodelled' });
    expect(classify('core/Mission-Steps/plan/specify.md', fileKinds)).toEqual({ expect: 'unmodelled' });
    expect(classify('core/Templates/spec-template.md', fileKinds)).toEqual({ expect: 'unmodelled' });
  });
});

describe('createClassifier', () => {
  it('compiles once per contract and carries the rule reason', () => {
    expect(createClassifier(fileKinds)).toBe(createClassifier(fileKinds));
    const retired = classify('core/pack.md', fileKinds);
    expect(retired.expect).toBe('retired');
    expect(retired.reason).toMatch(/README\.md/);
  });
});

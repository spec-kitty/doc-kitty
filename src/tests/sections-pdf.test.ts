/**
 * The section `pdf` key (ADR-0081, #382): both registry normalizers carry it the same
 * way, and an invalid value is advisory, never a failure.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseSectionRegistry } from '../lib/sections.js';
import { loadSectionRegistry as loadBareRegistry } from '../lib/vocabulary-loader.mjs';
import { normalizeSectionPdf } from '../lib/vocabulary-core.mjs';

const YAML = `version: 1
sections:
  - id: architecture
    label: Architecture
    order: 20
    pdf: true
  - id: guides
    label: Guides
    order: 30
    pdf: false
  - id: rhetoric
    label: Rhetoric
    order: 40
    pdf: { site: appendix }
  - id: plans
    label: Plans
    order: 50
    pdf: { section: true, site: omit }
  - id: broken
    label: Broken
    order: 60
    pdf: yes-please
  - id: half
    label: Half
    order: 70
    pdf: { section: true, site: sideways }
  - id: plain
    label: Plain
    order: 80
`;

const EXPECTED = {
  architecture: { section: true },
  guides: { section: false },
  rhetoric: { site: 'appendix' },
  plans: { section: true, site: 'omit' },
  broken: undefined,
  half: { section: true },
  plain: undefined,
};

describe('normalizeSectionPdf', () => {
  it('reads the shorthand and the mapping', () => {
    const warn = (m: string) => {
      throw new Error(m);
    };
    expect(normalizeSectionPdf(true, warn, 'a')).toEqual({ section: true });
    expect(normalizeSectionPdf(false, warn, 'a')).toEqual({ section: false });
    expect(normalizeSectionPdf({ section: false, site: 'appendix' }, warn, 'a')).toEqual({ section: false, site: 'appendix' });
    expect(normalizeSectionPdf(undefined, warn, 'a')).toBeUndefined();
  });

  it('warns and drops an invalid value or part, never throws', () => {
    const warnings: string[] = [];
    const warn = (m: string) => warnings.push(m);
    expect(normalizeSectionPdf('yes', warn, 'x')).toBeUndefined();
    expect(normalizeSectionPdf([true], warn, 'x')).toBeUndefined();
    expect(normalizeSectionPdf({ site: 'sideways', colour: 'blue' }, warn, 'x')).toBeUndefined();
    expect(normalizeSectionPdf({ section: 'true' }, warn, 'x')).toBeUndefined();
    expect(warnings).toHaveLength(5);
    expect(warnings[0]).toContain('section "x" "pdf"');
  });
});

describe('both registry readers carry pdf', () => {
  it('the Astro-side parser keeps every valid setting and warns on the rest', () => {
    const warnings: string[] = [];
    const registry = parseSectionRegistry(YAML, { warn: (m) => warnings.push(m), source: 'sections.yaml' });
    expect(Object.fromEntries(registry.map((e) => [e.id, e.pdf]))).toEqual(EXPECTED);
    expect(warnings.filter((w) => w.includes('"pdf"'))).toHaveLength(2);
  });

  it('the bare-Node loader agrees, so gates and the PDF command see the same setting', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-sections-pdf-'));
    mkdirSync(path.join(root, '_meta'));
    writeFileSync(path.join(root, '_meta', 'sections.yaml'), YAML);
    const registry = loadBareRegistry(root) ?? [];
    expect(Object.fromEntries(registry.map((e) => [e.id, e.pdf]))).toEqual(EXPECTED);
  });
});

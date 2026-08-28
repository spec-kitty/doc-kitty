import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  expectedType,
  loadSectionTypes,
  validate,
  SECTION_TYPE,
} from '../scripts/validate-frontmatter.mjs';
import { expectedTypeForPath, DOC_TYPES } from '../lib/schema.ts';
import { parseSectionRegistry } from '../lib/sections.js';

/**
 * Issue #24: the `sections.yaml` registry — not a hardcoded switch — is the
 * section-default `type` authority. These tests pin the closure across the two
 * consuming surfaces that were previously registry-blind: the standalone
 * `validate-frontmatter.mjs` gate (`expectedType`/`loadSectionTypes`) and the
 * build-side `schema.ts` (`expectedTypeForPath`). The severity stays ADVISORY —
 * a mismatch is a warning, never a hard problem.
 */

// A fixture registry whose `guides` type deliberately DIFFERS from the frozen
// fallback ('Guide'), so a green test proves the derivation follows the registry.
const REGISTRY_YAML = `version: 1
sections:
  - id: architecture
    label: Architecture
    order: 20
    type: Architecture
  - id: adr
    label: Decision Records
    order: 30
    type: ADR
  - id: guides
    label: Handbook
    order: 40
    type: Handbook
  - id: plans
    label: Plans
    order: 50
    type: Plan
  - id: operations
    label: Operations
    order: 60
    type: Operations
`;

describe('validate-frontmatter loadSectionTypes (registry consumption, issue #24)', () => {
  it('reads <docsRoot>/_meta/sections.yaml into an id → type map', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-types-'));
    try {
      mkdirSync(path.join(dir, '_meta'), { recursive: true });
      writeFileSync(path.join(dir, '_meta', 'sections.yaml'), REGISTRY_YAML, 'utf8');
      const map = loadSectionTypes(dir);
      expect(map).toMatchObject({
        architecture: 'Architecture',
        adr: 'ADR',
        guides: 'Handbook',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null (graceful fallback) when no registry file is present', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-types-none-'));
    try {
      expect(loadSectionTypes(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('validate-frontmatter expectedType (registry-derived, issue #24)', () => {
  const types = loadSectionTypesFrom(REGISTRY_YAML);

  it('derives the section default from the registry map', () => {
    expect(expectedType('architecture/overview.md', types)).toBe('Architecture');
    // A section README takes the section type.
    expect(expectedType('architecture/README.md', types)).toBe('Architecture');
  });

  it('follows the registry when its type differs from the OLD hardcoded value', () => {
    // The pre-#24 switch hardcoded guides → 'Guide'. The registry now says
    // 'Handbook', and the expectation must follow the registry.
    expect(SECTION_TYPE['guides']).toBe('Guide'); // frozen fallback unchanged
    expect(expectedType('guides/deploy.md', types)).toBe('Handbook');
  });

  it('still applies the sub-path overrides on top of the registry default', () => {
    expect(expectedType('adr/0001-decide.md', types)).toBe('ADR');
    expect(expectedType('adr/template.md', types)).toBe('Template');
    expect(expectedType('plans/epics/e.md', types)).toBe('Epic');
    expect(expectedType('plans/features/f.md', types)).toBe('Feature');
    expect(expectedType('operations/runbooks/r.md', types)).toBe('Runbook');
    expect(expectedType('operations/monitor.md', types)).toBe('Operations');
  });

  it('falls back to the frozen SECTION_TYPE map when no map is passed', () => {
    expect(expectedType('guides/deploy.md')).toBe('Guide');
    expect(expectedType('context/intro.md')).toBe('Context');
    expect(expectedType('adr/template.md')).toBe('Template');
  });

  it('yields null for a section absent from the registry map (no expectation)', () => {
    expect(expectedType('context/intro.md', types)).toBeNull();
  });
});

describe('validate() honours the registry map and keeps the mismatch ADVISORY', () => {
  const types = loadSectionTypesFrom(REGISTRY_YAML);

  it('warns (does not fail) when a declared type mismatches the registry default', () => {
    const { problems, warnings } = validate(
      'guides/deploy.md',
      { title: 'Deploy', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', type: 'Guide', kind: 'How-To' },
      types,
    );
    // Registry says guides → 'Handbook'; declared 'Guide' is a canonical DOC_TYPE,
    // so the only signal is the advisory path/registry-suggestion warning.
    expect(problems).toEqual([]);
    expect(warnings.some((w) => /path suggests `Handbook`/.test(w))).toBe(true);
  });

  it('is silent when the declared (canonical) type matches the registry default', () => {
    // `architecture` → 'Architecture' (canonical, and matches): no unknown-type
    // warning and no path-suggests warning — a clean pass.
    const { problems, warnings } = validate(
      'architecture/overview.md',
      { title: 'Overview', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', type: 'Architecture', kind: 'Reference' },
      types,
    );
    expect(problems).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('keeps the bundle-root README exempt from `type` regardless of registry', () => {
    const { problems, warnings } = validate(
      'README.md',
      { title: 'Docs', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', okf_version: '0.2', kind: 'Hub' },
      types,
    );
    // No `type` present and none required for the bundle root.
    expect(problems).toEqual([]);
    expect(warnings.some((w) => /path suggests/.test(w))).toBe(false);
  });
});

describe('schema.ts expectedTypeForPath (registry-derived, issue #24)', () => {
  const registry = parseSectionRegistry(REGISTRY_YAML);

  it('derives the expected type from the registry', () => {
    expect(expectedTypeForPath('architecture/overview.md', registry)).toBe('Architecture');
    expect(expectedTypeForPath('guides/deploy.md', registry)).toBe('Handbook');
    expect(expectedTypeForPath('adr/0001-x.md', registry)).toBe('ADR');
    expect(expectedTypeForPath('adr/template.md', registry)).toBe('Template');
  });

  it('gracefully falls back to the frozen map when the registry is null', () => {
    expect(expectedTypeForPath('guides/deploy.md', null)).toBe('Guide');
    expect(expectedTypeForPath('context/intro.md', null)).toBe('Context');
  });

  it('keeps the type vocabulary open/advisory: DOC_TYPES stays the canonical set', () => {
    // A declared type outside the derived expectation is advisory, not a schema
    // error — the canonical set is exported for that warn check, unchanged.
    expect(DOC_TYPES).toContain('Guide');
    expect(DOC_TYPES).toContain('Architecture');
    // An unknown section yields no expectation (null), so nothing to check against.
    expect(expectedTypeForPath('marketing/pitch.md', registry)).toBeNull();
  });
});

/** Parse a registry body into the standalone gate's `id → type` map via a temp dir. */
function loadSectionTypesFrom(yaml: string): Record<string, string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-types-load-'));
  try {
    mkdirSync(path.join(dir, '_meta'), { recursive: true });
    writeFileSync(path.join(dir, '_meta', 'sections.yaml'), yaml, 'utf8');
    return loadSectionTypes(dir) as Record<string, string>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

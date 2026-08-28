import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseSectionRegistry,
  loadSectionRegistry,
  sectionOrder,
  sectionLabels,
  registryToSidebar,
  BUILD_GENERATED_SECTION_IDS,
  type SectionRegistry,
} from '../lib/sections.js';

// A representative authored registry body (a subset of docs/_meta/sections.yaml
// plus a glossary → "Reference" entry and an id absent from the frozen tuple).
const REGISTRY_YAML = `version: 1
sections:
  - id: context
    label: Context
    order: 10
    type: Context
  - id: architecture
    label: Architecture
    order: 20
    type: Architecture
  - id: adr
    label: Decision Records
    order: 30
    type: ADR
  - id: glossary
    label: Reference
    order: 60
    type: Glossary
  - id: faq
    label: FAQ
    order: 25
`;

describe('parseSectionRegistry', () => {
  it('parses a fixture into an ordered list sorted by `order`', () => {
    const reg = parseSectionRegistry(REGISTRY_YAML);
    expect(reg.map((e) => e.id)).toEqual([
      'context', // 10
      'architecture', // 20
      'faq', // 25 — sorts by order, NOT source position
      'adr', // 30
      'glossary', // 60
    ]);
    expect(reg[0]).toMatchObject({ id: 'context', label: 'Context', order: 10 });
  });

  it('carries the (deferred) `type` field without consuming it', () => {
    const reg = parseSectionRegistry(REGISTRY_YAML);
    expect(reg.find((e) => e.id === 'adr')?.type).toBe('ADR');
  });

  it('throws on a duplicate `id` (ambiguous section)', () => {
    const dup = `version: 1
sections:
  - id: adr
    label: One
    order: 10
  - id: adr
    label: Two
    order: 20
`;
    expect(() => parseSectionRegistry(dup)).toThrow(/duplicate section id "adr"/);
  });

  it('warns on a duplicate `order` and tie-breaks by id', () => {
    const warnings: string[] = [];
    const dupOrder = `version: 1
sections:
  - id: zeta
    label: Zeta
    order: 10
  - id: alpha
    label: Alpha
    order: 10
`;
    const reg = parseSectionRegistry(dupOrder, { warn: (m) => warnings.push(m) });
    // Same order → alphabetical id tiebreak: alpha before zeta.
    expect(reg.map((e) => e.id)).toEqual(['alpha', 'zeta']);
    expect(warnings.some((w) => /duplicate order 10/.test(w))).toBe(true);
  });

  it('throws when an entry is missing a required field', () => {
    const noLabel = `version: 1
sections:
  - id: adr
    order: 10
`;
    expect(() => parseSectionRegistry(noLabel)).toThrow(/missing a string "label"/);
    const noOrder = `version: 1
sections:
  - id: adr
    label: ADR
`;
    expect(() => parseSectionRegistry(noOrder)).toThrow(/missing a numeric "order"/);
  });

  it('throws when `sections` is not a list', () => {
    expect(() => parseSectionRegistry('version: 1\n')).toThrow(/"sections" must be a YAML list/);
  });
});

describe('loadSectionRegistry', () => {
  it('returns null (graceful sentinel) when the registry file is absent', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-sections-none-'));
    try {
      // No _meta/sections.yaml under this docs root.
      expect(loadSectionRegistry(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads and parses <docsRoot>/_meta/sections.yaml when present', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-sections-'));
    try {
      mkdirSync(path.join(dir, '_meta'), { recursive: true });
      writeFileSync(path.join(dir, '_meta', 'sections.yaml'), REGISTRY_YAML, 'utf8');
      const reg = loadSectionRegistry(dir);
      expect(reg).not.toBeNull();
      expect(sectionLabels(reg!)['glossary']).toBe('Reference');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('sectionOrder / sectionLabels derivations', () => {
  const reg: SectionRegistry = parseSectionRegistry(REGISTRY_YAML);

  it('sectionOrder returns ids in display order', () => {
    expect(sectionOrder(reg)).toEqual(['context', 'architecture', 'faq', 'adr', 'glossary']);
  });

  it('sectionLabels maps id → label', () => {
    expect(sectionLabels(reg)).toMatchObject({
      adr: 'Decision Records',
      glossary: 'Reference',
    });
  });
});

describe('registryToSidebar (registry → Starlight sidebar shape)', () => {
  const reg: SectionRegistry = parseSectionRegistry(REGISTRY_YAML);

  it('emits one autogenerate group per PRESENT section, in registry order', () => {
    // `faq` is registered but has no folder on disk → skipped (Starlight would
    // throw on an empty autogenerate directory).
    const present = ['context', 'architecture', 'adr', 'glossary'];
    // `faq` is registered but absent and not generated → it warns; silence it so
    // this test asserts only on the emitted-groups shape.
    const sidebar = registryToSidebar(reg, present, { warn: () => {} });
    expect(sidebar).toEqual([
      { label: 'Context', autogenerate: { directory: 'context' } },
      { label: 'Architecture', autogenerate: { directory: 'architecture' } },
      { label: 'Decision Records', autogenerate: { directory: 'adr' } },
      { label: 'Reference', autogenerate: { directory: 'glossary' } },
    ]);
  });

  it('labels the glossary group "Reference" pointing at the glossary/ folder', () => {
    const sidebar = registryToSidebar(reg, ['glossary'], { warn: () => {} });
    expect(sidebar).toContainEqual({
      label: 'Reference',
      autogenerate: { directory: 'glossary' },
    });
  });

  it('appends an on-disk folder with no registry entry (humanized), after registry groups', () => {
    const sidebar = registryToSidebar(reg, ['context', 'glossary', 'glossary-demo'], {
      // A section registered but neither present nor generated warns; silence it
      // here so this test asserts only on the append behavior.
      warn: () => {},
    });
    // Registered groups first (in order), then the leftover, humanized + alpha.
    expect(sidebar[sidebar.length - 1]).toEqual({
      label: 'Glossary Demo',
      autogenerate: { directory: 'glossary-demo' },
    });
    expect(sidebar.map((g) => g.label)).toEqual(['Context', 'Reference', 'Glossary Demo']);
  });

  // --- issue #23: build-generated sections must not vanish silently ----------

  it('emits a build-generated section group even when its folder is absent (issue #23)', () => {
    // `glossary` is registered (order 60) but NOT on disk — its pages are codegen'd
    // later, after config.ts snapshots the on-disk dirs. Seeded as generated, so
    // the "Reference" group must still be emitted.
    const present = ['context', 'architecture', 'faq', 'adr']; // every dir EXCEPT glossary
    const sidebar = registryToSidebar(reg, present, { generatedIds: ['glossary'] });
    expect(sidebar).toContainEqual({
      label: 'Reference',
      autogenerate: { directory: 'glossary' },
    });
    // The generated group keeps registry order (glossary is order 60 → last).
    expect(sidebar.map((g) => g.label)).toEqual([
      'Context',
      'Architecture',
      'FAQ',
      'Decision Records',
      'Reference',
    ]);
  });

  it('seeds BUILD_GENERATED_SECTION_IDS by default (glossary survives an absent folder)', () => {
    expect(BUILD_GENERATED_SECTION_IDS).toContain('glossary');
    // No explicit generatedIds → the default seed is used; glossary absent on disk.
    const sidebar = registryToSidebar(reg, ['context', 'architecture', 'faq', 'adr']);
    expect(sidebar.map((g) => g.label)).toContain('Reference');
  });

  it('warns (naming the id) and skips a registered section that is neither on disk nor generated (issue #23)', () => {
    const warnings: string[] = [];
    // `faq` (order 25) is registered but not present and not a build-generated id.
    const sidebar = registryToSidebar(reg, ['context', 'glossary'], {
      generatedIds: ['glossary'],
      warn: (m) => warnings.push(m),
    });
    // The group is skipped (Starlight would throw on a missing autogenerate dir)...
    expect(sidebar.some((g) => g.autogenerate.directory === 'faq')).toBe(false);
    // ...and a clear warning naming the id + the missing folder was emitted.
    expect(warnings.some((w) => /"faq"/.test(w) && /missing/.test(w))).toBe(true);
  });

  it('defaults the missing-folder warning to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Only glossary present (as a generated id); the other registered sections
      // are absent and not generated → console.warn for each.
      registryToSidebar(reg, ['glossary'], { generatedIds: ['glossary'] });
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.some((c) => String(c[0]).includes('"faq"'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * ATDD (T001) for flexible section identity — the registry `subtypes` half
 * (FR-005/FR-006/FR-007, US2, E-02, E-06, D-03). Proves a sub-path section
 * rename (`plans/features` → `plans/missions`) is a DATA edit: the registry
 * `subtypes` field derives the type, ahead of the built-in table, with the
 * built-in table staying the fallback (doc-kitty's own tree is a no-op).
 *
 * Mission: adopter-loader-migration-01M1KKYA, WP01.
 */
import { describe, it, expect } from 'vitest';
import {
  parseSectionRegistry,
  sectionTypes,
  sectionSubtypes,
  sectionIds,
  registryToSidebar,
  type SectionRegistry,
} from '../lib/sections.js';
import { expectedDocType, SECTION_TYPE } from '../lib/metadata.js';
import { expectedTypeForPath } from '../lib/schema.js';
import {
  expectedType as mjsExpectedType,
  SECTION_TYPE as MJS_SECTION_TYPE,
  validate,
} from '../scripts/validate-frontmatter.mjs';

// The frozen E-08 fixture datum: the illustrative rename this mission pins —
// `plans/features` → `plans/missions` — declared via a registry `subtypes`
// entry under the (unrenamed) top-level `plans` section id.
const RENAMED_REGISTRY_YAML = `version: 1
sections:
  - id: plans
    label: Plans
    order: 20
    type: Plan
    subtypes:
      - match: missions
        type: Mission
  - id: faq
    label: FAQ
    order: 90
`;

describe('registry subtypes parsing (E-02)', () => {
  it('parses a subtypes list onto its section entry', () => {
    const reg = parseSectionRegistry(RENAMED_REGISTRY_YAML);
    const plans = reg.find((e) => e.id === 'plans');
    expect(plans?.subtypes).toEqual([{ match: 'missions', type: 'Mission' }]);
  });

  it('an entry with no subtypes field carries none (undefined)', () => {
    const reg = parseSectionRegistry(RENAMED_REGISTRY_YAML);
    expect(reg.find((e) => e.id === 'faq')?.subtypes).toBeUndefined();
  });

  it('throws on a malformed subtypes entry (missing match/type — authored, must not silently skip)', () => {
    const badMatch = `version: 1
sections:
  - id: plans
    label: Plans
    order: 20
    subtypes:
      - type: Mission
`;
    expect(() => parseSectionRegistry(badMatch)).toThrow(/missing a string "match"/);

    const badType = `version: 1
sections:
  - id: plans
    label: Plans
    order: 20
    subtypes:
      - match: missions
`;
    expect(() => parseSectionRegistry(badType)).toThrow(/missing a string "type"/);
  });

  it('throws when subtypes is not a list', () => {
    const notList = `version: 1
sections:
  - id: plans
    label: Plans
    order: 20
    subtypes: missions
`;
    expect(() => parseSectionRegistry(notList)).toThrow(/must be a YAML list/);
  });
});

describe('sectionSubtypes / sectionIds resolvers', () => {
  const reg: SectionRegistry = parseSectionRegistry(RENAMED_REGISTRY_YAML);

  it('sectionSubtypes maps id → subtypes[] (only entries that declare one)', () => {
    const subtypes = sectionSubtypes(reg);
    expect(subtypes['plans']).toEqual([{ match: 'missions', type: 'Mission' }]);
    expect('faq' in subtypes).toBe(false);
  });

  it('sectionIds returns the FULL registered id set (distinct from sectionTypes)', () => {
    const ids = sectionIds(reg);
    expect(ids.has('plans')).toBe(true);
    expect(ids.has('faq')).toBe(true); // registered but typeless — still a known id
    expect(ids.has('missions')).toBe(false); // never a top-level id in this fixture
  });
});

describe('US2-AS1: renamed sub-path derives its type via registry subtypes (TS twin)', () => {
  const reg: SectionRegistry = parseSectionRegistry(RENAMED_REGISTRY_YAML);
  const typesBySection = sectionTypes(reg);
  const subtypesBySection = sectionSubtypes(reg);

  it('plans/missions/x.md derives "Mission" — the registry rule, not the section default', () => {
    expect(expectedDocType('plans/missions/x.md', typesBySection, subtypesBySection)).toBe(
      'Mission',
    );
  });

  it('plans/roadmap.md (no matching sub-path) still derives the section default "Plan"', () => {
    expect(expectedDocType('plans/roadmap.md', typesBySection, subtypesBySection)).toBe('Plan');
  });

  it('absent subtypes (no registry arg) → the BUILT-IN table still applies (backward-compat, NFR-003)', () => {
    // doc-kitty's own tree: plans/features still derives "Feature" from the
    // built-in table when no registry subtypes are supplied at all.
    expect(expectedDocType('plans/features/small.md')).toBe('Feature');
    expect(expectedDocType('plans/features/small.md', SECTION_TYPE)).toBe('Feature');
  });

  it('a registry with NO subtypes for a section falls through to the built-in table too', () => {
    // plans/epics has no registry subtypes rule in RENAMED_REGISTRY_YAML —
    // the built-in table (not the registry) still supplies "Epic".
    expect(expectedDocType('plans/epics/big.md', typesBySection, subtypesBySection)).toBe('Epic');
  });
});

describe('US2-AS1/AS2: the mjs twin agrees with the ts derivation (parity)', () => {
  const reg: SectionRegistry = parseSectionRegistry(RENAMED_REGISTRY_YAML);
  const typesBySection = sectionTypes(reg);
  const subtypesBySection = sectionSubtypes(reg);

  const CASES = ['plans/missions/x.md', 'plans/roadmap.md', 'plans/epics/big.md'];

  it.each(CASES)('%s: ts expectedDocType ≡ mjs expectedType', (relPath) => {
    expect(expectedDocType(relPath, typesBySection, subtypesBySection)).toBe(
      mjsExpectedType(relPath, typesBySection, subtypesBySection),
    );
  });

  it('the frozen fallback SECTION_TYPE maps stay byte-identical (pre-existing guard, still true)', () => {
    expect(MJS_SECTION_TYPE).toEqual(SECTION_TYPE);
  });
});

describe('US2-AS5: rename to an unregistered section id — documented default + warning', () => {
  const reg: SectionRegistry = parseSectionRegistry(RENAMED_REGISTRY_YAML);

  it('ts: expectedTypeForPath falls back to null and warns, naming the id', () => {
    const warnings: string[] = [];
    const result = expectedTypeForPath('missions-renamed-wrong/x.md', reg, {
      warn: (m) => warnings.push(m),
    });
    expect(result).toBeNull();
    expect(warnings.some((w) => /"missions-renamed-wrong"/.test(w) && /not registered/.test(w))).toBe(
      true,
    );
  });

  it('ts: a REGISTERED-but-typeless id (faq) does NOT warn (distinct from unregistered)', () => {
    const warnings: string[] = [];
    const result = expectedTypeForPath('faq/x.md', reg, { warn: (m) => warnings.push(m) });
    expect(result).toBeNull(); // no type declared for faq
    expect(warnings).toEqual([]);
  });

  it('ts: with NO registry at all (null), no warning fires (the ordinary orphan case, AS-3 precedent)', () => {
    const warnings: string[] = [];
    const result = expectedTypeForPath('unregistered/x.md', null, {
      warn: (m) => warnings.push(m),
    });
    expect(result).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('mjs: validate() surfaces the same unregistered-id warning via knownSectionIds', () => {
    const knownSectionIds = new Set(reg.map((e) => e.id));
    const data = {
      title: 'x',
      description: 'a'.repeat(60),
      doc_status: 'active',
      kind: 'Reference',
    };
    const { warnings } = validate('missions-renamed-wrong/x.md', data, undefined, undefined, {
      knownSectionIds,
    });
    expect(warnings.some((w) => /"missions-renamed-wrong"/.test(w) && /not registered/.test(w))).toBe(
      true,
    );
  });
});

describe('T006: registryToSidebar keeps the renamed section group rendering (ADR-0029)', () => {
  it('the plans group still renders (hub + children) after a SUB-PATH rename under it', () => {
    // registryToSidebar is keyed on the TOP-LEVEL section id ("plans"), which
    // did not change — only the sub-path (features → missions) did. The group
    // is fully generic/data-driven already (no id-specific code), so it must
    // keep rendering the "plans" group whether its subfolder is "features",
    // "missions", or both, with no code change (SC-002).
    const reg: SectionRegistry = parseSectionRegistry(RENAMED_REGISTRY_YAML);
    const sidebar = registryToSidebar(reg, ['plans'], { warn: () => {} });
    expect(sidebar).toContainEqual({
      label: 'Plans',
      autogenerate: { directory: 'plans' },
    });
  });

  it('a renamed TOP-LEVEL section id (registry updated) also renders under its new id', () => {
    const renamedTopLevel = `version: 1
sections:
  - id: missions
    label: Missions
    order: 20
    type: Mission
`;
    const reg: SectionRegistry = parseSectionRegistry(renamedTopLevel);
    const sidebar = registryToSidebar(reg, ['missions'], { warn: () => {} });
    expect(sidebar).toEqual([{ label: 'Missions', autogenerate: { directory: 'missions' } }]);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseSectionRegistry,
  loadSectionRegistry,
  resolveSectionRegistry,
  sectionOrder,
  sectionLabels,
  sectionTypes,
  sectionPurposes,
  sectionFeeds,
  feedsSurface,
  registryToSidebar,
  BUILD_GENERATED_SECTION_IDS,
  type SectionRegistry,
} from '../lib/sections.js';
import { resetDeprecationNotice } from '../lib/vocabulary-loader.mjs';

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

describe('resolveSectionRegistry — charter-aware path (charter → legacy → default, WP03)', () => {
  const CHARTER_WITH_ENTRIES = `version: 1
sections:
  entries:
    - id: guides
      label: Guides
      order: 10
      type: Guide
    - id: adr
      label: Decisions
      order: 20
      type: ADR
`;

  function docsRoot(): string {
    return mkdtempSync(path.join(tmpdir(), 'dk-resolve-sections-'));
  }
  function writeMeta(dir: string, name: string, body: string): void {
    mkdirSync(path.join(dir, '_meta'), { recursive: true });
    writeFileSync(path.join(dir, '_meta', name), body, 'utf8');
  }

  it('returns null when neither a charter nor a legacy registry is present (frozen-defaults fallback)', () => {
    const dir = docsRoot();
    try {
      expect(resolveSectionRegistry(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to the legacy sections.yaml when no charter declares sections (identical to loadSectionRegistry)', () => {
    const dir = docsRoot();
    try {
      resetDeprecationNotice();
      writeMeta(dir, 'sections.yaml', REGISTRY_YAML);
      expect(resolveSectionRegistry(dir)).toEqual(loadSectionRegistry(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves a charter-declared section registry from its `entries` (normalized like the legacy loader)', () => {
    const dir = docsRoot();
    try {
      resetDeprecationNotice();
      writeMeta(dir, 'charter.yaml', CHARTER_WITH_ENTRIES);
      const reg = resolveSectionRegistry(dir);
      expect(reg).not.toBeNull();
      expect(sectionOrder(reg!)).toEqual(['guides', 'adr']);
      expect(sectionTypes(reg!)).toEqual({ guides: 'Guide', adr: 'ADR' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the charter WINS over a legacy sections.yaml (per-axis precedence)', () => {
    const dir = docsRoot();
    try {
      resetDeprecationNotice();
      writeMeta(dir, 'sections.yaml', REGISTRY_YAML); // legacy: context/architecture/…
      writeMeta(dir, 'charter.yaml', CHARTER_WITH_ENTRIES); // charter: guides/adr
      expect(sectionOrder(resolveSectionRegistry(dir)!)).toEqual(['guides', 'adr']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a charter that declares section metadata but NO entries yields null (defaults apply)', () => {
    const dir = docsRoot();
    try {
      resetDeprecationNotice();
      writeMeta(dir, 'charter.yaml', 'version: 1\nsections:\n  index_basename: README\n  order: [ guides, adr ]\n');
      expect(resolveSectionRegistry(dir)).toBeNull();
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

  it('sectionTypes maps id → type (the section-default type authority, issue #24)', () => {
    const types = sectionTypes(reg);
    expect(types['adr']).toBe('ADR');
    expect(types['context']).toBe('Context');
    expect(types['architecture']).toBe('Architecture');
    expect(types['glossary']).toBe('Glossary');
  });

  it('sectionTypes omits an entry with no `type` (no section-default expectation)', () => {
    // `faq` in REGISTRY_YAML declares no `type`.
    const types = sectionTypes(reg);
    expect('faq' in types).toBe(false);
    expect(types['faq']).toBeUndefined();
  });
});

// A registry exercising `feeds` (a coarse per-surface filter) and `purpose` (the
// llms.txt blurb fallback). `context` declares a SUBSET of surfaces; `guides`
// OMITS `feeds` entirely (absent = all); `faq` declares neither `feeds` nor
// `purpose`.
const FEEDS_YAML = `version: 1
sections:
  - id: context
    label: Context
    order: 10
    purpose: Why the toolkit exists.
    feeds: [sitemap, llms]
  - id: plans
    label: Plans
    order: 20
    purpose: Roadmap and feature designs.
    feeds: [sitemap, llms, agent]
  - id: guides
    label: Guides
    order: 30
    purpose: Task-oriented how-tos.
  - id: faq
    label: FAQ
    order: 40
`;

describe('sectionPurposes / sectionFeeds / feedsSurface (feeds + purpose consumers)', () => {
  const reg: SectionRegistry = parseSectionRegistry(FEEDS_YAML);

  it('sectionPurposes maps id → purpose (only entries that declare one)', () => {
    const purposes = sectionPurposes(reg);
    expect(purposes['context']).toBe('Why the toolkit exists.');
    expect(purposes['plans']).toBe('Roadmap and feature designs.');
    expect(purposes['guides']).toBe('Task-oriented how-tos.');
    // `faq` declares no purpose → absent from the map (no blurb fallback for it).
    expect('faq' in purposes).toBe(false);
  });

  it('sectionFeeds maps id → surfaces, ONLY for sections that declare `feeds`', () => {
    const feeds = sectionFeeds(reg);
    expect(feeds['context']).toEqual(['sitemap', 'llms']);
    expect(feeds['plans']).toEqual(['sitemap', 'llms', 'agent']);
    // `guides` and `faq` omit `feeds` → absent from the map (absent = all).
    expect('guides' in feeds).toBe(false);
    expect('faq' in feeds).toBe(false);
  });

  it('feedsSurface: a section with `feeds:[sitemap,llms]` feeds those, not rss/agent', () => {
    const feeds = sectionFeeds(reg);
    expect(feedsSurface(feeds, 'context', 'sitemap')).toBe(true);
    expect(feedsSurface(feeds, 'context', 'llms')).toBe(true);
    expect(feedsSurface(feeds, 'context', 'rss')).toBe(false);
    expect(feedsSurface(feeds, 'context', 'agent')).toBe(false);
  });

  it('feedsSurface: a section with NO `feeds` entry feeds ALL FOUR (absent = all)', () => {
    const feeds = sectionFeeds(reg);
    for (const surface of ['sitemap', 'rss', 'llms', 'agent'] as const) {
      expect(feedsSurface(feeds, 'guides', surface)).toBe(true);
      // A section id not in the registry at all is likewise absent = all.
      expect(feedsSurface(feeds, 'unregistered', surface)).toBe(true);
    }
  });

  it('feedsSurface: an ABSENT feeds map (no registry) never filters — every surface true', () => {
    for (const surface of ['sitemap', 'rss', 'llms', 'agent'] as const) {
      expect(feedsSurface(undefined, 'context', surface)).toBe(true);
    }
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

  // --- Model D: the autogenerate directory is PREFIXED with the docsDir so the
  // group matches Starlight's un-stripped `docs/<id>/…` filePath and renders the
  // hub link AND child pages (empty otherwise under the `docs/` layout). ---------

  it('prefixes every autogenerate directory with `directoryPrefix` (docsDir)', () => {
    const present = ['context', 'architecture', 'adr', 'glossary'];
    const sidebar = registryToSidebar(reg, present, {
      directoryPrefix: 'docs',
      warn: () => {},
    });
    expect(sidebar).toEqual([
      { label: 'Context', autogenerate: { directory: 'docs/context' } },
      { label: 'Architecture', autogenerate: { directory: 'docs/architecture' } },
      { label: 'Decision Records', autogenerate: { directory: 'docs/adr' } },
      { label: 'Reference', autogenerate: { directory: 'docs/glossary' } },
    ]);
  });

  it('prefixes a build-generated section directory too (glossary absent on disk)', () => {
    // The glossary folder may be absent at the pre-codegen snapshot; it is emitted
    // via the generated seed, and its directory must ALSO carry the docsDir prefix
    // so the "Reference" group resolves `/glossary/` once its pages are codegen'd.
    const present = ['context', 'architecture', 'adr']; // glossary NOT on disk
    const sidebar = registryToSidebar(reg, present, {
      generatedIds: ['glossary'],
      directoryPrefix: 'docs',
    });
    expect(sidebar).toContainEqual({
      label: 'Reference',
      autogenerate: { directory: 'docs/glossary' },
    });
  });

  it('prefixes an appended (unregistered) leftover folder too', () => {
    const sidebar = registryToSidebar(reg, ['context', 'glossary', 'glossary-demo'], {
      directoryPrefix: 'docs',
      warn: () => {},
    });
    expect(sidebar[sidebar.length - 1]).toEqual({
      label: 'Glossary Demo',
      autogenerate: { directory: 'docs/glossary-demo' },
    });
  });

  it('normalizes the prefix (leading `./`, surrounding slashes, backslashes)', () => {
    for (const raw of ['docs', './docs', 'docs/', '/docs/', 'docs\\']) {
      const sidebar = registryToSidebar(reg, ['context'], {
        directoryPrefix: raw,
        warn: () => {},
      });
      expect(sidebar.find((g) => g.label === 'Context')).toEqual({
        label: 'Context',
        autogenerate: { directory: 'docs/context' },
      });
    }
  });

  it('supports a nested docsDir prefix (e.g. `content/docs`)', () => {
    const sidebar = registryToSidebar(reg, ['glossary'], {
      directoryPrefix: 'content/docs',
      warn: () => {},
    });
    expect(sidebar).toContainEqual({
      label: 'Reference',
      autogenerate: { directory: 'content/docs/glossary' },
    });
  });

  it('omits the prefix when `directoryPrefix` is absent/empty (bare `<id>` directory)', () => {
    const bare = registryToSidebar(reg, ['context', 'glossary'], { warn: () => {} });
    expect(bare).toContainEqual({ label: 'Context', autogenerate: { directory: 'context' } });
    const empty = registryToSidebar(reg, ['context'], {
      directoryPrefix: '',
      warn: () => {},
    });
    expect(empty).toContainEqual({ label: 'Context', autogenerate: { directory: 'context' } });
  });
});

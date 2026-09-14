import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  loadCharter,
  resolveGovernance,
  resetDeprecationNotice,
  loadVocabulary,
  loadSectionRegistry,
  CHARTER_REGISTRY_RELPATH,
} from '../lib/vocabulary-loader.mjs';
import { computeEffectiveCharter } from '../lib/effective-charter.mjs';
import { STATUSES, CANONICAL_REQUIRED } from '../lib/vocabulary-core.mjs';

/**
 * WP02 — Charter loader: per-axis precedence, back-compat, fail-closed, and the
 * effective-charter projection (contracts/charter-resolution-contract C1/C2/C6,
 * data-model resolution rules, FR-009/FR-010/FR-015, NFR-002).
 *
 * The #1 invariant under test is **NFR-002 non-regression**: a legacy-only
 * consumer (no `charter.yaml`) MUST resolve exactly as the legacy loaders do
 * today — proven by an explicit legacy-only fixture asserting identity with
 * `loadVocabulary` / `loadSectionRegistry` and canonical status / required-field
 * defaults.
 */

/** A throwaway docs root; `_meta` files are written under it per-test. */
function makeDocsRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'dk-charter-'));
}

function writeMeta(dir: string, relFromMeta: string, body: string): void {
  const file = path.join(dir, '_meta', relFromMeta);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body, 'utf8');
}

const cleanups: string[] = [];
function docsRoot(): string {
  const dir = makeDocsRoot();
  cleanups.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of cleanups.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Reset the one-shot deprecation guard before each test so notice-count
// assertions are independent of test order.
beforeEach(() => resetDeprecationNotice());

// A non-default charter exercising all four governable axes.
const CHARTER_ALL = `version: 1
vocabulary:
  types:
    aliases: { Feature: Capability }
    forbidden: [ Feature ]
  kinds:
    aliases: { Ref: Reference }
statuses:
  add: [ archived ]
required_fields:
  optional: [ updated ]
sections:
  index_basename: README
  order: [ context, architecture ]
`;

// A legacy vocabulary.yaml: alias Feature → Mission AND forbid Epic. Diverges
// from the shipped default so "resolved" is distinguishable from "default".
const LEGACY_VOCAB = `types:
  aliases:
    Feature: Mission
  forbidden:
    - Epic
`;

const LEGACY_SECTIONS = `version: 1
sections:
  - id: context
    label: Context
    order: 10
    type: Context
  - id: architecture
    label: Architecture
    order: 20
    type: Architecture
`;

describe('loadCharter (T006)', () => {
  it('returns null when no charter.yaml is present', () => {
    expect(loadCharter(docsRoot())).toBeNull();
  });

  it('parses a present charter into a ResolvedCharter', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', CHARTER_ALL);
    const charter = loadCharter(dir);
    expect(charter).not.toBeNull();
    // forbidden type surfaces through the resolver
    expect(charter!.resolveType('Feature').forbidden).toBe(true);
    expect(charter!.legalStatuses).toContain('archived');
    expect(charter!.requiredFields.required).not.toContain('updated');
    expect(charter!.sourceMeta.fromCharter).toBe(true);
  });

  it('uses the canonical charter-relative path constant', () => {
    expect(CHARTER_REGISTRY_RELPATH).toBe(path.join('_meta', 'charter.yaml'));
  });
});

describe('resolveGovernance — charter-only (T007)', () => {
  it('resolves every axis from the charter and reports provenance', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', CHARTER_ALL);
    const g = resolveGovernance(dir);

    expect(g.resolveType('Feature').forbidden).toBe(true);
    expect(g.resolveKind('Ref').effective).toBe('Reference');
    expect(g.legalStatuses).toContain('archived');
    expect(g.requiredFields.required).toEqual(['title', 'description', 'doc_status']);

    expect(g.sources).toEqual({
      types: 'charter',
      kinds: 'charter',
      statuses: 'charter',
      sections: 'charter',
      requiredFields: 'charter',
    });
    expect(g.sourceMeta).toEqual({ fromCharter: true, legacyPresent: false });
  });
});

describe('resolveGovernance — legacy-only NON-REGRESSION (NFR-002)', () => {
  it('resolves identically to the legacy loaders + canonical defaults', () => {
    const dir = docsRoot();
    writeMeta(dir, 'vocabulary.yaml', LEGACY_VOCAB);
    writeMeta(dir, 'sections.yaml', LEGACY_SECTIONS);

    const g = resolveGovernance(dir);

    // types/kinds identical to loadVocabulary
    const legacy = loadVocabulary(dir);
    expect(g.resolveType('Feature')).toEqual(legacy.resolveType('Feature'));
    expect(g.resolveType('Epic')).toEqual(legacy.resolveType('Epic'));
    expect(g.resolveType('Feature').effective).toBe('Mission');
    expect(g.resolveType('Epic').forbidden).toBe(true);

    // statuses = canonical (statuses are new; legacy-only ⇒ unchanged set)
    expect(g.legalStatuses).toEqual([...STATUSES]);

    // required fields = canonical unchanged
    expect(g.requiredFields.required).toEqual([...CANONICAL_REQUIRED]);
    expect(g.requiredFields.floor).toEqual(['title']);

    // sections identical to loadSectionRegistry
    expect(g.sections).toEqual(loadSectionRegistry(dir));

    expect(g.sources).toEqual({
      types: 'legacy',
      kinds: 'default',
      statuses: 'default',
      sections: 'legacy',
      requiredFields: 'default',
    });
    expect(g.sourceMeta).toEqual({ fromCharter: false, legacyPresent: true });
  });

  it('with no _meta files at all, resolves to shipped defaults', () => {
    const g = resolveGovernance(docsRoot());
    expect(g.resolveType('Feature').effective).toBe('Feature'); // identity
    expect(g.legalStatuses).toEqual([...STATUSES]);
    expect(g.requiredFields.required).toEqual([...CANONICAL_REQUIRED]);
    expect(g.sections).toBeNull();
    expect(g.sourceMeta).toEqual({ fromCharter: false, legacyPresent: false });
  });
});

describe('resolveGovernance — both present, per-axis precedence (C2)', () => {
  it('charter-silent axis falls back to legacy; charter axis wins', () => {
    const dir = docsRoot();
    // Charter declares ONLY statuses; silent on types/kinds/sections.
    writeMeta(dir, 'charter.yaml', 'version: 1\nstatuses:\n  add: [ archived ]\n');
    writeMeta(dir, 'vocabulary.yaml', LEGACY_VOCAB);
    writeMeta(dir, 'sections.yaml', LEGACY_SECTIONS);

    const g = resolveGovernance(dir);

    // types come from legacy (charter silent on that axis)
    expect(g.resolveType('Feature').effective).toBe('Mission');
    expect(g.sources.types).toBe('legacy');
    // statuses come from the charter
    expect(g.legalStatuses).toContain('archived');
    expect(g.sources.statuses).toBe('charter');
    // sections come from legacy
    expect(g.sections).toEqual(loadSectionRegistry(dir));
    expect(g.sources.sections).toBe('legacy');

    expect(g.sourceMeta.legacyPresent).toBe(true);
  });

  it('never partial-merges the SAME axis across charter + legacy', () => {
    const dir = docsRoot();
    // Both declare `types`. Charter forbids Feature (no alias); legacy aliases
    // Feature → Mission. Charter must fully own the axis: NO alias leaks in.
    writeMeta(
      dir,
      'charter.yaml',
      'version: 1\nvocabulary:\n  types:\n    forbidden: [ Feature ]\n',
    );
    writeMeta(dir, 'vocabulary.yaml', LEGACY_VOCAB);

    const g = resolveGovernance(dir);
    const res = g.resolveType('Feature');
    expect(res.forbidden).toBe(true);
    expect(res.effective).toBeUndefined();
    expect(res.aliasedFrom).toBeUndefined(); // legacy alias did NOT merge in
    expect(g.sources.types).toBe('charter');
  });
});

describe('resolveGovernance — deprecation notice (one-shot, T007)', () => {
  it('emits exactly ONE notice per build regardless of call count', () => {
    const dir = docsRoot();
    writeMeta(dir, 'vocabulary.yaml', LEGACY_VOCAB);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      resolveGovernance(dir); // page 1
      resolveGovernance(dir); // page 2
      resolveGovernance(dir); // page 3
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/DEPRECATION/);
      expect(warn.mock.calls[0][0]).toMatch(/charter\.yaml/);
    } finally {
      warn.mockRestore();
    }
  });

  it('emits no notice when no legacy file is present', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', CHARTER_ALL);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      resolveGovernance(dir);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('loadCharter / resolveGovernance — fail closed (T008/C6)', () => {
  it('throws naming the file + offending key when a canonical status is forbidden', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', 'version: 1\nstatuses:\n  forbidden: [ draft ]\n');
    expect(() => loadCharter(dir)).toThrow(/charter\.yaml/);
    expect(() => loadCharter(dir)).toThrow(/reserved/);
    expect(() => loadCharter(dir)).toThrow(/draft/);
    expect(() => resolveGovernance(dir)).toThrow(/charter\.yaml/);
  });

  it('throws (fail closed) when required-field floor `title` is relaxed', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', 'version: 1\nrequired_fields:\n  optional: [ title ]\n');
    expect(() => loadCharter(dir)).toThrow(/title/);
  });

  it('throws naming the file on malformed YAML (never a swallowed default)', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', 'vocabulary: [ unclosed\n');
    expect(() => loadCharter(dir)).toThrow(/charter\.yaml/);
  });
});

describe('computeEffectiveCharter — projection (T009/FR-015)', () => {
  it('projects a charter into a plain, JSON-serializable object', () => {
    const dir = docsRoot();
    writeMeta(dir, 'charter.yaml', CHARTER_ALL);
    const eff = computeEffectiveCharter(dir);

    expect(eff.types.forbidden).toContain('Feature');
    expect(eff.types.aliases).toEqual({ Feature: 'Capability' });
    expect(eff.kinds.aliases).toEqual({ Ref: 'Reference' });
    expect(eff.statuses).toContain('archived');
    expect(eff.requiredFields.required).toEqual(['title', 'description', 'doc_status']);
    expect(eff.requiredFields.floor).toEqual(['title']);
    expect(eff.sourceMeta).toEqual({ fromCharter: true, legacyPresent: false });

    // No functions leak into the projection — it round-trips through JSON.
    expect(() => JSON.parse(JSON.stringify(eff))).not.toThrow();
    expect(JSON.parse(JSON.stringify(eff))).toEqual(eff);
  });

  it('projects the legacy-only resolution faithfully', () => {
    const dir = docsRoot();
    writeMeta(dir, 'vocabulary.yaml', LEGACY_VOCAB);
    writeMeta(dir, 'sections.yaml', LEGACY_SECTIONS);
    const eff = computeEffectiveCharter(dir);

    expect(eff.types.aliases).toEqual({ Feature: 'Mission' });
    expect(eff.types.forbidden).toEqual(['Epic']);
    expect(eff.statuses).toEqual([...STATUSES]);
    expect(eff.sections).toEqual(loadSectionRegistry(dir));
    expect(eff.sourceMeta).toEqual({ fromCharter: false, legacyPresent: true });
  });

  it('is side-effect-free — inspecting never emits the deprecation notice', () => {
    const dir = docsRoot();
    writeMeta(dir, 'vocabulary.yaml', LEGACY_VOCAB);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      computeEffectiveCharter(dir);
      computeEffectiveCharter(dir);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

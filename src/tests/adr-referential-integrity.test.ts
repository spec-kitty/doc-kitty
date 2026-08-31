import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectDanglingRelated } from '../scripts/check-links.mjs';

/**
 * #44 / FR-008 / SC-004 — ADR→ADR cross-references must be integrity-checked:
 * a reference to a real ADR resolves (passes), a reference to a non-existent
 * ADR dangles (fails). Both polarities in one test so a check that always
 * returns "clean" cannot pass.
 *
 * We reuse the existing `collectDanglingRelated` helper from `check-links.mjs`
 * (imported at test level — that gate file is NOT owned/edited by this WP). It
 * resolves docs-root-relative `related:` ids (e.g. `adr/0004-...`) against the
 * on-disk tree, which is exactly the ADR→ADR reference shape (ADR-0009).
 */

/** Build a docs root holding one real ADR the references can point at. */
function docsRootWithAdr(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-refint-'));
  mkdirSync(path.join(root, 'adr'), { recursive: true });
  writeFileSync(
    path.join(root, 'adr', '0001-real-decision.md'),
    '---\ntitle: "ADR-0001: Real"\n---\n\n# ADR-0001\n',
    'utf8',
  );
  return root;
}

describe('ADR referential integrity (collectDanglingRelated, both polarities)', () => {
  it('a valid ADR→ADR reference resolves (no dangling)', () => {
    const root = docsRootWithAdr();
    try {
      const dangling = collectDanglingRelated(root, {
        related: ['adr/0001-real-decision'],
      });
      expect(dangling).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a dangling ADR→ADR reference is reported', () => {
    const root = docsRootWithAdr();
    try {
      const dangling = collectDanglingRelated(root, {
        related: ['adr/9999-does-not-exist'],
      });
      expect(dangling).toEqual(['adr/9999-does-not-exist']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves object-form { ref } references and reports only the dangling one', () => {
    const root = docsRootWithAdr();
    try {
      const dangling = collectDanglingRelated(root, {
        related: [
          { ref: 'adr/0001-real-decision', note: 'the real one' },
          { ref: 'adr/0042-ghost', note: 'missing' },
        ],
      });
      expect(dangling).toEqual(['adr/0042-ghost']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

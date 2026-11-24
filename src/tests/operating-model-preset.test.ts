/**
 * The opt-in `operating-model` section preset (#402, FR-010). It ships as a
 * `sections.yaml` snippet, not as a default section: a consumer adds the entry
 * under `sections:` in `docs/_meta/sections.yaml`.
 *
 * - The snippet is one entry, and the real registry loader reads it.
 * - The toolkit's own registry and the frozen fallback map do not hold it (C-005).
 * - With the snippet applied, the gate checks an operating-model page's `type`:
 *   a template page passes, and the same page typed `Guide` fails.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { SECTION_TYPE } from '../lib/vocabulary-core.mjs';
import { loadSectionRegistry, sectionTypes } from '../lib/vocabulary-loader.mjs';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { renderTemplatePage, siteDocType, templateById } from '../lib/operating-model-templates.mjs';

const snippetPath = fileURLToPath(new URL('../lib/templates/operating-model/sections.snippet.yaml', import.meta.url));
const ownRegistry = fileURLToPath(new URL('../../docs/_meta/sections.yaml', import.meta.url));
const exampleRegistry = fileURLToPath(new URL('../../example/docs/_meta/sections.yaml', import.meta.url));
const NOW = new Date('2026-11-24T09:00:00Z');

/** The snippet as shipped: already indented to sit under `sections:`. */
function snippet(): string {
  return readFileSync(snippetPath, 'utf8');
}

/** A docs root whose registry is the toolkit's own plus the snippet. */
function rootWithSnippet(): string {
  const root = mkdtempSync(join(tmpdir(), 'om-preset-'));
  const meta = join(root, '_meta');
  mkdirSync(meta, { recursive: true });
  writeFileSync(join(meta, 'sections.yaml'), `${readFileSync(ownRegistry, 'utf8').trimEnd()}\n\n${snippet()}`, 'utf8');
  return root;
}

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

describe('operating-model section preset (FR-010)', () => {
  it('the snippet is one entry: operating-model, typed Operations', () => {
    const entries = parseYaml(readFileSync(snippetPath, 'utf8'));
    expect(entries).toEqual([
      {
        id: 'operating-model',
        label: 'Operating model',
        order: 105,
        type: 'Operations',
        purpose: 'How the organisation runs, including structure, roles, governance, processes and policies.',
      },
    ]);
  });

  it('the real registry loader reads it once it is added under sections:', () => {
    const root = rootWithSnippet();
    roots.push(root);
    const registry = loadSectionRegistry(root);
    expect(registry?.some((s: { id: string }) => s.id === 'operating-model')).toBe(true);
    expect(sectionTypes(registry!)['operating-model']).toBe('Operations');
    // The existing sections are still there (the snippet appends, it does not replace).
    expect(sectionTypes(registry!).operations).toBe('Operations');
    expect(sectionTypes(registry!).guides).toBe('Guide');
  });

  it('is opt-in: neither the toolkit registry nor the fallback map has it (C-005)', () => {
    const own = parseYaml(readFileSync(ownRegistry, 'utf8')) as { sections: { id: string }[] };
    expect(own.sections.map((s) => s.id)).not.toContain('operating-model');
    expect(Object.keys(SECTION_TYPE)).not.toContain('operating-model');
  });

  it('pasted verbatim at the end of a real registry, it still parses (R24 squad)', () => {
    for (const registry of [ownRegistry, exampleRegistry]) {
      const merged = `${readFileSync(registry, 'utf8').trimEnd()}\n${snippet()}`;
      const parsed = parseYaml(merged) as { sections: { id: string }[] };
      expect(parsed.sections.at(-1)?.id, registry).toBe('operating-model');
    }
  });

  it('with the snippet applied, a template page passes and the same page typed Guide is flagged', () => {
    const root = rootWithSnippet();
    roots.push(root);
    const types = sectionTypes(loadSectionRegistry(root)!);
    const page = renderTemplatePage(templateById('governance-forums')!, { now: NOW });
    const data = { ...(matter(page).data as Record<string, unknown>) };
    const relPath = 'operating-model/governance-forums.md';
    expect(validate(relPath, data, types).problems).toEqual([]);
    // Positive control: the registry really is consulted for this section.
    const asGuide = validate(relPath, { ...data, type: 'Guide' }, types);
    expect([...asGuide.problems, ...asGuide.warnings].some((m: string) => m.includes('Guide'))).toBe(true);
  });

  it('siteDocType follows the registry: Operations with the snippet, a registry rename otherwise', () => {
    const root = rootWithSnippet();
    roots.push(root);
    expect(siteDocType('operating-model/organisation.md', root)).toBe('Operations');
    expect(siteDocType('operations/runbooks/incident-response.md', root)).toBe('Runbook');
    // Positive control: a registry that types the section differently is followed.
    const renamed = mkdtempSync(join(tmpdir(), 'om-preset-'));
    roots.push(renamed);
    mkdirSync(join(renamed, '_meta'), { recursive: true });
    writeFileSync(
      join(renamed, '_meta/sections.yaml'),
      'sections:\n  - id: operating-model\n    label: Operating model\n    order: 1\n    type: Context\n',
      'utf8',
    );
    expect(siteDocType('operating-model/organisation.md', renamed)).toBe('Context');
  });

  it('siteDocType falls back to the frozen map on a missing or malformed registry, as the gate does', () => {
    const empty = mkdtempSync(join(tmpdir(), 'om-preset-'));
    const broken = mkdtempSync(join(tmpdir(), 'om-preset-'));
    roots.push(empty, broken);
    mkdirSync(join(broken, '_meta'), { recursive: true });
    writeFileSync(join(broken, '_meta/sections.yaml'), 'sections:\n  - id: [unclosed\n', 'utf8');
    for (const root of [empty, broken]) {
      expect(() => siteDocType('operating-model/organisation.md', root)).not.toThrow();
      expect(siteDocType('operating-model/organisation.md', root), root).toBeNull();
      expect(siteDocType('operations/runbooks/x.md', root), root).toBe('Runbook');
      expect(siteDocType('guides/x.md', root), root).toBe('Guide');
    }
  });
});

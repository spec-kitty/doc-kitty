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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { SECTION_TYPE } from '../lib/vocabulary-core.mjs';
import { loadSectionRegistry, sectionTypes } from '../lib/vocabulary-loader.mjs';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { renderTemplatePage, templateById } from '../lib/operating-model-templates.mjs';

const snippetPath = fileURLToPath(new URL('../lib/templates/operating-model/sections.snippet.yaml', import.meta.url));
const ownRegistry = fileURLToPath(new URL('../../docs/_meta/sections.yaml', import.meta.url));
const NOW = new Date('2026-11-24T09:00:00Z');

/** The snippet's list item, indented to sit under `sections:`. */
function indentedSnippet(): string {
  return readFileSync(snippetPath, 'utf8')
    .split('\n')
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join('\n');
}

/** A docs root whose registry is the toolkit's own plus the snippet. */
function rootWithSnippet(): string {
  const root = mkdtempSync(join(tmpdir(), 'om-preset-'));
  const meta = join(root, '_meta');
  mkdirSync(meta, { recursive: true });
  writeFileSync(join(meta, 'sections.yaml'), `${readFileSync(ownRegistry, 'utf8').trimEnd()}\n\n${indentedSnippet()}\n`, 'utf8');
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

  it('with the snippet applied, a template page passes and the same page typed Guide fails', () => {
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

  it('a page written into a snippet tree lands where the registry expects it', () => {
    const root = rootWithSnippet();
    roots.push(root);
    const file = join(root, 'operating-model/organisation.md');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderTemplatePage(templateById('organisation')!, { now: NOW }), 'utf8');
    const data = { ...(matter(readFileSync(file, 'utf8')).data as Record<string, unknown>) };
    expect(data.type).toBe(sectionTypes(loadSectionRegistry(root)!)['operating-model']);
  });
});

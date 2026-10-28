/**
 * JSON Schema pages compile from JSON. The generator owns the pages it
 * stamps: an unstamped file stops the run, and a page is removed only when
 * its JSON is gone.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import matter from 'gray-matter';
import { generateJsonSchemaPages, publishJsonFiles, RESERVED_JSON_SCHEMA_SECTIONS } from '../lib/json-schema/generate.mjs';
import { publishedJsonDevMiddleware, publishedJsonFile } from '../lib/json-schema/integration.ts';
import { SECTION_ORDER } from '../lib/metadata.ts';
import { resolveRelativeDocLink } from '../lib/vocabulary-core.mjs';
import { resolveJsonSchemaOptions } from '../lib/json-schema/integration.ts';
import { defineDocKittyIntegrations, sentinelThemeRewrite } from '../lib/config.ts';
import plantumlMeta from '../lib/remark/plantuml-meta.ts';
import { validate } from '../scripts/validate-frontmatter.mjs';

const NOW = new Date('2026-10-27T12:00:00Z');
const MTIME = new Date('2026-10-27T00:00:00Z');
const roots: string[] = [];

function tempRoot(): { root: string; docs: string; source: string; out: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-json-schema-'));
  roots.push(root);
  const docs = path.join(root, 'docs');
  const source = path.join(root, 'json');
  const out = path.join(docs, 'json-files-output');
  mkdirSync(source, { recursive: true });
  return { root, docs, source, out };
}

function writeJson(dir: string, name: string, value: unknown): void {
  const file = path.join(dir, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  utimesSync(file, MTIME, MTIME);
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

const WIDGET = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Widget',
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: 'Display name.' },
    note: { type: 'string' },
    tags: { type: 'array' },
  },
};

const NOTE = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Note',
  type: 'object',
  required: ['text'],
  properties: {
    text: { type: 'string', description: 'The note.' },
  },
};

describe('generateJsonSchemaPages', () => {
  it('writes JSON Schema and JSON Content pages and refuses an unstamped file', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'schema/note.schema.json', NOTE);
    writeJson(source, 'records/acme.json', {
      title: 'Acme',
      name: 'Acme',
      tags: [{ name: 'partner', description: 'Attach the partner rows.' }],
    });
    writeJson(source, 'notes/hello.json', { title: 'Hello', text: 'Hello' });

    const first = generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
    expect(first.sources).toHaveLength(4);
    expect(first.pages).toBeGreaterThan(4);

    const widget = matter(readFileSync(path.join(out, 'content/widget/acme.md'), 'utf8'));
    expect(widget.data.type).toBe('JSON Content');
    expect(widget.data.kind).toBe('Schematic');
    expect(widget.data.record_kind).toBe('page');
    expect(widget.data.doc_status).toBe('active');
    expect(widget.data.generated.by).toMatch(/^doc-kitty-json-schema\//);
    expect(widget.data.sources).toEqual([{ resource: '/json-files-output/contract/widget.md', title: 'Widget' }]);
    expect(widget.data.related).toEqual(['json-files-output/contract/widget']);
    expect(widget.content).toContain('Schema: [Widget](../../contract/widget.md).');
    expect(widget.content).toContain('- `name`: `Acme` — Display name.');
    expect(widget.content).toContain('Attach the partner rows.');
    expect(widget.content).toContain('```plantuml');
    expect(widget.content).toContain('@startjson');
    expect(widget.content).toContain('@endjson');
    expect(widget.content).not.toContain('json "Artifact" as J {');
    expect(
      resolveRelativeDocLink(
        {
          'json-files-output/content/widget/acme.md': '/json-files-output/content/widget/acme/',
          'json-files-output/contract/widget.md': '/json-files-output/contract/widget/',
        },
        'json-files-output/content/widget/acme.md',
        '../../contract/widget.md',
      ),
    ).toBe('/json-files-output/contract/widget/');

    const note = matter(readFileSync(path.join(out, 'content/note/hello.md'), 'utf8'));
    expect(note.data.sources).toEqual([{ resource: '/json-files-output/contract/note.md', title: 'Note' }]);
    expect(note.content).toContain('- `text`: `Hello` — The note.');

    const schema = matter(readFileSync(path.join(out, 'contract/widget.md'), 'utf8'));
    expect(schema.data.type).toBe('JSON Schema');
    expect(schema.data.kind).toBe('Schematic');
    expect(schema.content).toContain('- `name`: Display name.');
    expect(schema.content).toContain('- `tags`');
    expect(schema.content).not.toMatch(/`tags`:/);

    const index = matter(readFileSync(path.join(out, 'index.md'), 'utf8'));
    expect(index.data.type).toBe('JSON Schema');
    expect(index.data.kind).toBe('Hub');
    expect(index.content).not.toMatch(/joins|mappings|reconciliations/);

    for (const rel of [
      'index.md',
      'contract/index.md',
      'contract/widget.md',
      'contract/note.md',
      'content/index.md',
      'content/widget/index.md',
      'content/widget/acme.md',
      'content/note/hello.md',
    ]) {
      const parsed = matter(readFileSync(path.join(out, rel), 'utf8'));
      const result = validate(`json-files-output/${rel}`, parsed.data);
      expect(result.problems, rel).toEqual([]);
      expect(result.warnings, rel).toEqual([]);
    }

    const updated = widget.data.updated;
    const stampedAt = widget.data.generated.at;
    const again = generateJsonSchemaPages({
      sourceDir: source,
      docsRoot: docs,
      outDir: out,
      now: new Date('2027-03-01T00:00:00Z'),
    });
    expect(again.unchanged.length).toBeGreaterThan(0);
    expect(again.written).toEqual([]);
    const kept = matter(readFileSync(path.join(out, 'content/widget/acme.md'), 'utf8'));
    expect(kept.data.updated).toBe(updated);
    expect(kept.data.generated.at).toBe(stampedAt);

    writeFileSync(path.join(out, 'stray.md'), 'authored\n');
    expect(() => generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW })).toThrow(
      /not generated by doc-kitty-json-schema/,
    );
    expect(readFileSync(path.join(out, 'stray.md'), 'utf8')).toBe('authored\n');
    expect(readFileSync(path.join(out, 'content/widget/acme.md'), 'utf8')).toContain('Acme');
  });

  it('refuses a document that fits no schema before writing', () => {
    const { docs, source, out } = tempRoot();
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'keep.md'), 'stay\n');
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/orphan.json', { color: 'red' });
    expect(() => generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW })).toThrow(
      /does not fit any JSON Schema/,
    );
    expect(readFileSync(path.join(out, 'keep.md'), 'utf8')).toBe('stay\n');
  });

  it('uses the most specific schema, or the schema a document names', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/record.schema.json', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Record',
      type: 'object',
    });
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'schema/note.schema.json', NOTE);
    writeJson(source, 'records/acme.json', { name: 'Acme' });
    writeJson(source, 'records/named.json', {
      $schema: '../schema/note.schema.json',
      name: 'Named',
      text: 'Hi',
    });
    generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
    expect(readFileSync(path.join(out, 'content/widget/acme.md'), 'utf8')).toContain('Schema: [Widget]');
    expect(() => readFileSync(path.join(out, 'content/record/acme.md'), 'utf8')).toThrow();
    const named = matter(readFileSync(path.join(out, 'content/note/named.md'), 'utf8'));
    expect(named.data.sources).toEqual([{ resource: '/json-files-output/contract/note.md', title: 'Note' }]);
  });

  it('refuses two schemas that fit a document equally', () => {
    const { docs, source, out } = tempRoot();
    const shape = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    };
    writeJson(source, 'schema/alpha.schema.json', { ...shape, title: 'Alpha' });
    writeJson(source, 'schema/beta.schema.json', { ...shape, title: 'Beta' });
    writeJson(source, 'records/acme.json', { name: 'Acme' });
    expect(() => generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW })).toThrow(
      /equally/,
    );
  });

  it('refuses an output folder that is the docs root or outside it', () => {
    const { docs, source } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/only.json', { name: 'Only' });
    expect(() => generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: docs, now: NOW })).toThrow(
      /inside the docs tree/,
    );
    expect(() =>
      generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: path.join(docs, '..', 'elsewhere'), now: NOW }),
    ).toThrow(/inside the docs tree/);
  });

  it('drops a page whose JSON was removed', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/acme.json', { name: 'Acme' });
    writeJson(source, 'records/other.json', { name: 'Other' });
    generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
    expect(readFileSync(path.join(out, 'content/widget/other.md'), 'utf8')).toContain('Other');
    rmSync(path.join(source, 'records/other.json'));
    const next = generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
    expect(next.removed).toContain('content/widget/other.md');
    expect(() => readFileSync(path.join(out, 'content/widget/other.md'), 'utf8')).toThrow();
  });

  it('omits the PlantUML fence when diagrams are off', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/only.json', { name: 'Only' });
    generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW, diagrams: false });
    const page = readFileSync(path.join(out, 'content/widget/only.md'), 'utf8');
    expect(page).not.toContain('```plantuml');
    expect(page).toContain('```json');
  });

  it('refuses a reserved section, a source that overlaps the output, and a symlink output', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/only.json', { name: 'Only' });
    expect(RESERVED_JSON_SCHEMA_SECTIONS).toEqual(
      expect.arrayContaining(SECTION_ORDER.filter((id) => id !== 'json-files-output')),
    );
    expect(() =>
      generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: path.join(docs, 'guides'), now: NOW }),
    ).toThrow(/reserved section/);
    const nested = path.join(out, 'payload');
    mkdirSync(nested, { recursive: true });
    writeJson(nested, 'schema/widget.schema.json', WIDGET);
    writeJson(nested, 'records/only.json', { name: 'Only' });
    expect(() => generateJsonSchemaPages({ sourceDir: nested, docsRoot: docs, outDir: out, now: NOW })).toThrow(
      /overlaps/,
    );
    const linked = path.join(docs, 'linked');
    const real = path.join(docs, 'real-out');
    mkdirSync(real);
    symlinkSync(real, linked);
    expect(() =>
      generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: linked, now: NOW }),
    ).toThrow(/symlink/);
  });

  it('does not follow a symlinked JSON file', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/only.json', { name: 'Only' });
    symlinkSync(path.join(source, 'records/only.json'), path.join(source, 'alias.json'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
      expect(result.sources).toHaveLength(2);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipping symlink alias.json'));
    } finally {
      warn.mockRestore();
    }
    expect(() => readFileSync(path.join(out, 'content/widget/only.md'), 'utf8')).not.toThrow();
  });

  it('wraps a long string in the drawing and leaves the JSON block intact', () => {
    const { docs, source, out } = tempRoot();
    const description =
      'Formal Hub substitute for SQLX UNION ALL across Derivative Position and Instrument exports.';
    writeJson(source, 'schema/record.schema.json', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Record',
      type: 'object',
      properties: {
        label: { type: 'string' },
        description: { type: 'string' },
      },
    });
    writeJson(source, 'records/wide.json', {
      label: 'Pipeline_Derivative_SQLX_Row_Set_Orchestration',
      description,
    });
    generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
    const page = readFileSync(path.join(out, 'content/record/wide.md'), 'utf8');
    const diagram = page.split('## Diagram')[1]?.split('## Artifact')[0] ?? '';
    const artifact = page.split('## Artifact')[1] ?? '';
    expect(diagram).toContain('\\\\n');
    expect(diagram).toContain('Formal Hub substitute for SQLX UNION ALL');
    expect(diagram).toContain('Pipeline_Derivative_SQLX_Row_Set_Orchestration');
    expect(artifact).toContain(description);
    expect(artifact).not.toContain('\\\\n');
  });

  it('draws the class-diagram box when graph is uml', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/only.json', { name: 'Only' });
    generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW, graph: 'uml' });
    const page = readFileSync(path.join(out, 'content/widget/only.md'), 'utf8');
    expect(page).toContain('json "Artifact" as J {');
    expect(page).not.toContain('@startjson');
  });
});

describe('jsonSchema integration option', () => {
  it('stays off unless jsonSchema is set', () => {
    const names = defineDocKittyIntegrations({ title: 'Docs' }).map((integration) => integration.name);
    expect(names).not.toContain('doc-kitty:json-schema');
  });

  it('registers the generator when a source is configured', () => {
    const names = defineDocKittyIntegrations({ title: 'Docs', jsonSchema: { source: 'json' } }).map(
      (integration) => integration.name,
    );
    expect(names).toContain('doc-kitty:json-schema');
    expect(names).toContain('doc-kitty:diagrams');
  });

  it('renders PlantUML in client mode when jsonSchema is set', async () => {
    const previous = process.env.DK_DIAGRAM_BUILD_RENDER;
    process.env.DK_DIAGRAM_BUILD_RENDER = 'off';
    try {
      const entry = defineDocKittyIntegrations({ title: 'Docs', jsonSchema: { source: 'json' } }).find(
        (integration) => integration.name === 'doc-kitty:diagrams',
      );
      const hook = entry?.hooks['astro:config:setup'];
      if (typeof hook !== 'function') throw new Error('diagrams integration has no setup hook');
      const configs: Array<{ markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] } }> = [];
      await hook({
        updateConfig: (config: { markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] } }) => {
          configs.push(config);
        },
        injectScript: () => {},
      } as never);
      const markdown = configs.find((config) => config.markdown)?.markdown;
      expect(markdown?.remarkPlugins).toContain(plantumlMeta);
      expect(markdown?.rehypePlugins?.[0]).toBe(sentinelThemeRewrite);
    } finally {
      if (previous === undefined) delete process.env.DK_DIAGRAM_BUILD_RENDER;
      else process.env.DK_DIAGRAM_BUILD_RENDER = previous;
    }
  });

  it('leaves diagrams off when jsonSchema is set and diagrams is false', () => {
    const names = defineDocKittyIntegrations({
      title: 'Docs',
      diagrams: false,
      jsonSchema: { source: 'json' },
    }).map((integration) => integration.name);
    expect(names).toContain('doc-kitty:json-schema');
    expect(names).not.toContain('doc-kitty:diagrams');
  });

  it('rejects an unknown graph', () => {
    expect(() => resolveJsonSchemaOptions({ graph: 'deployment' })).toThrow(/graph must be "json" or "uml"/);
  });

  it('rejects an absolute output path', () => {
    expect(() => resolveJsonSchemaOptions({ source: 'json', out: '/tmp/json-out' })).toThrow(/relative folder/);
  });

  it('defaults source to json-files and out to json-files-output', () => {
    expect(resolveJsonSchemaOptions({})).toEqual({ source: 'json-files', out: 'json-files-output', graph: 'json' });
  });

  it('copies a sibling markdown file under Extra Information', () => {
    const { docs, source, out } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', {
      ...WIDGET,
      description: 'A widget record.',
    });
    writeFileSync(path.join(source, 'schema/widget.schema.md'), 'Schema notes.\n\nKeep the keys stable.\n');
    writeJson(source, 'records/acme.json', { name: 'Acme' });
    writeFileSync(path.join(source, 'records/acme.md'), 'This record is the sample.\n\n- name only\n');
    writeJson(source, 'records/plain.json', { name: 'Plain' });
    writeFileSync(path.join(source, 'records/plain.md'), '   \n');
    writeFileSync(path.join(source, 'records/notes.md'), 'wrong folder\n');

    generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW });
    const widget = readFileSync(path.join(out, 'content/widget/acme.md'), 'utf8');
    const sourceAt = widget.indexOf('Source file: [records/acme.json](/json-files/records/acme.json).');
    const extraAt = widget.indexOf('## Extra Information');
    const propertiesAt = widget.indexOf('## Properties');
    expect(sourceAt).toBeGreaterThan(-1);
    expect(extraAt).toBeGreaterThan(sourceAt);
    expect(widget.indexOf('<!-- dk-extra-start -->')).toBeGreaterThan(extraAt);
    expect(propertiesAt).toBeGreaterThan(widget.indexOf('<!-- dk-extra-end -->'));
    expect(widget).toContain('This record is the sample.');
    expect(widget).toContain('- name only');
    expect(widget).not.toContain('wrong folder');

    const schema = readFileSync(path.join(out, 'contract/widget.md'), 'utf8');
    const schemaSource = schema.indexOf(
      'Source file: [schema/widget.schema.json](/json-files/schema/widget.schema.json).',
    );
    const described = schema.indexOf('A widget record.');
    const required = schema.indexOf('Required: `name`.');
    const schemaExtra = schema.indexOf('## Extra Information');
    const properties = schema.indexOf('## Properties');
    expect(schemaSource).toBeGreaterThan(-1);
    expect(described).toBeGreaterThan(schemaSource);
    expect(required).toBeGreaterThan(described);
    expect(schemaExtra).toBeGreaterThan(required);
    expect(properties).toBeGreaterThan(schemaExtra);
    expect(schema).toContain('Keep the keys stable.');

    const plain = readFileSync(path.join(out, 'content/widget/plain.md'), 'utf8');
    expect(plain).not.toContain('Extra Information');

    const again = generateJsonSchemaPages({
      sourceDir: source,
      docsRoot: docs,
      outDir: out,
      now: new Date('2027-03-01T00:00:00Z'),
    });
    expect(again.written).toEqual([]);
    writeFileSync(path.join(source, 'records/acme.md'), 'Updated sample note.\n');
    const next = generateJsonSchemaPages({
      sourceDir: source,
      docsRoot: docs,
      outDir: out,
      now: new Date('2027-04-01T00:00:00Z'),
    });
    expect(next.written).toContain('content/widget/acme.md');
    expect(readFileSync(path.join(out, 'content/widget/acme.md'), 'utf8')).toContain('Updated sample note.');
  });

  it('refuses a symlink sidecar before writing pages', () => {
    const { docs, source, out } = tempRoot();
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'keep.md'), 'stay\n');
    writeJson(source, 'schema/widget.schema.json', WIDGET);
    writeJson(source, 'records/only.json', { name: 'Only' });
    const note = path.join(source, 'records/only.md');
    writeFileSync(path.join(source, 'elsewhere.md'), 'outside\n');
    symlinkSync(path.join(source, 'elsewhere.md'), note);
    expect(() => generateJsonSchemaPages({ sourceDir: source, docsRoot: docs, outDir: out, now: NOW })).toThrow(
      /sidecar must not be a symlink/,
    );
    expect(readFileSync(path.join(out, 'keep.md'), 'utf8')).toBe('stay\n');
  });

  it('serves the published JSON for a browser navigation', () => {
    const { root } = tempRoot();
    const published = path.join(root, 'public', 'json-files');
    writeJson(root, 'json-files/schema/widget.schema.json', { title: 'Widget', type: 'object' });
    const { files } = generateJsonSchemaPages({
      sourceDir: path.join(root, 'json-files'),
      docsRoot: path.join(root, 'docs'),
      outDir: path.join(root, 'docs', 'json-files-output'),
      now: NOW,
      diagrams: false,
    });
    publishJsonFiles(files, published);
    expect(publishedJsonFile('/json-files/schema/widget.schema.json', published, '')).toBe(
      path.join(published, 'schema', 'widget.schema.json'),
    );
    expect(publishedJsonFile('/doc-kitty/json-files/schema/widget.schema.json', published, '/doc-kitty')).toBe(
      path.join(published, 'schema', 'widget.schema.json'),
    );
    expect(publishedJsonFile('/json-files/../secret.json', published, '')).toBeUndefined();

    const handle = publishedJsonDevMiddleware(published, '');
    const headers = new Map<string, string>();
    let body = '';
    let passed = false;
    handle(
      { method: 'GET', url: '/json-files/schema/widget.schema.json' },
      {
        setHeader: (name, value) => headers.set(name, value),
        end: (chunk) => {
          body = chunk?.toString('utf8') ?? '';
        },
      },
      () => {
        passed = true;
      },
    );
    expect(passed).toBe(false);
    expect(headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(body).toContain('"title": "Widget"');
  });

  it('publishes each JSON file under public/json-files', () => {
    const { root, source } = tempRoot();
    writeJson(source, 'schema/widget.schema.json', { title: 'Widget', type: 'object' });
    const published = path.join(root, 'public', 'json-files');
    const { files } = generateJsonSchemaPages({
      sourceDir: source,
      docsRoot: path.join(root, 'docs'),
      outDir: path.join(root, 'docs', 'json-files-output'),
      now: NOW,
      diagrams: false,
    });
    publishJsonFiles(files, published);
    expect(readFileSync(path.join(published, 'schema/widget.schema.json'), 'utf8')).toContain('"title": "Widget"');
    publishJsonFiles([], published);
    expect(() => readFileSync(path.join(published, 'schema/widget.schema.json'), 'utf8')).toThrow();
  });
});

/**
 * `kind: Schematic` (ADR-0067), through the real remark plugin: an authored page
 * that references a JSON Schema file gets generated sections, fails closed on a bad
 * reference, and leaves every other page alone.
 *
 * Fixtures: a real Spec Kitty doctrine schema (YAML, `definitions` + `$ref`) and a real
 * spec-kitty-events payload schema (JSON, pydantic `$defs` + `$ref`, `anyOf` with null).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import schematic from '../lib/remark/schematic.js';
import { SCHEMATIC_MIME, schematicPublishedPath } from '../lib/schematic/core.mjs';
import { schematicIntegration } from '../lib/integrations/schematic.js';

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'schematic');

let root: string;
let docs: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-schematic-'));
  docs = path.join(root, 'docs');
  mkdirSync(docs, { recursive: true });
  cpSync(path.join(FIXTURES, 'schemas'), path.join(root, 'schemas'), { recursive: true });
  const put = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  put('schemas/order.schema.json', JSON.stringify({
    type: 'object',
    required: ['ship_to'],
    properties: {
      ship_to: { $ref: './address.schema.yaml' },
      billing: { $ref: './address.schema.yaml#/$defs/Country' },
      docs: { $ref: 'https://example.com/other.schema.json' },
    },
  }));
  put('schemas/address.schema.yaml', 'type: object\ndescription: A postal address.\nproperties:\n  street: {type: string}\n  country: {$ref: "#/$defs/Country"}\n$defs:\n  Country: {type: string, enum: [BE, NL]}\n');
  put('schemas/tree.schema.json', JSON.stringify({
    type: 'object',
    properties: { children: { type: 'array', items: { $ref: '#' } }, a: { $ref: '#/$defs/A' } },
    $defs: {
      A: { type: 'object', properties: { b: { $ref: '#/$defs/B' } } },
      B: { type: 'object', properties: { a: { $ref: '#/$defs/A' } } },
    },
  }));
  put('schemas/two.yaml', 'type: object\n---\ntype: object\n');
  put('schemas/broken.json', '{ "type": ');
  put('schemas/plain.json', '{"hello": "world"}');
  put('schemas/dangling.json', '{"type":"object","properties":{"x":{"$ref":"#/$defs/Nope"}}}');
  put('schemas/badfile.json', '{"type":"object","properties":{"x":{"$ref":"./missing.json"}}}');
  put('schemas/alias.yaml', 'base: &b {type: string}\ntype: object\nproperties:\n  x:\n    <<: *b\n');
  writeFileSync(path.join(tmpdir(), 'dk-schematic-outside.json'), '{"type":"object"}');
  symlinkSync(path.join(tmpdir(), 'dk-schematic-outside.json'), path.join(root, 'schemas/link.json'));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

interface Node {
  type: string;
  children?: Node[];
  value?: string;
  depth?: number;
  url?: string;
  lang?: string;
}

/** Run the plugin over `body` as the page `rel`, return a Markdown-ish outline. */
function render(rel: string, frontmatter: Record<string, unknown>, body = 'Authored text.\n', diagram = true): string {
  const tree = unified().use(remarkParse).parse(body) as unknown as Node;
  const file = { path: path.join(docs, rel), data: { astro: { frontmatter } } };
  schematic({ docsRoot: docs, root, diagram })(tree as never, file);
  const inline = (n: Node): string =>
    n.type === 'link' ? `[${(n.children ?? []).map(inline).join('')}](${n.url})` : n.type === 'inlineCode' ? `\`${n.value}\`` : (n.value ?? (n.children ?? []).map(inline).join(''));
  const block = (n: Node, indent: string): string[] => {
    if (n.type === 'heading') return [`${'#'.repeat(n.depth ?? 1)} ${inline(n)}`];
    if (n.type === 'code') return [`\`\`\`${n.lang}`, n.value ?? '', '```'];
    if (n.type === 'list') return (n.children ?? []).flatMap((li) => block(li, indent));
    if (n.type === 'listItem') {
      const [first, ...rest] = n.children ?? [];
      return [`${indent}- ${inline(first)}`, ...rest.flatMap((c) => block(c, indent + '  '))];
    }
    return [`${indent}${inline(n)}`];
  };
  return (tree.children ?? []).flatMap((n) => block(n, '')).join('\n');
}

const page = (schematic_path: string, extra: Record<string, unknown> = {}) => ({ kind: 'Schematic', title: 'Page', schematic_path, ...extra });

describe('Schematic page, YAML doctrine schema', () => {
  let out = '';
  beforeAll(() => {
    out = render('reference/tactic.md', page('schemas/tactic.schema.yaml'));
  });
  it('puts the schema description before the authored body and the generated sections after it', () => {
    const at = (s: string) => out.indexOf(s);
    expect(at('Minimal schema for reusable behavior tactics.')).toBeGreaterThanOrEqual(0);
    expect(at('Minimal schema')).toBeLessThan(at('Authored text.'));
    expect(at('Authored text.')).toBeLessThan(at('## Diagram'));
    expect(at('## Diagram')).toBeLessThan(at('## Properties'));
    expect(at('## Properties')).toBeLessThan(at('## Source'));
  });
  it('draws the schema as a PlantUML JSON tree', () => {
    expect(out).toMatch(/```plantuml\n' title: Tactic\n' description: .*\n@startjson\n\{/);
    expect(out).toContain('@endjson');
  });
  it('lists properties with type and required, and a $ref to definitions links to a sub-section', () => {
    expect(out).toContain('- `id` (string, required)');
    expect(out).toContain('- `purpose` (string)');
    expect(out).toContain('- `steps` (array of [tactic_step](#tactic_step), required)');
    expect(out).toContain('### tactic_step');
    expect(out).toContain('- `references` (array of [tactic_reference](#tactic_reference))');
    expect(out).toContain('### tactic_reference');
    expect(out).toContain('- `type` (enum: directive, tactic, styleguide, toolguide, paradigm, procedure, template, required): Doctrine artifact type being referenced.');
  });
  it('links the published file next to the page, keeping its extension', () => {
    expect(out).toContain('Schema file: [schemas/tactic.schema.yaml](/reference/tactic.yaml)');
  });
});

describe('Schematic page, JSON events payload schema', () => {
  let out = '';
  beforeAll(() => {
    out = render('reference/events/answered.md', page('schemas/decision_input_answered_payload.schema.json'));
  });
  it('renders $defs types, anyOf with null, and the schema description', () => {
    expect(out).toContain('- `actor` ([RuntimeActorIdentity](#runtimeactoridentity), required): Actor who answered the decision');
    expect(out).toContain('### RuntimeActorIdentity');
    expect(out).toContain('- `model` (string | null): Model identifier');
    expect(out).toContain('Schema file: [schemas/decision_input_answered_payload.schema.json](/reference/events/answered.json)');
  });
});

describe('$ref resolution', () => {
  it('follows relative-file refs (with and without a pointer) and renders URL refs as links', () => {
    const out = render('order.md', page('schemas/order.schema.json'));
    expect(out).toContain('- `ship_to` ([address](#address), required): A postal address.');
    expect(out).toContain('- `billing` (enum: BE, NL)');
    expect(out).toContain('- `docs` ([https://example.com/other.schema.json](https://example.com/other.schema.json))');
    expect(out).toContain('- `country` (enum: BE, NL)');
  });
  it('renders a cycle as a link, once, instead of recursing', () => {
    const out = render('tree.md', page('schemas/tree.schema.json'));
    expect(out).toContain('- `children` (array of this schema)');
    expect(out).toContain('- `b` ([B](#b))');
    expect(out).toContain('- `a` ([A](#a))');
    expect(out.match(/^### A$/gm)).toHaveLength(1);
    expect(out.match(/^### B$/gm)).toHaveLength(1);
  });
  it('does not expand YAML merge keys', () => {
    expect(render('alias.md', page('schemas/alias.yaml'))).toContain('- `x` (any)');
  });
});

describe('authored headings and diagrams off', () => {
  it('an authored heading replaces the generated one, and no diagram is added when the pipeline is off', () => {
    const out = render('p.md', page('schemas/order.schema.json'), '## Properties\n\nMine.\n\n## Source\n\nAlso mine.\n', false);
    expect(out.match(/^## Properties$/gm)).toHaveLength(1);
    expect(out.match(/^## Source$/gm)).toHaveLength(1);
    expect(out).not.toContain('## Diagram');
    expect(out).not.toContain('- `ship_to`');
  });
});

describe('fail closed', () => {
  const err = (sp: unknown) => () => render('reference/x.md', page(sp as string));
  it.each([
    ['schemas/nope.json', /\[dk-schematic\] reference\/x\.md: "schemas\/nope\.json" does not exist/],
    ['schemas/broken.json', /"schemas\/broken\.json" cannot be parsed/],
    ['schemas/two.yaml', /cannot be parsed: holds 2 YAML documents/],
    ['schemas/plain.json', /is not a single JSON Schema document/],
    ['../outside.json', /is outside the project root/],
    ['/etc/passwd', /must be relative to the project root/],
    ['schemas/link.json', /is outside the project root/],
    ['schemas/dangling.json', /"#\/\$defs\/Nope" does not resolve/],
    ['schemas/badfile.json', /"\.\/missing\.json" does not exist/],
    ['', /schematic_path must name a file/],
  ])('%s', (sp, message) => {
    expect(err(sp)).toThrow(message);
  });
  it('refuses a relative-file $ref that climbs out of the root', () => {
    writeFileSync(path.join(root, 'schemas/escape.json'), '{"type":"object","properties":{"x":{"$ref":"../../outside.json"}}}');
    expect(err('schemas/escape.json')).toThrow(/is outside the project root/);
  });
  it('a missing schematic_path is an error, not a silent page', () => {
    expect(() => render('x.md', { kind: 'Schematic' })).toThrow(/schematic_path must name a file/);
  });
});

describe('a page that is not kind: Schematic', () => {
  it('is untouched, even with a schematic_path that would fail', () => {
    expect(render('how-to.md', { kind: 'How-To', schematic_path: 'schemas/nope.json' }, '## Properties\n\nText.\n')).toBe('## Properties\nText.');
  });
});

describe('publishing', () => {
  it('maps a page route to a file next to it, keeping the extension', () => {
    expect(schematicPublishedPath('/reference/events/answered/', '.json')).toBe('/reference/events/answered.json');
    expect(schematicPublishedPath('/', '.YAML')).toBe('/index.yaml');
    expect(SCHEMATIC_MIME['.yml']).toBe('application/yaml');
  });
  it('build:done copies the schema file byte for byte', () => {
    mkdirSync(path.join(docs, 'reference'), { recursive: true });
    writeFileSync(path.join(docs, 'reference/tactic.md'), '---\nkind: Schematic\nschematic_path: schemas/tactic.schema.yaml\n---\nBody\n');
    writeFileSync(path.join(docs, 'reference/plain.md'), '---\nkind: Reference\n---\nBody\n');
    const dist = path.join(root, 'dist');
    const cwd = process.cwd();
    process.chdir(root);
    try {
      const integration = schematicIntegration('docs', undefined, false, '/');
      (integration.hooks['astro:build:done'] as (a: unknown) => void)({ dir: new URL(`file://${dist}/`) });
    } finally {
      process.chdir(cwd);
    }
    expect(readFileSync(path.join(dist, 'reference/tactic.yaml'))).toEqual(readFileSync(path.join(FIXTURES, 'schemas/tactic.schema.yaml')));
    expect(existsSync(path.join(dist, 'reference/plain.yaml'))).toBe(false);
  });
  it('build:done refuses to overwrite an existing output file, or to publish one href twice', () => {
    const dist = path.join(root, 'dist-clash');
    mkdirSync(path.join(dist, 'reference'), { recursive: true });
    writeFileSync(path.join(dist, 'reference/tactic.yaml'), 'site-owned\n');
    const run = () => {
      const cwd = process.cwd();
      process.chdir(root);
      try {
        (schematicIntegration('docs', undefined, false, '/').hooks['astro:build:done'] as (a: unknown) => void)({ dir: new URL(`file://${dist}/`) });
      } finally {
        process.chdir(cwd);
      }
    };
    expect(run).toThrow(/\[dk-schematic\] reference\/tactic\.md: cannot publish \/reference\/tactic\.yaml, .*already exists/);
    expect(readFileSync(path.join(dist, 'reference/tactic.yaml'), 'utf8')).toBe('site-owned\n');
    rmSync(path.join(dist, 'reference/tactic.yaml'));
    mkdirSync(path.join(docs, 'reference/tactic'), { recursive: true });
    writeFileSync(path.join(docs, 'reference/tactic/index.md'), '---\nkind: Schematic\nschematic_path: schemas/tactic.schema.yaml\n---\nBody\n');
    try {
      expect(run).toThrow(/already publishes it/);
    } finally {
      rmSync(path.join(docs, 'reference/tactic'), { recursive: true });
    }
  });
});

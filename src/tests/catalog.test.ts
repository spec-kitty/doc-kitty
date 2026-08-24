import { describe, it, expect } from 'vitest';
import {
  buildCatalog,
  resolveCitation,
  projectBibliography,
  BIBLIOGRAPHY_API_VERSION,
  type BibliographyRecord,
  type ToolRecord,
} from '../lib/catalog.js';

const biblio: BibliographyRecord[] = [
  {
    id: 'divio-2017',
    type: 'webpage',
    title: 'The documentation system',
    authors: ['Daniele Procida'],
    url: 'https://documentation.divio.com',
    issued: '2017',
  },
  { id: 'llms-txt-2024', title: 'The /llms.txt file', url: 'https://llmstxt.org' },
];

const tools: ToolRecord[] = [
  { id: 'revealjs', name: 'reveal.js', url: 'https://revealjs.com' },
];

describe('buildCatalog', () => {
  it('keys records by their stable id', () => {
    const catalog = buildCatalog(biblio, tools);
    expect(catalog.bibliography['divio-2017'].title).toBe('The documentation system');
    expect(catalog.tools['revealjs'].name).toBe('reveal.js');
  });

  it('rejects a duplicate id (ambiguous citation key)', () => {
    const dupes: BibliographyRecord[] = [
      { id: 'x', title: 'A', url: 'https://a' },
      { id: 'x', title: 'B', url: 'https://b' },
    ];
    expect(() => buildCatalog(dupes, [])).toThrow(/duplicate bibliography id "x"/);
  });
});

describe('resolveCitation against a built catalog', () => {
  const catalog = buildCatalog(biblio, tools);

  it('resolves a biblio citation to its record (happy path)', () => {
    expect(resolveCitation({ type: 'biblio', id: 'divio-2017' }, catalog)).toEqual(
      catalog.bibliography['divio-2017'],
    );
  });

  it('resolves a tool citation to its record', () => {
    expect(resolveCitation({ type: 'tool', id: 'revealjs' }, catalog)).toEqual(
      catalog.tools['revealjs'],
    );
  });

  it('passes an inline reference through unchanged (no citation key)', () => {
    const inline = { url: 'https://example.com', title: 'Example', note: 'inline' };
    expect(resolveCitation(inline, catalog)).toEqual(inline);
  });

  it('throws on a missing id (build-fatal)', () => {
    expect(() => resolveCitation({ type: 'biblio', id: 'ghost' }, catalog)).toThrow(
      /no bibliography entry for id "ghost"/,
    );
    expect(() => resolveCitation({ type: 'tool', id: 'ghost' }, catalog)).toThrow(
      /no tool entry for id "ghost"/,
    );
  });

  it('throws on an unknown catalog type (build-fatal)', () => {
    expect(() => resolveCitation({ type: 'journal', id: 'divio-2017' }, catalog)).toThrow(
      /unknown catalog type "journal"/,
    );
  });
});

describe('projectBibliography (endpoint shape)', () => {
  it('emits { version, count, records } ordered by stable id', () => {
    const body = projectBibliography(biblio);
    expect(body.version).toBe(BIBLIOGRAPHY_API_VERSION);
    expect(body.count).toBe(2);
    expect(body.records.map((r) => r.id)).toEqual(['divio-2017', 'llms-txt-2024']);
  });

  it('each record carries at least id, title, and url', () => {
    const body = projectBibliography(biblio);
    for (const record of body.records) {
      expect(typeof record.id).toBe('string');
      expect(typeof record.title).toBe('string');
      expect(typeof record.url).toBe('string');
    }
  });

  it('does not mutate the input array order', () => {
    const input = [...biblio].reverse();
    const snapshot = input.map((r) => r.id);
    projectBibliography(input);
    expect(input.map((r) => r.id)).toEqual(snapshot);
  });
});

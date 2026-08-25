/**
 * Astro-free unit matrix for the diagram-metadata transform (ADR-0023,
 * contract `diagram-meta-transform`; FR-003/004/005/013, NFR-005).
 *
 * Exercises the three pure helpers in `diagram-meta.internal` directly on fence
 * source strings — no Astro, unified, hast, or vfile runtime is involved, so
 * this suite is independent of the build and the Playwright a11y lane. The
 * remark/rehype wrappers only walk the tree and move these results onto
 * `file.data`; the load-bearing correctness lives here.
 */
import { describe, it, expect } from 'vitest';
import {
  parseMeta,
  injectAccStatements,
  figureFields,
  type DiagramMeta,
} from '../lib/remark/diagram-meta.internal.js';

describe('parseMeta — the leading `%% key: value` block', () => {
  it('parses all four closed-set fields', () => {
    const code = [
      '%% title: Order flow',
      '%% description: How an order moves through the system',
      '%% attribution: Jane Doe',
      '%% source: https://example.com/orders',
      'flowchart TD',
      '  A --> B',
    ].join('\n');

    const { fields } = parseMeta(code);

    expect(fields).toEqual<DiagramMeta>({
      title: 'Order flow',
      description: 'How an order moves through the system',
      attribution: 'Jane Doe',
      source: 'https://example.com/orders',
    });
  });

  it('leaves unknown `%% key:` lines in place (ordinary comments, never captured)', () => {
    const code = ['%% title: Kept', '%% author: Not a reserved key', 'flowchart TD'].join('\n');

    const { fields, strippedCode } = parseMeta(code);

    expect(fields).toEqual<DiagramMeta>({ title: 'Kept' });
    expect(strippedCode).toBe(['%% author: Not a reserved key', 'flowchart TD'].join('\n'));
  });

  it('NEVER matches the reserved `%%{ … }%%` init directive as metadata (guard)', () => {
    const code = [
      "%%{ init: { 'theme': 'base' } }%%",
      '%% title: Real title',
      'flowchart TD',
    ].join('\n');

    const { fields, strippedCode } = parseMeta(code);

    // The init directive is untouched; only the true metadata line is captured.
    expect(fields).toEqual<DiagramMeta>({ title: 'Real title' });
    expect(strippedCode).toBe(
      ["%%{ init: { 'theme': 'base' } }%%", 'flowchart TD'].join('\n'),
    );
  });

  it('strips only the matched metadata lines, byte-preserving the rest', () => {
    const code = [
      '%% title: A',
      '%% description: B',
      'flowchart TD',
      '  A --> B',
      '  %% description: this is body, not metadata',
    ].join('\n');

    const { strippedCode } = parseMeta(code);

    expect(strippedCode).toBe(
      ['flowchart TD', '  A --> B', '  %% description: this is body, not metadata'].join('\n'),
    );
  });

  it('stops scanning at the first non-blank, non-`%%` line', () => {
    // The `%% title:` here follows a declaration line, so it is body, not metadata.
    const code = ['flowchart TD', '%% title: too late'].join('\n');

    const { fields, strippedCode } = parseMeta(code);

    expect(fields).toEqual<DiagramMeta>({});
    expect(strippedCode).toBe(code);
  });

  it('keeps the leading block open across blank lines', () => {
    const code = ['%% title: A', '', '%% description: B', 'flowchart TD'].join('\n');

    const { fields, strippedCode } = parseMeta(code);

    expect(fields).toEqual<DiagramMeta>({ title: 'A', description: 'B' });
    expect(strippedCode).toBe(['', 'flowchart TD'].join('\n'));
  });

  it('trims surrounding whitespace from captured values', () => {
    const { fields } = parseMeta('%% title:    Spaced out   \nflowchart TD');
    expect(fields.title).toBe('Spaced out');
  });
});

describe('injectAccStatements — accTitle/accDescr placement + name fallback', () => {
  it('injects accTitle + accDescr immediately after the declaration line', () => {
    const code = ['flowchart TD', '  A --> B'].join('\n');
    const out = injectAccStatements(code, { title: 'T', description: 'D' });

    expect(out).toBe(['flowchart TD', 'accTitle: T', 'accDescr: D', '  A --> B'].join('\n'));
  });

  it('falls back to `description` for the accessible NAME when `title` is absent', () => {
    const out = injectAccStatements('flowchart TD', { description: 'Only a description' });

    expect(out).toBe(
      ['flowchart TD', 'accTitle: Only a description', 'accDescr: Only a description'].join('\n'),
    );
  });

  it('omits accDescr when there is no description (name only)', () => {
    const out = injectAccStatements('flowchart TD', { title: 'Just a name' });

    expect(out).toBe(['flowchart TD', 'accTitle: Just a name'].join('\n'));
    expect(out).not.toContain('accDescr');
  });

  it('returns the source unchanged when there is no name at all', () => {
    const code = ['flowchart TD', '  A --> B'].join('\n');
    expect(injectAccStatements(code, {})).toBe(code);
    // attribution/source alone never produce an accessible name.
    expect(injectAccStatements(code, { attribution: 'x', source: 'y' })).toBe(code);
  });

  it('injects AFTER the declaration when a leading `%%{ init }%%` directive is present', () => {
    const code = ["%%{ init: { 'theme': 'base' } }%%", 'flowchart TD', '  A --> B'].join('\n');
    const out = injectAccStatements(code, { title: 'T', description: 'D' });

    expect(out).toBe(
      [
        "%%{ init: { 'theme': 'base' } }%%",
        'flowchart TD',
        'accTitle: T',
        'accDescr: D',
        '  A --> B',
      ].join('\n'),
    );
  });

  it('injects AFTER the declaration when a leading `---` frontmatter block is present', () => {
    const code = ['---', 'config:', '  theme: base', '---', 'flowchart TD', '  A --> B'].join('\n');
    const out = injectAccStatements(code, { title: 'T', description: 'D' });

    expect(out).toBe(
      [
        '---',
        'config:',
        '  theme: base',
        '---',
        'flowchart TD',
        'accTitle: T',
        'accDescr: D',
        '  A --> B',
      ].join('\n'),
    );
  });

  it('injects after the declaration with BOTH frontmatter and an init directive', () => {
    const code = [
      '---',
      'title: fm',
      '---',
      "%%{ init: { 'theme': 'base' } }%%",
      'sequenceDiagram',
      '  A->>B: hi',
    ].join('\n');
    const out = injectAccStatements(code, { title: 'T' });

    expect(out).toBe(
      [
        '---',
        'title: fm',
        '---',
        "%%{ init: { 'theme': 'base' } }%%",
        'sequenceDiagram',
        'accTitle: T',
        '  A->>B: hi',
      ].join('\n'),
    );
  });

  it.each([
    ['flowchart', 'flowchart TD', '  A --> B'],
    ['sequence', 'sequenceDiagram', '  Alice->>Bob: hi'],
    ['class', 'classDiagram', '  class Animal'],
  ])('places accTitle after the %s declaration line', (_name, decl, body) => {
    const out = injectAccStatements([decl, body].join('\n'), { title: 'N', description: 'D' });

    const lines = out.split('\n');
    expect(lines[0]).toBe(decl);
    expect(lines[1]).toBe('accTitle: N');
    expect(lines[2]).toBe('accDescr: D');
    expect(lines[3]).toBe(body);
  });
});

describe('figureFields — the `<figcaption>` projection', () => {
  it('carries description/attribution/source and drops the accessible-name `title`', () => {
    const fields: DiagramMeta = {
      title: 'name only',
      description: 'D',
      attribution: 'A',
      source: 'https://example.com',
    };

    expect(figureFields(fields)).toEqual({
      description: 'D',
      attribution: 'A',
      source: 'https://example.com',
    });
  });

  it('omits each caption field that is absent', () => {
    expect(figureFields({})).toEqual({});
    expect(figureFields({ description: 'D' })).toEqual({ description: 'D' });
    expect(figureFields({ attribution: 'A' })).toEqual({ attribution: 'A' });
    expect(figureFields({ title: 'name' })).toEqual({});
  });
});

describe('end-to-end pure pipeline (parse → inject → figureFields)', () => {
  it('parses metadata, strips it, injects a11y, and projects the caption', () => {
    const code = [
      '%% title: Order flow',
      '%% description: A short caption',
      '%% attribution: Jane Doe',
      '%% source: https://example.com',
      'flowchart TD',
      '  A --> B',
    ].join('\n');

    const { fields, strippedCode } = parseMeta(code);
    const injected = injectAccStatements(strippedCode, fields);

    expect(injected).toBe(
      [
        'flowchart TD',
        'accTitle: Order flow',
        'accDescr: A short caption',
        '  A --> B',
      ].join('\n'),
    );
    expect(figureFields(fields)).toEqual({
      description: 'A short caption',
      attribution: 'Jane Doe',
      source: 'https://example.com',
    });
  });
});

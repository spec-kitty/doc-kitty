/**
 * The pack document parser (#330, ADR-0079 D3): a pack's README is read into the
 * charter codec's shape (frontmatter, H1 title, preamble, H2 sections) with
 * doc-kitty's own Markdown pipeline. It never fails: an ambiguity the codec
 * would refuse is a warning.
 */
import { describe, expect, it } from 'vitest';
import { parsePackDocument } from '../lib/packs/readme.mjs';

describe('parsePackDocument', () => {
  it('reads frontmatter, the title, the preamble and the sections in order', () => {
    const doc = parsePackDocument('---\nowner: me\n---\n\n# The pack\n\nIntro line.\n\n## One\n\nFirst.\n\n## Two\n\nSecond.\n');
    expect(doc).toEqual({
      frontmatter: { owner: 'me' },
      title: 'The pack',
      preamble: 'Intro line.',
      sections: [
        { title: 'One', content: 'First.' },
        { title: 'Two', content: 'Second.' },
      ],
      problems: [],
    });
  });

  it('has no title when the README does not start with an H1', () => {
    const doc = parsePackDocument('Just a preamble.\n\n## Scope\n\nText.\n');
    expect(doc.title).toBeUndefined();
    expect(doc.preamble).toBe('Just a preamble.');
    expect(doc.sections).toEqual([{ title: 'Scope', content: 'Text.' }]);
  });

  it('keeps a title with no sections, and an empty preamble', () => {
    expect(parsePackDocument('# Only a title\n')).toEqual({ title: 'Only a title', preamble: '', sections: [], problems: [] });
    expect(parsePackDocument('')).toEqual({ preamble: '', sections: [], problems: [] });
  });

  it('does not split on a heading inside a fenced code block', () => {
    const doc = parsePackDocument('# T\n\n## Real\n\n```md\n## Not real\n```\n');
    expect(doc.sections).toEqual([{ title: 'Real', content: '```md\n## Not real\n```' }]);
  });

  it('reads setext headings and inline code in a heading as plain text', () => {
    const doc = parsePackDocument('The `qa` pack\n=============\n\nIntro.\n\nUsage\n-----\n\nRun it.\n');
    expect(doc.title).toBe('The qa pack');
    expect(doc.sections).toEqual([{ title: 'Usage', content: 'Run it.' }]);
  });

  it('warns on a second H1 and keeps it as content', () => {
    const doc = parsePackDocument('# First\n\nIntro.\n\n# Second\n\nMore.\n');
    expect(doc.title).toBe('First');
    expect(doc.preamble).toBe('Intro.\n\n# Second\n\nMore.');
    expect(doc.problems.map((p) => p.code)).toEqual(['readme-ambiguous-heading']);
  });

  it('closes the frontmatter only on a line that is `---`, not on a line ending in it', () => {
    const doc = parsePackDocument('---\nnote: a---\nowner: me\n---\n\n# T\n');
    expect(doc.frontmatter).toEqual({ note: 'a---', owner: 'me' });
    expect(doc.title).toBe('T');
    expect(parsePackDocument('---\n---\n# X\n')).toEqual({ title: 'X', preamble: '', sections: [], problems: [] });
  });

  it('keeps tagged frontmatter values as plain data', () => {
    const doc = parsePackDocument('---\nblob: !!binary aGVsbG8=\n---\n');
    expect(Buffer.isBuffer(doc.frontmatter?.blob)).toBe(false);
  });

  it('normalises CRLF and a byte order mark', () => {
    const doc = parsePackDocument('﻿# T\r\n\r\nIntro.\r\n\r\n## S\r\n\r\nBody.\r\n');
    expect(doc).toEqual({ title: 'T', preamble: 'Intro.', sections: [{ title: 'S', content: 'Body.' }], problems: [] });
  });

  it('warns on frontmatter that does not parse, and still reads the body', () => {
    const doc = parsePackDocument('---\nowner: [unclosed\n---\n\n# T\n');
    expect(doc.problems.map((p) => p.code)).toEqual(['readme-frontmatter']);
    expect(doc.frontmatter).toBeUndefined();
  });
});

/**
 * Non-fakeable matrix for the Markua block-detection normaliser (ADR-0030,
 * contract `normaliser-block-detection.md`; FR-001/FR-004/FR-012).
 *
 * The load-bearing correctness — fence suppression, run termination, wrapper
 * balance, unbalanced degradation, three-way class equivalence — is exercised
 * on the PURE line-level state machine (`normaliseDocument`) with raw line
 * strings, so the two fence cases are genuine LETTER-PREFIX cases (a `W>` inside
 * / after a fence), not vacuous bare-`>` passes. A second block runs the thin
 * remark plugin end-to-end (parse → plugin → assert tree) for the node-spanning
 * cases (adjacent blockquote, fence-inside-aside, attr-above-wrapper) and the
 * byte-identical no-op. No Astro/build runtime is involved.
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import markuaNormalise from '../lib/remark/markua-normalise.js';
import {
  classifyLine,
  normaliseDocument,
  parseLinePrefix,
  matchWrapperOpen,
  RECOGNISED_LETTERS,
  LETTER_TO_CLASS,
  CLASS_TO_DIRECTIVE,
  type NormBlock,
} from '../lib/remark/markua-normalise.internal.js';
import {
  splitDeck,
  type MdNode as DeckMdNode,
  type MdRoot as DeckMdRoot,
  type DeckFrontmatter,
} from '../lib/remark/deck-split.internal.js';

/** A fake deck/non-deck VFile, mirroring `deck-split.test.ts`'s `makeFile`. */
function makeFile(kind: string) {
  const messages: string[] = [];
  return {
    messages,
    file: {
      data: { astro: { frontmatter: { kind } } },
      message(reason: string) {
        messages.push(reason);
        return reason;
      },
    },
  };
}

// --- helpers ---------------------------------------------------------------

const doc = (...lines: string[]): NormBlock[] => normaliseDocument(lines);

const containers = (blocks: NormBlock[]): Extract<NormBlock, { kind: 'container' }>[] =>
  blocks.filter((b): b is Extract<NormBlock, { kind: 'container' }> => b.kind === 'container');

const directiveNames = (blocks: NormBlock[]): string[] =>
  containers(blocks).map((c) => c.directiveName);

/** Run a Markdown string through the real remark plugin; return the root tree. */
function runPlugin(md: string): { type: string; children: MdNode[] } {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as {
    type: string;
    children: MdNode[];
  };
  markuaNormalise()(tree as never);
  return tree;
}

interface MdNode {
  type: string;
  name?: string;
  value?: string;
  depth?: number;
  children?: MdNode[];
  [key: string]: unknown;
}

const nodeText = (n: MdNode): string => {
  if (typeof n.value === 'string') return n.value;
  return (n.children ?? []).map(nodeText).join('');
};

const flatten = (n: MdNode): MdNode[] => [n, ...(n.children ?? []).flatMap(flatten)];

// --- T004: classifier -------------------------------------------------------

describe('classifyLine — the line classifier (T004)', () => {
  it('classifies each recognised letter-prefix as line-prefix', () => {
    for (const letter of RECOGNISED_LETTERS) {
      expect(classifyLine(`${letter}> body`, false)).toBe('line-prefix');
      // bare marker (blank line within the block) is still a line-prefix line
      expect(classifyLine(`${letter}>`, false)).toBe('line-prefix');
    }
  });

  it('treats an UNrecognised letter (`Z>`) as ordinary', () => {
    expect(classifyLine('Z> not markua', false)).toBe('ordinary');
    expect(classifyLine('F> nor this', false)).toBe('ordinary');
  });

  it('anchors on `^`: a look-alike mid-prose (`see W> here`) is ordinary', () => {
    expect(classifyLine('see W> in the manual', false)).toBe('ordinary');
  });

  it('leaves a real blockquote (`> quote`) as ordinary (never a Markua line)', () => {
    expect(classifyLine('> a real quote', false)).toBe('ordinary');
  });

  it('toggles on BOTH ``` and ~~~ fences', () => {
    expect(classifyLine('```', false)).toBe('fence-toggle');
    expect(classifyLine('```js', false)).toBe('fence-toggle');
    expect(classifyLine('~~~', false)).toBe('fence-toggle');
    expect(classifyLine('   ```', false)).toBe('fence-toggle'); // indented ≤3 → still a fence
  });

  it('fires NO other rule while inside a fence — every line is ordinary', () => {
    expect(classifyLine('W> not a warning', true)).toBe('ordinary');
    expect(classifyLine('{aside}', true)).toBe('ordinary');
    // …but a fence line still toggles the state closed
    expect(classifyLine('```', true)).toBe('fence-toggle');
  });

  it('recognises the wrapper markers (open + close), tolerating inner whitespace', () => {
    expect(classifyLine('{aside}', false)).toBe('wrapper-open');
    expect(classifyLine('{ aside }', false)).toBe('wrapper-open');
    expect(classifyLine('{blurb}', false)).toBe('wrapper-open');
    expect(classifyLine('{blurb, class: warning}', false)).toBe('wrapper-open');
    expect(classifyLine('{/aside}', false)).toBe('wrapper-close');
    expect(classifyLine('{/blurb}', false)).toBe('wrapper-close');
  });

  it('does NOT treat an attribute list (`{class: …}` / `{#id}`) as a wrapper', () => {
    // WP08 owns attribute lists; the normaliser leaves them ordinary.
    expect(classifyLine('{class: warning}', false)).toBe('ordinary');
    expect(classifyLine('{#note}', false)).toBe('ordinary');
  });
});

describe('mapping constants cover the full recognised set (T004)', () => {
  it('maps every letter A B C D E I Q T W X to a class and a directive name', () => {
    expect([...RECOGNISED_LETTERS]).toEqual(['A', 'B', 'C', 'D', 'E', 'I', 'Q', 'T', 'W', 'X']);
    for (const letter of RECOGNISED_LETTERS) {
      const markuaClass = LETTER_TO_CLASS[letter];
      expect(markuaClass, `class for ${letter}`).toBeTruthy();
      expect(CLASS_TO_DIRECTIVE[markuaClass], `directive for ${markuaClass}`).toBeTruthy();
    }
  });

  it('renames the four Starlight-mapped classes and keeps the six theme names', () => {
    expect(CLASS_TO_DIRECTIVE.warning).toBe('caution');
    expect(CLASS_TO_DIRECTIVE.error).toBe('danger');
    expect(CLASS_TO_DIRECTIVE.information).toBe('note');
    expect(CLASS_TO_DIRECTIVE.tip).toBe('tip');
    expect(CLASS_TO_DIRECTIVE.aside).toBe('aside');
    expect(CLASS_TO_DIRECTIVE.generic).toBe('generic');
    expect(CLASS_TO_DIRECTIVE.discussion).toBe('discussion');
    expect(CLASS_TO_DIRECTIVE.question).toBe('question');
    expect(CLASS_TO_DIRECTIVE.exercise).toBe('exercise');
    expect(CLASS_TO_DIRECTIVE.center).toBe('center');
  });

  it('resolves each recognised letter run to its expected directive name', () => {
    const nameFor = (letter: string): string => directiveNames(doc(`${letter}> x`))[0];
    expect(nameFor('A')).toBe('aside');
    expect(nameFor('B')).toBe('generic');
    expect(nameFor('C')).toBe('center');
    expect(nameFor('D')).toBe('discussion');
    expect(nameFor('E')).toBe('danger');
    expect(nameFor('I')).toBe('note');
    expect(nameFor('Q')).toBe('question');
    expect(nameFor('T')).toBe('tip');
    expect(nameFor('W')).toBe('caution');
    expect(nameFor('X')).toBe('exercise');
  });
});

// --- The named non-fakeable cases ------------------------------------------

describe('fence-suppresses-line-prefix (non-fakeable, LETTER-prefix)', () => {
  it('a `W>` line INSIDE a fence emits no `:::caution` and passes through byte-identical', () => {
    const lines = ['```', 'W> not a warning', '```'];
    const blocks = doc(...lines);

    // No container at all — the fence suppressed the actual letter-prefix line.
    expect(containers(blocks)).toHaveLength(0);
    expect(directiveNames(blocks)).not.toContain('caution');

    // The fenced block is one raw block, byte-identical to the input.
    expect(blocks).toHaveLength(1);
    const raw = blocks[0];
    expect(raw.kind).toBe('raw');
    if (raw.kind === 'raw') expect(raw.lines.join('\n')).toBe(lines.join('\n'));
  });

  it('proves the trigger is a real letter-prefix: the SAME line outside a fence DOES convert', () => {
    expect(directiveNames(doc('W> not a warning'))).toEqual(['caution']);
  });
});

describe('unterminated-fence-at-EOF (non-fakeable, LETTER-prefix)', () => {
  it('does not unwind insideFence at EOF — trailing `W>` lines stay code, not caution', () => {
    const lines = ['```', 'W> still code', 'W> also code'];
    const blocks = doc(...lines);

    expect(containers(blocks)).toHaveLength(0);
    expect(directiveNames(blocks)).not.toContain('caution');
    expect(blocks).toHaveLength(1);
    const raw = blocks[0];
    if (raw.kind === 'raw') expect(raw.lines).toEqual(lines);
  });
});

describe('blank-line-run', () => {
  it('keeps one aside across a bare `A>`; the internal heading survives the run', () => {
    const blocks = doc('A> # Heading', 'A>', 'A> para');
    expect(blocks).toHaveLength(1);
    const aside = blocks[0];
    expect(aside.kind).toBe('container');
    if (aside.kind !== 'container') return;
    expect(aside.directiveName).toBe('aside');

    // Inner content strips the prefix to `# Heading` / blank / `para`; the blank
    // `A>` produced a paragraph break inside the aside, not a run end. (The
    // plugin re-parses this raw inner content into a real heading + paragraph.)
    expect(aside.children.map((c) => c.kind)).toEqual(['raw']);
    const raw = aside.children[0];
    if (raw.kind === 'raw') {
      expect(raw.lines).toEqual(['# Heading', '', 'para']);
    }
  });

  it('a different family does NOT extend a run (A> does not continue a W> run)', () => {
    const blocks = doc('W> one', 'A> two');
    expect(directiveNames(blocks)).toEqual(['caution', 'aside']);
  });
});

describe('three-way-equivalence (FR-004)', () => {
  it('`W>` and `{blurb, class: warning}` both normalise to the identical `caution` container', () => {
    const shorthand = doc('W> Be careful.');
    const blurb = doc('{blurb, class: warning}', 'Be careful.', '{/blurb}');

    expect(directiveNames(shorthand)).toEqual(['caution']);
    expect(directiveNames(blurb)).toEqual(['caution']);
    expect(directiveNames(shorthand)).toEqual(directiveNames(blurb));
  });

  it('`{class: warning}` + `B>` leaves the class line for WP08 above a generic `B>` container', () => {
    // WP02 does NOT fold a free `{class: …}` attribute list — that is WP08. At
    // this seam the `B>` run is the generic container and the attribute-list
    // line is its immediate predecessor (the WP08 precondition WP08 folds to
    // `caution`, completing the three-way redundancy).
    const blocks = doc('{class: warning}', 'B> Be careful.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('raw');
    if (blocks[0].kind === 'raw') expect(blocks[0].lines).toEqual(['{class: warning}']);
    expect(directiveNames(blocks)).toEqual(['generic']);
  });
});

describe('nested-wrapper', () => {
  it('closes by balance: the outer `{aside}` closes only at count zero', () => {
    const blocks = doc('{aside}', 'outer', '{aside}', 'inner', '{/aside}', 'still outer', '{/aside}');
    expect(blocks).toHaveLength(1);
    const outer = blocks[0];
    expect(outer.kind).toBe('container');
    if (outer.kind !== 'container') return;
    expect(outer.source).toBe('wrapper-aside');

    // The body (between the outer markers) recompiled to: raw "outer", the inner
    // aside container, raw "still outer" — a first-close-wins bug would truncate
    // the outer body at the inner `{/aside}` and strand "still outer".
    const inner = containers(outer.children);
    expect(inner).toHaveLength(1);
    expect(inner[0].source).toBe('wrapper-aside');
    const rawText = outer.children
      .filter((c): c is Extract<NormBlock, { kind: 'raw' }> => c.kind === 'raw')
      .flatMap((c) => c.lines)
      .join('\n');
    expect(rawText).toContain('outer');
    expect(rawText).toContain('still outer');
  });
});

describe('unbalanced-degrades (never throws — FR-012/NFR-002)', () => {
  it('an `{aside}` with no `{/aside}` leaves the marker literal; the rest renders', () => {
    let blocks: NormBlock[] = [];
    expect(() => {
      blocks = doc('{aside}', 'orphaned body', 'more text');
    }).not.toThrow();

    // No container — the open never matched a close.
    expect(containers(blocks)).toHaveLength(0);
    const text = blocks
      .filter((b): b is Extract<NormBlock, { kind: 'raw' }> => b.kind === 'raw')
      .flatMap((b) => b.lines);
    expect(text).toContain('{aside}'); // marker stayed literal
    expect(text).toContain('orphaned body');
    expect(text).toContain('more text');
  });

  it('a stray `{/blurb}` with no open stays literal and does not throw', () => {
    let blocks: NormBlock[] = [];
    expect(() => {
      blocks = doc('ordinary', '{/blurb}', 'more');
    }).not.toThrow();
    expect(containers(blocks)).toHaveLength(0);
    const text = blocks
      .filter((b): b is Extract<NormBlock, { kind: 'raw' }> => b.kind === 'raw')
      .flatMap((b) => b.lines);
    expect(text).toContain('{/blurb}');
  });
});

describe('wrapper class resolution', () => {
  it('bare `{blurb}` is generic; unknown `{blurb, class: …}` degrades to generic (FR-012)', () => {
    expect(matchWrapperOpen('{blurb}')?.directiveName).toBe('generic');
    expect(matchWrapperOpen('{blurb, class: nonsense}')?.directiveName).toBe('generic');
    expect(matchWrapperOpen('{blurb, class: tip}')?.directiveName).toBe('tip');
    expect(matchWrapperOpen('{aside}')?.directiveName).toBe('aside');
  });
});

describe('parseLinePrefix — inner-content stripping', () => {
  it('strips the marker and a single following space; keeps further indentation', () => {
    expect(parseLinePrefix('A> # Heading')?.content).toBe('# Heading');
    expect(parseLinePrefix('A>')?.content).toBe('');
    expect(parseLinePrefix('A>  two-space')?.content).toBe(' two-space');
    expect(parseLinePrefix('Z> unrecognised')).toBeNull();
  });
});

// --- T007: the remark plugin (mdast, node-spanning) ------------------------

describe('remark plugin — byte-identical no-op (FR-011)', () => {
  it('leaves a Markua-free page unchanged (same node objects)', () => {
    const md = '# Title\n\nJust prose.\n\n> a real quote\n';
    const before = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as {
      children: MdNode[];
    };
    const childrenBefore = before.children;
    markuaNormalise()(before as never);
    // The transformer returns early: the children array is the very same one.
    expect(before.children).toBe(childrenBefore);
  });
});

describe('adjacent-blockquote (mdast)', () => {
  it('leaves the real blockquote a `blockquote` node and turns the `A>` run into `:::aside`', () => {
    const tree = runPlugin('> a real quote\n\nA> aside body\n');
    const kinds = tree.children.map((c) => c.type);
    expect(kinds).toContain('blockquote');
    const aside = tree.children.find((c) => c.type === 'containerDirective');
    expect(aside?.name).toBe('aside');
    expect(nodeText(aside as MdNode)).toContain('aside body');
    // the blockquote is untouched
    const bq = tree.children.find((c) => c.type === 'blockquote') as MdNode;
    expect(nodeText(bq)).toContain('a real quote');
  });
});

describe('fence-inside-aside (mdast, US1 sc.5)', () => {
  it('keeps aside boundaries correct and the fenced code block intact', () => {
    const md = ['{aside}', '', '```', 'W> not a warning', '> literal', '```', '', '{/aside}', ''].join(
      '\n',
    );
    const tree = runPlugin(md);
    const aside = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(aside?.name).toBe('aside');

    // The body still holds ONE real `code` node whose value is byte-intact — the
    // fenced `W>` and `>` were never converted.
    const code = flatten(aside).find((n) => n.type === 'code') as MdNode;
    expect(code).toBeTruthy();
    expect(code.value).toBe('W> not a warning\n> literal');
    // and no nested caution container leaked out of the fence
    expect(flatten(aside).filter((n) => n.type === 'containerDirective')).toHaveLength(1);
  });
});

describe('attr-above-wrapper (mdast, boundary with WP08)', () => {
  it('emits the container with the attribute-list paragraph as its immediate predecessor', () => {
    const tree = runPlugin('{#note}\n\n{aside}\n\nbody text\n\n{/aside}\n');
    const idx = tree.children.findIndex((c) => c.type === 'containerDirective');
    expect(idx).toBeGreaterThan(0);
    const container = tree.children[idx];
    expect(container.name).toBe('aside');

    // WP02 does NOT attach `{#note}`; it leaves it as the immediately-preceding
    // sibling paragraph for WP08's attribute-list plugin to fold.
    const predecessor = tree.children[idx - 1];
    expect(predecessor.type).toBe('paragraph');
    expect(nodeText(predecessor)).toContain('{#note}');
    // the id is NOT on the container (that is WP08's job)
    expect((container as MdNode).attributes).toEqual({});
  });
});

// Integration regression (WP10 out-of-map fix, defects D1/D2). Before the fix,
// buildLineStream reconstructed EVERY raw paragraph to lossy text and reparsed
// it whenever the page carried any marker, so on a callout page a lone image was
// dropped (no text descendants → empty reconstruction) and inline links/emphasis/
// inlineCode were flattened. The fix makes every NON-marker paragraph OPAQUE
// (original node preserved verbatim); only marker-bearing paragraphs convert.
describe('non-marker paragraphs survive verbatim on a callout page (D1/D2)', () => {
  const md = [
    'A> An aside marker on this page triggers the normaliser.',
    '',
    '![Palm Trees](palm.svg)',
    '',
    'See the [intro](#intro) with **bold** and `code`.',
    '',
  ].join('\n');

  it('still converts the aside marker to a containerDirective', () => {
    const tree = runPlugin(md);
    const names = tree.children
      .filter((c) => c.type === 'containerDirective')
      .map((c) => c.name);
    expect(names).toContain('aside');
  });

  it('D1: the lone image node is preserved (not dropped)', () => {
    const tree = runPlugin(md);
    const images = flatten(tree as unknown as MdNode).filter((n) => n.type === 'image');
    expect(images).toHaveLength(1);
    expect((images[0] as MdNode).url).toBe('palm.svg');
    expect((images[0] as MdNode).alt).toBe('Palm Trees');
  });

  it('D2: the inline link keeps its URL and is not flattened to text', () => {
    const tree = runPlugin(md);
    const links = flatten(tree as unknown as MdNode).filter((n) => n.type === 'link');
    expect(links).toHaveLength(1);
    expect((links[0] as MdNode).url).toBe('#intro');
    expect(nodeText(links[0])).toBe('intro');
  });

  it('D2: inline emphasis and inlineCode survive as nodes (markers not lost)', () => {
    const tree = runPlugin(md);
    const nodes = flatten(tree as unknown as MdNode);
    expect(nodes.some((n) => n.type === 'strong' && nodeText(n) === 'bold')).toBe(true);
    expect(nodes.some((n) => n.type === 'inlineCode' && n.value === 'code')).toBe(true);
  });
});

// D1 CLASS-GUARD (defect D1/D1b). Before the fix, `reconstructParagraphText`
// walked a MARKER-BEARING paragraph to TEXT ONLY and the body was re-parsed, so
// every inline construct inside a line-prefix callout body was flattened
// (link href dropped, `**bold**`/`` `code` `` collapsed) and a lone image with
// no text descendant vanished — including an image soft-adjacent (no blank line)
// to `{/aside}`, which CommonMark merges into the close-marker paragraph. The fix
// serialises inline children FAITHFULLY back to Markdown source so the body
// re-parse rebuilds the identical inline tree. These assert the CLASS, and each
// FAILS on the pre-fix (text-only) reconstruction.
describe('inline markup survives inside a line-prefix callout body (D1 class-guard)', () => {
  const md = 'I> Body with [a link](https://ex.com/x), **bold**, `code`, and ![a pic](pic.png).\n';

  it('link/strong/inlineCode/image all round-trip inside an `I>` body', () => {
    const tree = runPlugin(md);
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(container, 'the I> run became a container directive').toBeTruthy();
    const nodes = flatten(container);

    const link = nodes.find((n) => n.type === 'link') as MdNode | undefined;
    expect(link?.url, 'the link keeps its href (not flattened to text)').toBe('https://ex.com/x');
    expect(nodeText(link as MdNode)).toBe('a link');
    expect(nodes.some((n) => n.type === 'strong' && nodeText(n) === 'bold')).toBe(true);
    expect(nodes.some((n) => n.type === 'inlineCode' && n.value === 'code')).toBe(true);
    const img = nodes.find((n) => n.type === 'image') as MdNode | undefined;
    expect(img?.url, 'the image survives inside the callout body').toBe('pic.png');
    expect(img?.alt).toBe('a pic');
  });

  it('the SAME body under a `T>` prefix preserves inline markup identically', () => {
    // FR-004: a `T>` line-prefix body must not diverge from the `{blurb}` wrapper
    // (opaque-body) form — both preserve inline markup.
    const tree = runPlugin('T> A tip with **emphasis** and a `token`.\n');
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    const nodes = flatten(container);
    expect(nodes.some((n) => n.type === 'strong' && nodeText(n) === 'emphasis')).toBe(true);
    expect(nodes.some((n) => n.type === 'inlineCode' && n.value === 'token')).toBe(true);
  });
});

// FIX 1 (serialiser escape-loss). The faithful-but-NON-escaping serialiser
// corrupted line-prefix callout bodies whenever author text carried a markdown
// metachar that was ESCAPED in the source (`\*`, `\_`, `\[`) or a literal `]`
// inside a link label: re-emitting the (now-unescaped) text raw made the body
// re-parse spuriously as emphasis / a link, and footnote/linkReference nodes
// dropped entirely. The fix escapes inline text metachars, balances label
// brackets, and round-trips footnote/reference tokens. Each case below FAILS on
// the pre-fix (non-escaping) serialiser and passes after — while the marker
// prefix is still detected (a real `W> *emph*` still renders emphasis).
describe('escaped metachars stay literal inside a line-prefix body (FIX 1)', () => {
  it('`\\*.\\*` in a T> body stays literal text — no spurious emphasis', () => {
    const tree = runPlugin('T> The regex \\*.\\* matches\n');
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(container?.name).toBe('tip');
    expect(flatten(container).some((n) => n.type === 'emphasis')).toBe(false);
    expect(nodeText(container)).toContain('*.*');
  });

  it('`\\_val\\_` in a T> body stays literal text — no spurious emphasis', () => {
    const tree = runPlugin('T> use \\_val\\_ literal\n');
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(flatten(container).some((n) => n.type === 'emphasis')).toBe(false);
    expect(nodeText(container)).toContain('_val_');
  });

  it('an escaped `\\[label](not-a-link)` stays literal — no spurious link', () => {
    const tree = runPlugin('T> see \\[label](not-a-link) x\n');
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(flatten(container).some((n) => n.type === 'link')).toBe(false);
    expect(nodeText(container)).toContain('[label](not-a-link)');
  });

  it('a `]`-in-label link round-trips with its URL intact (label brackets balanced)', () => {
    const tree = runPlugin('T> [a\\]b](https://ex.com/x)\n');
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    const link = flatten(container).find((n) => n.type === 'link') as MdNode | undefined;
    expect(link, 'the link survives instead of being mangled').toBeTruthy();
    expect(link?.url).toBe('https://ex.com/x');
    expect(nodeText(link as MdNode)).toBe('a]b');
  });

  it('a real `W> *emph*` still classifies as caution AND renders the emphasis', () => {
    const tree = runPlugin('W> *emph*\n');
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(container?.name).toBe('caution');
    expect(flatten(container).some((n) => n.type === 'emphasis' && nodeText(n) === 'emph')).toBe(
      true,
    );
  });
});

describe('footnote / linkReference survive a line-prefix body (FIX 1)', () => {
  it('a footnoteReference token survives instead of vanishing', () => {
    const md = 'T> A tip with a footnote[^fn].\n\n[^fn]: The footnote text.\n';
    const tree = runPlugin(md);
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(container?.name).toBe('tip');
    // Pre-fix the footnoteReference hit the default branch (no children/value) and
    // returned '' — the token vanished. Now it round-trips as `[^fn]`.
    expect(nodeText(container)).toContain('[^fn]');
  });

  it('a linkReference round-trips as `[label][ref]` instead of flattening to text', () => {
    const md = 'T> See [the docs][d] for details.\n\n[d]: https://example.com\n';
    const tree = runPlugin(md);
    const container = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    // Pre-fix the linkReference flattened to its label only (`the docs`), losing
    // the `[…][d]` reference syntax. Now the reference token survives.
    expect(nodeText(container)).toContain('[the docs][d]');
  });
});

describe('an image soft-adjacent to {/aside} survives (D1b class-guard)', () => {
  // No blank line before `{/aside}` → CommonMark merges the image and the close
  // marker into ONE paragraph. The text-only reconstruction dropped the image
  // (no text descendant); the faithful serialisation keeps it.
  const md = '{aside}\n\n![Palm Trees](palm.svg)\n{/aside}\n';

  it('the image inside the aside is preserved (not dropped)', () => {
    const tree = runPlugin(md);
    const aside = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(aside?.name).toBe('aside');
    const images = flatten(aside).filter((n) => n.type === 'image');
    expect(images, 'the soft-adjacent image survives the close-marker paragraph').toHaveLength(1);
    expect((images[0] as MdNode).url).toBe('palm.svg');
    expect((images[0] as MdNode).alt).toBe('Palm Trees');
  });
});

// --- T001/T004: deck-aware wrapper boundary stop (C-COMPOSE-03, D3) --------
//
// The pure state machine has no mdast/opaque-node concept — the caller (the
// `.ts` plugin wrapper) resolves a placeholder LINE to "is this a slide
// boundary" and passes that decision in as `isBoundaryLine`. A literal marker
// line stands in for a resolved boundary placeholder at this level.

describe('normaliseDocument — deck-aware wrapper boundary stop (T001)', () => {
  const isBoundary = (line: string): boolean => line === '##BOUNDARY##';

  it('stops the wrapper before a boundary line, leaving it out of the container and unconsumed', () => {
    const blocks = normaliseDocument(
      ['{aside}', 'before', '##BOUNDARY##', 'after', '{/aside}'],
      isBoundary,
    );

    expect(blocks).toHaveLength(2);
    const [aside, rest] = blocks;
    expect(aside.kind).toBe('container');
    if (aside.kind !== 'container') return;
    expect(aside.source).toBe('wrapper-aside');
    expect(aside.terminatedAtBoundary).toBe(true);
    // Only the pre-boundary body was consumed.
    expect(aside.children).toEqual([{ kind: 'raw', lines: ['before'] }]);

    // The boundary line (and everything after) is NOT inside the container — it
    // comes back out as ordinary/raw content, exactly as `deckSplit` needs it.
    expect(rest.kind).toBe('raw');
    if (rest.kind === 'raw') {
      expect(rest.lines).toEqual(['##BOUNDARY##', 'after', '{/aside}']);
    }
  });

  it('without a boundary predicate (off-deck), the SAME input swallows the marker line whole (pre-T001 behaviour)', () => {
    const blocks = normaliseDocument(['{aside}', 'before', '##BOUNDARY##', 'after', '{/aside}']);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('container');
    if (blocks[0].kind !== 'container') return;
    expect(blocks[0].terminatedAtBoundary).toBeUndefined();
    const raw = blocks[0].children.find((c) => c.kind === 'raw');
    expect(raw?.kind === 'raw' && raw.lines).toContain('##BOUNDARY##');
  });

  it('a boundary that never appears leaves a balanced wrapper unaffected (predicate present, no-op)', () => {
    const blocks = normaliseDocument(['{aside}', 'body only', '{/aside}'], isBoundary);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('container');
    if (blocks[0].kind !== 'container') return;
    expect(blocks[0].terminatedAtBoundary).toBeUndefined();
  });

  it('a nested SAME-type wrapper still stops at the boundary, closing every open level', () => {
    const blocks = normaliseDocument(
      ['{aside}', 'outer', '{aside}', 'inner', '##BOUNDARY##', 'unreached', '{/aside}', '{/aside}'],
      isBoundary,
    );
    expect(blocks).toHaveLength(2);
    const [aside] = blocks;
    expect(aside.kind).toBe('container');
    if (aside.kind !== 'container') return;
    expect(aside.terminatedAtBoundary).toBe(true);
    const rawText = aside.children
      .filter((c): c is Extract<NormBlock, { kind: 'raw' }> => c.kind === 'raw')
      .flatMap((c) => c.lines);
    expect(rawText).toContain('outer');
    expect(rawText).toContain('{aside}'); // the nested open, never balanced here, stays literal
    expect(rawText).toContain('inner');
    expect(rawText).not.toContain('unreached');
  });

  it('a boundary as the very first body line degrades to an empty container, never throws', () => {
    let blocks: NormBlock[] = [];
    expect(() => {
      blocks = normaliseDocument(['{aside}', '##BOUNDARY##'], isBoundary);
    }).not.toThrow();
    expect(blocks[0].kind).toBe('container');
    if (blocks[0].kind !== 'container') return;
    expect(blocks[0].children).toEqual([]);
    expect(blocks[0].terminatedAtBoundary).toBe(true);
  });

  it('line-prefix runs are unaffected by the boundary predicate (already boundary-safe, untouched logic)', () => {
    // A placeholder line never matches `^[A-Z]>`, so it already ends a run
    // today unconditionally — passing `isBoundaryLine` must not change that.
    const blocks = normaliseDocument(['W> one', '##BOUNDARY##', 'W> two'], isBoundary);
    expect(directiveNames(blocks)).toEqual(['caution', 'caution']);
  });
});

describe('markuaNormalise on a deck — plugin-level wrapper boundary stop (T001, C-COMPOSE-03)', () => {
  it('closes the wrapper before a `###` boundary, leaving the heading top-level, and warns', () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      '{aside}\n\nsome note\n\n### Slide\n\nafter\n\n{/aside}\n',
    ) as unknown as { type: string; children: MdNode[] };
    const { file, messages } = makeFile('Presentation');
    markuaNormalise()(tree as never, file as never);

    const heading = tree.children.find((c) => c.type === 'heading');
    expect(heading, 'the boundary heading stays a top-level node').toBeTruthy();
    expect((heading as MdNode).depth).toBe(3);
    expect(nodeText(heading as MdNode)).toBe('Slide');

    const aside = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(aside?.name).toBe('aside');
    expect(nodeText(aside)).toContain('some note');
    expect(nodeText(aside)).not.toContain('Slide');

    expect(messages).toEqual([
      'Markua {aside}/{blurb} cannot span a slide boundary; closed at the boundary.',
    ]);
  });

  it('a `---` thematicBreak boundary is treated the same way', () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      '{aside}\n\nnote\n\n---\n\n{/aside}\n',
    ) as unknown as { type: string; children: MdNode[] };
    const { file, messages } = makeFile('Presentation');
    markuaNormalise()(tree as never, file as never);

    expect(tree.children.some((c) => c.type === 'thematicBreak')).toBe(true);
    expect(messages.some((m) => /cannot span a slide boundary/.test(m))).toBe(true);
  });

  it('FIX 2: a depth-1 `#` inside a wrapper on a deck is NOT a boundary — absorbed as body, like off-deck', () => {
    // deckSplit only reacts to depth 2/3 (`deck-split.internal.ts:377/381`); a
    // depth-1 heading stays IN-slide. The C-COMPOSE-03 predicate must match that
    // exactly, not `depth <= 3`, or a `{aside}` containing an authored `# Heading`
    // would wrongly terminate + warn where deckSplit splits nothing.
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      '{aside}\n\nsome note\n\n# Not a boundary\n\nmore note\n\n{/aside}\n',
    ) as unknown as { type: string; children: MdNode[] };
    const { file, messages } = makeFile('Presentation');
    markuaNormalise()(tree as never, file as never);

    // No boundary was crossed, so no warning and no top-level heading — the
    // depth-1 heading was absorbed into the wrapper body, exactly as off-deck.
    expect(messages).toHaveLength(0);
    expect(tree.children.some((c) => c.type === 'heading')).toBe(false);

    const aside = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(aside?.name).toBe('aside');
    expect(nodeText(aside)).toContain('some note');
    expect(nodeText(aside)).toContain('Not a boundary');
    expect(nodeText(aside)).toContain('more note');
  });

  it('FIX 2: depth 2 (`##`) and depth 3 (`###`) still terminate the wrapper on a deck', () => {
    for (const marker of ['##', '###']) {
      const tree = unified().use(remarkParse).use(remarkGfm).parse(
        `{aside}\n\nsome note\n\n${marker} Slide\n\nafter\n\n{/aside}\n`,
      ) as unknown as { type: string; children: MdNode[] };
      const { file, messages } = makeFile('Presentation');
      markuaNormalise()(tree as never, file as never);

      const heading = tree.children.find((c) => c.type === 'heading');
      expect(heading, `depth ${marker.length} heading stays a top-level boundary node`).toBeTruthy();
      expect((heading as MdNode).depth).toBe(marker.length);
      expect(messages).toEqual([
        'Markua {aside}/{blurb} cannot span a slide boundary; closed at the boundary.',
      ]);
    }
  });

  it('off a deck (no file at all — the existing plugin contract), the heading is swallowed as before', () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      '{aside}\n\nsome note\n\n### Slide\n\nafter\n\n{/aside}\n',
    ) as unknown as { type: string; children: MdNode[] };
    markuaNormalise()(tree as never); // no `file` argument at all

    expect(tree.children.some((c) => c.type === 'heading')).toBe(false);
    const aside = tree.children.find((c) => c.type === 'containerDirective') as MdNode;
    expect(nodeText(aside)).toContain('Slide');
  });

  it('off a deck via an explicit non-Presentation file, behaviour and warnings are unchanged', () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      '{aside}\n\nsome note\n\n### Slide\n\n{/aside}\n',
    ) as unknown as { type: string; children: MdNode[] };
    const { file, messages } = makeFile('Doc');
    markuaNormalise()(tree as never, file as never);

    expect(tree.children.some((c) => c.type === 'heading')).toBe(false);
    expect(messages).toHaveLength(0);
  });
});

// --- FIX C (2nd-squad remediation): boundary-predicate PARITY guard ---------
//
// The slide-boundary rule is stated TWICE — once as `markua-normalise.ts`'s
// `boundaryPlaceholderPredicate` (a heading depth 2 or 3, or a `thematicBreak`),
// and once inline in `deck-split.internal.ts`'s `splitDeck` loop (which SPLITS
// on exactly the same shape). Nothing ties the two definitions together, so a
// future edit to either one (e.g. widening `deckSplit` to also split on `####`)
// could silently desync them: a wrapper would then close at a line `deckSplit`
// no longer treats as a boundary, or vice versa. This test derives BOTH
// verdicts operationally — from the REAL plugin and the REAL `splitDeck`, never
// from a hand-copied expression — so a drift in either implementation reds.
describe('boundary-predicate parity guard (FIX C) — markua-normalise agrees with deckSplit', () => {
  const DECK_FM: DeckFrontmatter = { kind: 'Presentation', title: 'Deck' };

  const deckHeading = (depth: number, value: string): DeckMdNode => ({
    type: 'heading',
    depth,
    children: [{ type: 'text', value }],
  });
  const deckThematicBreak = (): DeckMdNode => ({ type: 'thematicBreak' });
  const deckRoot = (...children: DeckMdNode[]): DeckMdRoot => ({ type: 'root', children });

  /** Count every `deckSection` node in the tree, at any nesting depth (a
   * top-level horizontal slide and a nested inner/stack slide are both
   * `deckSection`s — `deck-split.internal.ts`'s `section()`). */
  function countSections(nodes: DeckMdNode[]): number {
    let n = 0;
    for (const node of nodes) {
      if (node.type === 'deckSection') {
        n += 1;
        n += countSections((node.children ?? []) as DeckMdNode[]);
      }
    }
    return n;
  }

  /** Ground truth from the REAL `splitDeck`: does appending `node` after an
   * already-open `##` slide open a NEW section (top-level or inner) — i.e. does
   * `deckSplit` treat it as a slide boundary — versus being absorbed as content
   * inside the existing slide? */
  function deckSplitTreatsAsBoundary(node: DeckMdNode): boolean {
    const base = countSections(splitDeck(deckRoot(deckHeading(2, 'S')), DECK_FM).children);
    const withNode = countSections(
      splitDeck(deckRoot(deckHeading(2, 'S'), node), DECK_FM).children,
    );
    return withNode > base;
  }

  /** Ground truth from the REAL `markuaNormalise` plugin: does a slide-boundary
   * placeholder line matching `markerMd`'s node terminate an `{aside}` wrapper
   * early (the `terminatedAtBoundary` warning fires) on a deck? */
  function normaliseTreatsAsBoundary(markerMd: string): boolean {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      `{aside}\n\nnote\n\n${markerMd}\n\nafter\n\n{/aside}\n`,
    ) as unknown as { type: string; children: MdNode[] };
    const { file, messages } = makeFile('Presentation');
    markuaNormalise()(tree as never, file as never);
    return messages.length > 0;
  }

  const samples: Array<{ label: string; markerMd: string; node: DeckMdNode }> = [
    ...[1, 2, 3, 4, 5, 6].map((depth) => ({
      label: `heading depth ${depth}`,
      markerMd: `${'#'.repeat(depth)} Slide`,
      node: deckHeading(depth, 'Slide'),
    })),
    { label: 'thematicBreak (`---`)', markerMd: '---', node: deckThematicBreak() },
  ];

  it.each(samples)(
    '$label: markua-normalise and deckSplit agree on boundary-ness',
    ({ markerMd, node }) => {
      expect(normaliseTreatsAsBoundary(markerMd)).toBe(deckSplitTreatsAsBoundary(node));
    },
  );
});

/**
 * WP08 — the attribute-list plugin (`markua-attributes*.ts`) + the two committed
 * `config.ts` wiring assertions (ADR-0030; FR-005/006/007/011/012, C-005).
 *
 * Three surfaces are proven here:
 *
 *  1. **Grammar parse** (`markua-attributes.internal.ts`): the `{…}` matrix —
 *     quoted/bare values, `%` kept, `{#id}` ≡ `{id: id}`, whitespace tolerance,
 *     and a non-parsing `{…}` → `null` (left as literal text).
 *  2. **Plugin behaviour** (`markua-attributes.ts`): per-target honour (image
 *     keys → the WP07 hProperties contract, silently-ignored `fullbleed`; heading
 *     honours only `id`; the consumed attribute paragraph removed), the id write
 *     (C-005), the span forms, and attr-above-wrapper-container.
 *  3. **Config wiring** (the two MANDATORY committed assertions): (a) markua-OFF →
 *     the integrations array is byte-identical to a pinned baseline (the
 *     `diagrams: false` twin, FR-011); (b) glossary-ACTIVE / markua-INACTIVE →
 *     `remarkDirective` is registered EXACTLY ONCE, before `glossary-term` /
 *     `glossary-autolink` (the single-owner hoist risk, research D-07). Plus the
 *     markua-ACTIVE wiring (prepend before Starlight + pinned plugin order).
 *
 * `@astrojs/starlight` is mocked (as in the sibling config tests) so the Starlight
 * entry is locatable; `../lib/glossary/load.js` + `.../generate.js` are mocked so
 * glossary presence/codegen are controlled without touching the filesystem. The
 * plugin-behaviour tests import `unified`/`remark-parse` directly and are
 * unaffected by those mocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import markuaAttributes from '../lib/remark/markua-attributes.js';
import { parseAttrList } from '../lib/remark/markua-attributes.internal.js';
import markuaNormalise from '../lib/remark/markua-normalise.js';
import markuaFootnotes from '../lib/remark/markua-footnotes.js';
import markuaCallouts from '../lib/remark/markua-callouts.js';
import markuaFigure from '../lib/rehype/markua-figure.js';
import markuaTocDemote from '../lib/rehype/markua-toc-demote.js';
import glossaryTerm from '../lib/remark/glossary-term.js';
import glossaryAutolink from '../lib/remark/glossary-autolink.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

vi.mock('../lib/glossary/generate.js', () => ({
  generateGlossaryPages: vi.fn(() => []),
  GLOSSARY_OUTPUT_DIRNAME: 'glossary',
}));

const { isGlossaryActive, loadGlossary } = await import('../lib/glossary/load.js');
const { defineDocKittyIntegrations } = await import('../lib/config.js');

// ---------------------------------------------------------------------------
// mdast helpers (plugin-behaviour tests)
// ---------------------------------------------------------------------------

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: Record<string, unknown>;
  attributes?: Record<string, string> | null;
  [key: string]: unknown;
}

const proc = unified().use(remarkParse).use(remarkGfm);

/** Parse Markdown to an mdast root and run `markuaAttributes` over it. */
function transform(md: string): Node {
  const tree = proc.runSync(proc.parse(md)) as unknown as Node;
  markuaAttributes()(tree as never);
  return tree;
}

function hProps(node: Node): Record<string, unknown> {
  return (node.data?.hProperties as Record<string, unknown>) ?? {};
}

// ===========================================================================
// 1. Grammar parse matrix
// ===========================================================================

describe('parseAttrList — {…} grammar', () => {
  it('parses comma-separated pairs, keeping the % on a percentage', () => {
    const r = parseAttrList('{alt: "a palm-lined beach", width: "75%"}');
    expect(r).not.toBeNull();
    expect(r?.entries.alt).toBe('a palm-lined beach');
    expect(r?.entries.width).toBe('75%');
  });

  it('accepts bare (unquoted) values and keeps a bare %', () => {
    expect(parseAttrList('{width: 75%}')?.entries.width).toBe('75%');
    expect(parseAttrList('{align: left}')?.entries.align).toBe('left');
  });

  it('strips SmartyPants-curled delimiter quotes off a value (#81)', () => {
    // Astro's SmartyPants runs over the raw `{alt: "…"}` text before this parser,
    // curling the straight delimiter quotes. They must not leak into the value
    // (which becomes the <img alt> accessible name).
    expect(parseAttrList('{alt: “a palm-lined beach”}')?.entries.alt).toBe('a palm-lined beach');
    expect(parseAttrList('{alt: ‘a beach’}')?.entries.alt).toBe('a beach');
    // Straight quotes still strip; a bare value with a curly apostrophe inside is
    // untouched (only a matched surrounding pair is a delimiter).
    expect(parseAttrList('{alt: "a beach"}')?.entries.alt).toBe('a beach');
    expect(parseAttrList('{alt: it’s bare}')?.entries.alt).toBe('it’s bare');
  });

  it('treats {#id} as equivalent to {id: id}', () => {
    const shorthand = parseAttrList('{#bar}');
    const explicit = parseAttrList('{id: bar}');
    expect(shorthand?.id).toBe('bar');
    expect(shorthand?.entries.id).toBe('bar');
    expect(explicit?.id).toBe('bar');
    expect(explicit?.entries.id).toBe('bar');
  });

  it('tolerates whitespace around keys, colons, and commas', () => {
    const r = parseAttrList('{  alt : "x" ,  width : 50%  }');
    expect(r?.entries.alt).toBe('x');
    expect(r?.entries.width).toBe('50%');
  });

  it('does not split on a comma inside a quoted value', () => {
    const r = parseAttrList('{alt: "a, b", width: "10%"}');
    expect(r?.entries.alt).toBe('a, b');
    expect(r?.entries.width).toBe('10%');
  });

  it('does not split on a comma inside a SmartyPants-curled quoted value (#81)', () => {
    // After SmartyPants curls the delimiters, an intra-value comma must still be
    // protected — otherwise the whole list drops to literal text for adopters who
    // write comma-containing alt text.
    const r = parseAttrList('{alt: “A cat, sitting”, width: 50%}');
    expect(r?.entries.alt).toBe('A cat, sitting');
    expect(r?.entries.width).toBe('50%');
    // A bare apostrophe must NOT open a quote and swallow the separator.
    const bare = parseAttrList('{alt: it’s fine, width: 40%}');
    expect(bare?.entries.alt).toBe('it’s fine');
    expect(bare?.entries.width).toBe('40%');
  });

  it('returns null for content that is not an attribute list (left as text)', () => {
    expect(parseAttrList('{just some prose}')).toBeNull();
    expect(parseAttrList('{}')).toBeNull();
    expect(parseAttrList('{aside}')).toBeNull();
    expect(parseAttrList('not braced at all')).toBeNull();
    expect(parseAttrList('{blurb, class: warning}')).toBeNull(); // first seg has no `:`
  });
});

// ===========================================================================
// 2. Plugin behaviour — block form
// ===========================================================================

describe('markuaAttributes — block form (per-target honour)', () => {
  it('applies image keys to the image hProperties (WP07 key contract)', () => {
    const tree = transform('{alt: "a cat", width: "75%", fullbleed: true}\n\n![The caption](cat.jpg)\n');
    // The consumed attribute paragraph is removed → only the image paragraph left.
    expect(tree.children).toHaveLength(1);
    const img = tree.children?.[0].children?.[0] as Node;
    expect(img.type).toBe('image');
    const props = hProps(img);
    // `{alt:}` → the DISTINCT `markuaAlt` key (never clobbers the bracket caption).
    expect(props.markuaAlt).toBe('a cat');
    expect(props.width).toBe('75%');
    // `fullbleed` is silently ignored (coverage row 26).
    expect(props.fullbleed).toBeUndefined();
    expect('fullbleed' in props).toBe(false);
  });

  it('honours only id on a heading; ignores non-id keys; removes the paragraph', () => {
    const tree = transform('{#overview, width: "50%", class: warning}\n\n# Chapter Bar\n');
    expect(tree.children).toHaveLength(1);
    const heading = tree.children?.[0] as Node;
    expect(heading.type).toBe('heading');
    const props = hProps(heading);
    // id write (C-005): explicit id lands on hProperties so rehypeHeadingIds keeps it.
    expect(props.id).toBe('overview');
    // width/class are NOT applied to a bare heading.
    expect(props.width).toBeUndefined();
    expect(props.class).toBeUndefined();
  });

  it('supports {id: foo} longhand on a heading', () => {
    const tree = transform('{id: foo}\n\n# Chapter Foo\n');
    expect(hProps(tree.children?.[0] as Node).id).toBe('foo');
  });

  it('leaves a non-parsing {…} paragraph as literal text (never consumed)', () => {
    const tree = transform('{just prose}\n\n# Heading\n');
    // Two children survive: the literal paragraph AND the heading (nothing consumed).
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[0].type).toBe('paragraph');
    expect(hProps(tree.children?.[1] as Node).id).toBeUndefined();
  });
});

// ===========================================================================
// 3. Plugin behaviour — span forms
// ===========================================================================

describe('markuaAttributes — inline span forms', () => {
  it('[text]{#id} → a <span id> carrying the bracket text', () => {
    const tree = transform('Here [is lorem]{#lorem}.\n');
    const para = tree.children?.[0] as Node;
    const span = para.children?.find((c) => c.type === 'markuaSpan') as Node;
    expect(span).toBeDefined();
    const data = span.data as { hName: string; hProperties: { id: string }; hChildren: Node[] };
    expect(data.hName).toBe('span');
    expect(data.hProperties.id).toBe('lorem');
    expect(data.hChildren[0].value).toBe('is lorem');
    // The surrounding prose survives as text on either side.
    const texts = (para.children ?? []).filter((c) => c.type === 'text').map((c) => c.value);
    expect(texts).toContain('Here ');
    expect(texts).toContain('.');
  });

  it('word{#id} (no brackets) → a <span id> around the preceding token', () => {
    const tree = transform('This is ipsum{#ipsum}.\n');
    const para = tree.children?.[0] as Node;
    const span = para.children?.find((c) => c.type === 'markuaSpan') as Node;
    expect(span).toBeDefined();
    const data = span.data as { hProperties: { id: string }; hChildren: Node[] };
    expect(data.hProperties.id).toBe('ipsum');
    expect(data.hChildren[0].value).toBe('ipsum');
    const texts = (para.children ?? []).filter((c) => c.type === 'text').map((c) => c.value);
    expect(texts).toContain('This is ');
    expect(texts).toContain('.');
  });

  it('ignores a non-id key on a span (left as literal text)', () => {
    const tree = transform('Here [x]{title: y}.\n');
    const para = tree.children?.[0] as Node;
    expect(para.children?.some((c) => c.type === 'markuaSpan')).toBe(false);
    const text = (para.children ?? []).map((c) => c.value ?? '').join('');
    expect(text).toContain('[x]{title: y}');
  });
});

// ===========================================================================
// 4. Plugin behaviour — attr-above-wrapper-container (H, coverage row 34)
// ===========================================================================

describe('markuaAttributes — attribute list above a wrapper container', () => {
  it('{#note} above a container directive → id on the container attributes', () => {
    const container: Node = { type: 'containerDirective', name: 'aside', attributes: {}, children: [] };
    const attrPara: Node = { type: 'paragraph', children: [{ type: 'text', value: '{#note}' }] };
    const tree: Node = { type: 'root', children: [attrPara, container] };
    markuaAttributes()(tree as never);
    // The `{#note}` paragraph is consumed; the container carries the anchor.
    expect(tree.children).toHaveLength(1);
    expect(tree.children?.[0]).toBe(container);
    expect(container.attributes?.id).toBe('note');
  });

  it('{class: warning} above a generic (B>) container → class folded onto it', () => {
    const container: Node = { type: 'containerDirective', name: 'generic', attributes: {}, children: [] };
    const attrPara: Node = { type: 'paragraph', children: [{ type: 'text', value: '{class: warning}' }] };
    const tree: Node = { type: 'root', children: [attrPara, container] };
    markuaAttributes()(tree as never);
    expect(container.attributes?.class).toBe('warning');
  });
});

// D2 CLASS-GUARD: the block-form pass must RECURSE into container-directive
// children so an attribute list nested INSIDE a wrapper (e.g. above an image
// inside `{aside}`) folds exactly like a root-level one. Before the fix,
// `applyBlockForms` iterated `root.children` only, so the nested `{alt:}`/`{#id}`
// leaked as literal text and the figure/id was lost. These FAIL on the pre-fix code.
describe('markuaAttributes — block form nested inside a wrapper (D2)', () => {
  it('folds an {alt:} attribute list above an image INSIDE a container directive', () => {
    const image: Node = { type: 'image', url: 'x.png', alt: 'bracket caption' };
    const imgPara: Node = { type: 'paragraph', children: [image] };
    const attrPara: Node = { type: 'paragraph', children: [{ type: 'text', value: '{alt: "described"}' }] };
    const container: Node = {
      type: 'containerDirective',
      name: 'aside',
      attributes: {},
      children: [attrPara, imgPara],
    };
    const tree: Node = { type: 'root', children: [container] };
    markuaAttributes()(tree as never);

    // The nested attribute paragraph is consumed inside the wrapper body…
    expect(container.children).toHaveLength(1);
    expect(container.children?.[0]).toBe(imgPara);
    // …and the image carries the WP07 figure-rehype key (the fold ran nested).
    expect(hProps(image).markuaAlt).toBe('described');
  });

  it('folds a {#id} attribute list above an image inside a container directive', () => {
    const image: Node = { type: 'image', url: 'y.png' };
    const imgPara: Node = { type: 'paragraph', children: [image] };
    const attrPara: Node = { type: 'paragraph', children: [{ type: 'text', value: '{#fig-nested}' }] };
    const container: Node = {
      type: 'containerDirective',
      name: 'aside',
      attributes: {},
      children: [attrPara, imgPara],
    };
    const tree: Node = { type: 'root', children: [container] };
    markuaAttributes()(tree as never);

    expect(container.children).toHaveLength(1);
    expect(hProps(image).id).toBe('fig-nested');
  });
});

// #36.2 / C36d: two `{…}` attribute-list paragraphs stacked directly above ONE
// target used to fold one step at a time — the outer attached to the inner
// (itself an attribute-list paragraph, not a real target) and was spliced out
// WITH it, silently losing the outer's attributes. This FAILS on the pre-fix
// `applyBlockFormsToChildren` (only `alt` would land; `width` is lost).
describe('markuaAttributes — stacked attribute-list paragraphs coalesce (C36d)', () => {
  it('{width:"50%"} then {alt:"x"} stacked above one image → both attributes land (merged, nearest-wins)', () => {
    const tree = transform('{width: "50%"}\n\n{alt: "x"}\n\n![cap](pic.png)\n');
    // Both attribute-list paragraphs are consumed → only the image paragraph left.
    expect(tree.children).toHaveLength(1);
    const img = tree.children?.[0].children?.[0] as Node;
    expect(img.type).toBe('image');
    const props = hProps(img);
    expect(props.width).toBe('50%');
    expect(props.markuaAlt).toBe('x');
  });

  it('nearest-wins: the list closer to the target overrides a conflicting key from the farther one', () => {
    const tree = transform('{width: "50%"}\n\n{width: "75%", alt: "near"}\n\n![cap](pic.png)\n');
    const img = tree.children?.[0].children?.[0] as Node;
    const props = hProps(img);
    // The nearer list's width (75%) wins over the farther one's (50%).
    expect(props.width).toBe('75%');
    expect(props.markuaAlt).toBe('near');
  });

  it('three stacked attribute-list paragraphs above one heading all fold (id nearest-wins)', () => {
    const tree = transform('{id: "far"}\n\n{class: warning}\n\n{id: "near"}\n\n# Heading\n');
    expect(tree.children).toHaveLength(1);
    const heading = tree.children?.[0] as Node;
    expect(heading.type).toBe('heading');
    // Only `id` is honoured on a bare heading; the nearest of the two ids wins.
    expect(hProps(heading).id).toBe('near');
  });

  it('a trailing run of attribute-list paragraphs with no target stays literal text', () => {
    const tree = transform('{width: "50%"}\n\n{alt: "x"}\n');
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[0].type).toBe('paragraph');
    expect(tree.children?.[1].type).toBe('paragraph');
  });
});

// ===========================================================================
// 5. Config wiring — the two MANDATORY committed assertions
// ===========================================================================

interface NamedIntegration {
  name: string;
  hooks?: Record<string, unknown>;
}
function named(integrations: unknown[]): NamedIntegration[] {
  return integrations.filter(
    (i): i is NamedIntegration =>
      typeof i === 'object' && i !== null && 'name' in i && typeof (i as { name: unknown }).name === 'string',
  );
}
function names(integrations: unknown[]): string[] {
  return named(integrations).map((i) => i.name);
}

interface MarkdownRegistration {
  markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] };
}
type SetupHook = (opts: {
  updateConfig: (config: MarkdownRegistration) => void;
  injectScript: (stage: string, code: string) => void;
}) => void;

/** Run one named integration's `astro:config:setup` hook, capturing what it
 * registers via `updateConfig` (markdown plugins). */
function runSetup(integrations: unknown[], name: string): MarkdownRegistration[] {
  const entry = named(integrations).find((i) => i.name === name);
  if (!entry) throw new Error(`integration ${name} not registered`);
  const hook = entry.hooks?.['astro:config:setup'] as SetupHook | undefined;
  if (!hook) throw new Error(`integration ${name} has no astro:config:setup hook`);
  const configs: MarkdownRegistration[] = [];
  hook({ updateConfig: (c) => configs.push(c), injectScript: () => {} });
  return configs;
}

/** All remark plugins the given integrations register, concatenated in ARRAY
 * order (the effective order Astro produces, since `updateConfig` APPENDS). */
function combinedRemark(integrations: unknown[], integrationNames: string[]): unknown[] {
  const out: unknown[] = [];
  const present = new Set(names(integrations));
  for (const name of integrationNames) {
    if (!present.has(name)) continue;
    for (const cfg of runSetup(integrations, name)) {
      out.push(...(cfg.markdown?.remarkPlugins ?? []));
    }
  }
  return out;
}

/** Index of a remark entry, whether registered bare (`plugin`) or as a tuple
 * (`[plugin, opts]`). Returns -1 when absent. */
function indexOfPlugin(remark: unknown[], plugin: unknown): number {
  return remark.findIndex((e) => e === plugin || (Array.isArray(e) && e[0] === plugin));
}

const fakeIndex: SharedTermIndex = {
  bySurface: new Map([
    ['term', [{ context: 'Ctx', contextSlug: 'ctx', anchor: 'term', termName: 'Term' }]],
  ]),
  contexts: new Map([
    ['Ctx', { slug: 'ctx', terms: [{ name: 'Term', definition: 'A thing.' }], anchors: new Map([['Term', 'term']]) }],
  ]),
};

beforeEach(() => {
  vi.mocked(isGlossaryActive).mockReturnValue(false);
  vi.mocked(loadGlossary).mockReturnValue({ present: false });
});

describe('config wiring — markua OFF byte-identity (FR-011, the diagrams:false twin)', () => {
  // PINNED baseline: the plain (no theme, no diagrams, no glossary, no markua)
  // named-integration order. A future UNCONDITIONAL markua/directive registration
  // makes this list grow and this assertion fails loudly.
  //
  // review-cycle-1 Fix A (WP01 FR-004/SC-002) intentionally grows this list:
  // `doc-kitty:base-absolute-links` is the ONE new always-on entry (unlike
  // markua/directive, it is never gated) — present in every named-array shape.
  const PINNED_BOTH_OFF_BASELINE = [
    '@astrojs/starlight',
    'doc-kitty:deck-split',
    'doc-kitty:base-absolute-links',
    '@astrojs/sitemap',
    'doc-kitty:sitemap-order',
    'doc-kitty:manifest',
    'doc-kitty:favicon',
  ];

  it('omits the whole markua seam when markua is absent (and no .contextive)', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs' });
    expect(names(arr)).toEqual(PINNED_BOTH_OFF_BASELINE);
    expect(names(arr)).not.toContain('doc-kitty:markua');
    expect(names(arr)).not.toContain('doc-kitty:remark-directive');
  });

  it('omits the whole markua seam when markua is explicitly false', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs', markua: false });
    expect(names(arr)).toEqual(PINNED_BOTH_OFF_BASELINE);
  });
});

describe('config wiring — single remark-directive owner (glossary ACTIVE / markua INACTIVE)', () => {
  beforeEach(() => {
    vi.mocked(isGlossaryActive).mockReturnValue(true);
    vi.mocked(loadGlossary).mockReturnValue({ present: true, index: fakeIndex });
  });

  it('registers remarkDirective EXACTLY ONCE, before glossary-term/glossary-autolink', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs' }); // markua absent → OFF
    // markua is OFF, so its integration is absent — the hoist is exercised via the
    // dedicated directive owner + the glossary integration only.
    expect(names(arr)).not.toContain('doc-kitty:markua');
    expect(names(arr)).toContain('doc-kitty:remark-directive');

    const remark = combinedRemark(arr, ['doc-kitty:remark-directive', 'doc-kitty:glossary']);
    // EXACTLY ONCE — a double registration (glossary + directive both adding it) or
    // a silent non-registration is the exact D-07 ownership bug this locks.
    const directiveOccurrences = remark.filter((e) => e === remarkDirective).length;
    expect(directiveOccurrences).toBe(1);

    // Pre-hoist POSITION preserved: remarkDirective leads glossary-term/autolink.
    const dirIdx = indexOfPlugin(remark, remarkDirective);
    const termIdx = indexOfPlugin(remark, glossaryTerm);
    const autoIdx = indexOfPlugin(remark, glossaryAutolink);
    expect(dirIdx).toBe(0);
    expect(termIdx).toBeGreaterThan(dirIdx);
    expect(autoIdx).toBeGreaterThan(termIdx);
  });

  it('prepends the directive owner before Starlight when glossary is active', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs' });
    const n = names(arr);
    expect(n.indexOf('doc-kitty:remark-directive')).toBeLessThan(n.indexOf('@astrojs/starlight'));
    expect(n.indexOf('doc-kitty:remark-directive')).toBeLessThan(n.indexOf('doc-kitty:glossary'));
  });
});

describe('config wiring — markua ACTIVE (prepend before Starlight + pinned order)', () => {
  it('prepends the directive owner AND the markua seam before Starlight', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs', markua: true }); // glossary OFF
    const n = names(arr);
    expect(n).toContain('doc-kitty:remark-directive');
    expect(n).toContain('doc-kitty:markua');
    expect(n.indexOf('doc-kitty:remark-directive')).toBeLessThan(n.indexOf('doc-kitty:markua'));
    expect(n.indexOf('doc-kitty:markua')).toBeLessThan(n.indexOf('@astrojs/starlight'));
    // Glossary is off → its integration is absent.
    expect(n).not.toContain('doc-kitty:glossary');
  });

  // The markua arrays are wrapped `[...].map(guardDeck)` (WP02, C36f), so each
  // member is a deck-guard whose real identity is reachable via `.__inner`
  // (C36c). These wiring assertions look THROUGH the wrap — exactly as the S-04
  // parity enumerator does — so they still pin the real plugins and their order.
  const deckInner = (e: unknown): unknown => (e as { __inner?: unknown })?.__inner ?? e;

  it('registers remarkDirective once, then markua remark in the pinned order', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs', markua: true });
    const remark = combinedRemark(arr, ['doc-kitty:remark-directive', 'doc-kitty:markua']);
    expect(remark.filter((e) => e === remarkDirective).length).toBe(1);
    // remarkDirective (unwrapped) → markuaNormalise → markuaFootnotes → markuaAttributes → markuaCallouts.
    expect(remark.map(deckInner)).toEqual([remarkDirective, markuaNormalise, markuaFootnotes, markuaAttributes, markuaCallouts]);
  });

  it('registers the markua rehype stage as [figure, tocDemote]', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs', markua: true });
    const cfg = runSetup(arr, 'doc-kitty:markua').find((c) => c.markdown?.rehypePlugins);
    expect((cfg?.markdown?.rehypePlugins ?? []).map(deckInner)).toEqual([markuaFigure, markuaTocDemote]);
  });
});

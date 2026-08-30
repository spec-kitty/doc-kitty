/**
 * WP04 T016 — vitest for the callout-mapping plugin on SYNTHETIC
 * `containerDirective` mdast (constructed directly, never depending on WP02's
 * plugin output). Covers the class → target table, three-input-form equivalence
 * (FR-004), the attribute tradeoff routing (coverage row 15), icon resolution
 * (FR-009/FR-010), unknown-class degradation (FR-012), the emitted hast shape,
 * and first-heading title extraction.
 *
 * Emission is asserted on the mdast-plus-`data` shape the plugin produces: a
 * remark plugin injects specific HTML the one supported way — `data.hName` /
 * `data.hProperties` / `data.hChildren`, which `mdast-util-to-hast` applies as the
 * element tag / properties / children. So a theme callout is the directive node
 * with `data.hName === 'aside'` and `dk-callout` classes; a native aside is the
 * directive left with its Starlight `name` (and no `data.hName`) for Starlight's
 * `remarkAsides` to render.
 */
import { describe, it, expect, vi } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import markuaCallouts from '../lib/remark/markua-callouts.js';
import markuaNormalise from '../lib/remark/markua-normalise.js';
import {
  resolveCalloutTarget,
  decideEmission,
  extractLeadingHeadingTitle,
  type MdastLike,
} from '../lib/remark/markua-callouts.internal.js';

/** Build a synthetic `containerDirective` node (the shape WP02 emits + folded attrs). */
function directive(
  name: string,
  attributes: Record<string, string> = {},
  children: MdastLike[] = [para('body')],
): MdastLike {
  return { type: 'containerDirective', name, attributes, children };
}

/** A simple mdast paragraph carrying `value` as its only text. */
function para(value: string): MdastLike {
  return { type: 'paragraph', children: [{ type: 'text', value }] };
}

/** An mdast ATX heading of the given depth carrying `value`. */
function heading(depth: number, value: string): MdastLike {
  return { type: 'heading', depth, children: [{ type: 'text', value }] };
}

/** Run the plugin over a single directive wrapped in a root, returning the mutated node. */
function run(node: MdastLike): MdastLike {
  const tree: MdastLike = { type: 'root', children: [node] };
  markuaCallouts()(tree);
  return (tree.children as MdastLike[])[0];
}

/**
 * Run RAW Markdown through the real `markuaNormalise` fold (not a hand-built
 * synthetic node) and return the resulting root's first child — the actual
 * `containerDirective` the normaliser emits. C36e / D-04b: this is what makes
 * form 1 (`W>`) and form 3 (`{blurb, class: warning}`) below genuinely distinct
 * PRE-normalisation inputs (different Markdown source) rather than two
 * hand-built, byte-identical `directive('caution')` nodes — the vacuous shape
 * the pre-fix test had. If the normalise fold breaks (e.g. the class→directive
 * mapping or the wrapper-marker regex), this helper's output changes and the
 * equivalence assertion below reds.
 */
function normalise(md: string): MdastLike {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as {
    type: string;
    children: MdastLike[];
  };
  markuaNormalise()(tree as never);
  return tree.children[0];
}

/** Read the `className` list off a node's emitted `hProperties`. */
function classes(node: MdastLike): string[] {
  const data = node.data as { hProperties?: { className?: unknown } } | undefined;
  const raw = data?.hProperties?.className;
  return Array.isArray(raw) ? raw.map(String) : [];
}

/** Find the direct child whose emitted `hProperties.className` includes `cls`. */
function childByClass(node: MdastLike, cls: string): MdastLike | undefined {
  return (node.children ?? []).find((child) => classes(child).includes(cls));
}

const MAPPED: ReadonlyArray<[string, 'note' | 'tip' | 'caution' | 'danger']> = [
  ['tip', 'tip'],
  ['warning', 'caution'],
  ['error', 'danger'],
  ['information', 'note'],
];

const THEME: ReadonlyArray<string> = [
  'aside',
  'discussion',
  'question',
  'exercise',
  'center',
  'generic',
];

describe('resolveCalloutTarget — class → target table (T012)', () => {
  it('routes the four mapped classes (and their folded names) to the native aside', () => {
    for (const [markuaClass, starlightName] of MAPPED) {
      // Markua class form (e.g. `warning`) folds to the Starlight name.
      expect(resolveCalloutTarget(markuaClass)).toEqual({
        target: 'starlight-aside',
        starlightName,
        variant: starlightName,
      });
      // Already-folded directive-name form (e.g. `caution`) resolves the same.
      expect(resolveCalloutTarget(starlightName)).toEqual({
        target: 'starlight-aside',
        starlightName,
        variant: starlightName,
      });
    }
  });

  it('routes the six theme classes to the theme callout with their own variant', () => {
    for (const variant of THEME) {
      expect(resolveCalloutTarget(variant)).toEqual({ target: 'theme-callout', variant });
    }
  });

  it('degrades an unknown class to the generic theme variant, never throwing (FR-012)', () => {
    expect(resolveCalloutTarget('totally-unknown')).toEqual({
      target: 'theme-callout',
      variant: 'generic',
    });
    expect(() => resolveCalloutTarget('')).not.toThrow();
  });
});

describe('native-aside emission — bare mapped classes (T014)', () => {
  it('leaves a bare mapped directive for remarkAsides (Starlight name, no hName)', () => {
    for (const [, starlightName] of MAPPED) {
      // Construct with the folded name WP02 actually emits for this class.
      const node = run(directive(starlightName));
      expect(node.name).toBe(starlightName);
      expect((node.data as { hName?: string } | undefined)?.hName).toBeUndefined();
      // No dk-callout markup on the native path.
      expect(classes(node)).toHaveLength(0);
    }
  });
});

describe('theme-callout emission — the six theme classes (T014, hast shape)', () => {
  it('rewrites each theme class to <aside class="dk-callout dk-callout--{variant}"> with a body', () => {
    for (const variant of THEME) {
      const node = run(directive(variant));
      const data = node.data as { hName?: string } | undefined;
      expect(data?.hName).toBe('aside');
      expect(classes(node)).toEqual(['dk-callout', `dk-callout--${variant}`]);
      // Body is wrapped in a dk-callout__body div (a <div>, not the raw paragraph).
      const body = childByClass(node, 'dk-callout__body');
      expect(body).toBeDefined();
      expect((body?.data as { hName?: string } | undefined)?.hName).toBe('div');
      // The directive name is neutralised so remarkAsides cannot re-grab it.
      expect(node.name).toBe('dk-callout');
    }
  });
});

describe('three-input-form equivalence (FR-004)', () => {
  it('W>, {class: warning}+B>, {blurb, class: warning} all emit the identical caution result', () => {
    // Form 1 (`W>`): a REAL `W> …` line, folded by the actual `markuaNormalise`
    // pass (not a hand-built `directive('caution')`) so this form's
    // pre-normalisation input is genuinely its own Markdown source (C36e).
    const formLinePrefix = run(normalise('W> Be careful.'));
    // Form 2 (`{class: warning}` + `B>`): `markuaNormalise` leaves the `{class:}`
    // line raw for WP08 (`markua-attributes`) to fold onto the `generic`
    // container's `attributes` — that fold is out of `markua-callouts`' own
    // scope, so its POST-fold shape (what `markua-callouts` actually receives)
    // is modelled directly, distinctly from forms 1/3.
    const formClassAttr = run(directive('generic', { class: 'warning' }));
    // Form 3 (`{blurb, class: warning}`): a DIFFERENT real Markdown source from
    // form 1 — a wrapper, not a line-prefix run — folded by the same real
    // `markuaNormalise` pass. Distinct pre-normalisation input, same result.
    const formWrapper = run(normalise('{blurb, class: warning}\n\nBe careful.\n\n{/blurb}'));

    // All three take the identical native-aside path (bare, no id/icon).
    for (const node of [formLinePrefix, formClassAttr, formWrapper]) {
      expect(node.name).toBe('caution');
      expect((node.data as { hName?: string } | undefined)?.hName).toBeUndefined();
    }
    expect(decideEmission({ name: 'caution' })).toEqual(formNative('caution'));
    expect(decideEmission({ name: 'generic', attributes: { class: 'warning' } })).toEqual(
      formNative('caution'),
    );
  });
});

function formNative(starlightName: 'note' | 'tip' | 'caution' | 'danger') {
  return { mode: 'native', starlightName } as const;
}

describe('attribute tradeoff routing — mapped + attribute → theme fallback (row 15)', () => {
  it('routes a mapped class carrying {#id} to the dk-callout--{mapped-name} hast with the id on the <aside>', () => {
    const node = run(directive('tip', { id: 'my-anchor' }));
    expect((node.data as { hName?: string } | undefined)?.hName).toBe('aside');
    expect(classes(node)).toEqual(['dk-callout', 'dk-callout--tip']);
    expect((node.data as { hProperties?: { id?: string } }).hProperties?.id).toBe('my-anchor');
  });

  it('routes a mapped class carrying {icon:} to the theme hast with an icon child', () => {
    const node = run(directive('caution', { icon: 'fa-lightbulb' }));
    expect((node.data as { hName?: string } | undefined)?.hName).toBe('aside');
    expect(classes(node)).toEqual(['dk-callout', 'dk-callout--caution']);
    expect(childByClass(node, 'dk-callout__icon')).toBeDefined();
  });

  it('keeps a bare mapped class on the native path (no attribute → native aside)', () => {
    const node = run(directive('tip'));
    expect(node.name).toBe('tip');
    expect((node.data as { hName?: string } | undefined)?.hName).toBeUndefined();
  });
});

describe('icon resolution — single call site via WP03 resolveIcon (T014)', () => {
  it('emits the resolved Starlight name on the dk-callout__icon child for a mapped icon', () => {
    const node = run(directive('aside', { icon: 'fa-lightbulb' }));
    const icon = childByClass(node, 'dk-callout__icon');
    expect(icon).toBeDefined();
    const props = (icon?.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties;
    // fa-lightbulb resolves to the Starlight name in the WP03 seed map.
    expect(props?.['data-icon']).toBe('rocket');
  });

  it('drops an unmapped icon (no icon child) and warns, without throwing', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const node = run(directive('aside', { icon: 'fa-obscure-name' }));
      expect(childByClass(node, 'dk-callout__icon')).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain('fa-obscure-name');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('unknown class → generic theme variant, no throw (FR-012)', () => {
  it('emits dk-callout--generic for an unrecognised directive name', () => {
    const node = run(directive('mystery-kind'));
    expect((node.data as { hName?: string } | undefined)?.hName).toBe('aside');
    expect(classes(node)).toEqual(['dk-callout', 'dk-callout--generic']);
  });
});

describe('first-heading title extraction (T015)', () => {
  it('surfaces a body-leading heading as the dk-callout__title child and removes it from the body', () => {
    const node = run(
      directive('discussion', {}, [heading(2, 'Talking point'), para('the discussion body')]),
    );
    const title = childByClass(node, 'dk-callout__title');
    expect(title).toBeDefined();
    expect((title?.data as { hName?: string } | undefined)?.hName).toBe('p');

    const body = childByClass(node, 'dk-callout__body');
    // The heading was pulled into the title, so the body no longer contains it.
    const bodyHasHeading = (body?.children ?? []).some((child) => child.type === 'heading');
    expect(bodyHasHeading).toBe(false);
  });

  it('prefers an explicit {title:} attribute over a leading heading', () => {
    const node = run(
      directive('question', { title: 'Explicit title' }, [heading(3, 'Ignored heading')]),
    );
    const title = childByClass(node, 'dk-callout__title');
    const titleText = (title?.data as { hChildren?: MdastLike[] } | undefined)?.hChildren?.[0]?.value;
    expect(titleText).toBe('Explicit title');
  });

  it('extractLeadingHeadingTitle leaves a non-heading-led body untouched', () => {
    const body = [para('no heading here')];
    expect(extractLeadingHeadingTitle(body)).toEqual({ body });
  });
});

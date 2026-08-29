/**
 * Astro-free unit matrix for `markuaTocDemote` — the ToC heading-exclusion
 * demotion pass (FR-001, US1 sc.2; NFR-004). Exercised on SYNTHETIC hast (no
 * Astro/unified runtime needed): the pass only walks a hast tree and mutates
 * in-container heading nodes.
 *
 * The integration proof — a real build where the ToC genuinely omits the demoted
 * heading while the document outline stays intact — is deferred to WP10. Here we
 * pin the node SHAPE the demotion produces (the contract WP08/WP10 depend on):
 *   - a heading inside a theme-callout (`dk-callout`) container is demoted;
 *   - a heading inside a native-aside (`starlight-aside`) container is demoted;
 *   - a heading OUTSIDE any container is untouched (keeps ToC eligibility, FR-008);
 *   - a nested callout's heading is demoted once, correctly;
 *   - an explicit `id` on an in-callout heading is preserved (FR-008).
 */
import { describe, it, expect } from 'vitest';
import markuaTocDemote from '../lib/rehype/markua-toc-demote.js';

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

const text = (value: string): HastNode => ({ type: 'text', value });

function element(
  tagName: string,
  properties: Record<string, unknown>,
  children: HastNode[],
): HastNode {
  return { type: 'element', tagName, properties, children };
}

function root(children: HastNode[]): HastNode {
  return { type: 'root', children };
}

/** Run the pass over a tree (mutates in place) and return the same tree.
 * `as never` bridges this file's local `HastNode` and the plugin's own
 * structurally-distinct `HastNode` — the repo test convention (see
 * `diagram-figure.test.ts`). */
function run(tree: HastNode): HastNode {
  markuaTocDemote()(tree as never);
  return tree;
}

/** Depth-first find the first element with the given tagName. */
function firstByTag(node: HastNode, tagName: string): HastNode | undefined {
  if (node.tagName === tagName) return node;
  for (const child of node.children ?? []) {
    const found = firstByTag(child, tagName);
    if (found) return found;
  }
  return undefined;
}

describe('markuaTocDemote — in-container ATX headings are demoted', () => {
  it('demotes a heading inside a theme-callout (dk-callout) container', () => {
    const tree = run(
      root([
        element('aside', { className: ['dk-callout', 'dk-callout--aside'] }, [
          element('h3', {}, [text('Tips')]),
        ]),
      ]),
    );

    const aside = firstByTag(tree, 'aside')!;
    const demoted = aside.children![0];
    expect(demoted.tagName).toBe('p');
    expect(demoted.properties?.role).toBe('heading');
    expect(demoted.properties?.['aria-level']).toBe(3);
    // children preserved
    expect(demoted.children).toEqual([{ type: 'text', value: 'Tips' }]);
    // no h_n survives anywhere -> the collector (tagName-keyed) omits it
    expect(firstByTag(tree, 'h3')).toBeUndefined();
  });

  it('demotes a heading inside a native-aside (starlight-aside) container, at its level', () => {
    const tree = run(
      root([
        element('aside', { className: ['starlight-aside', 'starlight-aside--note'] }, [
          element('div', { className: ['starlight-aside__content'] }, [
            element('h2', {}, [text('Did you know?')]),
          ]),
        ]),
      ]),
    );

    const demoted = firstByTag(tree, 'p')!;
    expect(demoted.properties?.role).toBe('heading');
    expect(demoted.properties?.['aria-level']).toBe(2);
    expect(firstByTag(tree, 'h2')).toBeUndefined();
  });

  it('preserves an explicit id on an in-callout heading (FR-008: author anchors kept)', () => {
    const tree = run(
      root([
        element('aside', { className: ['dk-callout'] }, [
          element('h4', { id: 'author-anchor' }, [text('Anchored')]),
        ]),
      ]),
    );

    const demoted = firstByTag(tree, 'p')!;
    expect(demoted.tagName).toBe('p');
    expect(demoted.properties?.id).toBe('author-anchor');
    expect(demoted.properties?.role).toBe('heading');
    expect(demoted.properties?.['aria-level']).toBe(4);
  });

  it('demotes a heading in a nested callout once, correctly', () => {
    const tree = run(
      root([
        element('aside', { className: ['dk-callout', 'dk-callout--discussion'] }, [
          element('div', { className: ['dk-callout__body'] }, [
            element('aside', { className: ['starlight-aside'] }, [
              element('h5', {}, [text('Nested')]),
            ]),
          ]),
        ]),
      ]),
    );

    const demoted = firstByTag(tree, 'p')!;
    expect(demoted.tagName).toBe('p');
    expect(demoted.properties?.role).toBe('heading');
    expect(demoted.properties?.['aria-level']).toBe(5);
    // exactly one heading existed and it is gone as an h_n
    expect(firstByTag(tree, 'h5')).toBeUndefined();
  });
});

describe('markuaTocDemote — headings outside any container are untouched (FR-008)', () => {
  it('leaves a top-level page heading as an h_n with no injected role', () => {
    const tree = run(
      root([
        element('h2', { id: 'section' }, [text('Real Section')]),
        element('aside', { className: ['dk-callout'] }, [
          element('h3', {}, [text('Inside')]),
        ]),
      ]),
    );

    const pageHeading = tree.children![0];
    expect(pageHeading.tagName).toBe('h2');
    expect(pageHeading.properties?.id).toBe('section');
    expect(pageHeading.properties?.role).toBeUndefined();
    expect(pageHeading.properties?.['aria-level']).toBeUndefined();

    // the in-callout sibling WAS demoted (sanity: the pass ran)
    expect(firstByTag(tree, 'p')?.properties?.role).toBe('heading');
  });

  it('does not treat a non-callout aside/div as a container', () => {
    const tree = run(
      root([
        element('aside', { className: ['some-other-aside'] }, [
          element('h2', {}, [text('Plain aside heading')]),
        ]),
        element('div', { className: ['content'] }, [
          element('h3', {}, [text('Plain div heading')]),
        ]),
      ]),
    );

    expect(firstByTag(tree, 'h2')?.tagName).toBe('h2');
    expect(firstByTag(tree, 'h3')?.tagName).toBe('h3');
    expect(firstByTag(tree, 'p')).toBeUndefined();
  });
});

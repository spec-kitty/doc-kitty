/**
 * The lightbox's pure decisions (#185): which images are worth expanding and
 * what the trigger is called. The DOM wiring is proven in the browser
 * (`tests/a11y/diagram.spec.ts`); these use minimal element stubs, since the
 * fast tier runs in `node` without a DOM.
 */
import { describe, it, expect } from 'vitest';
import { isExpandableImage, lightboxLabel, MIN_IMAGE_WIDTH } from '../lib/lightbox/lightbox.client.js';

interface Stub {
  attrs?: Record<string, string>;
  width?: number;
  closest?: string[];
  desc?: string;
}

/** An element whose `closest` matches any listed selector part. */
function el({ attrs = {}, width = 0, closest = [], desc }: Stub): HTMLImageElement {
  return {
    width,
    getAttribute: (n: string) => attrs[n] ?? null,
    closest: (sel: string) =>
      closest.some((c) => sel.split(',').map((s) => s.trim()).includes(c))
        ? { querySelector: () => (desc === undefined ? null : { textContent: desc }) }
        : null,
  } as unknown as HTMLImageElement;
}

describe('isExpandableImage', () => {
  it.each([
    ['a plain content image', el({ attrs: { alt: 'Beach' }, width: 320 }), true],
    ['an image not laid out yet (width unknown)', el({ attrs: { alt: 'Beach' } }), true],
    ['a linked image', el({ attrs: { alt: 'Beach' }, width: 320, closest: ['a'] }), false],
    ['an opted-out image', el({ attrs: { alt: 'x' }, width: 320, closest: ['.dk-no-lightbox'] }), false],
    ['a decorative image (alt="")', el({ attrs: { alt: '' }, width: 320 }), false],
    ['a presentation image', el({ attrs: { alt: 'x', role: 'presentation' }, width: 320 }), false],
    ['an aria-hidden image', el({ attrs: { alt: 'x', 'aria-hidden': 'true' }, width: 320 }), false],
    ['an icon below the minimum width', el({ attrs: { alt: 'x' }, width: MIN_IMAGE_WIDTH - 1 }), false],
  ])('%s → %s', (_name, img, expected) => {
    expect(isExpandableImage(img)).toBe(expected);
  });
});

describe('lightboxLabel', () => {
  it('names a diagram by its caption description, whitespace collapsed', () => {
    const svg = el({ closest: ['figure.dk-diagram'], desc: '  Request\n  flow ' });
    expect(lightboxLabel(svg)).toBe('Expand diagram: Request flow');
  });

  it('falls back to the image alt, then to the generic label', () => {
    expect(lightboxLabel(el({ attrs: { alt: 'Beach' } }))).toBe('Expand image: Beach');
    expect(lightboxLabel(el({}))).toBe('Expand image');
    expect(lightboxLabel(el({ closest: ['figure.dk-diagram'] }))).toBe('Expand diagram');
  });
});

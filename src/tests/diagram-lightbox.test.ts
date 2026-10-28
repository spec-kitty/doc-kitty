import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const client = readFileSync(new URL('../lib/lightbox/lightbox.client.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/dk-components.css', import.meta.url), 'utf8');

describe('JSON diagram lightbox', () => {
  it('keeps a JSON diagram at its drawn size and scrolls only when it is wider than the column', () => {
    const figure = css.match(
      /\.sl-markdown-content \.dk-diagram:has\(> svg\[data-diagram-type='JSON'\]\)\s*\{([^}]*)\}/,
    )?.[1];
    expect(figure).toBeDefined();
    expect(figure).toMatch(/overflow-x:\s*auto;/);
    expect(figure).toMatch(/overflow-y:\s*hidden;/);
    expect(figure).not.toMatch(/max-block-size/);
    expect(css).toMatch(
      /\.sl-markdown-content \.dk-diagram > svg\[data-diagram-type='JSON'\]\s*\{[^}]*max-width:\s*none;/,
    );
  });

  it('opens that drawing in the shared lightbox and does not scale the copy down', () => {
    expect(client).toContain('data-diagram-type');
    expect(client).toContain('dk-lightbox--native');
    expect(client).toContain('dk-lightbox__sheet');
    expect(client).toContain('cloneNode(true)');
    expect(client).toContain('showModal()');
    expect(client).toContain('scroller.scrollLeft');
    expect(client).toContain('scroller.scrollTop');
    expect(css).toMatch(/\.dk-lightbox__sheet\s*\{[^}]*margin:\s*auto;/);
    expect(css).toMatch(/\.dk-lightbox__sheet > svg\s*\{[^}]*max-width:\s*none;/);
  });
});

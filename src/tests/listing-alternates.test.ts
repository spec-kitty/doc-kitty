/**
 * Locale alternates on a paged hub's listing pages (#342; the operator's Q9
 * ruling, 2026-11-25: drop the missing alternates). Each locale's hub pages by
 * its own child count, so `missions/page/4/` can exist in English while French
 * stops at page 3. Starlight links every locale's version of a page from its
 * hreflang `<link>`s and its language picker; on a listing page those links are
 * kept only when their target is a built page.
 */
import { describe, expect, it } from 'vitest';
import {
  dropUnbuiltListingAlternates,
  listingAlternateTargets,
  unbuiltListingAlternates,
} from '../lib/listing-alternates.js';

const BASE = '/site';
const built = new Set(['missions/page/2', 'missions/page/3', 'missions/page/4', 'fr/missions/page/2', 'fr/missions/page/3']);

const link = (lang: string, path: string) =>
  `<link rel="alternate" hreflang="${lang}" href="https://example.test${BASE}/${path}/"/>`;
const option = (path: string, label: string, selected = false) =>
  `<option value="${BASE}/${path}/"${selected ? ' selected' : ''} class="astro-3ekvxui7">${label}</option>`;
const picker = (current: string, fr: string, en: string) =>
  `<starlight-lang-select> <label> <select autocomplete="off">${option(en, 'English', current === 'en')}${option(fr, 'Français', current === 'fr')}</select> </label> </starlight-lang-select>`;
const theme = '<starlight-theme-select><select><option value="dark">Dark</option><option value="auto" selected>Auto</option></select></starlight-theme-select>';

/** A listing page's head and header as Starlight builds them. */
function page(en: string, fr: string, current: 'en' | 'fr' = 'en'): string {
  return [
    '<head>',
    link('en', en),
    link('fr', fr),
    link('x-default', en),
    '</head><body>',
    theme,
    picker(current, fr, en),
    picker(current, fr, en),
    '</body>',
  ].join('\n');
}

describe('dropUnbuiltListingAlternates', () => {
  it('drops the hreflang link and both picker options for an unbuilt locale listing page', () => {
    const html = dropUnbuiltListingAlternates(page('missions/page/4', 'fr/missions/page/4'), BASE, built);
    expect(html).not.toContain('fr/missions/page/4');
    expect(html).toContain(link('en', 'missions/page/4'));
    expect(html).toContain(link('x-default', 'missions/page/4'));
    expect(html.match(/>English<\/option>/g)).toHaveLength(2);
    expect(html).not.toContain('>Français</option>');
  });

  it('keeps every alternate whose listing page is built', () => {
    const before = page('missions/page/2', 'fr/missions/page/2');
    expect(dropUnbuiltListingAlternates(before, BASE, built)).toBe(before);
  });

  it('drops the default-locale and x-default alternates when only the locale is paged that far', () => {
    const fronly = new Set(['fr/missions/page/2']);
    const html = dropUnbuiltListingAlternates(page('missions/page/2', 'fr/missions/page/2', 'fr'), BASE, fronly);
    expect(html).not.toContain('hreflang="en"');
    expect(html).not.toContain('hreflang="x-default"');
    expect(html).toContain(link('fr', 'fr/missions/page/2'));
    expect(html).not.toContain('>English</option>');
    expect(html.match(/ selected class="astro-3ekvxui7">Français<\/option>/g)).toHaveLength(2);
  });

  it('leaves alternates that are not listing pages, and other selects, alone', () => {
    const hub = page('missions', 'fr/missions');
    expect(dropUnbuiltListingAlternates(hub, BASE, new Set())).toBe(hub);
    // A docs page whose slug ends in a number under `page/` is not a listing page
    // unless it has that form: `page/1` is the hub itself and never a listing URL.
    const one = page('missions/page/1', 'fr/missions/page/1');
    expect(dropUnbuiltListingAlternates(one, BASE, new Set())).toBe(one);
    expect(dropUnbuiltListingAlternates(page('missions/page/4', 'fr/missions/page/4'), BASE, built)).toContain(theme);
  });

  it('matches targets under the site base only, and decodes them', () => {
    const elsewhere = `<link rel="alternate" hreflang="fr" href="https://example.test/other/fr/missions/page/9/"/>`;
    expect(dropUnbuiltListingAlternates(elsewhere, BASE, built)).toBe(elsewhere);
    const encoded = `<link rel="alternate" hreflang="fr" href="https://example.test${BASE}/fr/caf%C3%A9/page/2/"/>`;
    expect(dropUnbuiltListingAlternates(encoded, BASE, new Set(['fr/café/page/2']))).toBe(encoded);
    expect(dropUnbuiltListingAlternates(encoded, BASE, new Set())).toBe('');
  });

  it('works with no base', () => {
    const html = `<link rel="alternate" hreflang="fr" href="https://example.test/fr/missions/page/4/"/>`;
    expect(dropUnbuiltListingAlternates(html, '', built)).toBe('');
    expect(dropUnbuiltListingAlternates(html, '/', new Set(['fr/missions/page/4']))).toBe(html);
  });
});

describe('listingAlternateTargets / unbuiltListingAlternates (the built-HTML check)', () => {
  it('lists every hreflang and picker target of a page', () => {
    expect(listingAlternateTargets(page('missions/page/4', 'fr/missions/page/4'), BASE)).toEqual([
      'missions/page/4',
      'fr/missions/page/4',
      'missions/page/4',
      'missions/page/4',
      'fr/missions/page/4',
      'missions/page/4',
      'fr/missions/page/4',
    ]);
  });

  it('names the unbuilt listing targets, once each, and none after the rewrite', () => {
    const html = page('missions/page/4', 'fr/missions/page/4');
    expect(unbuiltListingAlternates(html, BASE, built)).toEqual(['fr/missions/page/4']);
    expect(unbuiltListingAlternates(dropUnbuiltListingAlternates(html, BASE, built), BASE, built)).toEqual([]);
  });
});

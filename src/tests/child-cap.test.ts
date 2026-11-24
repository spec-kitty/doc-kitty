/**
 * The sidebar child cap's settings and pure API (#341, WP01; FR-001, FR-002,
 * FR-006, FR-008). Each level of the cap is asserted with the less specific
 * levels set to other values, and each refused value is paired with an accepted
 * value of the same setting.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  CAPPED_ENTRY_LABEL,
  CAPPED_LABEL_KEY,
  DEFAULT_CHILD_CAP,
  cappedChildHidden,
  isChildCap,
  resolveCappedLabel,
  resolveChildCap,
} from '../lib/child-cap.js';
import { defineDocKittyIntegrations, type DocKittyOptions } from '../lib/config.js';
import { parseSectionRegistry } from '../lib/sections.js';
import { docKittyFields } from '../lib/schema.js';
import { DOC_KITTY_I18N_PLUGIN } from '../lib/i18n-plugin.js';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

/** The options each `defineDocKittyIntegrations` call hands the route-shaping integration. */
const routeShapingCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('../lib/integrations/route-shaping.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/integrations/route-shaping.js')>();
  return {
    ...actual,
    routeShapingIntegration: (options: Record<string, unknown>, ...rest: unknown[]) => {
      routeShapingCalls.push(options);
      return (actual.routeShapingIntegration as (...args: unknown[]) => unknown)(options, ...rest);
    },
  };
});

restoreInternalEnv();

describe('resolveChildCap (FR-001)', () => {
  it('takes the most specific level that is set', () => {
    expect(resolveChildCap({ hub: 5, section: 40, site: 20 })).toBe(5);
    expect(resolveChildCap({ section: 40, site: 20 })).toBe(40);
    expect(resolveChildCap({ site: 20 })).toBe(20);
    expect(resolveChildCap({})).toBe(DEFAULT_CHILD_CAP);
    expect(DEFAULT_CHILD_CAP).toBe(50);
  });
});

describe('cappedChildHidden (FR-008)', () => {
  it('hides a child exactly when the hub has more children than its cap', () => {
    expect(cappedChildHidden(51, 50)).toBe(true);
    expect(cappedChildHidden(50, 50)).toBe(false);
    expect(cappedChildHidden(0, 1)).toBe(false);
  });
});

describe('isChildCap (FR-002)', () => {
  it('accepts a positive whole number only', () => {
    expect(isChildCap(1)).toBe(true);
    expect(isChildCap(5000)).toBe(true);
    for (const bad of [0, -1, 1.5, '10', Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(isChildCap(bad)).toBe(false);
    }
  });
});

describe('resolveCappedLabel (FR-006)', () => {
  const translate = (strings: Record<string, string>) => (key: string) => strings[key] ?? key;

  it('defaults to "{count} pages"', () => {
    expect(CAPPED_ENTRY_LABEL).toBe('{count} pages');
    expect(resolveCappedLabel(200)).toBe('200 pages');
  });

  it('uses the locale translation, and treats an echoed key as none', () => {
    expect(resolveCappedLabel(7, undefined, translate({ [CAPPED_LABEL_KEY]: '{count} Seiten' }))).toBe('7 Seiten');
    expect(resolveCappedLabel(7, undefined, translate({}))).toBe('7 pages');
    expect(resolveCappedLabel(7, undefined, () => '')).toBe('7 pages');
  });

  it('lets the site option win, and replaces every {count}', () => {
    expect(resolveCappedLabel(3, 'All {count} ({count})', translate({ [CAPPED_LABEL_KEY]: '{count} Seiten' }))).toBe('All 3 (3)');
    expect(resolveCappedLabel(3, 'Browse all')).toBe('Browse all');
  });
});

describe('site option sidebar.childCap / sidebar.cappedLabel (FR-001, FR-002, FR-006)', () => {
  const define = (sidebar: unknown) => () =>
    defineDocKittyIntegrations({ title: 'Docs', sidebar: sidebar as DocKittyOptions['sidebar'] });

  it('accepts a positive whole number and a non-empty label', () => {
    expect(define({ childCap: 30 })).not.toThrow();
    expect(define({ cappedLabel: 'All {count}' })).not.toThrow();
  });

  it.each([0, -1, 1.5, '10'])('refuses childCap %j, naming the setting', (value) => {
    expect(define({ childCap: value })).toThrow('[dk-config] sidebar.childCap must be a positive whole number');
  });

  it('refuses a blank or non-string cappedLabel', () => {
    expect(define({ cappedLabel: '  ' })).toThrow('[dk-config] sidebar.cappedLabel must be a non-empty string');
    expect(define({ cappedLabel: 3 })).toThrow('[dk-config] sidebar.cappedLabel must be a non-empty string');
  });

  it('hands both options to the route-shaping integration, and nothing when unset', () => {
    routeShapingCalls.length = 0;
    define({ childCap: 30, cappedLabel: 'All {count}' })();
    define({ indexLabel: 'Start' })();
    expect(routeShapingCalls).toHaveLength(2);
    expect(routeShapingCalls[0]).toMatchObject({ childCap: 30, cappedLabel: 'All {count}' });
    expect(routeShapingCalls[1]).not.toHaveProperty('childCap');
    expect(routeShapingCalls[1]).not.toHaveProperty('cappedLabel');
  });

  it('lists the new keys in the unknown-key message', () => {
    expect(define({ childcap: 3 })).toThrow(
      '[dk-config] unknown key "childcap" under sidebar; expected indexLabel, collapsed, titleIsIndex, childCap or cappedLabel',
    );
  });
});

describe('section sidebar.childCap in sections.yaml (FR-001, FR-002)', () => {
  const registry = (sidebar: string) =>
    parseSectionRegistry(
      `version: 1\nsections:\n  - id: adr\n    label: Decision Records\n    order: 30\n${sidebar}`,
      { source: 'sections.yaml', warn: () => {} },
    );

  it('carries a valid cap on the entry', () => {
    expect(registry('    sidebar:\n      childCap: 100\n')[0]!.sidebar).toEqual({ childCap: 100 });
    expect(registry('')[0]!.sidebar).toBeUndefined();
  });

  it('refuses an invalid cap, naming the section', () => {
    expect(() => registry('    sidebar:\n      childCap: 0\n')).toThrow(
      'sections.yaml: section "adr" sidebar.childCap must be a positive whole number',
    );
    expect(() => registry('    sidebar: 5\n')).toThrow('sections.yaml: section "adr" "sidebar" must be a mapping');
    expect(() => registry('    sidebar:\n      child_cap: 10\n')).toThrow(
      'sections.yaml: section "adr" sidebar has unknown key "child_cap"; known keys: childCap',
    );
  });
});

describe('hub frontmatter sidebar_child_cap (FR-001, FR-002)', () => {
  const build = z.object(docKittyFields).pick({ sidebar_child_cap: true } as never);
  const page = (extra: Record<string, unknown>) => ({
    title: 'Missions',
    description: 'All missions.',
    doc_status: 'active',
    updated: '2026-11-23T00:00:00Z',
    kind: 'Hub',
    ...extra,
  });

  it('is kept by the site schema when valid, and refused when not', () => {
    expect(build.safeParse({ sidebar_child_cap: 10 })).toMatchObject({ success: true, data: { sidebar_child_cap: 10 } });
    for (const bad of [0, -3, 2.5, '10']) expect(build.safeParse({ sidebar_child_cap: bad }).success).toBe(false);
  });

  it('is checked by the standalone frontmatter gate', () => {
    expect(validate('missions/README.md', page({ sidebar_child_cap: 10 })).problems).toEqual([]);
    expect(validate('missions/README.md', page({ sidebar_child_cap: 0 })).problems.join('\n')).toMatch(/sidebar_child_cap/);
  });
});

describe('UI string (FR-006)', () => {
  it('ships dockitty.sidebar.cappedEntry in English', () => {
    const injected: Array<Record<string, Record<string, string>>> = [];
    (DOC_KITTY_I18N_PLUGIN.hooks['i18n:setup'] as (arg: { injectTranslations: (t: Record<string, Record<string, string>>) => void }) => void)({
      injectTranslations: (t) => injected.push(t),
    });
    expect(injected[0]!.en![CAPPED_LABEL_KEY]).toBe(CAPPED_ENTRY_LABEL);
  });
});

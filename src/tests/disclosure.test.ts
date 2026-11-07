/**
 * WP03 T012 — the shared disclosure control's logic (FR-016, FR-017, NFR-006). jsdom
 * is forbidden here (DIRECTIVE_051), so this runs against small stubs. They prove the
 * decisions and their order, not what a browser does with them: click, focus, the
 * real `toggle` event and layout are proved in `tests/a11y/metadata-blocks.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createDisclosureButton,
  reflectState,
  type DisclosureOptions,
} from '../lib/disclosure/toggle.js';
import {
  detailsAdapter,
  isUpgraded,
  readLabels,
  upgradeDetails,
  UPGRADED_CLASS,
} from '../lib/disclosure/upgrade-details.js';

/** Records what the code under test does to an element, in order, in `log`. */
class StubElement {
  id = '';
  type = '';
  title = '';
  className = '';
  innerHTML = '';
  textContent = '';
  open = false;
  attributes = new Map<string, string>();
  nodes: unknown[] = [];
  listeners = new Map<string, () => void>();
  classes = new Set<string>();
  clone?: StubElement;
  withIds: StubElement[] = [];
  queries: Record<string, StubElement | undefined> = {};
  ownerDocument: { activeElement: unknown } = { activeElement: null };
  log: string[];

  constructor(log: string[] = []) {
    this.log = log;
  }

  classList = {
    contains: (name: string) => this.classes.has(name),
    add: (name: string) => {
      this.classes.add(name);
      this.log.push(`class:${name}`);
    },
  };
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  querySelector(selector: string) {
    return this.queries[selector] ?? null;
  }
  querySelectorAll() {
    return this.withIds;
  }
  cloneNode() {
    return this.clone;
  }
  get childNodes() {
    return this.nodes;
  }
  get children() {
    return this.nodes;
  }
  append(...nodes: unknown[]) {
    this.nodes.push(...nodes);
  }
  replaceChildren(...nodes: unknown[]) {
    this.nodes = nodes;
  }
  before(node: unknown) {
    this.log.push(`before:${(node as StubElement).id}`);
  }
  focus() {
    this.log.push(`focus:${this.id}`);
  }
  click() {
    this.log.push('summary.click');
    this.listeners.get('click')?.();
  }
}

const asButton = (stub: StubElement) => stub as unknown as HTMLButtonElement;
const asRoot = (stub: StubElement) => stub as unknown as HTMLElement;

function optionsWith(overrides: Partial<DisclosureOptions> = {}): DisclosureOptions {
  return {
    id: 'toggle',
    controls: 'region',
    labelWhenExpanded: 'Hide it',
    labelWhenCollapsed: 'Show it',
    isCollapsed: () => false,
    setCollapsed: () => {},
    ...overrides,
  };
}

/** A complete baseline, with the wrapper, `details`, summary and its clone wired up. */
function baseline({ summaryText = 'Related (3)', cloned = ['<span>Related</span>', ' (3)'] } = {}) {
  const log: string[] = [];
  const root = new StubElement(log);
  const details = new StubElement(log);
  const summary = new StubElement(log);
  const clone = new StubElement(log);
  const clonedChild = new StubElement(log);
  clonedChild.attributes.set('id', 'copied');
  clone.nodes = cloned;
  clone.withIds = [clonedChild];
  summary.clone = clone;
  summary.textContent = summaryText;
  details.id = 'block';
  details.queries[':scope > summary'] = summary;
  root.queries[':scope > details'] = details;
  root.attributes.set('data-label-expanded', 'Hide Related (3)');
  root.attributes.set('data-label-collapsed', 'Show Related (3)');
  return { log, root, details, summary, clone, clonedChild };
}

/** Throws on any use, so reaching for storage fails the test that did it. */
const forbiddenStorage = new Proxy(
  {},
  {
    get() {
      throw new Error('the disclosure control must not touch storage');
    },
  },
);

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => new StubElement() });
  vi.stubGlobal('localStorage', forbiddenStorage);
  vi.stubGlobal('sessionStorage', forbiddenStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reflectState', () => {
  it('names the action of the next click, and mirrors the state in aria-expanded', () => {
    const button = new StubElement();
    reflectState(asButton(button), true, optionsWith());
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Show it');
    expect(button.title).toBe('Show it');

    reflectState(asButton(button), false, optionsWith());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Hide it');
    expect(button.title).toBe('Hide it');
  });

  it('sets no title on a labelled button, which keeps its aria-label', () => {
    const button = new StubElement();
    reflectState(asButton(button), true, optionsWith({ labelled: true }));
    expect(button.getAttribute('aria-label')).toBe('Show it');
    expect(button.title).toBe('');
  });
});

describe('createDisclosureButton', () => {
  const create = (options: DisclosureOptions) =>
    createDisclosureButton(options) as unknown as StubElement;

  it('builds a plain button in the adapter\'s current state', () => {
    const button = create(optionsWith({ isCollapsed: () => true }));
    expect(button.type).toBe('button');
    expect(button.id).toBe('toggle');
    expect(button.getAttribute('aria-controls')).toBe('region');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.innerHTML).toContain('aria-hidden="true"');
  });

  it('never writes an empty aria-controls', () => {
    const button = create(optionsWith({ controls: '' }));
    expect(button.getAttribute('aria-controls')).toBeNull();
    expect(button.getAttribute('aria-expanded'), 'control: the button is still reflected').toBe('true');
  });

  it('a click flips the adapter and the button together', () => {
    let collapsed = true;
    const button = create(
      optionsWith({
        isCollapsed: () => collapsed,
        setCollapsed: (next) => {
          collapsed = next;
        },
      }),
    );
    button.listeners.get('click')?.();
    expect(collapsed).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.listeners.get('click')?.();
    expect(collapsed).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('a click shows the state it asked for when the adapter could not record it', () => {
    // The rail's preference reads but cannot write under a full localStorage. The
    // button has always shown the click's result there; a re-read would not.
    const button = create(optionsWith({ isCollapsed: () => false, setCollapsed: () => {} }));
    button.listeners.get('click')?.();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('readLabels', () => {
  it('takes both names from the wrapper', () => {
    expect(readLabels(asRoot(baseline().root))).toEqual({
      labelWhenExpanded: 'Hide Related (3)',
      labelWhenCollapsed: 'Show Related (3)',
    });
  });

  it.each(['data-label-expanded', 'data-label-collapsed'])('is null without %s', (name) => {
    const { root } = baseline();
    root.removeAttribute(name);
    expect(readLabels(asRoot(root))).toBeNull();
  });
});

describe('detailsAdapter', () => {
  const stubs = (open: boolean) => {
    const details = new StubElement();
    details.open = open;
    const summary = new StubElement();
    return {
      details,
      summary,
      asDetails: details as unknown as HTMLDetailsElement,
      asSummary: asRoot(summary),
    };
  };

  it('reads collapsed as details not being open', () => {
    const open = stubs(true);
    expect(detailsAdapter(open.asDetails, open.asSummary, false).isCollapsed()).toBe(false);
    const closed = stubs(false);
    expect(detailsAdapter(closed.asDetails, closed.asSummary, false).isCollapsed()).toBe(true);
  });

  it('by default writes details.open, without a click', () => {
    const { details, summary, asDetails, asSummary } = stubs(false);
    detailsAdapter(asDetails, asSummary, false).setCollapsed(false);
    expect(details.open).toBe(true);
    expect(summary.log).toEqual([]);
  });

  it('via the summary it clicks and leaves details.open to the browser', () => {
    const { details, summary, asDetails, asSummary } = stubs(false);
    detailsAdapter(asDetails, asSummary, true).setCollapsed(false);
    expect(summary.log).toEqual(['summary.click']);
    expect(details.open, 'the stub has no native toggle').toBe(false);
  });

  it('via the summary it does not click when the state is already right', () => {
    const { summary, asDetails, asSummary } = stubs(false);
    detailsAdapter(asDetails, asSummary, true).setCollapsed(true);
    expect(summary.log).toEqual([]);
  });
});

describe('upgradeDetails', () => {
  const buttonOf = (log: string[], root: StubElement, spy: ReturnType<typeof vi.fn>) => {
    upgradeDetails(asRoot(root));
    return { log, button: spy.mock.results[0]?.value as StubElement };
  };
  const spyOnCreate = (log: string[] = []) => {
    const spy = vi.fn(() => new StubElement(log));
    vi.stubGlobal('document', { createElement: spy });
    return spy;
  };

  it('inserts the button before details, targeting it, then marks the wrapper', () => {
    const { log, root, details } = baseline();
    const { button } = buttonOf(log, root, spyOnCreate());
    expect(button.id).toBe('block-toggle');
    expect(button.getAttribute('aria-controls')).toBe(details.id);
    expect(button.className).toBe('dk-disclosure__toggle');
    expect(log).toEqual(['before:block-toggle', `class:${UPGRADED_CLASS}`]);
    expect(isUpgraded(asRoot(root))).toBe(true);
  });

  it('copies the summary\'s content, stripped of ids, after the chevron', () => {
    const { log, root, clonedChild } = baseline();
    const { button } = buttonOf(log, root, spyOnCreate());
    expect(clonedChild.getAttribute('id')).toBeNull();
    expect(button.nodes).toEqual(['<span>Related</span>', ' (3)']);
    expect(button.innerHTML, 'the default chevron stays').toContain('<svg');
  });

  it('takes its names from the wrapper, and no title when labelled', () => {
    const { log, root } = baseline();
    const { button } = buttonOf(log, root, spyOnCreate());
    expect(button.getAttribute('aria-label')).toBe('Show Related (3)');
    expect(button.title).toBe('');
  });

  it('a chevron-only summary gives its icon to the button and keeps the title', () => {
    const icon = new StubElement();
    const { log, root } = baseline({ summaryText: '  ', cloned: [icon] as never });
    const { button } = buttonOf(log, root, spyOnCreate());
    expect(button.nodes).toEqual([icon]);
    expect(button.getAttribute('aria-label')).toBe('Show Related (3)');
    expect(button.title).toBe('Show Related (3)');
  });

  it('never changes the open state on upgrade (NFR-006)', () => {
    for (const open of [true, false]) {
      const { log, root, details } = baseline();
      details.open = open;
      const { button } = buttonOf(log, root, spyOnCreate());
      expect(details.open).toBe(open);
      expect(button.getAttribute('aria-expanded')).toBe(String(open));
    }
  });

  it('a toggle from outside, such as in-page find, updates the button', () => {
    const { log, root, details } = baseline();
    const { button } = buttonOf(log, root, spyOnCreate());
    expect(button.getAttribute('aria-expanded')).toBe('false');
    details.open = true;
    details.listeners.get('toggle')?.();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Hide Related (3)');
  });

  it('honours data-dk-toggle-via="summary" through the button', () => {
    const { log, root, summary } = baseline();
    root.attributes.set('data-dk-toggle-via', 'summary');
    const { button } = buttonOf(log, root, spyOnCreate());
    button.listeners.get('click')?.();
    expect(log).toContain('summary.click');
    expect(summary.log).toBe(log);
  });

  it('moves focus to the button, after insertion, only if the summary had it', () => {
    const focused = baseline();
    focused.root.ownerDocument.activeElement = focused.summary;
    buttonOf(focused.log, focused.root, spyOnCreate(focused.log));
    expect(focused.log).toEqual([
      'before:block-toggle',
      `class:${UPGRADED_CLASS}`,
      'focus:block-toggle',
    ]);

    const elsewhere = baseline();
    elsewhere.root.ownerDocument.activeElement = new StubElement();
    buttonOf(elsewhere.log, elsewhere.root, spyOnCreate(elsewhere.log));
    expect(elsewhere.log.some((entry) => entry.startsWith('focus:')), 'control').toBe(false);
  });

  it('skips a wrapper that is already upgraded', () => {
    const { log, root } = baseline();
    const spy = spyOnCreate();
    upgradeDetails(asRoot(root));
    upgradeDetails(asRoot(root));
    expect(spy, 'control: the first call created it').toHaveBeenCalledTimes(1);
    expect(log.filter((entry) => entry.startsWith('before:'))).toHaveLength(1);
  });

  it.each([
    ['no details', (b: ReturnType<typeof baseline>) => delete b.root.queries[':scope > details']],
    ['a details with no id', (b: ReturnType<typeof baseline>) => (b.details.id = '')],
    ['no summary', (b: ReturnType<typeof baseline>) => delete b.details.queries[':scope > summary']],
    ['no labels', (b: ReturnType<typeof baseline>) => b.root.removeAttribute('data-label-expanded')],
  ])('leaves the native control alone with %s', (_name, breakIt) => {
    const stubs = baseline();
    breakIt(stubs);
    const spy = spyOnCreate();
    upgradeDetails(asRoot(stubs.root));
    expect(spy).not.toHaveBeenCalled();
    expect(isUpgraded(asRoot(stubs.root))).toBe(false);
  });

  it('leaves the summary visible if the insertion throws', () => {
    const { root, details } = baseline();
    details.before = () => {
      throw new Error('insertion failed');
    };
    spyOnCreate();
    expect(() => upgradeDetails(asRoot(root))).toThrow('insertion failed');
    expect(isUpgraded(asRoot(root))).toBe(false);
  });
});

describe('storage (FR-016)', () => {
  const libDir = fileURLToPath(new URL('../lib/', import.meta.url));
  const STORAGE = /\b(localStorage|sessionStorage|indexedDB|cookie)\b/;
  const code = (file: string) =>
    readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('no module under src/lib/disclosure/ names a storage API', () => {
    const dir = path.join(libDir, 'disclosure');
    const files = readdirSync(dir);
    expect(files, 'control: the scan reads the modules').toContain('toggle.ts');
    for (const file of files) expect(code(path.join(dir, file)), file).not.toMatch(STORAGE);
  });

  it('control: the scan does find the rail\'s persistence', () => {
    expect(code(path.join(libDir, 'toc-rail', 'preference.ts'))).toMatch(STORAGE);
  });
});

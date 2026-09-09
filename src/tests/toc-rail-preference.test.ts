/**
 * WP01 T004 — behavior tests for the collapse preference + pre-paint (contract
 * C-1, invariants INV-1/INV-2, FR-005). C-5 nominates "jsdom for behavior", but
 * jsdom is NOT a dependency of this toolkit and DIRECTIVE_051 forbids adding one.
 * The behavior under test needs only two globals — `document.documentElement`
 * (`setAttribute`/`hasAttribute`/`getAttribute`) and `localStorage` — so this
 * suite runs in the default node project and supplies those via `vi.stubGlobal`
 * with lightweight fakes (including a THROWING stub for private mode). This
 * covers the identical behavioral assertions C-5 lists without a new dependency;
 * the DOM-integration proof lives in the Playwright suite (C-5 Playwright block).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PRE_PAINT_SCRIPT } from '../lib/toc-rail/pre-paint.js';

/** Minimal `document` stub tracking attributes set on `documentElement`. */
function makeDocumentStub() {
  const attrs: Record<string, string> = {};
  return {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      hasAttribute(name: string) {
        return Object.prototype.hasOwnProperty.call(attrs, name);
      },
      getAttribute(name: string) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
    },
  };
}

/** A working Map-backed `localStorage` fake. */
function makeStorageStub(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    _store: store,
  };
}

/** A `localStorage` whose getItem/setItem THROW (private-mode simulation, C-1). */
function makeThrowingStorageStub() {
  return {
    getItem() {
      throw new Error('SecurityError: storage blocked');
    },
    setItem() {
      throw new Error('SecurityError: storage blocked');
    },
  };
}

/** Execute the classic pre-paint body against the currently stubbed globals. */
function runPrePaint() {
  // Barewords `localStorage`/`document` in the script resolve to globalThis,
  // exactly as they would in a real inline <head> script.
  new Function(PRE_PAINT_SCRIPT)();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('pre-paint execution (INV-1 / NFR-001)', () => {
  it('sets data-toc-collapsed when the stored value is collapsed', () => {
    const doc = makeDocumentStub();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('localStorage', makeStorageStub({ 'dk-toc-collapsed': '1' }));

    runPrePaint();

    expect(doc.documentElement.getAttribute('data-toc-collapsed')).toBe('');
  });

  it('is a no-op when the stored value is expanded (\'0\')', () => {
    const doc = makeDocumentStub();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('localStorage', makeStorageStub({ 'dk-toc-collapsed': '0' }));

    runPrePaint();

    expect(doc.documentElement.hasAttribute('data-toc-collapsed')).toBe(false);
  });

  it('is a no-op when there is no stored value', () => {
    const doc = makeDocumentStub();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('localStorage', makeStorageStub());

    runPrePaint();

    expect(doc.documentElement.hasAttribute('data-toc-collapsed')).toBe(false);
  });

  it('does not throw and leaves the outline expanded when storage is blocked (C-1)', () => {
    const doc = makeDocumentStub();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('localStorage', makeThrowingStorageStub());

    expect(() => runPrePaint()).not.toThrow();
    expect(doc.documentElement.hasAttribute('data-toc-collapsed')).toBe(false);
  });
});

describe('preference read/write (INV-2 / FR-005)', () => {
  it('round-trips isCollapsed/setCollapsed through localStorage', async () => {
    const storage = makeStorageStub();
    vi.stubGlobal('localStorage', storage);
    const { isCollapsed, setCollapsed, STORAGE_KEY } = await import(
      '../lib/toc-rail/preference.js'
    );

    expect(isCollapsed()).toBe(false); // absent → expanded

    setCollapsed(true);
    expect(storage._store.get(STORAGE_KEY)).toBe('1');
    expect(isCollapsed()).toBe(true);

    setCollapsed(false);
    expect(storage._store.get(STORAGE_KEY)).toBe('0');
    expect(isCollapsed()).toBe(false);
  });

  it('throwing storage: never throws, falls back to in-session state (C-1)', async () => {
    vi.stubGlobal('localStorage', makeThrowingStorageStub());
    const { isCollapsed, setCollapsed } = await import('../lib/toc-rail/preference.js');

    // Read throws internally → caught → in-session default (expanded).
    expect(() => isCollapsed()).not.toThrow();
    expect(isCollapsed()).toBe(false);

    // Write throws internally → caught → in-session state still updates.
    expect(() => setCollapsed(true)).not.toThrow();
    expect(isCollapsed()).toBe(true);

    expect(() => setCollapsed(false)).not.toThrow();
    expect(isCollapsed()).toBe(false);
  });
});

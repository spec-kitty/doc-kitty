/**
 * `toc-rail/preference` — the collapse preference as pure, blocked-storage-safe
 * logic (IC-01, contract C-1, data-model E-01). This module is the persistence +
 * query surface only: it NEVER touches the DOM at import or at call time. The
 * `data-toc-collapsed` attribute on `<html>` (the layout driver, INV-3) is set
 * by the pre-paint inline script (`./pre-paint`) and, at runtime, by the client
 * toggle (WP02) — not here. Keeping this module DOM-free keeps it a pure unit
 * (DIRECTIVE_001) and lets both node and behavior tests exercise it directly.
 *
 * ## Blocked storage (INV-2 / FR-005 / C-1)
 * Private-browsing modes expose a `localStorage` object that EXISTS but whose
 * `getItem`/`setItem` THROW. Starlight's `ThemeProvider` bare
 * `typeof localStorage !== 'undefined' && localStorage.getItem(...)` guard would
 * therefore abort — so we deliberately do NOT copy it. BOTH the read and the
 * write are wrapped in a real `try/catch`; on failure we fall back to an
 * in-session value and never throw.
 */

/** The two-column TOC breakpoint (mirrors Starlight's own ~`min-width: 72rem`). */
export const TOC_BREAKPOINT = '72rem';

/** `TOC_BREAKPOINT` in px (72rem × 16px/rem) — for viewport-sized tests. */
export const TOC_BREAKPOINT_PX = 1152;

/** Persistence key; value `'1'` = collapsed, `'0'`/absent = expanded (C-1). */
export const STORAGE_KEY = 'dk-toc-collapsed';

/**
 * In-session fallback used only when `localStorage` is unavailable or throws
 * (blocked/private mode). It mirrors the last requested state so the toggle
 * still behaves within the session even with persistence blocked (INV-2).
 */
let sessionCollapsed = false;

/**
 * Whether the outline is currently collapsed. Reads persisted state when
 * storage is available; on any throw (blocked storage) returns the in-session
 * fallback. Never throws.
 */
export function isCollapsed(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Blocked storage (getItem throws in private mode) — in-session state (INV-2).
    return sessionCollapsed;
  }
}

/**
 * Persist the collapse preference. Always records the in-session fallback first
 * (so a subsequent blocked-storage read is consistent), then attempts to write
 * through to `localStorage`; a throwing write is swallowed. Never throws.
 */
export function setCollapsed(collapsed: boolean): void {
  sessionCollapsed = collapsed;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Blocked storage (setItem throws in private mode) — in-session only (INV-2).
  }
}

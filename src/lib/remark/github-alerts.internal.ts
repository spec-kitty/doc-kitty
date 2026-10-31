/**
 * Pure, Astro-free parsing and mapping for GitHub alert blockquotes (#250,
 * ADR-0068). `github-alerts.ts` (the remark plugin) delegates the marker test and
 * the type → aside table to this module, so the table is unit-tested on its own.
 *
 * GitHub's syntax is a blockquote whose FIRST line is exactly `[!TYPE]` (any
 * case, trailing spaces allowed) for one of five types. Anything else (an
 * unknown type, text after the marker on the same line) is not an alert on
 * GitHub, so it is not one here either.
 */

/** The four Starlight aside variants (`remarkAsides` renders only these). */
export type AsideVariant = 'note' | 'tip' | 'caution' | 'danger';

/** The five GitHub alert types. */
export type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

/**
 * Where each alert type renders. `title` is set only where Starlight's default
 * aside title would say something other than GitHub's label (IMPORTANT would read
 * "Note", WARNING "Caution", CAUTION "Danger"); it becomes the directive label, so
 * the reader sees the word the author wrote. NOTE and TIP keep Starlight's own
 * (translated) default title.
 */
export const ALERT_TO_ASIDE: Readonly<Record<AlertType, { variant: AsideVariant; title?: string }>> = {
  NOTE: { variant: 'note' },
  TIP: { variant: 'tip' },
  IMPORTANT: { variant: 'note', title: 'Important' },
  WARNING: { variant: 'caution', title: 'Warning' },
  CAUTION: { variant: 'danger', title: 'Caution' },
};

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

/**
 * Read an alert marker at the very start of `text` (the first text node of the
 * blockquote's first paragraph). Returns the upper-cased type and the text left
 * after the marker line, or `undefined` when `text` does not open with a marker
 * alone on its line.
 */
export function parseAlertMarker(text: string): { type: AlertType; rest: string } | undefined {
  const match = MARKER.exec(text);
  if (!match) return undefined;
  return { type: match[1].toUpperCase() as AlertType, rest: text.slice(match[0].length) };
}

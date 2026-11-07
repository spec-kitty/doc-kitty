/**
 * The data side of DocKitty's sidebar sublist (ADR-0075): what the template decides,
 * kept out of the `.astro` file. Starlight's `utils/` is not exported, so
 * `groupHasCurrent` stands in for its `sidebarGroupHasCurrent`.
 */
import type { SidebarEntry } from '../../lib/route-shaping.js';

/** The marker `shapeSidebar` puts on a group's index link. Never reaches the output. */
const GROUP_INDEX_ATTR = 'data-dk-group-index';

type Link = Extract<SidebarEntry, { type: 'link' }>;
type Group = Extract<SidebarEntry, { type: 'group' }>;

/** What the toolkit adds to a route's sidebar entry: `dkDir` from shaping, `dkIcon` from WP07. */
export interface DkExtras {
  /** The directory a group represents. */
  dkDir?: string;
  /** Inline SVG markup, from the toolkit's own icon set. */
  dkIcon?: string;
  /** `dkIcon` is a Font Awesome icon, so the page owes the licence comment. */
  dkIconFa?: boolean;
}

export const extrasOf = (entry: SidebarEntry): DkExtras => entry as SidebarEntry & DkExtras;

/** The attribution a page rendering a Font Awesome icon carries (C-008). */
export const FONT_AWESOME_LICENCE_COMMENT =
  '<!-- Icons: Font Awesome Free by Fonticons, Inc. (https://fontawesome.com), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) -->';

/** Whether this tree shows a Font Awesome icon. */
export function hasFontAwesomeIcon(entries: readonly SidebarEntry[]): boolean {
  return entries.some(
    (entry) => extrasOf(entry).dkIconFa === true || (entry.type === 'group' && hasFontAwesomeIcon(entry.entries)),
  );
}

export function groupHasCurrent(group: Group): boolean {
  return group.entries.some((entry) => (entry.type === 'link' ? entry.isCurrent : groupHasCurrent(entry)));
}

/** A link's attributes as they go in the output: the shaping marker removed. */
export function outputAttrs(link: Link): Link['attrs'] {
  const attrs = { ...link.attrs };
  delete attrs[GROUP_INDEX_ATTR];
  return attrs;
}

/**
 * A group's `details` id. An `id` and `aria-controls` take no whitespace, and two
 * directories must not share an id, so everything but letters, digits, `_` and `-` is
 * written as its code point. The directory is the same on every page, so the id is stable.
 */
export function groupElementId(dir: string): string {
  return `dk-group-${dir.replace(/[^\p{L}\p{N}_-]/gu, (char) => `.${char.codePointAt(0)!.toString(16)}.`)}`;
}

export interface TitleAsIndexGroup {
  /** The group's index link, shown as its label. */
  index: Link;
  /** Everything else in the group. May be empty. */
  rest: SidebarEntry[];
  /** The id for its `details`. */
  id: string;
}

/** The title-as-index reading of a group, or null when it takes Starlight's plain toggle. */
export function asTitleIndexGroup(group: Group): TitleAsIndexGroup | null {
  const [first, ...rest] = group.entries;
  const dir = extrasOf(group).dkDir;
  if (first?.type !== 'link' || !(GROUP_INDEX_ATTR in first.attrs) || dir === undefined) return null;
  return { index: first, rest, id: groupElementId(dir) };
}

/**
 * `icon-map.ts` — the curated Font Awesome → Starlight icon seed map + its pure
 * lookup (WP03 T009/T010; FR-009, FR-010, NFR-002; contract `icon-map.md`).
 *
 * A Markua callout attribute `{icon: fa-name}` names an icon by its Font Awesome
 * convention (Markua's source ecosystem). This module resolves that `fa-` name to
 * a real `@astrojs/starlight@0.32.6` `<Icon>` name, or drops it gracefully —
 * **never** failing the build over an icon (NFR-002).
 *
 * This is a **pure, standalone, Astro-free module**: a lookup table plus a
 * resolver function. It is **dormant** until WP04's callout-directive plugin
 * imports {@link resolveIcon} and emits the resolved name as the
 * `dk-callout__icon` hast child (there is no `Callout.astro` — see
 * `contracts/callout-mapping.md` §"Why hast, not an `.astro` component"). WP03
 * touches no rendering file; the corpus stays byte-identical until WP04 wires it
 * in and WP10 turns the Markua preset on.
 */

/** One seed-map row: the `fa-…` name an author writes → the Starlight `<Icon>` name it maps to. */
export interface IconMapEntry {
  /** The `fa-` prefixed Font Awesome name, e.g. `"fa-lightbulb"`. */
  fa: string;
  /** The Starlight `<Icon>` name it resolves to, e.g. `"rocket"`. */
  starlight: string;
}

/**
 * The curated seed set (contract `icon-map.md`).
 *
 * Every `starlight` target below was verified against the pinned
 * `@astrojs/starlight@0.32.6` `<Icon>` set (`node_modules/@astrojs/starlight/
 * components/Icons.ts`, `Icons = { ...BuiltInIcons, ...FileIcons }`). The
 * contract's draft table listed several targets — `question`, `flag`,
 * `bookmark`, `clock`, `user`, and `seti:code` — that do **not** exist in that
 * set; per the contract's own instruction ("where a listed target is not a real
 * Starlight icon it is corrected or the row is dropped — never shipped pointing
 * at a non-existent icon"), those rows are dropped here rather than guessed. The
 * remaining rows below are confirmed to exist verbatim in `Icons`. The row count
 * is not load-bearing (contract); the graceful-drop behaviour is.
 */
const ICON_SEED: readonly IconMapEntry[] = [
  { fa: 'fa-lightbulb', starlight: 'rocket' },
  { fa: 'fa-info-circle', starlight: 'information' },
  { fa: 'fa-exclamation-triangle', starlight: 'warning' },
  { fa: 'fa-exclamation-circle', starlight: 'error' },
  { fa: 'fa-check', starlight: 'approve-check' },
  { fa: 'fa-times', starlight: 'close' },
  { fa: 'fa-comments', starlight: 'comment' },
  { fa: 'fa-pencil', starlight: 'pencil' },
  { fa: 'fa-star', starlight: 'star' },
  { fa: 'fa-book', starlight: 'open-book' },
  { fa: 'fa-terminal', starlight: 'seti:shell' },
  { fa: 'fa-cog', starlight: 'setting' },
];

/**
 * The seed map, keyed by `fa` name — the single source of truth {@link lookup}
 * and {@link resolveIcon} read from. A frozen `Map` so no consumer mutates it.
 */
const ICON_MAP: ReadonlyMap<string, string> = new Map(
  ICON_SEED.map((entry) => [entry.fa, entry.starlight]),
);

/** Stable, greppable warning prefix — WP10's build assertion greps for it verbatim. */
const WARNING_PREFIX = '[markua]';

/**
 * Pure lookup: the Starlight `<Icon>` name for a given `fa-` name, or
 * `undefined` if it has no seed entry. A value with no `fa-` prefix is treated
 * as unmapped (Markua's Font Awesome convention — see contract "Entry shape").
 * Deterministic and side-effect-free; never throws.
 */
export function lookup(fa: string): string | undefined {
  if (!fa.startsWith('fa-')) return undefined;
  return ICON_MAP.get(fa);
}

/**
 * The call site WP04 uses. Resolves a Markua callout's `{icon: fa-name}` value
 * to a Starlight `<Icon>` name, with graceful-drop-plus-build-warning for an
 * unmapped name (FR-009, FR-010, NFR-002):
 *   - `undefined`/empty input → `undefined`, no warning (no `{icon:}` given).
 *   - a mapped name → the Starlight name.
 *   - an unmapped name (including one with no `fa-` prefix) → `undefined`, and
 *     a build-time warning naming the unmapped value is emitted via
 *     `console.warn` with the stable `[markua]` prefix.
 *
 * Never throws on any input — an icon must never fail the build (NFR-002).
 */
export function resolveIcon(fa: string | undefined): string | undefined {
  if (fa === undefined || fa === '') return undefined;

  const resolved = lookup(fa);
  if (resolved !== undefined) return resolved;

  console.warn(`${WARNING_PREFIX} unknown icon "${fa}" — dropped`);
  return undefined;
}

/**
 * The INNER SVG markup for every Starlight `<Icon>` name a curated `fa-` entry can
 * resolve to (the `starlight` targets of {@link ICON_SEED}), copied VERBATIM from
 * the pinned `@astrojs/starlight@0.32.6` icon set (`components/Icons.ts` for the
 * built-ins, `user-components/file-tree-icons.ts` for the `seti:` file icon). This
 * lets the callout plugin render the actual GLYPH (FR-009) as an inline `<svg>`
 * without importing Starlight's `Icons` map — that module is not a package export
 * (its `exports` map omits `./components/Icons`), and the callout is emitted from a
 * build-time remark plugin (there is no `Callout.astro`), so the `<Icon>` Astro
 * component is unreachable there. Curating the paths beside the seed keeps the same
 * "verified against the pinned Icons set" discipline the seed map already documents.
 */
const ICON_GLYPH_INNER: Readonly<Record<string, string>> = {
  rocket:
    '<path fill-rule="evenodd" d="M1.44 8.855v-.001l3.527-3.516c.34-.344.802-.541 1.285-.548h6.649l.947-.947c3.07-3.07 6.207-3.072 7.62-2.868a1.821 1.821 0 0 1 1.557 1.557c.204 1.413.203 4.55-2.868 7.62l-.946.946v6.649a1.845 1.845 0 0 1-.549 1.286l-3.516 3.528a1.844 1.844 0 0 1-3.11-.944l-.858-4.275-4.52-4.52-2.31-.463-1.964-.394A1.847 1.847 0 0 1 .98 10.693a1.843 1.843 0 0 1 .46-1.838Zm5.379 2.017-3.873-.776L6.32 6.733h4.638l-4.14 4.14Zm8.403-5.655c2.459-2.46 4.856-2.463 5.89-2.33.134 1.035.13 3.432-2.329 5.891l-6.71 6.71-3.561-3.56 6.71-6.711Zm-1.318 15.837-.776-3.873 4.14-4.14v4.639l-3.364 3.374Z" clip-rule="evenodd"/><path d="M9.318 18.345a.972.972 0 0 0-1.86-.561c-.482 1.435-1.687 2.204-2.934 2.619a8.22 8.22 0 0 1-1.23.302c.062-.365.157-.79.303-1.229.415-1.247 1.184-2.452 2.62-2.935a.971.971 0 1 0-.62-1.842c-.12.04-.236.084-.35.13-2.02.828-3.012 2.588-3.493 4.033a10.383 10.383 0 0 0-.51 2.845l-.001.016v.063c0 .536.434.972.97.972H2.24a7.21 7.21 0 0 0 .878-.065c.527-.063 1.248-.19 2.02-.447 1.445-.48 3.205-1.472 4.033-3.494a5.828 5.828 0 0 0 .147-.407Z"/>',
  information:
    '<path d="M12 11a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1Zm.38-3.92a1 1 0 0 0-.76 0 1 1 0 0 0-.33.21 1.15 1.15 0 0 0-.21.33 1 1 0 0 0 .21 1.09c.097.088.209.16.33.21A1 1 0 0 0 13 8a1.05 1.05 0 0 0-.29-.71 1 1 0 0 0-.33-.21ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16.001A8 8 0 0 1 12 20Z"/>',
  warning:
    '<path d="M12 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10.67 1.47-8.05-14a3 3 0 0 0-5.24 0l-8 14A3 3 0 0 0 3.94 22h16.12a3 3 0 0 0 2.61-4.53Zm-1.73 2a1 1 0 0 1-.88.51H3.94a1 1 0 0 1-.88-.51 1 1 0 0 1 0-1l8-14a1 1 0 0 1 1.78 0l8.05 14a1 1 0 0 1 .05 1.02v-.02ZM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1Z"/>',
  error:
    '<path d="M12 7a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1Zm0 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9.71-7.44-5.27-5.27a1.05 1.05 0 0 0-.71-.29H8.27a1.05 1.05 0 0 0-.71.29L2.29 7.56a1.05 1.05 0 0 0-.29.71v7.46c.004.265.107.518.29.71l5.27 5.27c.192.183.445.286.71.29h7.46a1.05 1.05 0 0 0 .71-.29l5.27-5.27a1.05 1.05 0 0 0 .29-.71V8.27a1.05 1.05 0 0 0-.29-.71ZM20 15.31 15.31 20H8.69L4 15.31V8.69L8.69 4h6.62L20 8.69v6.62Z"/>',
  'approve-check':
    '<path d="M18.71 7.21a1 1 0 0 0-1.42 0l-7.45 7.46-3.13-3.14A1.02 1.02 0 1 0 5.29 13l3.84 3.84a1.001 1.001 0 0 0 1.42 0l8.16-8.16a1 1 0 0 0 0-1.47Z"/>',
  close:
    '<path d="m13.41 12 6.3-6.29a1.004 1.004 0 1 0-1.42-1.42L12 10.59l-6.29-6.3a1.004 1.004 0 0 0-1.42 1.42l6.3 6.29-6.3 6.29a1 1 0 0 0 0 1.42.998.998 0 0 0 1.42 0l6.29-6.3 6.29 6.3a.999.999 0 0 0 1.42 0 1 1 0 0 0 0-1.42L13.41 12Z"/>',
  comment:
    '<path d="M12 2A10 10 0 0 0 2 12a9.9 9.9 0 0 0 2.3 6.3l-2 2a1 1 0 0 0-.3 1.1 1 1 0 0 0 1 .6h9a10 10 0 0 0 0-20m0 18H5.4l1-1a1 1 0 0 0 0-1.3A8 8 0 1 1 12 20"/>',
  pencil:
    '<path d="M22 7.24a1 1 0 0 0-.29-.71l-4.24-4.24a1 1 0 0 0-1.1-.22 1 1 0 0 0-.32.22l-2.83 2.83L2.29 16.05a1 1 0 0 0-.29.71V21a1 1 0 0 0 1 1h4.24a1 1 0 0 0 .76-.29l10.87-10.93L21.71 8c.1-.1.17-.2.22-.33a1 1 0 0 0 0-.24v-.14l.07-.05ZM6.83 20H4v-2.83l9.93-9.93 2.83 2.83L6.83 20ZM18.17 8.66l-2.83-2.83 1.42-1.41 2.82 2.82-1.41 1.42Z"/>',
  star:
    '<path d="M22 9.67a1 1 0 0 0-.86-.67l-5.69-.83L12.9 3a1 1 0 0 0-1.8 0L8.55 8.16 2.86 9a1 1 0 0 0-.81.68 1 1 0 0 0 .25 1l4.13 4-1 5.68a1 1 0 0 0 1.45 1.07L12 18.76l5.1 2.68c.14.08.3.12.46.12a1 1 0 0 0 .99-1.19l-1-5.68 4.13-4A1 1 0 0 0 22 9.67Zm-6.15 4a1 1 0 0 0-.29.89l.72 4.19-3.76-2a1 1 0 0 0-.94 0l-3.76 2 .72-4.19a1 1 0 0 0-.29-.89l-3-3 4.21-.61a1 1 0 0 0 .76-.55L12 5.7l1.88 3.82a1 1 0 0 0 .76.55l4.21.61-3 2.99Z"/>',
  'open-book':
    '<path d="M21.17 2.06A13.1 13.1 0 0 0 19 1.87a12.94 12.94 0 0 0-7 2.05 12.94 12.94 0 0 0-7-2 13.1 13.1 0 0 0-2.17.19 1 1 0 0 0-.83 1v12a1 1 0 0 0 1.17 1 10.9 10.9 0 0 1 8.25 1.91l.12.07h.11a.91.91 0 0 0 .7 0h.11l.12-.07A10.899 10.899 0 0 1 20.83 16 1 1 0 0 0 22 15V3a1 1 0 0 0-.83-.94ZM11 15.35a12.87 12.87 0 0 0-6-1.48H4v-10c.333-.02.667-.02 1 0a10.86 10.86 0 0 1 6 1.8v9.68Zm9-1.44h-1a12.87 12.87 0 0 0-6 1.48V5.67a10.86 10.86 0 0 1 6-1.8c.333-.02.667-.02 1 0v10.04Zm1.17 4.15a13.098 13.098 0 0 0-2.17-.19 12.94 12.94 0 0 0-7 2.05 12.94 12.94 0 0 0-7-2.05c-.727.003-1.453.066-2.17.19A1 1 0 0 0 2 19.21a1 1 0 0 0 1.17.79 10.9 10.9 0 0 1 8.25 1.91 1 1 0 0 0 1.16 0A10.9 10.9 0 0 1 20.83 20a1 1 0 0 0 1.17-.79 1 1 0 0 0-.83-1.15Z"/>',
  setting:
    '<path d="m21.32 9.55-1.89-.63.89-1.78A1 1 0 0 0 20.13 6L18 3.87a1 1 0 0 0-1.15-.19l-1.78.89-.63-1.89A1 1 0 0 0 13.5 2h-3a1 1 0 0 0-.95.68l-.63 1.89-1.78-.89A1 1 0 0 0 6 3.87L3.87 6a1 1 0 0 0-.19 1.15l.89 1.78-1.89.63a1 1 0 0 0-.68.94v3a1 1 0 0 0 .68.95l1.89.63-.89 1.78A1 1 0 0 0 3.87 18L6 20.13a1 1 0 0 0 1.15.19l1.78-.89.63 1.89a1 1 0 0 0 .95.68h3a1 1 0 0 0 .95-.68l.63-1.89 1.78.89a1 1 0 0 0 1.13-.19L20.13 18a1 1 0 0 0 .19-1.15l-.89-1.78 1.89-.63a1 1 0 0 0 .68-.94v-3a1 1 0 0 0-.68-.95ZM20 12.78l-1.2.4A2 2 0 0 0 17.64 16l.57 1.14-1.1 1.1-1.11-.6a2 2 0 0 0-2.79 1.16l-.4 1.2h-1.59l-.4-1.2A2 2 0 0 0 8 17.64l-1.14.57-1.1-1.1.6-1.11a2 2 0 0 0-1.16-2.82l-1.2-.4v-1.56l1.2-.4A2 2 0 0 0 6.36 8l-.57-1.11 1.1-1.1L8 6.36a2 2 0 0 0 2.82-1.16l.4-1.2h1.56l.4 1.2A2 2 0 0 0 16 6.36l1.14-.57 1.1 1.1-.6 1.11a2 2 0 0 0 1.16 2.79l1.2.4v1.59ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>',
  'seti:shell':
    '<path d="M9.977 3.222L9.935 3.222Q9.305 3.432 8.717 3.810L8.717 3.810Q8.549 3.894 8.213 4.146L8.213 4.146Q7.709 4.524 7.289 5.070L7.289 5.070L6.995 5.448Q6.575 6.120 6.449 6.666L6.449 6.666Q6.365 6.918 6.323 7.254L6.323 7.254Q6.239 7.884 6.323 8.556L6.323 8.556Q6.365 8.976 6.449 9.396L6.449 9.396Q6.617 10.026 6.995 10.614L6.995 10.614L7.289 10.992Q7.667 11.454 8.255 11.874L8.255 11.874L8.885 12.336Q9.347 12.672 10.061 12.966L10.061 12.966L11.069 13.386L11.531 13.554Q12.119 13.764 12.329 13.848L12.329 13.848L12.413 13.932Q13.757 14.310 14.345 15.360L14.345 15.360Q14.597 15.864 14.597 16.284L14.597 16.284L14.597 16.452Q14.681 16.998 14.555 17.250L14.555 17.250Q14.051 18.258 13.253 18.552L13.253 18.552Q12.749 18.720 11.447 18.678L11.447 18.678Q10.565 18.468 10.061 17.922L10.061 17.922Q9.599 17.418 9.305 16.494L9.305 16.494L9.263 16.326Q9.221 16.032 9.032 15.843Q8.843 15.654 8.549 15.654L8.549 15.654L6.449 15.654Q6.155 15.654 5.966 15.843Q5.777 16.032 5.819 16.326L5.819 16.326Q5.819 16.956 5.966 17.544Q6.113 18.132 6.449 18.804L6.449 18.804Q6.659 19.140 6.911 19.455Q7.163 19.770 7.877 20.316L7.877 20.316Q8.213 20.568 8.465 20.694L8.465 20.694Q8.843 20.904 9.683 21.240L9.683 21.240L9.977 21.324Q10.271 21.408 10.460 21.597Q10.649 21.786 10.649 22.080L10.649 22.080L10.649 23.130Q10.649 23.424 10.838 23.613Q11.027 23.802 11.321 23.802L11.321 23.802L12.749 23.802Q13.043 23.802 13.232 23.613Q13.421 23.424 13.421 23.130L13.421 23.130L13.421 22.080Q13.421 21.786 13.610 21.555Q13.799 21.324 14.051 21.282L14.051 21.282Q14.219 21.240 14.513 21.114L14.513 21.114Q15.269 20.820 15.731 20.568L15.731 20.568Q16.613 20.022 17.411 18.888L17.411 18.888Q17.873 18.216 17.999 17.712L17.999 17.712Q18.125 17.418 18.167 16.998L18.167 16.998Q18.209 16.326 18.167 15.696L18.167 15.696Q18.125 15.276 17.999 14.982L17.999 14.982Q17.831 14.310 17.453 13.764L17.453 13.764Q16.907 12.882 15.563 11.916L15.563 11.916Q14.975 11.538 14.387 11.244L14.387 11.244Q13.925 11.034 12.959 10.656L12.959 10.656L12.035 10.320Q11.153 9.984 10.859 9.732L10.859 9.732Q10.355 9.312 10.124 8.913Q9.893 8.514 9.851 8.094L9.851 8.094L9.851 8.052Q9.851 7.590 9.914 7.254Q9.977 6.918 10.313 6.414L10.313 6.414Q10.565 6.078 10.943 5.994L10.943 5.994Q11.405 5.826 11.825 5.826L11.825 5.826Q12.539 5.784 12.896 5.847Q13.253 5.910 13.694 6.267Q14.135 6.624 14.345 7.044L14.345 7.044Q14.597 7.590 14.597 8.094L14.597 8.094L14.597 8.094Q14.639 8.388 14.828 8.577Q15.017 8.766 15.269 8.766L15.269 8.766L17.369 8.766Q17.663 8.766 17.852 8.556Q18.041 8.346 17.999 8.094L17.999 8.094Q17.957 7.590 17.852 7.107Q17.747 6.624 17.411 5.868L17.411 5.868Q17.285 5.574 17.117 5.322L17.117 5.322Q16.697 4.650 16.277 4.272L16.277 4.272Q16.067 4.062 15.857 3.894Q15.647 3.726 15.017 3.390L15.017 3.390L14.681 3.222L14.345 3.054Q14.051 2.928 13.862 2.697Q13.673 2.466 13.673 2.214L13.673 2.214L13.673 0.870Q13.673 0.576 13.484 0.387Q13.295 0.198 13.043 0.198L13.043 0.198L11.573 0.198Q11.279 0.198 11.090 0.387Q10.901 0.576 10.901 0.870L10.901 0.870L10.901 2.340Q10.901 2.802 10.313 3.054L10.313 3.054Q10.229 3.138 9.977 3.222L9.977 3.222Z"/>',
};

/**
 * Build the inline `<svg>` markup for an already-resolved Starlight icon NAME, or
 * `undefined` when the name has no curated glyph. The wrapper mirrors Starlight's
 * own `Icon.astro` (`viewBox="0 0 24 24"`, `fill="currentColor"`, `aria-hidden`)
 * so the glyph inherits `.dk-callout__icon`'s `color`; it is returned as a string
 * the callout plugin emits as a hast `raw` node (parsed by the pipeline's
 * `rehype-raw`). Decorative by design — the callout's variant/title convey meaning,
 * so `aria-hidden="true"` keeps the glyph out of the accessibility tree (FR-009).
 */
export function iconGlyphSvg(starlightName: string | undefined): string | undefined {
  if (starlightName === undefined) return undefined;
  const inner = ICON_GLYPH_INNER[starlightName];
  if (inner === undefined) return undefined;
  return (
    '<svg class="dk-callout__icon-glyph" aria-hidden="true" width="16" height="16" ' +
    `viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`
  );
}

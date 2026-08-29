/**
 * Pure, Astro-free class → render-target routing for the Markua callout mapper
 * (ADR-0030 D-03, contract `callout-mapping.md`; FR-002/FR-003/FR-004/FR-009).
 *
 * `markua-callouts.ts` (the remark plugin) walks the normalised
 * `containerDirective` nodes WP02 produced and delegates ALL routing to this
 * module; nothing here imports remark, unified, mdast, hast, or vfile, so the
 * vitest matrix exercises the load-bearing correctness — the class → target
 * table, the attribute tradeoff, icon resolution, unknown-class degradation, and
 * first-heading title extraction — with zero build runtime.
 *
 * There is ONE emission owner and TWO vehicles (contract "Rendering seam"):
 *   - the four Starlight-mapped names (`tip`/`caution`/`danger`/`note`) route to
 *     the NATIVE aside — the plugin leaves the directive's name intact so
 *     Starlight's own `remarkAsides` (registered AFTER doc-kitty's plugins)
 *     rebuilds it; doc-kitty emits NO aside markup on that path;
 *   - the six theme names (`aside`/`discussion`/`question`/`exercise`/`center`/
 *     `generic`), and any mapped name carrying `{#id}`/`{icon:}` (the attribute
 *     tradeoff — `remarkAsides` discards attributes), route to the theme-callout
 *     hast `<aside class="dk-callout dk-callout--{variant}">` the plugin emits.
 *
 * We reuse WP02's exported `CLASS_TO_DIRECTIVE` as the single source of truth for
 * the class → directive-name folding (so the three input forms of a class — `W>`,
 * `{class: warning}`+`B>`, `{blurb, class: warning}` — already collapse to ONE
 * directive name before this mapping runs, FR-004) and WP03's `resolveIcon` as
 * the single icon call site (FR-009/FR-010, NFR-002). This module decides icons
 * and id/title; the plugin builds the hast.
 */
import { CLASS_TO_DIRECTIVE } from './markua-normalise.internal.js';
import { resolveIcon } from '../markua/icon-map.js';

/** The four Starlight aside types a mapped class renders as (native-aside path). */
export type StarlightName = 'note' | 'tip' | 'caution' | 'danger';

/**
 * Every `dk-callout--{variant}` modifier the emitted hast can carry: the six
 * canonical theme variants, plus the four mapped-name fallback variants used ONLY
 * on the attribute-bearing mapped path (`callout-mapping.md` "Emitted
 * theme-callout hast").
 */
export type ThemeVariant =
  | 'aside'
  | 'discussion'
  | 'question'
  | 'exercise'
  | 'center'
  | 'generic'
  | StarlightName;

/**
 * The four Markua classes Starlight renders natively, and the set of directive
 * NAMES they fold to (`tip`/`caution`/`danger`/`note`). Derived from WP02's
 * `CLASS_TO_DIRECTIVE` rather than re-listed, so this table cannot drift from the
 * normaliser's rename.
 */
const MAPPED_MARKUA_CLASSES = ['tip', 'warning', 'error', 'information'] as const;
const MAPPED_DIRECTIVE_NAMES: ReadonlySet<string> = new Set(
  MAPPED_MARKUA_CLASSES.map((markuaClass) => CLASS_TO_DIRECTIVE[markuaClass]),
);

/** The six canonical theme directive names (everything WP02 emits that is not mapped). */
const THEME_DIRECTIVE_NAMES: ReadonlySet<string> = new Set(
  Object.values(CLASS_TO_DIRECTIVE).filter((name) => !MAPPED_DIRECTIVE_NAMES.has(name)),
);

/**
 * Every recognised class OR folded directive name — the vocabulary a `{class: …}`
 * attribute may override the directive `name` with. A `{class:}` value outside
 * this set is NOT a recognised class, so it is ignored and the directive keeps its
 * own name (which then degrades to generic on its own if unknown) — never erroring
 * (FR-012).
 */
const KNOWN_CLASS_OR_NAME: ReadonlySet<string> = new Set<string>([
  ...Object.keys(CLASS_TO_DIRECTIVE),
  ...MAPPED_DIRECTIVE_NAMES,
  ...THEME_DIRECTIVE_NAMES,
]);

/**
 * The resolved render target for a callout class/name (T012). Reused by the
 * plugin AND the vitest table. `starlightName` is present only on the native
 * path; `variant` is always the `dk-callout--{variant}` modifier that path would
 * carry if it fell back to the theme hast (so the attribute-bearing mapped path
 * has its fallback variant ready).
 */
export type CalloutTarget =
  | { target: 'starlight-aside'; starlightName: StarlightName; variant: StarlightName }
  | { target: 'theme-callout'; variant: ThemeVariant };

/**
 * Resolve a Markua class name OR an already-folded directive name to its render
 * target (contract "Class → target table"). Accepts BOTH forms so the same table
 * serves the runtime (which sees the folded directive `name` on WP02's node) and
 * the class-oriented contract table / tests:
 *   - a Markua class (`warning`, `tip`, `aside`, …) is folded through WP02's
 *     `CLASS_TO_DIRECTIVE` first (so `warning` and `caution` both resolve to the
 *     `caution` native aside — the FR-004 synonym fold);
 *   - a mapped directive name (`tip`/`caution`/`danger`/`note`) → native aside;
 *   - a theme directive name (`aside`/`discussion`/…/`generic`) → theme callout;
 *   - anything else (an unknown `{class: …}` value) degrades to the GENERIC theme
 *     variant, never throwing (FR-012, contract Guarantee).
 */
export function resolveCalloutTarget(classOrName: string): CalloutTarget {
  const canonical = classOrName in CLASS_TO_DIRECTIVE ? CLASS_TO_DIRECTIVE[classOrName] : classOrName;

  if (MAPPED_DIRECTIVE_NAMES.has(canonical)) {
    const name = canonical as StarlightName;
    return { target: 'starlight-aside', starlightName: name, variant: name };
  }
  if (THEME_DIRECTIVE_NAMES.has(canonical)) {
    return { target: 'theme-callout', variant: canonical as ThemeVariant };
  }
  return { target: 'theme-callout', variant: 'generic' };
}

/**
 * The directive-schema fields this plugin honours, read off the node's
 * `attributes` (synthetic in tests; folded by WP08 at runtime). The schema
 * carries `icon` FROM THE START so WP03's icon map is the only later plumbing and
 * WP05 adds none (contract "the callout hast schema carries the icon from the
 * start"). `class` is not read here — WP02 already folded it into the directive
 * `name`; it is documented as honoured so WP08 knows the accepted keys.
 */
export interface CalloutAttributes {
  id?: string;
  icon?: string;
  title?: string;
  class?: string;
}

/** A minimal structural view of the `containerDirective` this module routes. */
export interface DirectiveLike {
  name: string;
  attributes?: CalloutAttributes | Record<string, string | undefined> | null;
}

/**
 * The emission decision (T013/T014): either the native-aside path (leave the
 * directive for `remarkAsides`) or the theme-callout hast with a resolved
 * variant, optional `id`, and an already-resolved Starlight `icon` name.
 */
export type Emission =
  | { mode: 'native'; starlightName: StarlightName }
  | { mode: 'theme'; variant: ThemeVariant; id?: string; icon?: string };

/** Read a trimmed, non-empty string attribute or `undefined`. */
function readAttr(attrs: DirectiveLike['attributes'], key: string): string | undefined {
  const value = (attrs as Record<string, string | undefined> | null | undefined)?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Decide how one directive emits (contract "Attribute tradeoff", coverage row
 * 15). The attribute tradeoff is load-bearing: `remarkAsides` rebuilds a mapped
 * directive as a fresh aside and DISCARDS its attributes, so a mapped class
 * carrying `{#id}` or `{icon:}` MUST leave the native path and ride the
 * theme-callout hast (with the `dk-callout--{mapped-name}` fallback variant) so
 * the attribute survives on the `<aside>`. Attribute PRESENCE routes — an unmapped
 * `{icon:}` still diverts to the fallback hast (its icon then drops with a
 * warning inside `resolveIcon`). This is the single icon call site.
 */
export function decideEmission(directive: DirectiveLike): Emission {
  const attrs = directive.attributes ?? {};
  const id = readAttr(attrs, 'id');
  const rawIcon = readAttr(attrs, 'icon');
  const hasRoutingAttribute = id !== undefined || rawIcon !== undefined;
  const icon = resolveIcon(rawIcon); // single icon call site (WP03); warns + drops when unmapped

  // FR-004 synonym fold: a recognised `{class: …}` attribute (the `{class: warning}`+`B>`
  // input form) overrides the bare directive name so all three input forms of a class
  // collapse to one target; an unrecognised `{class:}` value is ignored (the directive
  // keeps its own name), so an unknown class still degrades to generic (FR-012).
  const classAttr = readAttr(attrs, 'class');
  const effectiveClass =
    classAttr !== undefined && KNOWN_CLASS_OR_NAME.has(classAttr) ? classAttr : directive.name;
  const target = resolveCalloutTarget(effectiveClass);

  if (target.target === 'starlight-aside' && !hasRoutingAttribute) {
    return { mode: 'native', starlightName: target.starlightName };
  }

  // Theme path: every theme class always, plus the attribute-bearing mapped
  // class (which falls back to `dk-callout--{mapped-name}`, e.g. `dk-callout--tip`).
  return { mode: 'theme', variant: target.variant, id, icon };
}

/** A minimal structural mdast node — enough to read a leading heading's text. */
export interface MdastLike {
  type: string;
  value?: string;
  children?: MdastLike[];
  [key: string]: unknown;
}

/** Concatenate the text/inlineCode descendants of a node (heading label recovery). */
function textOf(node: MdastLike): string {
  let out = '';
  const walk = (n: MdastLike): void => {
    if (n.type === 'text' || n.type === 'inlineCode') {
      out += n.value ?? '';
      return;
    }
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return out.trim();
}

/**
 * First-heading title extraction (T015). If the callout body opens with an ATX
 * heading, surface its text as the `dk-callout__title` and remove it from the
 * body (per the pinned DOM — one heading, not duplicated). An explicit `{title:}`
 * attribute takes precedence and this is not consulted. WP06's ToC-demotion pass
 * still handles any NON-leading in-callout heading; this plugin only maps/emits —
 * it does not demote.
 */
export function extractLeadingHeadingTitle(children: readonly MdastLike[]): {
  title?: string;
  body: MdastLike[];
} {
  const body = [...children];
  const first = body[0];
  if (first && first.type === 'heading') {
    const title = textOf(first);
    if (title.length > 0) {
      body.shift();
      return { title, body };
    }
  }
  return { body };
}

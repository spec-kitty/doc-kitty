/**
 * `remark-stack` — the build's remark-stage enumerator behind the re-derive
 * parity guard (S-03; `glossary-substrate-parity.test.ts`).
 *
 * It runs each `doc-kitty:`-prefixed integration's `astro:config:setup` hook,
 * captures what that hook registers via `updateConfig`, and returns the ordered
 * remark stages in the effective order Astro produces (`updateConfig` APPENDS, so
 * integration-array order IS the combined-plugin order). Two subtleties it owns:
 *
 *  - **Selection by prefix, not a literal list** (S-03): integrations are chosen
 *    by the `doc-kitty:` NAME PREFIX, so a NEW `doc-kitty:*` integration that
 *    registers a remark plugin cannot silently slip past the parity classifier.
 *    (The predecessor `combinedRemark` in `markua-attributes.test.ts` iterated a
 *    hardcoded name list and `continue`d past unknowns — the exact drift hole.)
 *
 *  - **Sees THROUGH `guardDeck.__inner`** (C36c / C-006): the Markua arrays are
 *    `[...].map(guardDeck)`, so each entry is a deck-guard wrapper. The enumerator
 *    resolves each stage to its real inner plugin identity via `.__inner`, so the
 *    classifier keys on the real stage — not the wrapper.
 *
 * O-1 (ownership): `runSetup`/`SetupHook` originate in the WP04-owned
 * `markua-attributes.test.ts` (:315/:322). They are **copied** here (that file is
 * read-only for this WP), and the shim is **loosened**: the setup opts are backed
 * by a Proxy that returns a no-op for any param the shim does not model, so an
 * integration whose hook reads/calls an unmodelled setup param does not throw or
 * silently gate itself out of registration (the SetupHook false-green hole,
 * research D-04.3 / C35). The paired guard that turns any residual silent-nothing
 * into a red is the per-integration `remarkCount >= 1` assertion in the parity
 * test — this helper surfaces `perIntegration` for exactly that.
 */

/** The prefix every doc-kitty integration name carries. */
export const DOC_KITTY_PREFIX = 'doc-kitty:';

interface NamedIntegration {
  name: string;
  hooks?: Record<string, unknown>;
}

interface MarkdownRegistration {
  markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] };
}

/**
 * The `astro:config:setup` hook shape. Copied from `markua-attributes.test.ts`
 * (O-1) and widened: the opts object is a Proxy (see {@link runSetup}), so a hook
 * may read params beyond `updateConfig`/`injectScript` without silently
 * registering nothing.
 */
type SetupHook = (opts: Record<string, unknown>) => void;

function named(integrations: unknown[]): NamedIntegration[] {
  return integrations.filter(
    (i): i is NamedIntegration =>
      typeof i === 'object' &&
      i !== null &&
      'name' in i &&
      typeof (i as { name: unknown }).name === 'string',
  );
}

/** Named integrations whose name carries the `doc-kitty:` prefix, in array order. */
export function docKittyIntegrations(integrations: unknown[]): NamedIntegration[] {
  return named(integrations).filter((i) => i.name.startsWith(DOC_KITTY_PREFIX));
}

/**
 * Run one integration's `astro:config:setup` hook, capturing the markdown configs
 * it registers via `updateConfig`. The opts object is a Proxy: `updateConfig` /
 * `injectScript` are captured, a handful of common Astro setup params carry benign
 * values, and ANY other accessed param resolves to a no-op function so the hook
 * cannot throw on — or gate itself out via — an unmodelled param (O-1 loosening).
 */
export function runSetup(entry: NamedIntegration): MarkdownRegistration[] {
  const hook = entry.hooks?.['astro:config:setup'] as SetupHook | undefined;
  if (!hook) throw new Error(`integration ${entry.name} has no astro:config:setup hook`);
  const configs: MarkdownRegistration[] = [];
  const noop = (): undefined => undefined;
  const modelled: Record<string, unknown> = {
    updateConfig: (c: MarkdownRegistration) => configs.push(c),
    injectScript: noop,
    injectRoute: noop,
    addRenderer: noop,
    addWatchFile: noop,
    addClientDirective: noop,
    addDevToolbarApp: noop,
    addMiddleware: noop,
    createCodegenDir: () => new URL('file:///tmp/dk-codegen/'),
    command: 'build',
    isRestart: false,
    config: {},
    logger: { info: noop, warn: noop, error: noop, debug: noop, fork() { return this; } },
  };
  const opts = new Proxy(modelled, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      // Unmodelled param → a no-op function (the Astro setup API is
      // overwhelmingly functions). Prevents the "reads an omitted param →
      // registers nothing → false green" hole. See the header (C35 / D-04.3).
      return noop;
    },
  });
  hook(opts as Record<string, unknown>);
  return configs;
}

/** The real inner plugin of a remark entry, whether registered bare, as a tuple
 * (`[plugin, opts]`), or wrapped by `guardDeck` (`__inner`). */
function unwrapEntry(entry: unknown): { plugin: unknown; guarded: boolean } {
  const raw = Array.isArray(entry) ? entry[0] : entry;
  const inner = (raw as { __inner?: unknown } | null | undefined)?.__inner;
  return { plugin: inner ?? raw, guarded: inner !== undefined };
}

/** A stable display name for a plugin, for the red-on-unclassified message. */
function pluginName(plugin: unknown): string {
  const p = plugin as { displayName?: string; name?: string } | null | undefined;
  return p?.displayName || p?.name || '(anonymous)';
}

/** One enumerated build remark stage, resolved through `guardDeck.__inner`. */
export interface RemarkStage {
  /** The real inner plugin identity (the classifier keys on this). */
  plugin: unknown;
  /** A display name (plugin `.displayName`/`.name`) — used in failure messages. */
  name: string;
  /** True when the entry was a `guardDeck` wrapper (`__inner` was present). */
  guarded: boolean;
  /** The `doc-kitty:` integration that registered it. */
  integration: string;
}

/** Per-integration registration tally (for the vacuous / SetupHook false-green guard). */
export interface IntegrationTally {
  name: string;
  remarkCount: number;
  rehypeCount: number;
}

export interface EnumeratedStack {
  /** Ordered remark stages across every `doc-kitty:` integration (combined order). */
  stages: RemarkStage[];
  /** Per `doc-kitty:` integration: how many remark / rehype plugins it registered. */
  perIntegration: IntegrationTally[];
}

/**
 * Enumerate the remark stages the built `doc-kitty:` integrations register, in
 * combined (array) order, each resolved through `guardDeck.__inner`.
 */
export function enumerateDocKittyRemarkStack(integrations: unknown[]): EnumeratedStack {
  const stages: RemarkStage[] = [];
  const perIntegration: IntegrationTally[] = [];
  for (const entry of docKittyIntegrations(integrations)) {
    // A build-only `doc-kitty:` integration (only an `astro:build:done` hook,
    // e.g. `doc-kitty:sitemap-order`, #87) registers NO remark stages by
    // construction, so it is outside this remark-stack enumerator's scope. Skip
    // it rather than tripping `runSetup`'s config-setup guard: the false-green
    // hole that guard protects (a hook that reads an omitted setup param and
    // registers nothing) can only exist where a config:setup hook is PRESENT.
    if (!entry.hooks?.['astro:config:setup']) continue;
    let remarkCount = 0;
    let rehypeCount = 0;
    for (const cfg of runSetup(entry)) {
      const remark = cfg.markdown?.remarkPlugins ?? [];
      const rehype = cfg.markdown?.rehypePlugins ?? [];
      rehypeCount += rehype.length;
      for (const raw of remark) {
        const { plugin, guarded } = unwrapEntry(raw);
        stages.push({ plugin, name: pluginName(plugin), guarded, integration: entry.name });
        remarkCount += 1;
      }
    }
    perIntegration.push({ name: entry.name, remarkCount, rehypeCount });
  }
  return { stages, perIntegration };
}

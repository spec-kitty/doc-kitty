/**
 * Issue #35 — the re-derive parity drift guard (FR-003/FR-004, contract C35,
 * data-model S-03/S-04).
 *
 * The render-time re-derive substrate (`createPageProcessor`, `page-processor.ts`)
 * is a strict SUBSET of the build remark stack by design: it wants the mdast tree
 * as the glossary term/autolink passes see it — after gfm + smartypants + directive,
 * BEFORE the glossary passes themselves. #16/#20 were caused by that mirror silently
 * drifting from the build. This guard turns the by-convention mirror into a
 * STRUCTURAL one and closes three holes:
 *
 *   1. **Silent drift (name-classification)** — every build remark stage enumerated
 *      (with `markua:true, diagrams:true` + glossary active, selected by the
 *      `doc-kitty:` prefix, seen through `guardDeck.__inner`) must be either
 *      `MIRRORED` (DERIVED from `page-processor.ts`'s real `REDERIVE_REMARK_PLUGINS`
 *      — never hand-listed) or a keyed, justified `CONSCIOUS_EXCLUSIONS` entry.
 *      An unclassified stage reds naming the stage.
 *   2. **Vacuous / SetupHook false-green** — a stage-count floor + a per-integration
 *      `remarkCount >= 1` assertion, so an opt-gated seam that enumerated nothing,
 *      or a hook that read an omitted setup param and registered nothing, reds
 *      rather than passing empty.
 *   3. **WRONG exclusion (behavioural golden-tree)** — a fixture rendered through
 *      the build substrate (mirrored + the "inert" exclusions) and the re-derive
 *      substrate must produce identical mdast; excluding a should-be-mirrored stage
 *      as "inert" when it actually mutates the tree reds here, which name
 *      classification alone cannot catch.
 *
 * The version axis (a mirrored plugin's RESOLVED version drifting from Astro's) is
 * closed by the version-parity assertion below and, independently, by the committed
 * `remark-version-pin.test.ts` (issue #21). Per DIRECTIVE_043 the claim is bounded:
 * this closes silent-drift by construction, wrong-exclusion behaviourally, and the
 * version axis by assertion — nothing more.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  REDERIVE_REMARK_PLUGINS,
  createPageProcessor,
} from '../lib/glossary/page-processor.js';
import {
  enumerateDocKittyRemarkStack,
  type RemarkStage,
} from './helpers/remark-stack.js';

// The real inner identities of the consciously-excluded stages (keyed by identity,
// not name, so a rename cannot silently reshuffle a justification). `diagramMeta` /
// the markua passes / the glossary passes / `deckSplit` are all default exports of
// the same modules `config.ts` registers, so `===` holds through `guardDeck.__inner`.
import diagramMeta from '../lib/remark/diagram-meta.js';
import markuaNormalise from '../lib/remark/markua-normalise.js';
import markuaAttributes from '../lib/remark/markua-attributes.js';
import markuaCallouts from '../lib/remark/markua-callouts.js';
import glossaryTerm from '../lib/remark/glossary-term.js';
import glossaryAutolink from '../lib/remark/glossary-autolink.js';
import deckSplit from '../lib/remark/deck-split.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

// ---------------------------------------------------------------------------
// Build the stack with markua:true, diagrams:true + glossary ACTIVE.
// Mocks mirror markua-attributes.test.ts so `defineDocKittyIntegrations` builds
// the full seam without touching the filesystem or running Starlight.
// ---------------------------------------------------------------------------
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));
vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));
vi.mock('../lib/glossary/generate.js', () => ({
  generateGlossaryPages: vi.fn(() => []),
  GLOSSARY_OUTPUT_DIRNAME: 'glossary',
}));

const { isGlossaryActive, loadGlossary } = await import('../lib/glossary/load.js');
const { defineDocKittyIntegrations } = await import('../lib/config.js');

const fakeIndex: SharedTermIndex = {
  bySurface: new Map([
    ['term', [{ context: 'Ctx', contextSlug: 'ctx', anchor: 'term', termName: 'Term' }]],
  ]),
  contexts: new Map([
    ['Ctx', { slug: 'ctx', terms: [{ name: 'Term', definition: 'A thing.' }], anchors: new Map([['Term', 'term']]) }],
  ]),
};

beforeEach(() => {
  vi.mocked(isGlossaryActive).mockReturnValue(true);
  vi.mocked(loadGlossary).mockReturnValue({ present: true, index: fakeIndex });
});

function buildStack() {
  const arr = defineDocKittyIntegrations({ title: 'Docs', markua: true, diagrams: true });
  return enumerateDocKittyRemarkStack(arr);
}

// ---------------------------------------------------------------------------
// Classification: MIRRORED (derived) + CONSCIOUS_EXCLUSIONS (keyed + justified).
// ---------------------------------------------------------------------------

/** MIRRORED — DERIVED from the substrate's real plugin list (D-1, S-04). Never
 * hand-listed: it is exactly what `createPageProcessor` replays. */
const MIRRORED = new Set<unknown>(REDERIVE_REMARK_PLUGINS.map((e) => e.plugin));

/**
 * `inert` — a build stage the re-derive need NOT replay because it is a genuine
 *   no-op on the re-derive corpus today; it IS included in the golden-tree build
 *   side, so a wrong "inert" claim (a stage that actually mutates the tree) reds
 *   there behaviourally.
 * `boundary` — a build stage that lies BEYOND the re-derive's deliberate cut-off
 *   (the glossary passes the re-derive feeds) or on another route (deck-split);
 *   excluded from the golden-tree build side by design.
 */
type ExclusionKind = 'inert' | 'boundary';
interface Exclusion {
  /** Identity match (preferred) … */
  plugin?: unknown;
  /** … or a name match, for a stage defined inline & unexported (mermaidFenceTransform). */
  name?: string;
  kind: ExclusionKind;
  why: string;
}

const CONSCIOUS_EXCLUSIONS: Exclusion[] = [
  {
    plugin: diagramMeta,
    kind: 'inert',
    why: 'diagrams-only: parses/strips leading `%% key: value` metadata on mermaid code nodes; a no-op on a page with no mermaid fence, so the re-derive need not replay it.',
  },
  {
    name: 'mermaidFenceTransform',
    kind: 'inert',
    why: 'diagrams-only: rewrites ```mermaid fences to `<pre class="mermaid">`; a no-op without a fence. Defined inline in config.ts (unexported) → keyed by name.',
  },
  {
    plugin: markuaNormalise,
    kind: 'inert',
    why: 'opt-in Markua: compiles `A>`/`W>`/`{aside}` line-prefix runs into containerDirectives; inert on the non-Markua bodies the re-derive corpus uses today (Markua fixtures set tableOfContents:false, so OnThisPage is not exercised).',
  },
  {
    plugin: markuaAttributes,
    kind: 'inert',
    why: 'opt-in Markua: folds `{…}` attribute lists onto their target; inert without Markua attribute syntax.',
  },
  {
    plugin: markuaCallouts,
    kind: 'inert',
    why: 'opt-in Markua: routes callout containerDirectives to their render target; inert without Markua callouts.',
  },
  {
    plugin: glossaryTerm,
    kind: 'boundary',
    why: 'BEYOND the re-derive cut-off by design (issue #16): the re-derive produces the tree the term pass consumes; callers run glossary-term themselves over it.',
  },
  {
    plugin: glossaryAutolink,
    kind: 'boundary',
    why: 'BEYOND the re-derive cut-off: the autolinker is the consumer of the re-derived tree, not part of the substrate it re-derives.',
  },
  {
    plugin: deckSplit,
    kind: 'boundary',
    why: 'deck-route only: splits `kind: Presentation` pages into slides; never part of a docs-page re-derive.',
  },
];

function findExclusion(stage: RemarkStage): Exclusion | undefined {
  return CONSCIOUS_EXCLUSIONS.find(
    (e) => (e.plugin !== undefined && e.plugin === stage.plugin) || (e.name !== undefined && e.name === stage.name),
  );
}

// The remark-bearing doc-kitty integrations expected under markua+diagrams+glossary.
// Each MUST register >=1 remark plugin — a zero here is the SetupHook false-green
// (a hook that read an omitted setup param and registered nothing). This is a
// non-vacuous floor, NOT the classifier's selection (which is prefix-derived).
const REMARK_BEARING_INTEGRATIONS = [
  'doc-kitty:diagrams',
  'doc-kitty:remark-directive',
  'doc-kitty:markua',
  'doc-kitty:glossary',
  'doc-kitty:deck-split',
];

// Floor: the nine stages the full seam registers today (diagramMeta,
// mermaidFenceTransform, remarkDirective, markuaNormalise/Attributes/Callouts,
// glossaryTerm, glossaryAutolink, deckSplit). Guards a vacuous enumeration.
const STAGE_COUNT_FLOOR = 9;

// ===========================================================================
// 1. Enumeration is non-empty and well-formed (vacuous / SetupHook false-green).
// ===========================================================================
describe('re-derive parity — enumeration is real, not vacuous', () => {
  it('enumerates at least the stage-count floor', () => {
    const { stages } = buildStack();
    expect(
      stages.length,
      `enumerated only ${stages.length} build remark stage(s) (< floor ${STAGE_COUNT_FLOOR}). ` +
        `The stack was likely built without markua/diagrams/glossary active, so it enumerated ` +
        `nothing and this parity guard would pass VACUOUSLY (research D-02 hole 2).`,
    ).toBeGreaterThanOrEqual(STAGE_COUNT_FLOOR);
  });

  it('each remark-bearing doc-kitty integration registers >=1 remark plugin', () => {
    const { perIntegration } = buildStack();
    for (const name of REMARK_BEARING_INTEGRATIONS) {
      const tally = perIntegration.find((p) => p.name === name);
      expect(tally, `expected doc-kitty integration "${name}" to be present and enumerated`).toBeDefined();
      expect(
        tally!.remarkCount,
        `integration "${name}" registered 0 remark plugins. A SetupHook shim hole (a hook ` +
          `reading a setup param the shim omits, then gating itself out) would false-green here; ` +
          `see helpers/remark-stack.ts runSetup (C35 / research D-04.3).`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('MIRRORED is derived from the substrate (not empty, not hand-listed)', () => {
    // Cheap wiring check: MIRRORED comes from REDERIVE_REMARK_PLUGINS, so it can
    // never be an out-of-band hand-list that silently disagrees with the factory.
    expect(MIRRORED.size).toBe(REDERIVE_REMARK_PLUGINS.length);
    expect(MIRRORED.size).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 1b. FIX 3 (pre-PR squad, C-COMPOSE-01 / FR-003): markua-before-deckSplit
// ordering is pinned by a DIRECT assertion. The classification above pins the
// ordering only TRANSITIVELY (via `deckSplit`'s `boundary` exclusion); this
// asserts the actual array positions so a reorder in `config.ts` (moving
// `markuaIntegration()` after `deckSplitIntegration`, or vice versa) fails
// loudly here rather than only surfacing as a downstream behavioural drift.
// ===========================================================================
describe('FIX 3 — markua-before-deckSplit ordering is pinned directly (C-COMPOSE-01)', () => {
  it('every Markua content pass is registered strictly BEFORE deckSplit in the combined remark order', () => {
    const { stages } = buildStack();
    const indexOfPlugin = (plugin: unknown): number => stages.findIndex((s) => s.plugin === plugin);

    const deckSplitIndex = indexOfPlugin(deckSplit);
    expect(deckSplitIndex, 'deckSplit must be enumerated at all').toBeGreaterThanOrEqual(0);

    for (const [name, plugin] of [
      ['markuaNormalise', markuaNormalise],
      ['markuaAttributes', markuaAttributes],
      ['markuaCallouts', markuaCallouts],
    ] as const) {
      const pluginIndex = indexOfPlugin(plugin);
      expect(pluginIndex, `${name} must be enumerated at all`).toBeGreaterThanOrEqual(0);
      expect(
        pluginIndex,
        `${name} (index ${pluginIndex}) must run BEFORE deckSplit (index ${deckSplitIndex}) — ` +
          `C-COMPOSE-01 requires the Markua content passes to compose on the FLAT mdast body ` +
          `deckSplit has not yet sectioned (research D1). A reorder in config.ts must fail loudly here.`,
      ).toBeLessThan(deckSplitIndex);
    }
  });
});

// ===========================================================================
// 2. Every build remark stage is classified (red-on-unclassified).
// ===========================================================================
describe('re-derive parity — every build remark stage is classified', () => {
  it('is MIRRORED or a keyed CONSCIOUS_EXCLUSIONS entry (names an unclassified stage)', () => {
    const { stages } = buildStack();
    for (const stage of stages) {
      if (MIRRORED.has(stage.plugin)) continue;
      const excl = findExclusion(stage);
      expect(
        excl,
        `Unclassified build remark stage "${stage.name}" (registered by ${stage.integration}, ` +
          `${stage.guarded ? 'guardDeck-wrapped' : 'unwrapped'}). It is neither MIRRORED in ` +
          `page-processor.ts (REDERIVE_REMARK_PLUGINS) nor a keyed CONSCIOUS_EXCLUSIONS entry. ` +
          `Decide consciously: mirror it in the re-derive substrate, or add a justified exclusion. ` +
          `This is the #16/#20 silent-drift guard (C35).`,
      ).toBeDefined();
    }
  });

  it('every conscious exclusion carries a non-empty justification', () => {
    for (const e of CONSCIOUS_EXCLUSIONS) {
      const key = e.plugin ? `plugin:${(e.plugin as { name?: string }).name ?? '?'}` : `name:${e.name}`;
      expect(e.why.length, `CONSCIOUS_EXCLUSIONS[${key}] has no justification`).toBeGreaterThan(20);
    }
  });
});

// ===========================================================================
// 3. Behavioural golden-tree — catches a WRONG exclusion.
// ===========================================================================

// A normal docs-page body: exercises gfm (autolink literal, strikethrough, table),
// smartypants (quotes/dashes), and a `:term` directive — but NO Markua syntax, NO
// mermaid fence, NOT a deck. So every `inert` exclusion is genuinely a no-op on it.
const FIXTURE = [
  '# Heading One',
  '',
  "It's a \"quoted\" phrase --- with an em dash and cargo@x.com autolink.",
  '',
  '- ~~struck~~ item',
  '- plain item',
  '',
  'A :term[Cargo]{#cargo} reference inline.',
  '',
  '| A | B |',
  '| - | - |',
  '| 1 | 2 |',
  '',
].join('\n');

/** Deep clone dropping mdast `position` — the golden-tree asserts SEMANTIC mdast
 * parity (node types/values/data), the surface the re-derive callers consume; byte
 * offsets are not part of the substrate-parity contract. */
function stripPosition(tree: unknown): unknown {
  return JSON.parse(JSON.stringify(tree, (k, v) => (k === 'position' ? undefined : v)));
}

describe('re-derive parity — behavioural golden-tree (wrong-exclusion catch)', () => {
  it('build substrate (mirrored + inert exclusions) and re-derive substrate agree on mdast', () => {
    const { stages } = buildStack();

    // Build side: parse + the Astro built-ins (gfm, smartypants, run before every
    // doc-kitty stage) + every enumerated stage that is MIRRORED or classified
    // `inert`, in combined order, through `.__inner`. A stage wrongly excluded as
    // `inert` while actually mutating the tree diverges from the re-derive here.
    let build = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants);
    for (const stage of stages) {
      const excl = findExclusion(stage);
      const include = MIRRORED.has(stage.plugin) || excl?.kind === 'inert';
      if (include) build = build.use(stage.plugin as Parameters<typeof build.use>[0]);
    }

    // Re-derive side: exactly what the substrate replays (directive on, mirroring
    // the "links used" re-derive that needs `:term`).
    const rederive = createPageProcessor({ directive: true });

    const buildTree = stripPosition(build.runSync(build.parse(FIXTURE)));
    const rederiveTree = stripPosition(rederive.runSync(rederive.parse(FIXTURE)));

    expect(
      rederiveTree,
      'The re-derive substrate produced a DIFFERENT mdast than the build substrate for the ' +
        'mirrored set. Either a mirrored stage is missing from REDERIVE_REMARK_PLUGINS ' +
        '(re-opening #16/#20), or a stage marked CONSCIOUS_EXCLUSIONS kind:"inert" actually ' +
        'mutates a normal page and should be MIRRORED (a WRONG exclusion, C35).',
    ).toEqual(buildTree);
  });

  it('sanity: the fixture exercises gfm + smartypants + directive (golden-tree is not trivial)', () => {
    const rederive = createPageProcessor({ directive: true });
    const tree = rederive.runSync(rederive.parse(FIXTURE));
    const json = JSON.stringify(tree);
    expect(json).toContain('textDirective'); // :term parsed by remarkDirective
    expect(json).toContain('delete'); // ~~struck~~ parsed by remark-gfm
    expect(json).toContain('table'); // gfm table
    expect(json).toContain('’'); // ' curled by remark-smartypants (’)
  });
});

// ===========================================================================
// 4. Version-parity — the resolved mirrored-plugin versions equal Astro's.
// ===========================================================================

/** Version of `spec` as resolved from `requireFrom`'s module context. Many remark
 * packages restrict `./package.json` in their `exports`, so when the direct
 * `${spec}/package.json` resolve is blocked we resolve the module ENTRY and walk up
 * to the package's own `package.json` (matched by `name`) — the real installed
 * version the substrate loads. */
function resolvedVersion(requireFrom: string, spec: string): string {
  const req = createRequire(requireFrom);
  let version: unknown;
  try {
    version = JSON.parse(readFileSync(req.resolve(`${spec}/package.json`), 'utf8')).version;
  } catch {
    const entry = req.resolve(spec);
    let dir = path.dirname(entry);
    for (;;) {
      const pj = path.join(dir, 'package.json');
      if (existsSync(pj)) {
        const parsed = JSON.parse(readFileSync(pj, 'utf8'));
        if (parsed.name === spec) {
          version = parsed.version;
          break;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) throw new Error(`could not locate package.json for "${spec}" from ${entry}`);
      dir = parent;
    }
  }
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`resolved package for "${spec}" has no string "version"`);
  }
  return version;
}

/** The version Astro/Starlight's markdown pipeline actually resolves for `spec`
 * (astro → @astrojs/markdown-remark → spec), replaying real module resolution. We
 * anchor each hop on the resolved module ENTRY (a valid `createRequire` anchor)
 * rather than `${pkg}/package.json`, since astro's markdown packages restrict
 * `./package.json` in their `exports`. */
function astroResolvedVersion(spec: string): string {
  const astroEntry = createRequire(import.meta.url).resolve('astro');
  const mdRemarkEntry = createRequire(astroEntry).resolve('@astrojs/markdown-remark');
  return resolvedVersion(mdRemarkEntry, spec);
}

describe('re-derive parity — version axis (mirrored plugin versions equal Astro’s)', () => {
  // Guards the axis an identity-based classifier is blind to: a mirrored plugin
  // whose RESOLVED version drifts from Astro's re-opens #16/#20 without any stage
  // appearing/disappearing. Complements the committed remark-version-pin.test.ts
  // (#21, which pins package.json) by asserting the versions the substrate and the
  // test tree ACTUALLY load agree with Astro's markdown pipeline (S-04, C35).
  for (const spec of ['remark-gfm', 'remark-smartypants'] as const) {
    it(`${spec}: the substrate-imported version equals Astro's resolved version`, () => {
      const substrate = resolvedVersion(import.meta.url, spec);
      const astro = astroResolvedVersion(spec);
      expect(
        substrate,
        `The re-derive substrate imports ${spec}@${substrate}, but Astro/Starlight's markdown ` +
          `pipeline resolves ${spec}@${astro}. A mirrored plugin drifting from Astro's version ` +
          `re-opens the #16/#20 divergence invisibly to an identity-based guard. Re-pin so the ` +
          `substrate matches Astro (see remark-version-pin.test.ts / issue #21).`,
      ).toBe(astro);
    });
  }
});

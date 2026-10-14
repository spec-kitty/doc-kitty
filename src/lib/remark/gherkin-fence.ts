/**
 * `gherkinFence` — the in-page Gherkin stage (ADR-0051 decisions 2, 3, 5–8;
 * rendering contract 03 §1–§5). A ```` ```gherkin ```` fence on a docs page, and
 * a `::gherkin{src scenario tags}` include of a `.feature` file, are replaced by
 * a structured scenario: a `<div class="dk-gherkin">` holding real headings, step
 * lists, tables and doc strings, built from the same view model
 * (`gherkin/view.mjs`) a generated feature page is rendered from.
 *
 * WHERE IT RUNS. Registered by the `doc-kitty:gherkin-fence` integration
 * (`config.ts`) after the glossary and the `doc-kitty:gherkin` codegen hook and
 * immediately before Starlight, so (02 §Pipeline):
 *  - Astro's `remark-smartypants` has ALREADY run on the page and never sees the
 *    nodes inserted here, so this stage runs it over the subtree it emits (prose
 *    then reads like the page; `inlineCode`/`code` are left alone, as
 *    smartypants always does, which is what keeps a quoted step argument
 *    verbatim);
 *  - the glossary has already run, so step text is not auto-linked (Q1), and the
 *    stage is an `inert` exclusion in `glossary-substrate-parity.test.ts`;
 *  - Starlight's `remarkDirectivesRestoration` runs later and turns every
 *    directive no plugin claimed back into literal text. A `::gherkin` include
 *    this stage consumed never reaches it; with the preset off (or
 *    `fences: false`) the stage is not registered and the directive is restored
 *    exactly as before (pinned in `gherkin-include.test.ts`);
 *  - Expressive Code runs later. The fence node is therefore RETYPED (`dkGherkin`,
 *    `data.hName: 'div'`) rather than left a `code` node — a `code` node always
 *    renders as `<pre><code>`, which would put the whole block inside a `<pre>`
 *    (the #59 shape `mermaidFenceTransform` avoids the same way). Doc strings are
 *    emitted as fresh `code` nodes on purpose, so Expressive Code renders each one
 *    like any other code block;
 *  - `deckSplit` runs later but only reads root children, so headings nested in
 *    the container can never cut slides.
 *
 * WHAT IT SKIPS (03 §3):
 *  - a fence whose info string has the word `raw` (```` ```gherkin raw ````): the
 *    escape hatch for showing Gherkin AS SOURCE;
 *  - a generated feature page (`generated.by: doc-kitty/gherkin` frontmatter): its
 *    `gherkin` doc strings would otherwise grow nested structured scenarios and
 *    confuse the scenario index (02 §Generated pages and nested Gherkin). With
 *    `results` it only gets the results overlay (see RESULTS below);
 *  - a deck page (`isPresentationFile`, deliberately NOT `guardDeck`, which would
 *    no-op the whole transformer and later let a `::gherkin` include leak as
 *    text): fences on a slide stay code blocks, and an include is FATAL
 *    ("not supported in decks", 02 §Decks);
 *  - the `code` nodes this stage emits for doc strings (`data.dkGherkin`), and an
 *    empty or comment-only fence (no Feature to render: it stays a code block).
 *
 * INCLUDES (03 §2). Only the LEAF form `::gherkin{…}` includes; the container
 * form (`:::gherkin`) and a text form with attributes or a label
 * (`:gherkin{…}`, `:gherkin[…]`) are fatal and name the leaf form. A bare
 * `:gherkin` in prose (`lang:gherkin`) is not an include and is left alone.
 * Attributes are `src` (required), `scenario` and `tags` — anything else, or
 * `scenario` with `tags`, is fatal and names the allowed set; so is a `tags`
 * value written as a tag expression (`and`/`or`/`not`, parentheses), since it
 * is an any-of list. `src` is resolved by `gherkin/include.mjs` (a `.feature`
 * name, realpath containment in `includeRoots`, read, an mtime-keyed memo),
 * parsed with `parseGherkin` (its errors are re-reported through the host page:
 * `<page>:<L> ::gherkin src="x" — x:<l>:<c> …`), narrowed
 * by `gherkin/select.mjs`, then emitted like a fence with a source line (03
 * §4.6): a whole file with the full header and `Source: <path>`, a selection
 * with no header and `From <Feature title>, <path>`. The path links to
 * `sourceUrlPrefix + <path relative to sourceRoot>` when a prefix is set, built
 * by slice C's own `sourceLink`. Includes are NOT recursive: a `gherkin` doc
 * string inside the included file is emitted as a marked `code` node and stays
 * code. `@dk:*` metadata tags in an included file are legitimate (the same file
 * may feed a generated page), so they are dropped from the rendered tags without
 * the warning a fence gets (03 §1.5).
 *
 * HEADINGS (03 §4.2). `B = max(2, d + 1)` capped at 6, where `d` is the depth of
 * the nearest ROOT-LEVEL heading before the fence's top-level ancestor (the root
 * child that contains it). A fence whose parent is not the root (list item,
 * blockquote, aside, callout) emits `p[role=heading]` instead of headings, so it
 * stays out of the TOC and cannot break its container's outline. No heading ever
 * carries a preset id: the slugger must see every heading to keep ids unique.
 *
 * ERRORS (03 §5; 02 §Making errors fatal). A fence that fails to parse is FATAL,
 * reported as `[dk-gherkin] <page>:<line>:<col> <message>` at the page's absolute
 * line; so is a fence with no scenario or step (prose, a bare table or
 * `Examples:`, which the fragment wrap turns into the description of an
 * untitled Feature that renders nothing), at its opening line; so is every
 * include error of the 03 §5 table, reported as
 * `[dk-gherkin] <page>:<line> ::gherkin src="x" — …`. Every block on the page is
 * checked first, so one build reports them all;
 * then the page's messages are recorded in the process-wide sink
 * (`gherkin/errors.mjs`) and ONE Error is thrown, so the page never renders
 * half-transformed. Astro's content loader only logs that throw; it is the sink,
 * read by the integration's `astro:build:done` hook, that fails the build.
 * Warnings (`@dk:*` tags, duplicate scenario names, or steps under a real
 * `Feature:` line with no `Scenario:`, in a fence) go to `warn`.
 *
 * LINES. Astro renders a content entry's BODY: `getEntryInfo` blanks the
 * frontmatter and then `.trim()`s the result, so the mdast line 1 is the first
 * non-blank line after the frontmatter, not line 1 of the file. Messages must
 * cite the line the author sees, so the stage maps body lines back to file lines
 * by locating the body in the file on disk ({@link bodyLineOffset}); only pages
 * that report something pay for that read.
 *
 * AGENT SURFACE (02 §Agent surface; `gherkin/agent-includes.mjs`). Each include
 * is also rendered as Markdown for `/api/pages/<id>.json`, whose route splices
 * it into `entry.body` without a parser or the include roots. The records
 * (`{ start, end, src, scenario?, tags?, markdown }`, offsets of the directive
 * in the BODY Astro renders and stores) go to `file.data.astro.frontmatter`
 * under `dkGherkinIncludes`, which Astro keeps as the entry's
 * `rendered.metadata.frontmatter`, apart from the validated `entry.data`.
 *
 * RESULTS (ADR-0055). With `results` (the normalised `gherkin.results`), the
 * report is loaded at most once per render, through `results-load.mjs`'s memo,
 * and only for a page that shows Gherkin from a file. An include passes its
 * file's results (checked against the WHOLE file, so a selection cannot hide a
 * stale report) to both emitters; a generated page gets them through
 * `results-overlay.mjs` after its source is re-read and checked against
 * `generated.at`. A fence never has results. A stale report, an ambiguous report
 * path, an out-of-date generated page or a missing heading is a warning (once per
 * process and version); a report that cannot be read is fatal on the page. With
 * `fences: false` (registered for `results` alone) nothing is collected, so only
 * generated pages are touched.
 *
 * DESCRIPTIONS are Markdown, parsed with the HOST processor's own micromark and
 * from-markdown extensions (GFM, directives, …), read from the processor data the
 * attacher captured. They are read at transform time, not copied at attach time:
 * plugins registered after this one (Starlight's `remark-directive`) push into
 * the same arrays when the processor freezes. `unified` + `remark-parse` are
 * toolkit dependencies; `mdast-util-from-markdown` and `unist-util-visit` are not
 * (`package-runtime-deps.test.ts`), hence the hand-written walk below.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkSmartypants from 'remark-smartypants';
import { isPresentationFile } from '../deck/is-presentation.js';
import { GENERATED_BY } from '../gherkin/feature-core.mjs';
import { recordFatal } from '../gherkin/errors.mjs';
import { parseFragment } from '../gherkin/fragment.mjs';
import { resolveInclude } from '../gherkin/include.mjs';
import { MAX_INCLUDE_BYTES } from '../gherkin/include-path.mjs';
import { sourceLink, toPosix } from '../gherkin/load.mjs';
import { DOCSTRING_MARK, featureMdast } from '../gherkin/mdast.mjs';
import { formatProblem, parseGherkin } from '../gherkin/parse.mjs';
import { AGENT_INCLUDES_KEY, type AgentInclude } from '../gherkin/agent-includes.mjs';
import { renderFeatureBody, renderSourceLine, warnDuplicates } from '../gherkin/render.mjs';
import { featureResults } from '../gherkin/results.mjs';
import { loadReport, type LoadedReport, type ResultsOption } from '../gherkin/results-load.mjs';
import { overlayResults } from '../gherkin/results-overlay.mjs';
import { selectScenarios } from '../gherkin/select.mjs';
import { GHERKIN_LOG_PREFIX } from '../gherkin/text.mjs';
import { capLevel, featureView, hasMetadataTag } from '../gherkin/view.mjs';

/** Minimal structural mdast node: enough to find fences and splice the subtree. */
interface MdastNode {
  type: string;
  /** A directive's name (`leafDirective`, `textDirective`, `containerDirective`). */
  name?: string;
  /** A directive's attributes, as `remark-directive` parsed them. */
  attributes?: Record<string, string | null | undefined> | null;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  depth?: number;
  children?: MdastNode[];
  data?: Record<string, unknown>;
  position?: {
    start: { line: number; column: number; offset?: number };
    end?: { line: number; column: number; offset?: number };
  };
  [key: string]: unknown;
}

/** The subset of the remark VFile this stage reads (Astro injects `data.astro`). */
interface GherkinFenceVFile {
  path?: string;
  value?: unknown;
  data?: {
    astro?: { frontmatter?: { kind?: unknown; generated?: unknown; [key: string]: unknown } };
    [key: string]: unknown;
  };
}

/** The processor data the attacher reads (set by remark-gfm, remark-directive, …). */
interface ProcessorData {
  micromarkExtensions?: unknown[];
  fromMarkdownExtensions?: unknown[];
}

export interface GherkinFenceOptions {
  /**
   * Warning sink for `@dk:*` tags and duplicate scenario names in a fence.
   * Default `console.warn` (the glossary's warnings reach the build log the same
   * way).
   */
  warn?: (message: string) => void;
  /**
   * `gherkin.includeRoots` (project-root relative): the only directories an
   * include may read from. Empty or absent: every include is fatal ("includes
   * need gherkin.includeRoots").
   */
  includeRoots?: readonly string[];
  /** `gherkin.sourceRoot` (project-root relative, default `'.'`): source links are relative to it. */
  sourceRoot?: string;
  /** `gherkin.sourceUrlPrefix`: when set, an include's source path is a link. */
  sourceUrlPrefix?: string;
  /**
   * `gherkin.fences` (default `true`): transform fences and includes. `false`
   * leaves both as authored; the stage is then registered only for `results`,
   * and only adds results to generated pages.
   */
  fences?: boolean;
  /**
   * `gherkin.results`, normalised (ADR-0055): the Cucumber report whose results
   * are shown next to included scenarios and on generated feature pages.
   */
  results?: ResultsOption;
  /**
   * The project root `src`, `includeRoots` and `sourceRoot` are relative to,
   * and that page paths in messages are shown relative to.
   * Default `process.cwd()` at transform time: the site root in a build, the
   * same base slice C resolves `gherkin.sources` against.
   */
  root?: string;
}

/** One fence or `gherkin` directive to transform, found before any node is replaced. */
interface FenceMatch {
  kind: 'fence' | 'directive';
  node: MdastNode;
  parent: MdastNode;
  index: number;
  /** `B` of 03 §4.2, already capped. */
  baseLevel: number;
  /** The fence's parent is not the root: headings become `p[role=heading]`. */
  inContainer: boolean;
}

/** The `raw` opt-out: the WORD `raw` anywhere in the info string's meta (03 §1.2). */
const RAW_META = /(?:^|\s)raw(?:\s|$)/;

/** The lowest base level an embed may use: a page never gets a second H1. */
const MIN_BASE_LEVEL = 2;

/** The include directive's name, and the only attributes it accepts (03 §2.2). */
const DIRECTIVE_NAME = 'gherkin';
const INCLUDE_ATTRIBUTES = ['src', 'scenario', 'tags'] as const;

/** Every directive form `remark-directive` produces; only the leaf one includes. */
const DIRECTIVE_TYPES = new Set(['leafDirective', 'textDirective', 'containerDirective']);

/**
 * True for a fence this stage transforms: `lang === 'gherkin'` exactly
 * (case-sensitive, like `mermaid`), no `raw` word, not a doc string it emitted.
 */
function isGherkinFence(node: MdastNode): boolean {
  return (
    node.type === 'code' &&
    node.lang === 'gherkin' &&
    !RAW_META.test(node.meta ?? '') &&
    node.data?.dkGherkin !== DOCSTRING_MARK
  );
}

/**
 * True for a directive named `gherkin` this stage owns: the leaf form includes,
 * the container form and an ATTEMPTED text-form include are reported (03 §2.1).
 * A text directive counts as an attempt only when it carries attributes
 * (`:gherkin{src=…}`) or a label (`:gherkin[…]`): a bare `:gherkin` is ordinary
 * prose that `remark-directive` happens to parse (`lang:gherkin`), so it is left
 * for Starlight's restoration to turn back into its literal text. A
 * `::gherkin{…}` written in a code fence is text, never a directive, so it is
 * never matched (03 §3).
 */
function isGherkinDirective(node: MdastNode): boolean {
  if (!DIRECTIVE_TYPES.has(node.type) || node.name !== DIRECTIVE_NAME) return false;
  if (node.type !== 'textDirective') return true;
  return Object.keys(node.attributes ?? {}).length > 0 || (node.children?.length ?? 0) > 0;
}

/**
 * Find every gherkin fence (when `fences`) and every `gherkin` directive at any
 * depth, in document order, with the heading context 03 §4.2 needs. The walk only
 * COLLECTS; the caller replaces afterwards, so a node this stage inserts is never
 * visited.
 */
function collectBlocks(tree: MdastNode, { fences }: { fences: boolean }): FenceMatch[] {
  const matches: FenceMatch[] = [];
  let lastRootHeadingDepth = 0;
  const visit = (node: MdastNode, parent: MdastNode, index: number, baseLevel: number): void => {
    const kind = fences && isGherkinFence(node) ? 'fence' : isGherkinDirective(node) ? 'directive' : undefined;
    if (kind) {
      matches.push({ kind, node, parent, index, baseLevel, inContainer: parent !== tree });
      return; // a code node is a leaf; a gherkin directive is replaced or reported whole
    }
    node.children?.forEach((child, i) => visit(child, node, i, baseLevel));
  };
  (tree.children ?? []).forEach((child, i) => {
    // The fence's TOP-LEVEL ANCESTOR is this root child (or the fence itself):
    // `d` is the nearest root-level heading BEFORE it.
    const baseLevel = capLevel(Math.max(MIN_BASE_LEVEL, lastRootHeadingDepth + 1));
    visit(child, tree, i, baseLevel);
    if (child.type === 'heading' && typeof child.depth === 'number') lastRootHeadingDepth = child.depth;
  });
  return matches;
}

/**
 * The page path in messages: relative to the project root (`options.root`,
 * else the cwd: the site root in a build), POSIX. `<page>` when the file has no
 * path (a bare unified run).
 */
function displayPath(file: GherkinFenceVFile, root: string): string {
  return file.path ? toPosix(path.relative(root, file.path)) : '<page>';
}

/**
 * Lines between the top of the FILE and the top of the rendered BODY (see LINES
 * in the header): 0 when there is no file on disk to compare with, or the body
 * is the whole file. Astro's body is the file with its frontmatter blanked and
 * the result trimmed, so it is a verbatim substring of the file that runs to
 * the file's last non-blank character: its LAST occurrence is the rendered one
 * (an earlier copy could only sit inside the frontmatter).
 */
export function bodyLineOffset(file: GherkinFenceVFile): number {
  const body = typeof file.value === 'string' ? file.value : String(file.value ?? '');
  if (!file.path || body === '') return 0;
  let original: string;
  try {
    original = readFileSync(file.path, 'utf8');
  } catch {
    return 0;
  }
  const at = original.lastIndexOf(body);
  if (at <= 0) return 0;
  let lines = 0;
  for (let i = 0; i < at; i += 1) if (original.charCodeAt(i) === 10) lines += 1;
  return lines;
}

/** Drop `position` from parsed description nodes: their lines are the
 * description's own, not the page's, and would mislead any later reader. */
function stripPositions(node: MdastNode): MdastNode {
  delete node.position;
  node.children?.forEach(stripPositions);
  return node;
}

/** `scenario` with `tags` (03 §2.2): refused before any file is read. */
function bothSetMessage(ref: string): string {
  return `${ref} — use scenario="…" or tags="…", not both (allowed: ${INCLUDE_ATTRIBUTES.join(', ')})`;
}

/**
 * `tags` is a space-separated ANY-OF list (Q5), not a Cucumber tag expression:
 * `@a and @b` would otherwise select `@a`, `@and` or `@b`, and `not @wip` would
 * select `@wip`. The operator words (any case) and parentheses are refused.
 */
function isTagExpression(tags: string): boolean {
  return /[()]/.test(tags) || tags.split(/\s+/).some((t) => /^(?:and|or|not)$/i.test(t));
}

/** The 03 §5 message for a `src` that `resolveInclude` refused. */
function resolveFailureMessage(
  failure: Exclude<ReturnType<typeof resolveInclude>, { ok: true }>,
  ref: string,
  includeRoots: readonly string[],
): string {
  switch (failure.reason) {
    case 'invalid':
      return (
        `${ref} — src must be a project-relative path with / separators ` +
        `(no leading /, drive letter, URL scheme or \\)`
      );
    case 'notFeature':
      return `${ref} — src must name a .feature file`;
    case 'rootMissing':
      return `${ref} — include root not found: ${failure.includeRoot}`;
    case 'outside':
      return `${ref} — outside gherkin.includeRoots (${includeRoots.join(', ')})`;
    case 'notFile':
      return `${ref} — not a file`;
    case 'tooLarge':
      return `${ref} — larger than ${MAX_INCLUDE_BYTES / 1024 / 1024} MiB, the include limit`;
    case 'notFound':
      return `${ref} — file not found`;
  }
}

/** The 03 §5 message for a selection that `selectScenarios` refused; `x` is the file. */
function selectionFailureMessage(
  failure: Exclude<ReturnType<typeof selectScenarios>, { ok: true }>,
  ref: string,
  x: string,
): string {
  switch (failure.reason) {
    case 'notFound': {
      const names = failure.names.map((n) => `"${n}"`).join(', ') || 'none';
      return `${ref} — no scenario named "${failure.scenario}" in ${x} (scenarios: ${names})`;
    }
    case 'ambiguous':
      return (
        `${ref} — ${failure.lines.length} scenarios named "${failure.scenario}" in ${x} ` +
        `(lines ${failure.lines.join(', ')})`
      );
    case 'noTagMatch': {
      const wanted = failure.tags.length > 0 ? failure.tags.join(' or ') : '(no tags given)';
      // An outline whose tagged Examples have no rows yields no pickle, so
      // `tags` cannot reach it; say so, and how to select it (03 §2.2).
      const hints = failure.emptyOutlines.map(
        (o) =>
          `; outline "${o.name}" (line ${o.line}) is tagged but its Examples have no rows, ` +
          `so only scenario="${o.name}" can select it`,
      );
      return `${ref} — no scenario tagged ${wanted} in ${x}${hints.join('')}`;
    }
    case 'conflict':
      // `selectScenarios`' own check; the stage refuses both before reading.
      return bothSetMessage(ref);
  }
}

/** A block's outcome: its container (and, for an include, its agent record), or its fatal messages. */
type BlockResult =
  | { container: MdastNode; agent?: Omit<AgentInclude, 'start' | 'end'> }
  | { errors: string[] };

/** Where a block sits, for its messages: the page path, the block's FILE line, a deck page. */
interface BlockContext {
  page: string;
  line: number;
  deck: boolean;
}

/**
 * Remark plugin attacher. `this` is the host processor: its data holds the
 * micromark / from-markdown extensions descriptions are parsed with.
 */
export default function gherkinFence(
  this: { data: () => unknown } | undefined,
  options: GherkinFenceOptions = {},
) {
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const includeRoots = options.includeRoots ?? [];
  const hostData = (typeof this?.data === 'function' ? this.data() : {}) as ProcessorData;
  // Typography: the same `remark-smartypants` (defaults) Astro runs on the page.
  const smarten = (remarkSmartypants as unknown as () => (tree: MdastNode) => void)();

  /** Description Markdown → block nodes, with the host's syntax extensions. */
  const parseMarkdown = (markdown: string): MdastNode[] => {
    const parser = unified()
      .use(remarkParse)
      .data({
        micromarkExtensions: [...(hostData.micromarkExtensions ?? [])],
        fromMarkdownExtensions: [...(hostData.fromMarkdownExtensions ?? [])],
      } as never);
    const root = parser.parse(markdown) as unknown as MdastNode;
    return (root.children ?? []).map(stripPositions);
  };

  /** Warnings already given in this process (a dev server renders a page many times). */
  const warned = new Set<string>();
  const warnOnce = (key: string, message: string): void => {
    if (warned.has(key)) return;
    warned.add(key);
    warn(message);
  };

  /**
   * The results of one rendered `.feature` file (ADR-0055 decisions 3 and 4):
   * `undefined` when no report is configured or found, or the report does not
   * name the file. `text` is the WHOLE file, `view` what the page shows and
   * `whole` the whole file's view (staleness is checked against it).
   */
  const resultsFor = (
    loaded: LoadedReport | undefined,
    file: { relPath: string; text: string },
    view: NonNullable<ReturnType<typeof featureView>>,
    whole: NonNullable<ReturnType<typeof featureView>> = view,
  ): ReturnType<typeof featureResults> | undefined => {
    if (!loaded?.ok || !options.results) return undefined;
    const found = loaded.index.lookup(file.relPath);
    if (!found) return undefined;
    const report = options.results.report;
    if ('ambiguous' in found) {
      warnOnce(
        `ambiguous\0${report}\0${file.relPath}`,
        `${GHERKIN_LOG_PREFIX} ${report}: ${file.relPath} can only be matched by the end of a reported path, ` +
          `and that is not unique (${found.ambiguous.join(', ')}); its scenarios show no results — ` +
          `run Cucumber with relative paths and set gherkin.results.root`,
      );
      return undefined;
    }
    const results = featureResults(found.file, { text: file.text, view, file: whole, run: loaded.report.run });
    if (results.state === 'stale') {
      warnOnce(
        `stale\0${report}\0${file.relPath}\0${createHash('sha256').update(file.text).digest('hex')}`,
        `${GHERKIN_LOG_PREFIX} ${report} holds results for a different version of ${file.relPath}; ` +
          `its scenarios show no results until the tests run again`,
      );
    }
    return results;
  };

  /**
   * One ```` ```gherkin ```` fence → its `dkGherkin` container, or its fatal
   * messages (03 §1, §5). An empty or comment-only fence has no Feature and
   * yields `null`: it stays a code block. `ctx.line` is the fence's OPENING line
   * in the file: content line n reports as `line + n`.
   */
  const fenceBlock = (match: FenceMatch, { page, line }: BlockContext): BlockResult | null => {
    const { node } = match;
    // The fence's column is its indentation, which CommonMark strips from content.
    const columnOffset = node.position ? node.position.start.column - 1 : 0;
    const parsed = parseFragment(node.value ?? '', { display: page, lineOffset: line, columnOffset });
    if (parsed.errors.length > 0) return { errors: parsed.errors };
    const view = parsed.document ? featureView(parsed.document, { synthetic: parsed.synthetic }) : null;
    if (!view) return null;

    const at = `${GHERKIN_LOG_PREFIX} ${page}:${line}`;
    // Prose, a bare table or `Examples:` with no scenario parse as the
    // description of the synthetic Feature, which renders no heading: the
    // block would be empty and its content lost without a word.
    if (view.synthetic && view.children.length === 0) {
      return {
        errors: [`${at} gherkin fence has no scenario or steps; mark it \`\`\`gherkin raw\`\`\` to show it as source`],
      };
    }
    if (parsed.descriptionStepLine > 0) {
      warn(
        `${GHERKIN_LOG_PREFIX} ${page}:${line + parsed.descriptionStepLine} ` +
          `steps after Feature: without a Scenario: line render as description`,
      );
    }
    if (hasMetadataTag(view)) warn(`${at} metadata tags have no effect in an embedded feature`);
    // View lines are in WRAPPED coordinates (fragment.mjs): unshift, then offset.
    warnDuplicates(view, { file: page, warn, lineOffset: line - parsed.lineShift });

    const container = featureMdast(view, {
      baseLevel: match.baseLevel,
      header: 'full',
      parseMarkdown,
      inContainer: match.inContainer,
    }) as MdastNode;
    return { container };
  };

  /**
   * One `gherkin` directive → its `dkGherkin` container and agent record, or its
   * fatal messages (03 §2, §5). `ctx.line` is the directive's line in the FILE.
   * Checks run in the order an author fixes them: the form, the page kind, the
   * attributes, the configuration, the file, its Gherkin, then the selection.
   */
  const includeBlock = (
    match: FenceMatch,
    { page, line, deck }: BlockContext,
    root: string,
    loaded: () => LoadedReport | undefined,
  ): BlockResult => {
    const { node } = match;
    const at = `${GHERKIN_LOG_PREFIX} ${page}:${line}`;
    const fail = (message: string) => ({ errors: [message] });
    if (node.type === 'textDirective') {
      return fail(`${at} :gherkin is a text directive; write ::gherkin{src="…"} on a line of its own`);
    }
    if (node.type === 'containerDirective') {
      return fail(`${at} :::gherkin is a container directive; write ::gherkin{src="…"} on a line of its own`);
    }

    const attributes = node.attributes ?? {};
    const value = (key: string) => (typeof attributes[key] === 'string' ? (attributes[key] as string) : undefined);
    const src = value('src');
    const scenario = value('scenario');
    const tags = value('tags');
    // `<page>:<L> ::gherkin src="x"`: every message about one include starts so.
    const ref = src ? `${at} ::gherkin src="${src}"` : `${at} ::gherkin`;

    if (deck) return fail(`${ref} — ::gherkin is not supported in decks`);
    const unknown = Object.keys(attributes).filter((k) => !(INCLUDE_ATTRIBUTES as readonly string[]).includes(k));
    if (unknown.length > 0) {
      return fail(
        `${ref} — unknown attribute${unknown.length === 1 ? '' : 's'} ${unknown.join(', ')}; ` +
          `allowed: ${INCLUDE_ATTRIBUTES.join(', ')}`,
      );
    }
    if (src === undefined || src.trim() === '') return fail(`${at} ::gherkin needs src="…"`);
    if (scenario !== undefined && tags !== undefined) return fail(bothSetMessage(ref));
    if (tags !== undefined && isTagExpression(tags)) {
      return fail(`${ref} — tags is a space-separated any-of list; tag expressions are not supported`);
    }
    if (includeRoots.length === 0) {
      return fail(
        `${ref} — includes need gherkin.includeRoots (or gherkin.sources) — \`gherkin: true\` turns on fences only`,
      );
    }

    const resolved = resolveInclude(src, { root, includeRoots });
    if (!resolved.ok) return fail(resolveFailureMessage(resolved, ref, includeRoots));
    const x = resolved.relPath;

    // The included file's own errors, at ITS lines, re-reported through the page.
    const parsed = parseGherkin(resolved.bytes, { display: x });
    if (!parsed.document) return { errors: parsed.problems.map((p) => `${ref} — ${formatProblem(x, p)}`) };

    const selection = selectScenarios(
      parsed.document,
      scenario !== undefined ? { scenario } : tags !== undefined ? { tags: tags.split(/\s+/).filter(Boolean) } : {},
    );
    if (!selection.ok) return fail(selectionFailureMessage(selection, ref, x));

    const view = featureView(selection.document);
    if (!view) return fail(`${ref} — ${x} has no Feature`);
    // No `@dk:*` warning here (03 §1.5): the emitters drop those tags silently.
    const selected = scenario !== undefined || tags !== undefined;
    const href = options.sourceUrlPrefix
      ? sourceLink(resolved.absPath, {
          sourceRoot: path.resolve(root, options.sourceRoot ?? '.'),
          sourceUrlPrefix: options.sourceUrlPrefix,
        }).resource
      : undefined;
    // 03 §2.5: a whole file is the full feature; a selection drops the header
    // and cites the feature in the source line instead.
    const header = selected ? 'none' : 'full';
    const source = { path: x, ...(href ? { href } : {}), featureTitle: view.title, selected };
    const { baseLevel, inContainer } = match;
    // ADR-0055: the file's results, checked against the WHOLE file.
    const whole = selected ? (featureView(parsed.document) ?? view) : view;
    const results = resultsFor(loaded(), { relPath: x, text: resolved.bytes }, view, whole);
    const container = featureMdast(view, { baseLevel, header, source, parseMarkdown, inContainer, results }) as MdastNode;
    // The same include for agents (02 §Agent surface): the re-parse-safe
    // Markdown of a generated page, laid out as an EMBED so it shows the tags
    // the HTML shows where the HTML shows them, at the same base level and
    // header mode (bold lines for headings inside a container), then the
    // source line. Its duplicate-name warnings stay off (the default no-op
    // `warn`): an include gets none (03 §1.5).
    const body = renderFeatureBody(selection.document, { view, baseLevel, header, embed: true, inContainer, results });
    const agent = {
      src,
      ...(scenario !== undefined ? { scenario } : {}),
      ...(tags !== undefined ? { tags } : {}),
      markdown: `${body}\n${renderSourceLine(source)}`,
    };
    return { container, agent };
  };

  /**
   * Results on a generated feature page (ADR-0055 decision 5): re-read the
   * page's `.feature` source (`sources[0].resource`, the inverse of
   * `sourceLink`), check it is the version the page was generated from
   * (`generated.at`), and overlay its results on the page's mdast. Anything
   * that stops the overlay is a warning, never an error: the page is still
   * correct without results, and a page out of date with its source already
   * fails the drift gate and the scenario index.
   */
  const overlayGenerated = (
    tree: MdastNode,
    frontmatter: Record<string, unknown>,
    page: string,
    root: string,
    loaded: LoadedReport,
  ): void => {
    const sources = frontmatter.sources as Array<{ resource?: unknown }> | undefined;
    const generatedAt = (frontmatter.generated as { at?: unknown } | undefined)?.at;
    let resource = typeof sources?.[0]?.resource === 'string' ? sources[0].resource : undefined;
    if (!resource) return;
    if (options.sourceUrlPrefix && resource.startsWith(options.sourceUrlPrefix)) {
      resource = resource.slice(options.sourceUrlPrefix.length);
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(resource)) {
      return; // a URL the configured prefix does not explain: nothing to read
    }
    const absPath = path.resolve(root, options.sourceRoot ?? '.', ...resource.split('/'));
    const relPath = toPosix(path.relative(root, absPath));
    let raw: Buffer;
    try {
      const stat = statSync(absPath);
      if (!stat.isFile() || stat.size > MAX_INCLUDE_BYTES) return;
      raw = readFileSync(absPath);
    } catch {
      return;
    }
    const want = typeof generatedAt === 'string' ? generatedAt.replace(/^sha256:/, '') : '';
    if (want && !createHash('sha256').update(raw).digest('hex').startsWith(want)) {
      warnOnce(
        `outdated\0${page}\0${want}`,
        `${GHERKIN_LOG_PREFIX} ${page} is out of date with ${relPath}; it shows no results until it is regenerated`,
      );
      return;
    }
    const text = raw.toString('utf8');
    const parsed = parseGherkin(text, { display: relPath });
    const view = parsed.document ? featureView(parsed.document) : null;
    if (!view) return;
    const results = resultsFor(loaded, { relPath, text }, view);
    if (!results) return;
    const { missing } = overlayResults(tree as never, view, results);
    if (missing.length > 0) {
      warnOnce(
        `missing\0${page}\0${want}`,
        `${GHERKIN_LOG_PREFIX} ${page} has no heading for ${missing.map((m) => `"${m}"`).join(', ')} ` +
          `of ${relPath}; those scenarios show no result`,
      );
    }
  };

  return function transformer(tree: MdastNode, file: GherkinFenceVFile): void {
    const root = options.root ?? process.cwd();
    const frontmatter = file.data?.astro?.frontmatter ?? {};
    const generated = frontmatter.generated as { by?: unknown } | undefined;
    const isGenerated = generated?.by === GENERATED_BY;
    // 03 §3: a generated page's Gherkin stays as emitted. 02 §Decks: on a slide,
    // fences stay code and only directives are collected (to be reported).
    // `fences: false`: nothing is collected, so a directive is restored as text.
    const deck = isPresentationFile(file);
    const blocks = isGenerated || options.fences === false ? [] : collectBlocks(tree, { fences: !deck });
    const page = displayPath(file, root);

    // The report (ADR-0055), loaded at most once per render and only for a page
    // that shows Gherkin from a file. A report that cannot be read is FATAL on
    // every page that would show its results (decision 9).
    let reportError: string | undefined;
    let report: LoadedReport | undefined;
    let reportRead = false;
    const loaded = (): LoadedReport | undefined => {
      if (reportRead) return report;
      reportRead = true;
      if (!options.results) return undefined;
      try {
        report = loadReport(options.results, { projectRoot: root });
      } catch (error) {
        reportError = (error as Error).message;
      }
      return report;
    };

    if (isGenerated && options.results) {
      const current = loaded();
      if (current?.ok) overlayGenerated(tree, frontmatter, page, root, current);
    }
    if (blocks.length === 0) {
      const errors = reportError ? [`${reportError} (shown on ${page})`] : [];
      // Clear any record from an earlier render of this page (a dev edit that
      // removed the broken block), so the sink only ever holds the latest render
      // of each page.
      recordFatal(page, errors);
      if (errors.length > 0) throw new Error(errors.join('\n'));
      return;
    }

    let bodyOffset: number | undefined;
    const offset = () => (bodyOffset ??= bodyLineOffset(file));

    const errors: string[] = [];
    const replacements: Array<{ match: FenceMatch; container: MdastNode }> = [];
    const agentIncludes: AgentInclude[] = [];
    for (const match of blocks) {
      const { node } = match;
      const ctx = { page, line: node.position ? node.position.start.line + offset() : 0, deck };
      const result = match.kind === 'directive' ? includeBlock(match, ctx, root, loaded) : fenceBlock(match, ctx);
      if (!result) continue; // an empty or comment-only fence stays a code block
      if ('errors' in result) {
        errors.push(...result.errors);
        continue;
      }
      smarten(result.container);
      if (node.position) result.container.position = node.position;
      // Body offsets (see AGENT SURFACE in the header); a node without them
      // (a synthetic tree) simply stays a directive in the agent payload.
      const startOffset = node.position?.start.offset;
      const endOffset = node.position?.end?.offset;
      if (result.agent && typeof startOffset === 'number' && typeof endOffset === 'number') {
        agentIncludes.push({ start: startOffset, end: endOffset, ...result.agent });
      }
      replacements.push({ match, container: result.container });
    }
    if (reportError) errors.push(`${reportError} (shown on ${page})`);

    // Record (or clear) this page's fatal errors BEFORE throwing: Astro's loader
    // swallows the throw, and the sink is what fails the build.
    recordFatal(page, errors);
    if (errors.length > 0) throw new Error(errors.join('\n'));

    for (const { match, container } of replacements) {
      const siblings = match.parent.children;
      if (siblings) siblings[match.index] = container;
    }

    // A page with no include gets no key, so its rendered metadata (and the
    // agent payload) stay byte-identical. A NEW object, not a write into the
    // one Astro passed in: that is the loader's raw `data`, and the key must
    // reach `rendered.metadata.frontmatter` only.
    if (agentIncludes.length > 0) {
      const data = (file.data ??= {});
      const astro = (data.astro ??= {});
      astro.frontmatter = { ...astro.frontmatter, [AGENT_INCLUDES_KEY]: agentIncludes };
    }
  };
}

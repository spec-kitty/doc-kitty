/**
 * `scenarioIndexRoute` — the structured scenario index at `/api/scenarios.json`
 * (ADR-0046, gherkin-feature-pages WP10). One JSON document listing every
 * agent-discoverable GENERATED feature page (`kind: Specification`,
 * `generated.by: doc-kitty/gherkin`) with its rules, scenarios, anchors, tags and
 * steps, so an agent can answer "which scenarios cover mission-alpha?" without
 * scraping Markdown.
 *
 * The `doc-kitty:gherkin` integration injects this route when `gherkin.sources` is
 * set (#126, ADR-0054). To mount it by hand instead (a site keeps its own file),
 * use `src/pages/api/scenarios.json.ts`:
 *
 *   import { scenarioIndexRoute } from '@spec-kitty/doc-toolkit/routes';
 *   export const GET = scenarioIndexRoute();
 *
 * TWO SOURCES, ONE TRUTH EACH:
 *  - Page metadata (`id`, `title`, `url`, `doc_status`, `glossary_context`,
 *    `tags`, `related`, `source`) comes from the generated page in the `docs`
 *    collection, so draft gating (`isAgentDiscoverable`) and the section `feeds`
 *    filter are exactly the ones `/api/index.json` applies.
 *  - Scenario detail (name, rule, tags, outline, steps, examples) comes from
 *    RE-PARSING the page's `.feature` (`sources[0].resource`) with the same
 *    `loadFeatures` the integration uses — never by un-escaping the rendered
 *    Markdown, which would be a second (inverse) escaping implementation.
 *  - Anchors come from `render(entry).headings` — the ids Astro's
 *    `rehypeHeadingIds` actually assigned — matched to scenarios in document
 *    order (mapping contract §5). No heading slug is computed here.
 *
 * SOURCE RESOLUTION: a route cannot see the integration's `gherkin` options, so
 * the two that shape `sources[0].resource` are route options with the SAME names,
 * semantics and defaults: `sourceRoot` (default the site root, `process.cwd()`)
 * and `sourceUrlPrefix` (stripped from the resource before resolving). Pass the
 * values you gave `gherkin`. A source that cannot be found, has changed since its
 * page was generated (the `generated.at` content hash disagrees), or whose
 * scenarios have no matching rendered heading is a BUILD ERROR naming the page —
 * never a silent omission.
 *
 * PARSE-ONCE: parsed files are memoised at module level by absolute path and
 * re-validated against each page's `generated.at` hash, so a build parses each
 * referenced file once and a dev-server edit is never served stale.
 *
 * ORDER: features by `id` (code-unit); scenarios in document order.
 */
import path from 'node:path';
import process from 'node:process';
import { statSync } from 'node:fs';
import type { APIRoute } from 'astro';
import { getCollection, render } from 'astro:content';
import type { GherkinDocument, Scenario, Tag } from '@cucumber/messages';
import type { DocKittyFrontmatter } from '../metadata.js';
import { sectionOf, slugFromEntryId } from '../metadata.js';
import { compareCodeUnit, routeOfSlug } from '../vocabulary-core.mjs';
import { feedsSurface, resolveSectionRegistry, sectionFeeds } from '../sections.js';
import { GHERKIN_LOG_PREFIX, loadFeatures, type FeatureFile } from '../gherkin/load.mjs';
import { headingKey } from '../gherkin/text.mjs';
import { normalizeResultsOption } from '../gherkin/options.mjs';
import { featureResults, type Outcome } from '../gherkin/results.mjs';
import { loadReport } from '../gherkin/results-load.mjs';
import { featureView } from '../gherkin/view.mjs';
import { GENERATED_BY } from '../gherkin/feature-core.mjs';
import { isScenarioIndexed } from './scenario-index-filter.js';
import { absolute, docsRoot } from './shared.js';

export interface ScenarioIndexRouteOptions {
  /**
   * Directory `sources[0].resource` paths are relative to, itself relative to
   * the site root (`process.cwd()` at build). Default `'.'`. MUST equal the
   * `gherkin.sourceRoot` integration option.
   */
  sourceRoot?: string;
  /**
   * The `gherkin.sourceUrlPrefix` integration option, if set: stripped from the
   * front of each `sources[0].resource` before it is resolved against
   * `sourceRoot`.
   */
  sourceUrlPrefix?: string;
  /** Bump when the emitted shape changes so consumers can branch on it. */
  version?: string;
  /**
   * The `gherkin.results` integration option, if set (ADR-0052): each scenario
   * then carries its `result`, each Examples table its row `results`, and the
   * index a top-level `results` block naming the run. Same shape and meaning:
   * a report path, or `{ report, root }`.
   */
  results?: string | { report: string; root?: string };
}

/** A scenario's (or outline's) result (ADR-0052). */
export interface ScenarioResult {
  /** `passed`, `failed`, `ambiguous`, `undefined`, `pending`, `skipped` or `not-run`. */
  status: string;
  /** True when it passed after an earlier attempt that did not (Messages reports only). */
  retried?: boolean;
  /** An outline's rows by status. */
  counts?: Record<string, number>;
}

/** One step, keyword trimmed, text as written (outline placeholders kept). */
export interface ScenarioStep {
  keyword: string;
  text: string;
}

/** One Examples table of an outline; rows are NOT expanded into scenarios. */
export interface ScenarioExamples {
  name: string;
  tags: string[];
  header: string[];
  rows: string[][];
  /** With a results report: each row's status, in row order (ADR-0052). */
  results?: string[];
}

export interface ScenarioRecord {
  name: string;
  /** The enclosing `Rule:` name, or `null` for a scenario outside any rule. */
  rule: string | null;
  /** The rendered heading id on the feature page (`#<anchor>`). */
  anchor: string;
  /** 1-based line of the `Scenario:` keyword in the source file. */
  line: number;
  /** The scenario's OWN tags, without `@`, de-duplicated, code-unit sorted. */
  tags: string[];
  /** True when the scenario has Examples (the pickle compiler's outline rule). */
  outline: boolean;
  steps: ScenarioStep[];
  examples: ScenarioExamples[];
  /** With a results report that covers the file (ADR-0052). */
  result?: ScenarioResult;
}

export interface FeatureRecord {
  id: string;
  title: string;
  url: string;
  source: string;
  doc_status: string;
  glossary_context: string | null;
  tags: string[];
  related: string[];
  scenarios: ScenarioRecord[];
  /**
   * With a results report that names the file: `current` (scenarios carry
   * results) or `stale` (the report is for another version of the file, so
   * none are given).
   */
  results?: 'current' | 'stale';
}

/** The `{ depth, slug, text }` shape of Astro's `render(entry).headings`. */
export interface RenderedHeading {
  depth: number;
  slug: string;
  text: string;
}

export { isScenarioIndexed } from './scenario-index-filter.js';

/** A resource carrying a URL scheme (`https://…`), as opposed to a path. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Resolve a page's `sources[0].resource` to the absolute `.feature` path, the
 * inverse of the generator's `sourceUrlPrefix + relative(sourceRoot, absPath)`.
 * Throws when the resource is a URL the configured prefix does not explain.
 */
export function resolveSourcePath(
  resource: string,
  opts: { sourceRoot: string; sourceUrlPrefix?: string; page: string },
): string {
  let rel = resource;
  if (opts.sourceUrlPrefix && rel.startsWith(opts.sourceUrlPrefix)) {
    rel = rel.slice(opts.sourceUrlPrefix.length);
  } else if (URL_SCHEME.test(rel)) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} scenario index: ${opts.page} cites source ${JSON.stringify(resource)}, ` +
        `a URL; pass the gherkin \`sourceUrlPrefix\` (and \`sourceRoot\`) to scenarioIndexRoute({ … })`,
    );
  }
  return path.resolve(opts.sourceRoot, ...rel.split('/'));
}

/** Tag names without `@`, de-duplicated, code-unit sorted. */
function tagNames(tags: readonly Tag[] | undefined): string[] {
  return [...new Set((tags ?? []).map((t) => t.name.replace(/^@/, '')))].sort(compareCodeUnit);
}

/** The renderer's heading title: `<Keyword>: <name>`, or the bare keyword. */
function headingTitle(keyword: string, name: string): string {
  const n = name.trim();
  return n ? `${keyword.trim()}: ${n}` : keyword.trim();
}

/**
 * Project a parsed feature's scenarios, in document order, attaching each one's
 * anchor from the page's RENDERED headings. A scenario renders as `##` outside a
 * rule and `###` inside one (mapping contract §4); each is matched to the next
 * heading at that depth with the same title, so a description that happens to
 * contain a heading is skipped rather than mis-matched. No match is fatal: the
 * page is out of date with its source.
 */
export function scenarioRecords(
  document: GherkinDocument,
  headings: readonly RenderedHeading[],
  ctx: { page: string; source: string },
): ScenarioRecord[] {
  const feature = document.feature;
  if (!feature) return [];
  const items: Array<{ scenario: Scenario; rule: string | null; depth: number }> = [];
  for (const child of feature.children) {
    if (child.scenario) items.push({ scenario: child.scenario, rule: null, depth: 2 });
    if (child.rule) {
      for (const rc of child.rule.children) {
        if (rc.scenario) {
          items.push({ scenario: rc.scenario, rule: child.rule.name.trim(), depth: 3 });
        }
      }
    }
  }

  let cursor = 0;
  return items.map(({ scenario, rule, depth }) => {
    const want = headingKey(headingTitle(scenario.keyword, scenario.name));
    let at = -1;
    for (let i = cursor; i < headings.length; i += 1) {
      if (headings[i].depth === depth && headingKey(headings[i].text) === want) {
        at = i;
        break;
      }
    }
    if (at === -1) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} scenario index: ${ctx.page} has no rendered heading for ` +
          `"${headingTitle(scenario.keyword, scenario.name)}" (${ctx.source}:${scenario.location.line}); ` +
          `the generated page is out of date with its source — regenerate it`,
      );
    }
    cursor = at + 1;
    return {
      name: scenario.name.trim(),
      rule,
      anchor: headings[at].slug,
      line: scenario.location.line,
      tags: tagNames(scenario.tags),
      outline: scenario.examples.length > 0,
      steps: scenario.steps.map((step) => ({ keyword: step.keyword.trim(), text: step.text })),
      examples: scenario.examples.map((ex) => ({
        name: ex.name.trim(),
        tags: tagNames(ex.tags),
        header: ex.tableHeader ? ex.tableHeader.cells.map((c) => c.value) : [],
        rows: ex.tableBody.map((row) => row.cells.map((c) => c.value)),
      })),
    };
  });
}

/** Parsed `.feature` files by absolute path (parse-once; see the module doc). */
const parsedFeatures = new Map<string, FeatureFile>();

/** Does `file`'s content hash match the page's `generated.at` stamp? */
function hashMatches(file: FeatureFile, at: string | undefined): boolean {
  if (!at) return true;
  const want = at.replace(/^sha256:/, '');
  return want !== '' && file.sha256.startsWith(want);
}

/**
 * Parse (or reuse) every wanted `.feature`. Unparsed or stale files are loaded
 * in ONE `loadFeatures` call over the minimal set of their parent directories
 * (a directory under another wanted directory is covered by the walk of that
 * ancestor), so each file is parsed once.
 */
function ensureParsed(
  wanted: ReadonlyArray<{ absPath: string; at?: string; page: string; source: string }>,
  sourceRoot: string,
): void {
  const missing = wanted.filter((w) => {
    const file = parsedFeatures.get(w.absPath);
    return !file || !hashMatches(file, w.at);
  });
  if (missing.length === 0) return;

  for (const w of missing) {
    if (!statSync(w.absPath, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} scenario index: ${w.page} cites source ${JSON.stringify(w.source)}, ` +
          `resolved to ${w.absPath}, which does not exist; pass the gherkin \`sourceRoot\`/` +
          `\`sourceUrlPrefix\` options to scenarioIndexRoute({ … })`,
      );
    }
  }

  const dirs = [...new Set(missing.map((w) => path.dirname(w.absPath)))].sort(compareCodeUnit);
  const roots: string[] = [];
  for (const dir of dirs) {
    if (!roots.some((r) => dir === r || dir.startsWith(r + path.sep))) roots.push(dir);
  }
  const model = loadFeatures({ sources: roots, root: sourceRoot });
  for (const file of model.files) parsedFeatures.set(file.absPath, file);
}

/** The page frontmatter this route reads (`glossary_context` is schema-only). */
type FeaturePageData = DocKittyFrontmatter & { glossary_context?: string };

/** The structural slice of a `CollectionEntry<'docs'>` this route reads. */
interface ContentEntry {
  id: string;
  data: unknown;
}

/** An outcome as the index serves it. */
function resultRecord(outcome: Outcome): ScenarioResult {
  return {
    status: outcome.status,
    ...(outcome.retried ? { retried: true } : {}),
    ...(outcome.counts ? { counts: { ...outcome.counts } as Record<string, number> } : {}),
  };
}

/**
 * Add a feature's results to its record (ADR-0052), from the same report and
 * by the same rules as the pages: matched by file and line, never from a
 * report made for another version of the file.
 */
function attachResults(
  record: FeatureRecord,
  file: FeatureFile,
  report: Extract<ReturnType<typeof loadReport>, { ok: true }>,
): void {
  const found = report.index.lookup(path.relative(process.cwd(), file.absPath).split(path.sep).join('/'));
  if (!found || !('file' in found)) return;
  const view = featureView(file.document);
  if (!view) return;
  const results = featureResults(found.file, { text: file.bytes, view, run: report.report.run });
  record.results = results.state;
  if (results.state !== 'current') return;
  const scenarios = [...(file.document.feature?.children ?? [])].flatMap((child) =>
    child.scenario ? [child.scenario] : (child.rule?.children ?? []).flatMap((rc) => (rc.scenario ? [rc.scenario] : [])),
  );
  record.scenarios.forEach((scenarioRecord, i) => {
    const scenario = scenarios[i];
    const outcome = scenario ? results.scenarios.get(scenario.location.line) : undefined;
    if (outcome) scenarioRecord.result = resultRecord(outcome);
    scenarioRecord.examples.forEach((ex, j) => {
      const rows = scenario?.examples[j]?.tableBody ?? [];
      ex.results = rows.map((row) => (results.rows.get(row.location.line) ?? { status: 'not-run' }).status);
    });
  });
}

export function scenarioIndexRoute(options: ScenarioIndexRouteOptions = {}): APIRoute {
  return async ({ site }) => {
    // The same section `feeds` filter `/api/index.json` applies (absent registry
    // or a section omitting `feeds` → no filtering), on top of draft gating.
    const registry = resolveSectionRegistry(await docsRoot());
    const feeds = registry ? sectionFeeds(registry) : undefined;
    const entries = (await getCollection('docs')) as unknown as ContentEntry[];
    const pages = entries
      .map((entry) => ({
        entry,
        slug: slugFromEntryId(entry.id),
        data: entry.data as FeaturePageData,
      }))
      .filter(
        ({ slug, data }) => isScenarioIndexed(data) && feedsSurface(feeds, sectionOf(slug), 'agent'),
      )
      .sort((a, b) => compareCodeUnit(a.slug, b.slug));

    const sourceRoot = path.resolve(process.cwd(), options.sourceRoot ?? '.');
    const located = pages.map((p) => {
      const source = p.data.sources?.[0]?.resource;
      if (!source) {
        throw new Error(
          `${GHERKIN_LOG_PREFIX} scenario index: ${p.slug} is a generated feature page with no ` +
            '`sources[0].resource`; regenerate it',
        );
      }
      const absPath = resolveSourcePath(source, {
        sourceRoot,
        sourceUrlPrefix: options.sourceUrlPrefix,
        page: p.slug,
      });
      return { ...p, source, absPath, at: p.data.generated?.at };
    });
    ensureParsed(
      located.map(({ absPath, at, slug, source }) => ({ absPath, at, page: slug, source })),
      sourceRoot,
    );

    // ADR-0052: the report, read once per request (memoised by file version).
    const resultsOption = options.results ? normalizeResultsOption(options.results, 'scenarioIndexRoute results') : undefined;
    const report = resultsOption ? loadReport(resultsOption, { projectRoot: process.cwd() }) : undefined;

    const features: FeatureRecord[] = [];
    for (const p of located) {
      const file = parsedFeatures.get(p.absPath);
      if (!file) {
        throw new Error(
          `${GHERKIN_LOG_PREFIX} scenario index: ${p.slug} cites ${JSON.stringify(p.source)}, ` +
            'which has no Feature',
        );
      }
      if (!hashMatches(file, p.at)) {
        throw new Error(
          `${GHERKIN_LOG_PREFIX} scenario index: ${p.source} changed since ${p.slug} was generated ` +
            `(${p.at}); regenerate the feature pages`,
        );
      }
      const { headings } = await render(p.entry as Parameters<typeof render>[0]);
      features.push({
        id: p.slug,
        title: p.data.title,
        url: absolute(site, routeOfSlug(p.slug)),
        source: p.source,
        doc_status: p.data.doc_status ?? 'draft',
        glossary_context: p.data.glossary_context ?? null,
        tags: p.data.tags ?? [],
        // Raw ref slugs (a `{ ref, note }` entry contributes its `ref`); the
        // resolved objects live in `/api/index.json`.
        related: (p.data.related ?? []).map((r) => (typeof r === 'string' ? r : r.ref)),
        scenarios: scenarioRecords(file.document, headings, { page: p.slug, source: p.source }),
      });
      if (report?.ok) attachResults(features[features.length - 1], file, report);
    }

    const body = {
      version: options.version ?? '1',
      generated_from: GENERATED_BY,
      count: features.length,
      ...(report?.ok && resultsOption
        ? {
            results: {
              report: resultsOption.report,
              format: report.report.format,
              ...(report.report.run.date ? { as_of: report.report.run.date } : {}),
              ...(report.report.run.revision ? { revision: report.report.run.revision } : {}),
            },
          }
        : {}),
      features,
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}

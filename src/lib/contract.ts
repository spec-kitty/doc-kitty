/**
 * The published contract of DocKitty's machine artifacts — TYPES ONLY.
 *
 * This module mirrors, field for field, the JSON the generator routes emit:
 *
 *   - {@link AgentIndex}       - `/api/index.json`       (`agentIndexRoute`)
 *   - {@link AgentPagePayload} - `/api/pages/<id>.json`  (`agentPageRoute`)
 *   - {@link ScenarioIndex}    - `/api/scenarios.json`   (`scenarioIndexRoute`)
 *
 * It exists so an out-of-process consumer (the MCP server,
 * `doc-kitty-mcp-server` WP02+) can `import type` the exact shapes WITHOUT
 * importing the package root — the root transitively imports `astro:content`,
 * which does not resolve outside an Astro build (mission squad A1). Its purity
 * rule is therefore absolute and test-enforced:
 *
 *   ZERO imports, ZERO runtime code. Only `export interface` / `export type`.
 *
 * (`src/tests/contract-module.test.ts` scans this file for any import and
 * compiles a scratch project importing nothing else from it under plain
 * `tsc --noEmit`.)
 *
 * The routes are retyped against these interfaces (WP01/T002): each route
 * annotates the object it serialises with the matching contract type, so the
 * emitted JSON and this published type cannot drift without a build-time type
 * error. The enumeration below was verified 2026-11-01 against a real
 * `example/dist/api/` build: `generatedFrom` and every per-page
 * `generated`/`verified`/`sources`/`includes` follow the current emitters;
 * `scenarios.json` carries snake_case `generated_by` and a STRING `version`.
 */
export interface AgentLink {
  href: string;
}

/** A link carrying a human-readable title (the `_links.related` entries). */
export interface AgentTitledLink extends AgentLink {
  title: string;
}

/**
 * The opt-in MCP wiring pointer (WP01/T005, FR-009): how an agent launches the
 * generic DocKitty MCP server against this site. Emitted at `_links.mcp` on
 * the machine index when the site opts in via `links.mcp`; until the C-002
 * publishing ruling the `usage` string documents the packed-tarball launch
 * form (the installed `doc-kitty-mcp` bin), not an npmjs `npx` line.
 */
export interface McpWiringPointer extends AgentLink {
  /** Display title of the pointed-at service. */
  title: string;
  /** Space-separated launch command with this site's base URL substituted. */
  usage: string;
}

/**
 * One section listing entry (WP01/T003, FR-003), projected from the section
 * registry (`<docsRoot>/_meta/sections.yaml` or a charter's `sections.entries`)
 * in registry order. A site without a registry emits `sections: []`.
 */
export interface SectionRecord {
  /** Section id — the top-level folder slug under the docs root. */
  id: string;
  /** Display label. */
  label: string;
  /** Integer sort key; lower first. */
  order: number;
  /** One-line section purpose, when authored. */
  purpose?: string;
}

/** One resolved `related` reference as embedded in a page record/payload. */
export interface ResolvedRelatedRecord {
  ref: string;
  title: string;
  kind: string;
  doc_status: string;
}

/** One `audience` entry: a reader profile slug + page-local guidance. */
export interface AudienceRecord {
  profile: string;
  guidance_text: string;
}

/** Per-record navigation links in the machine index. */
export interface AgentRecordLinks {
  /** Per-page JSON source. Absent when the site sets `links.pages: false`. */
  self?: AgentLink;
  /** The rendered HTML page. */
  html: AgentLink;
  /** Resolved `related` refs as links, in authored order. */
  related: AgentTitledLink[];
}

/**
 * One page record of `/api/index.json`'s `pages[]` (FR-003). `route` and
 * `source` are the BASE-LESS contract strings combined with the site base by
 * the consumer — except `source` and `url`, which the index emitter resolves
 * to absolute URLs; `source` points at the per-page JSON artifact.
 */
export interface AgentRecordEntry {
  slug: string;
  route: string;
  section: string;
  title: string;
  description: string;
  type: string | null;
  doc_status: string;
  kind: string;
  tags: string[];
  related: ResolvedRelatedRecord[];
  priority: number;
  /** Full UTC instant (YYYY-MM-DDTHH:MM:SSZ) or null when unauthored. */
  updated: string | null;
  /** Absolute URL of this page's per-page JSON artifact. */
  source: string;
  audience: AudienceRecord[];
  /** Absolute URL of the rendered page. */
  url: string;
  _links: AgentRecordLinks;
}

/** Top-level navigation links of the machine index. */
export interface IndexLinks {
  self: AgentLink;
  llms: AgentLink;
  sitemap: AgentLink;
  /** Always emitted: the integration injects the content-graph route (#176). */
  contentGraph: AgentLink;
  rss?: AgentLink;
  bibliography?: AgentLink;
  scenarios?: AgentLink;
  /** Present only when the site opts in with `links.mcp` (FR-009). */
  mcp?: McpWiringPointer;
}

/** The machine index, `/api/index.json`. */
export interface AgentIndex {
  title: string;
  /** Contract major handshake; consumers branch on it (today `"3"`). */
  version: string;
  count: number;
  /**
   * Build identity (WP01/T004, FR-008): sha256 over a canonical serialization
   * of the corpus' source inputs, identical on every artifact of one build —
   * compare it across everything loaded to detect a torn corpus read.
   */
  buildId: string;
  /** Present on every current emission; optional for pre-FR-008 corpora. */
  generatedFrom?: string;
  sections: SectionRecord[];
  pages: AgentRecordEntry[];
  _links: IndexLinks;
}

/** A generated-page stamp (`generated:` frontmatter, FR-008/#177). */
export interface PageGeneratedStamp {
  by: string;
  at: string;
  content_hash?: string;
}

/** A `verified:` frontmatter stamp entry. */
export interface PageVerifiedStamp {
  by: string;
  at: string;
}

/** A `sources:` frontmatter entry. */
export interface PageSourceRef {
  resource: string;
  title: string;
}

/** One `::gherkin` include's attributes as the payload lists them (ADR-0051). */
export interface AgentIncludeRef {
  src: string;
  scenario?: string;
  tags?: string;
}

/** Per-page navigation links. */
export interface AgentPageLinks {
  /** This per-page JSON artifact itself. */
  self: AgentLink;
  /** The machine index. Absent when the site sets `links.index: false`. */
  up?: AgentLink;
  html: AgentLink;
  related: AgentTitledLink[];
}

/**
 * The per-page detail artifact, `/api/pages/<id>.json`: every
 * {@link AgentRecordEntry} field plus the raw Markdown body and the
 * page-local enrichments. Optional enrichments are OMITTED when absent
 * (`generated`/`verified`/`sources` follow the frontmatter; `includes` only
 * when the page carries at least one `::gherkin` include).
 */
export interface AgentPagePayload {
  slug: string;
  route: string;
  section: string;
  title: string;
  description: string;
  type: string | null;
  doc_status: string;
  kind: string;
  tags: string[];
  related: ResolvedRelatedRecord[];
  priority: number;
  updated: string | null;
  source: string;
  audience: AudienceRecord[];
  url: string;
  authors: string[];
  keywords: string[];
  generated?: PageGeneratedStamp;
  verified?: PageVerifiedStamp[];
  sources?: PageSourceRef[];
  includes?: AgentIncludeRef[];
  /** Raw Markdown source with every `::gherkin` include expanded. */
  markdown: string;
  /** The build identity; equal to the index's `buildId` of the same build. */
  buildId: string;
  _links: AgentPageLinks;
}

/** A scenario's (or outline's) result (ADR-0055). */
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
  /** With a results report: each row's status, in row order (ADR-0055). */
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
  /** With a results report that covers the file (ADR-0055). */
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
  /** Raw ref slugs; the resolved objects live in `/api/index.json`. */
  related: string[];
  scenarios: ScenarioRecord[];
  /**
   * With a results report that names the file: `current` (scenarios carry
   * results) or `stale` (the report is for another version of the file, so
   * none are given).
   */
  results?: 'current' | 'stale';
}

/** The top-level `results` block naming the report the scenarios index used. */
export interface ScenarioRunInfo {
  report: string;
  format: string;
  as_of?: string;
  revision?: string;
}

/** The scenario index, `/api/scenarios.json` (ADR-0046). */
export interface ScenarioIndex {
  /** The emitted shape's version; a STRING on the wire (today `"2"`). */
  version: string;
  /** The producer as an OKF tool actor: `doc-kitty-gherkin/<version>`. */
  generated_by: string;
  count: number;
  /** The build identity; equal to the index's `buildId` of the same build. */
  buildId: string;
  /** Present only when the route is given a results report (ADR-0055). */
  results?: ScenarioRunInfo;
  features: FeatureRecord[];
}

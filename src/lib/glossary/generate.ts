/**
 * Glossary page generator — codegen INTO the docs collection (ADR-0026 Decision 3,
 * AS-6, FR-013). From the one {@link SharedTermIndex} the loader built, this writes
 * real Markdown files under `<outDocsDir>/glossary/`:
 *
 *   - `glossary/index.md`            — the hub (`kind: Hub`) listing every context.
 *   - `glossary/<slug>/index.md`     — one page per context (`kind: Glossary`,
 *                                       self-declared `glossary_context`).
 *
 * Because the files land under the globbed `docs/` base, the existing
 * `glob({ base: 'docs' })` loader ingests them, so the sidebar (via Starlight
 * tree-autogeneration of the `docs/glossary/` folder), sitemap draft-filter, agent
 * API, and `llms.txt` pick them up with **zero new wiring** — the reason an injected
 * route was rejected (an `injectRoute` here would be a review finding).
 *
 * This module is **pure** (Astro-free) and a function of the index alone:
 *
 *   - **Presence-gated** (INV-G4): an absent/empty index writes nothing, returns `[]`.
 *   - **Deterministic + idempotent** (NFR-004, INV-G2): contexts are emitted in a
 *     stable name-sorted order and meta keys are sorted, so the same index yields
 *     byte-identical files on every run — no `Date.now()`, no Map-iteration reliance.
 *   - Definitions/meta are emitted as Markdown **body** (never pre-escaped plain
 *     text) so FR-003/FR-004 route them through the site's real markdown pipeline;
 *     each term sits at a deterministic `#<anchor>` from the shared
 *     {@link slug} (a second slug impl would be a finding).
 *
 * It is **wired** by WP08's config hook (not here) and **dormant** until WP09 lands
 * the example `.contextive/definitions.yaml`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SharedTermIndex, Term } from './types.js';
import { slug } from './anchor.js';

/** YAML-safe double-quoted scalar (handles quotes, backslashes, colons, unicode). */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Serialize a small ordered field map as a `---` frontmatter block. */
function frontmatter(fields: Array<[string, string]>): string {
  const lines = fields.map(([key, value]) => `${key}: ${value}`);
  return ['---', ...lines, '---'].join('\n');
}

/** Render a term's `meta` (URLs already scheme-checked in WP01) as a Markdown list. */
function renderMeta(meta: Record<string, string>): string[] {
  const keys = Object.keys(meta).sort();
  if (keys.length === 0) return [];
  const items = keys.map((key) => {
    const value = meta[key];
    // Values are hrefs (FR-004, already scheme-checked build-fatal in WP01). Render
    // a CLEAN http(s) URL as a Markdown link; render anything else as inert inline
    // code, NOT verbatim Markdown. Post-squad security MED: a verbatim non-http(s)
    // value that is itself Markdown-link syntax (e.g. `[x](javascript:alert(1))`)
    // passes safeHref as a "relative" link and would re-parse into a live
    // `javascript:` href; a crafted http(s) value with trailing `](…)` could break
    // out of the link too. Requiring a whitespace/bracket/backtick-free URL for the
    // link branch, and inline-coding everything else, closes both — the markdown
    // pipeline treats inline-code content as literal text, no href forms.
    const isCleanUrl = /^https?:\/\/\S+$/i.test(value) && !/[()[\]`<>]/.test(value);
    const rendered = isCleanUrl
      ? `[${value}](${value})`
      : `\`${value.replace(/`/g, "'")}\``;
    return `- **${key}:** ${rendered}`;
  });
  return ['**Meta:**', '', ...items];
}

/** Render one term as a Markdown section anchored at `slug(name)`. */
function renderTerm(term: Term): string[] {
  const anchor = slug(term.name);
  const blocks: string[] = [`## ${term.name} {#${anchor}}`, '', term.definition];

  if (term.aliases && term.aliases.length > 0) {
    blocks.push('', `**Aliases:** ${term.aliases.join(', ')}`);
  }
  if (term.examples && term.examples.length > 0) {
    blocks.push('', '**Examples:**', '', ...term.examples.map((ex) => `- ${ex}`));
  }
  if (term.meta) {
    const meta = renderMeta(term.meta);
    if (meta.length > 0) blocks.push('', ...meta);
  }
  return blocks;
}

/** The hub page body: a bullet list linking every context (name-sorted). */
function renderHub(contexts: Array<{ name: string; slug: string; vision?: string }>): string {
  const items = contexts.map(({ name, slug: contextSlug, vision }) => {
    const link = `- [${name}](./${contextSlug}/)`;
    return vision ? `${link} — ${vision}` : link;
  });
  const body = frontmatter([
    ['title', yamlString('Glossary')],
    ['description', yamlString('Bounded-context vocabulary for this documentation.')],
    ['kind', 'Hub'],
    ['doc_status', 'active'],
  ]);
  return (
    `${body}\n\n# Glossary\n\n` +
    'The vocabulary of each bounded context. Terms are grouped by the context that ' +
    'owns them.\n\n' +
    `${items.join('\n')}\n`
  );
}

/** A single context page: self-declared `glossary_context`, vision, term sections. */
function renderContextPage(name: string, vision: string | undefined, terms: Term[]): string {
  const head = frontmatter([
    ['title', yamlString(name)],
    ['description', yamlString(`Glossary terms for the ${name} context.`.slice(0, 180))],
    ['kind', 'Glossary'],
    ['glossary_context', yamlString(name)],
    ['doc_status', 'active'],
  ]);

  const sections: string[] = [`# ${name}`];
  if (vision) sections.push('', vision);
  for (const term of terms) sections.push('', ...renderTerm(term));

  return `${head}\n\n${sections.join('\n')}\n`;
}

/**
 * Codegen the glossary hub + per-context pages into `<outDocsDir>/glossary/`.
 *
 * @param index      the shared term index (from the WP01 loader).
 * @param outDocsDir the docs-collection base to write under (e.g. repo-root `docs`).
 * @returns the written file paths (hub first, then contexts name-sorted); `[]` when
 *          the index is absent or has no contexts (presence gate, INV-G4).
 */
export function generateGlossaryPages(index: SharedTermIndex, outDocsDir: string): string[] {
  // Presence gate (INV-G4): nothing to generate → write nothing, return [].
  if (!index || index.contexts.size === 0) return [];

  // Stable name-sorted context order → byte-identical output run-to-run (NFR-004).
  const contexts = [...index.contexts.entries()]
    .map(([name, data]) => ({ name, slug: data.slug, vision: data.domainVisionStatement, terms: data.terms }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const glossaryDir = join(outDocsDir, 'glossary');
  const written: string[] = [];

  mkdirSync(glossaryDir, { recursive: true });
  const hubPath = join(glossaryDir, 'index.md');
  writeFileSync(hubPath, renderHub(contexts), 'utf8');
  written.push(hubPath);

  for (const context of contexts) {
    const contextDir = join(glossaryDir, context.slug);
    mkdirSync(contextDir, { recursive: true });
    const pagePath = join(contextDir, 'index.md');
    writeFileSync(pagePath, renderContextPage(context.name, context.vision, context.terms), 'utf8');
    written.push(pagePath);
  }

  return written;
}

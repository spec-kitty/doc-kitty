/**
 * `llmsTxtRoute` — an llms.txt index (https://llmstxt.org) of the docs, grouped
 * by Common Docs section in progressive-disclosure order and ordered within a
 * section by agent priority. Discovery, not RAG: each line points an agent at a
 * page; the machine index carries the full metadata.
 *
 * Mount as `src/pages/llms.txt.ts`:
 *
 *   import { llmsTxtRoute } from '@commondocs-kitty/toolkit/routes';
 *   export const GET = llmsTxtRoute({ title: 'My Docs', description: '…' });
 */
import type { APIRoute } from 'astro';
import {
  rankForAgents,
  sectionOf,
  sectionRank,
  sectionLabel,
  type IndexBasenameOption,
} from '../metadata.js';
import { compareCodeUnit } from '../vocabulary-core.mjs';
import {
  loadSectionRegistry,
  sectionLabels,
  sectionOrder,
  sectionPurposes,
  sectionFeeds,
  feedsSurface,
} from '../sections.js';
import { DESCRIPTION_MAX } from '../schema.js';
import { absolute, docsRoot } from './shared.js';
import { collectDocEntries } from '../docs-index.js';

export interface LlmsTxtRouteOptions {
  title: string;
  description?: string;
  /**
   * The section-index basename(s) (FR-003): forwarded to `docsRoot()` so the
   * registry (order/labels/purposes) resolves from the SAME root the content
   * loader used, when a custom `indexBasename` moves that root's derivation
   * (e.g. an `index.md`-only docs tree). The per-entry blurb detection below is
   * basename-agnostic by construction — it keys off the already-resolved entry
   * `slug` shape, not a raw filename — so no other change is needed here.
   */
  indexBasename?: IndexBasenameOption;
}

export function llmsTxtRoute(options: LlmsTxtRouteOptions): APIRoute {
  return async ({ site }) => {
    // The section registry (<docsRoot>/_meta/sections.yaml) drives order + labels
    // when present; a registry-free root falls back to the SECTION_ORDER/
    // SECTION_LABEL defaults inside the metadata helpers (issue #18). The root is
    // resolved from the content layer so a custom docs directory is honored (#22),
    // not hardcoded to `docs/`.
    const registry = loadSectionRegistry(await docsRoot(options.indexBasename));
    const order = registry ? sectionOrder(registry) : undefined;
    const labels = registry ? sectionLabels(registry) : undefined;
    // Section blurb source (FALLBACK): the registry `purpose` per section — the
    // emitted blurb is the section README description ?? this purpose (README
    // wins). Empty when there is no registry.
    const purposes: Record<string, string> = registry ? sectionPurposes(registry) : {};
    // Section-level `feeds` filter, composed ON TOP of the per-page
    // `agent.discoverable` gating rankForAgents applies: a section omitting
    // `feeds` feeds all four surfaces (absent = all); an absent registry →
    // `feeds` undefined → no filtering (byte-compatible).
    const feeds = registry ? sectionFeeds(registry) : undefined;
    const all = await collectDocEntries();
    const ranked = rankForAgents(all, order).filter((entry) =>
      feedsSurface(feeds, sectionOf(entry.slug), 'llms'),
    );

    // The section README description, keyed by section id — the PREFERRED blurb.
    // A section README's route slug IS the section id (README-as-index), so an
    // entry whose slug equals its own section is that section's README. Read from
    // the FULL corpus so the blurb is available even if the README opts out of
    // agent discovery. README description wins; the registry `purpose` is the
    // fallback (see the per-group emit below).
    const readmeDescriptions = new Map<string, string>();
    for (const entry of all) {
      if (
        entry.slug !== '' &&
        sectionOf(entry.slug) === entry.slug &&
        entry.data.description
      ) {
        readmeDescriptions.set(entry.slug, entry.data.description);
      }
    }

    const lines: string[] = [`# ${options.title}`, ''];
    if (options.description) lines.push(`> ${options.description}`, '');
    lines.push(`Full machine index: ${absolute(site, '/api/index.json')}`, '');

    // Group by section, preserving the section order rankForAgents produced.
    const sections = new Map<string, typeof ranked>();
    for (const entry of ranked) {
      const section = sectionOf(entry.slug);
      const bucket = sections.get(section) ?? [];
      bucket.push(entry);
      sections.set(section, bucket);
    }

    // Section order: registry rank first, then a code-unit tiebreak on the
    // section key so two sections that tie on rank (e.g. both unregistered) order
    // deterministically from the keys alone rather than by Map-insertion order
    // (#88/FR-002). Byte-neutral on the demonstrator (at most one unregistered
    // section, so the tiebreak never fires).
    const orderedSections = [...sections.keys()].sort(
      (a, b) => sectionRank(a, order) - sectionRank(b, order) || compareCodeUnit(a, b),
    );

    for (const section of orderedSections) {
      const heading = sectionLabel(section, labels) ?? section;
      lines.push(`## ${heading}`, '');
      // Section blurb: the README description ?? the registry purpose (README
      // wins). Neither → no blurb line at all (no empty line). Emitted as a plain
      // paragraph after the H2 and before the page list, matching the llms.txt
      // section shape (the file-level `> summary` blockquote stays H1-only).
      // `purpose` comes from sections.yaml and is otherwise unvalidated, so
      // sanitize before emitting: collapse whitespace/newlines (kills multi-line
      // injection of fake sections/entries), strip any leading Markdown structural
      // marker (`#`/`>`/`-`/`*` — so a `purpose: "## x"` can't forge a heading),
      // and cap length — matching the single-line, length-bounded discipline of a
      // page `description`.
      const rawBlurb = readmeDescriptions.get(section) ?? purposes[section];
      const blurb = rawBlurb
        ?.replace(/\s+/g, ' ')
        .trim()
        .replace(/^[#>\-*\s]+/, '')
        .slice(0, DESCRIPTION_MAX);
      if (blurb) lines.push(blurb, '');
      for (const entry of sections.get(section)!) {
        const url = absolute(site, entry.slug === '' ? '/' : `/${entry.slug}/`);
        const note = entry.data.description ? `: ${entry.data.description}` : '';
        lines.push(`- [${entry.data.title}](${url})${note}`);
      }
      lines.push('');
    }

    return new Response(lines.join('\n'), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  };
}

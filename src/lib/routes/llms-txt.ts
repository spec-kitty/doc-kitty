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
  SECTION_LABEL,
} from '../metadata.js';
import { absolute, collectDocEntries } from './shared.js';

export interface LlmsTxtRouteOptions {
  title: string;
  description?: string;
}

export function llmsTxtRoute(options: LlmsTxtRouteOptions): APIRoute {
  return async ({ site }) => {
    const ranked = rankForAgents(await collectDocEntries());

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

    const orderedSections = [...sections.keys()].sort(
      (a, b) => sectionRank(a) - sectionRank(b),
    );

    for (const section of orderedSections) {
      const heading = SECTION_LABEL[section] ?? section;
      lines.push(`## ${heading}`, '');
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

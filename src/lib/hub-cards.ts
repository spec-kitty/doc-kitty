/**
 * A hub's cards, composed from the docs collection (#342, WP04): the one
 * composition `Hub.astro` renders and the paged listing route (`/<hub>/page/N/`)
 * slices, so a hub's page and its listing pages show the same cards. Moved
 * verbatim out of `Hub.astro`, whose output is byte-identical.
 *
 * Child derivation: a child is a collection entry whose PARENT path equals the
 * hub's slug (the pages one level down), published, ordered by section rank then
 * title (`selectHubChildren`), with the ADR-kind children first as ADR cards
 * (`composeHubChildren`: number, status and date from the shared ADR pipeline).
 */
import path from 'node:path';
import process from 'node:process';
import { collectDocEntries } from './docs-index.js';
import { selectHubChildren, composeHubChildren } from './hub-children.mjs';
import { loadAdrIdRule } from '../scripts/generate-adr-index.mjs';
import { resolveSectionRegistry, sectionOrder } from './sections.js';
import type { HubCard } from './hub-pagination.js';

/** The fields of a docs entry the hub composition reads. */
interface HubEntry {
  slug: string;
  body: string;
  data: { title: string; description?: string; kind?: string; doc_status?: string };
}

/** The cards the hub page at `hubSlug` lists, in its listing order. */
export async function composeHubCards(hubSlug: string): Promise<HubCard[]> {
  // Section ordering follows the same registry the sidebar and discovery
  // surfaces read, so the root Hub grid never diverges from them (DIRECTIVE_044).
  // Read from `cwd/docs`, as Hub.astro always did (#426 deferred item 7).
  const docsRoot = path.join(process.cwd(), 'docs');
  const registry = resolveSectionRegistry(docsRoot);
  const order = registry ? sectionOrder(registry) : undefined;
  // INV-1 / US3: a hub lists only PUBLISHED children (`selectHubChildren`).
  // `collectDocEntries` carries the validated frontmatter; the composition's JSDoc
  // types name only the fields it reads, so the entries are narrowed to them.
  const entries = (await collectDocEntries({ withBody: true })) as unknown as ReadonlyArray<HubEntry>;
  const publishedChildren = selectHubChildren(entries, hubSlug, order);
  // ADR children first, by id, with status and date (C-005, #57, #248); then the
  // others in section-rank → title order. Non-ADR cards leave status and date
  // undefined, so their markup is byte-identical to before (T020).
  const { adrCards, others } = composeHubChildren(publishedChildren, { idRule: loadAdrIdRule(docsRoot) });
  const otherCards: HubCard[] = others.map((entry) => ({
    slug: entry.slug,
    title: entry.data.title,
    description: entry.data.description,
    kind: entry.data.kind,
  }));
  return [...(adrCards as HubCard[]), ...otherCards];
}

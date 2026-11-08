/**
 * The version switcher's same-operation mapping (mission
 * openapi-second-slice-01M6WXJ4, WP07; FR-017, SC-003; renderer slug coupling
 * C-007).
 *
 * `switcherEntries` turns the route middleware's nav plus the `DK_OPENAPI`
 * publication handoff into the per-version list `OpenApiVersionNav.astro`
 * renders. The nav (`resolveOpenApiNav`'s seam) carries only labels and
 * verbatim-label routes; the operations the mapping needs live in the
 * publication every build of an `openapi` site writes at config time, so the
 * component reads them through {@link switcherPublication} — the same handoff
 * the `llms.txt` route reads, never a re-read of a file.
 *
 * The mapping mirrors the pinned renderer (starlight-openapi 0.27.0): a version's
 * pages live under `<section>/<label>` with EACH SEGMENT slugified
 * (`getSchemaBasePath`), and an operation page's route is `<base>/operations/`
 * plus the remainder the nav carries (`OpenApiNav.current.operationSlug`, the
 * id — with `/<method>` appended for a same-path duplicate operationId) — the
 * same remainder the materialised list's `Operation.slug` names after its own
 * `operations/` prefix. A dotted label therefore routes to its dot-free slug
 * (`v1.1` → `v11`), which the verbatim nav route is NOT — hence the base is
 * recomputed here, never taken from the nav. A target version keeps the current
 * operation only on an exact slug match; anything else falls back to that
 * version's overview (resolved decision 5).
 */
import { slug } from 'github-slugger';
import { readPublication, type OpenApiPublication } from '../integrations/openapi-publish.js';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import type { OpenApiNav } from './adapters.js';
import type { Operation } from './operations.mjs';
import { flattenText } from './summary.mjs';
import { withBase } from '../with-base.js';

/** One row of the version switcher. */
export interface SwitcherEntry {
  /** The version's label, flattened (FR-028). */
  label: string;
  released: boolean;
  /** The base-prefixed href: the same operation when it exists there, else the overview. */
  href: string;
  /** True for the version whose pages are being read. */
  current: boolean;
}

/**
 * The renderer's base route of a version: `<section>/<label>` with each segment
 * slugified, trailing slash included. Segments that are empty or `.` never match
 * a real route and are dropped before slugging — the renderer's own
 * `getSchemaBasePath` does NOT drop them, but no conforming config can produce
 * one (the `section` rule refuses empty and `.` segments, and a dotted label is
 * refused by the toolkit's label validation, openapi-second-slice WP11), so the
 * drop is a guard, not a behaviour difference. The route is built the way the
 * nav's own `versionRoute` builds its verbatim one (FR-003, issue 134): through
 * `routeOfSlug`, the one owner of the address rule, with `/index` appended so
 * the strip yields the directory route — which also keeps a label that itself
 * slugs to `index` routing to its own directory.
 */
function versionBase(section: string, label: string): string {
  const segments = [...section.split('/'), label].filter((segment) => segment !== '' && segment !== '.');
  return routeOfSlug([...segments.map((segment) => slug(segment)), 'index'].join('/'));
}

/** True when the target version routes an operation with exactly this slug. */
function routesOperation(operationSlug: string | undefined, operations: Operation[]): boolean {
  // `OpenApiNav.current.operationSlug` is the route remainder UNDER `operations/`
  // (WP02's pinned seam, `operationSlugOf`); `Operation.slug` carries the prefix.
  return operationSlug !== undefined && operations.some((operation) => operation.slug === `operations/${operationSlug}`);
}

/**
 * The switcher's rows for the nav a reference page carries: one per version, in
 * the nav's order, each linking the same operation when the target version has
 * it and that version's overview otherwise. Throws `[dk-openapi]` naming the
 * version when the publication does not list it — the two lists come from the
 * same materialised specs, so a miss is a toolkit bug, not a site problem.
 */
export function switcherEntries(nav: OpenApiNav, publication: OpenApiPublication): SwitcherEntry[] {
  return nav.versions.map((version) => {
    const published = publication.versions.find((candidate) => candidate.label === version.label);
    if (!published) {
      throw new Error(
        `[dk-openapi] the version switcher cannot map version "${version.label}": the DK_OPENAPI publication handoff does not list it. This is a DocKitty internal error; please report it.`,
      );
    }
    const operation = routesOperation(nav.current.operationSlug, published.operations)
      ? `operations/${nav.current.operationSlug}/`
      : '';
    return {
      label: flattenText(version.label),
      released: published.released,
      href: withBase(`${versionBase(publication.section, version.label)}${operation}`),
      current: version.label === nav.current.label,
    };
  });
}

/**
 * The publication the switcher maps with, read from the `DK_OPENAPI` handoff at
 * render time. The component only renders on a page the option's own route
 * middleware claimed, so a missing or malformed handoff there is a toolkit bug:
 * fail closed with `[dk-openapi]` instead of linking overviews silently.
 */
export function switcherPublication(): OpenApiPublication {
  const publication = readPublication(process.env[DK_OPENAPI_ENV]);
  if (!publication) {
    throw new Error(
      '[dk-openapi] the version switcher cannot read the DK_OPENAPI publication handoff: it is absent or malformed in this build. This is a DocKitty internal error; please report it.',
    );
  }
  return publication;
}

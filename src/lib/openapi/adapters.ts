/**
 * The adapters that fit `starlight-openapi` into DocKitty (mission
 * openapi-reference-pages, WP03; ADR-0049 addendum, research R7).
 *
 * The renderer is an optional peer that the adopter imports and passes as
 * `openapi.renderer`; the toolkit never imports it. The option contributes the
 * renderer's own Starlight plugin ({@link openApiPlugins} calls `renderer(config)`
 * synchronously) followed by a plugin of its own.
 *
 * Four things the renderer cannot do alone:
 *  - sidebar groups: the renderer swaps a placeholder group for each version's tree.
 *    The placeholders are built here ({@link openApiSidebarGroup}), with no peer;
 *  - description: its page props carry only `title`, and Starlight validates them
 *    against the site's docs schema, which requires a description. Route middleware
 *    runs after that validation and so cannot help. {@link describeOpenApiPage}
 *    supplies it, spliced into the renderer's `getPageProps` by a Vite transform
 *    ({@link patchPageProps}); the schema stays strict for authored pages;
 *  - stylesheet: there is no switch, so a follow-on plugin filters
 *    `starlight-openapi/styles` out of `customCss` ({@link openApiStylesheetFilter});
 *  - version links and the "unreleased" badge: there are no slots, so a route
 *    middleware ({@link resolveOpenApiNav}) hands the data to `PageTitle`.
 *
 * Code samples are off: with them on, each operation page adds scripts the NFR-002
 * waiver does not cover.
 *
 * Second slice (WP02): every function that walked the option's specs now takes
 * the materialised list (`materialiseOpenApiSpecs`, see materialise.mjs), the
 * renderer reads each version's `renderPath`, the virtual module carries the
 * operations, and the extension points of the plan's parallel-edit registry are
 * wired: `buildDoneHooks` after the publisher inside the inner integration,
 * `devHandlers` in `astro:server:setup`, `pagePropsHooks` in the description
 * splice, and `OpenApiNav.current.operationSlug` for the version switcher.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { walkMarkdownPaths } from '../docs-walk.mjs';
import { formatRouteCollisions, resolveIndexEntries, routeOfSlug } from '../vocabulary-core.mjs';
import type { NormalisedOpenApiOptions } from './options.mjs';
import type { MaterialisedSpec } from './materialise.mjs';
import type { Operation } from './operations.mjs';
import { openApiPublishHooks } from '../integrations/openapi-publish.js';
import { openApiDevHandler } from '../integrations/openapi-dev.js';
import { openApiLinkCheck } from '../integrations/openapi-link-check.js';
import { PLACEHOLDER_GROUP_PREFIX } from '../route-shaping.js';
import { buildDoneHooks, devHandlers, pagePropsHooks, registerBuildDoneHook, registerDevHandler, registerSitemapPredicate, unregisterSitemapPredicate } from './materialise.mjs';
import { openApiSitemapPredicate } from './indexing.js';

// The registry's hook seams, re-exported so a later work package imports them
// from here (the plan's table names this file). They live in materialise.mjs,
// dependency-light, so a module pushing to them never pulls this file's
// Starlight-adjacent imports in.
export { buildDoneHooks, devHandlers, pagePropsHooks } from './materialise.mjs';

/** The virtual module that serves the versions to the route middleware. */
export const OPENAPI_MODULE_ID = 'virtual:doc-kitty/openapi';

/** The stylesheet the renderer appends to `customCss`; DocKitty never loads it. */
const OPENAPI_STYLESHEET = 'starlight-openapi/styles';

/**
 * DocKitty's own OpenAPI chrome styles. Added to `customCss` only when the option is
 * set, so a site without it ships the same CSS as before (SC-004).
 */
export const OPENAPI_CHROME_SHEET = '@spec-kitty/doc-toolkit/styles/dk-openapi.css';

/** Mirrors `DESCRIPTION_MAX` in `schema.ts` (which cannot be imported at render time). */
const DESCRIPTION_MAX = 180;

/** The renderer's code samples, all off (research R7 item 6; NFR-002). */
export const SNIPPETS_OFF = { operation: false, requestBody: false, response: false } as const;

const RENDERER_FILE = /[\\/]starlight-openapi[\\/]libs[\\/]starlight\.ts$/;

/** One version, as the route middleware and `OpenApiVersionNav` see it. */
export interface OpenApiNavVersion {
  label: string;
  released: boolean;
  /** Site route of the version's overview, without the base. */
  route: string;
  /**
   * The operation slug of an operation page — `operations/<id>` or, with the
   * duplicate-operationId suffix, `operations/<id>/<method>` — exactly the
   * renderer's route remainder. The version switcher maps it onto the target
   * version (WP07). Undefined on the version overview and on a tag overview.
   */
  operationSlug?: string;
}

/** What the middleware hands to the page chrome for a reference page. */
export interface OpenApiNav {
  current: OpenApiNavVersion;
  versions: OpenApiNavVersion[];
}

/** The data behind `virtual:doc-kitty/openapi`. */
export interface OpenApiModuleData {
  section: string;
  versions: Array<{ label: string; released: boolean; operations: Operation[] }>;
}

/** A placeholder sidebar group, replaced by the renderer with the version's tree. */
export function openApiSidebarGroup(section: string, label: string) {
  return { collapsed: false, items: [] as never[], label: `${PLACEHOLDER_GROUP_PREFIX}${section}/${label})` };
}

/** The renderer's config for the materialised list: one entry per version. */
export function openApiRendererConfig(options: NormalisedOpenApiOptions, specs: MaterialisedSpec[]) {
  return specs.map((spec) => ({
    base: `${options.section}/${spec.label}`,
    schema: spec.renderPath,
    sidebar: {
      label: `API ${spec.label}`,
      collapsed: true,
      group: openApiSidebarGroup(options.section, spec.label),
    },
    snippets: { ...SNIPPETS_OFF },
  }));
}

/** The placeholder groups, in version order, for the site sidebar. */
export function openApiSidebarGroups(options: NormalisedOpenApiOptions, specs: MaterialisedSpec[]) {
  return specs.map((spec) => openApiSidebarGroup(options.section, spec.label));
}

/** Collapse whitespace and cut at the schema's upper bound. */
function clamp(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= DESCRIPTION_MAX ? flat : `${flat.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

/** The first sentence of a Markdown description, with the common inline marks removed. */
function firstSentence(markdown: string): string {
  const plain = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const end = plain.search(/[.!?](\s|$)/);
  return end === -1 ? plain : plain.slice(0, end + 1);
}

interface RendererSchema {
  config?: { base?: string };
  document?: { info?: { title?: string; version?: string; summary?: string; description?: string } };
}

/** The version label of a page's renderer schema: the last `base` segment, else "API". */
function rendererLabel(schema: RendererSchema | undefined): string {
  return (schema?.config?.base ?? '').split('/').filter(Boolean).pop() ?? 'API';
}

/** The overview's own text: `info.summary`, else the first sentence of `info.description`. */
function overviewText(info: { summary?: string; description?: string }): string {
  return info.summary ?? (info.description ? firstSentence(info.description) : '');
}

/**
 * The description of a generated page, given the renderer's `getPageProps` arguments.
 * An operation page: `"<label> API reference: <operation summary>"`. A tag overview:
 * `"<label> API reference: <tag> operations"`. The version overview: `info.summary`,
 * else the first sentence of `info.description`, else the title and version.
 */
export function describeOpenApiPage(
  title: string,
  schema: RendererSchema | undefined,
  pathItemOperation?: { operation?: { summary?: string } },
  tag?: { name?: string },
): string {
  const info = schema?.document?.info ?? {};
  const prefix = `${rendererLabel(schema)} API reference`;
  if (pathItemOperation) return clamp(`${prefix}: ${pathItemOperation.operation?.summary ?? title}`);
  if (tag) return clamp(`${prefix}: ${tag.name ?? title} operations`);
  const own = overviewText(info);
  return clamp(own !== '' ? own : `${prefix}: ${info.title ?? 'API'} ${info.version ?? ''}`);
}

/** Absolute path of this module: the Vite transform imports the runtime half from it. */
const SELF = fileURLToPath(import.meta.url);

const PAGE_PROPS_FRONTMATTER = /frontmatter:\s*\{\s*title\s*,?\s*\}/g;

/** A `pagePropsHooks` entry, as a later work package pushes it (WP05: `pagefind`). */
interface PagePropsHook {
  /** The frontmatter key the hook's value lands under; identifier-safe. */
  key: string;
  /** The module URL to import the hook from (a virtual module is fine). */
  moduleUrl: string;
  /** The export to call with the renderer's `getPageProps` arguments. */
  exportName: string;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// WP05 (the plan's `pagePropsHooks` seam, FR-015): the `pagefind` value, so an
// unreleased version's pages carry no `data-pagefind-body` and Pagefind writes no
// fragment for them. Registered once, at load: `patchPageProps` is its only reader,
// and the hook itself reads the build's published versions when it is called.
pagePropsHooks.push({
  key: 'pagefind',
  moduleUrl: pathToFileURL(fileURLToPath(new URL('./indexing.ts', import.meta.url))).href,
  exportName: 'openApiPagefind',
});

/**
 * Splice a `description` into the renderer's `getPageProps` frontmatter, plus
 * one entry per registered {@link pagePropsHook}: an import of its export and a
 * frontmatter key calling it with the same `(title, schema, pathItemOperation,
 * tag)` arguments. With none registered the splice is byte-identical to the
 * description-only one. Throws when the renderer's source no longer has the
 * expected shape, so a changed pin fails the build instead of silently
 * publishing pages the docs schema rejects.
 */
export function patchPageProps(code: string): string {
  // Exactly one site: zero or several means the renderer changed shape.
  if ((code.match(PAGE_PROPS_FRONTMATTER) ?? []).length !== 1) {
    throw new Error(
      '[dk-openapi] cannot add a description to the pages of starlight-openapi: its getPageProps no longer has the expected frontmatter. The adapter is pinned to the version in peerDependencies.',
    );
  }
  const hooks: PagePropsHook[] = [...pagePropsHooks];
  for (const { key, moduleUrl, exportName } of hooks) {
    // The key and the export name become identifiers in generated code.
    if (!IDENTIFIER.test(key) || !IDENTIFIER.test(exportName)) {
      throw new Error(
        `[dk-openapi] a pagePropsHooks entry needs identifier-safe "key" and "exportName" (got key ${JSON.stringify(key)}, exportName ${JSON.stringify(exportName)} from ${moduleUrl})`,
      );
    }
  }
  const imports = hooks
    .map(({ key, moduleUrl, exportName }) => `import { ${exportName} as dkPageProps_${key} } from ${JSON.stringify(moduleUrl)};`)
    .join('\n');
  const extras = hooks.map(({ key }) => `, ${key}: dkPageProps_${key}(title, schema, pathItemOperation, tag)`).join('');
  const body = code.replace(
    PAGE_PROPS_FRONTMATTER,
    // `doc_status` is part of the splice: the docs schema defaults a missing one to
    // `draft`, which would give every reference page the draft notice and `noindex`.
    `frontmatter: { title, description: dkDescribeOpenApiPage(title, schema, pathItemOperation, tag), doc_status: 'active'${extras} }`,
  );
  return `${imports === '' ? '' : `${imports}\n`}import { describeOpenApiPage as dkDescribeOpenApiPage } from ${JSON.stringify(pathToFileURL(SELF).href)};\n${body}`;
}

/** Source of `virtual:doc-kitty/openapi`. */
export function openApiModuleSource(data: OpenApiModuleData): string {
  return `export const openApi = ${JSON.stringify(data)};\n`;
}

/**
 * What Starlight shows when a site sets no `sidebar`: its top-level directory tree,
 * where the first path segment of the docs root becomes one group labelled with that
 * segment, verbatim (`docs`), holding the whole tree. A sidebar array replaces that
 * default, so appending the OpenAPI groups to nothing would drop the adopter's pages.
 * This returns the same group, written as config (the schema requires a label), so
 * the adopter's navigation keeps its shape and the API groups follow it.
 */
export function starlightDefaultSidebar(docsDir: string): Array<{ label: string; autogenerate: { directory: string } }> {
  const top = docsDir.split('/').filter((segment) => segment !== '' && segment !== '.')[0] ?? '.';
  return [{ label: top, autogenerate: { directory: top } }];
}

/** The Vite plugin: serves the virtual module and adds the description to the renderer. */
export function openApiVitePlugin(data: OpenApiModuleData) {
  const resolved = `\0${OPENAPI_MODULE_ID}`;
  let rendererSeen = false;
  let buildFailed = false;
  let isBuild = true;
  return {
    name: 'doc-kitty:openapi',
    enforce: 'pre' as const,
    // The dev server installs this plugin too, and Vite runs `buildEnd` when it closes.
    configResolved(config: { command: string }): void {
      isBuild = config.command === 'build';
    },
    resolveId(id: string): string | null {
      return id === OPENAPI_MODULE_ID ? resolved : null;
    },
    load(id: string): string | null {
      return id === resolved ? openApiModuleSource(data) : null;
    },
    transform(code: string, id: string): string | null {
      if (!RENDERER_FILE.test(id.split('?')[0])) return null;
      rendererSeen = true;
      return patchPageProps(code);
    },
    // Astro runs several Vite builds in one process (server first, then the client
    // bundle, which never loads the renderer), so `rendererSeen` is sticky: it is the
    // plugin instance's, not one build's, and the client pass must not clear it.
    buildStart(): void {
      buildFailed = false;
    },
    // Fail closed: a renderer module that moved leaves every page without a description.
    // Only meaningful for a build: not a dev server (which also runs buildEnd on close), not a failed build.
    buildEnd(error?: Error): void {
      if (error) buildFailed = true;
      if (isBuild && !buildFailed && !rendererSeen) {
        throw new Error(
          '[dk-openapi] the starlight-openapi page-props module (libs/starlight.ts) was never loaded, ' +
            'so the generated pages would have no description; the plugin layout has changed.',
        );
      }
    },
  };
}

/** Absolute path of the route middleware (referenced by path, like the lightbox island). */
export const OPENAPI_ROUTE_MIDDLEWARE = fileURLToPath(new URL('./route-middleware.ts', import.meta.url));

// Starlight's hook parameters, which this module hands on without reading most of them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Params = Record<string, any>;

/** The route of a version's overview, without the base. */
function versionRoute(section: string, label: string): string {
  return routeOfSlug(`${section}/${label}/index`);
}

/** The operation slug the route carries, when it is an operation page. */
function operationSlugOf(route: string, version: { route: string }): string | undefined {
  const remainder = route.slice(version.route.length).replace(/\/+$/, '');
  if (!remainder.startsWith('operations/') || remainder.startsWith('operations/tags/')) return undefined;
  // The duplicate-operationId suffix (`<id>/<method>`) is part of the slug.
  return remainder.slice('operations/'.length);
}

/**
 * Which reference version a request path belongs to, as the nav the page chrome
 * renders; `undefined` outside the reference pages. `base` is Astro's `BASE_URL`.
 * `current.operationSlug` carries the operation of an operation page (WP07).
 */
export function resolveOpenApiNav(
  pathname: string,
  base: string,
  data: OpenApiModuleData,
): OpenApiNav | undefined {
  const prefix = base.replace(/\/+$/, '');
  // Strip the base only at a segment boundary: `/doc-kittyX/` is not under `/doc-kitty`.
  const route =
    prefix !== '' && (pathname === prefix || pathname.startsWith(`${prefix}/`))
      ? pathname.slice(prefix.length) || '/'
      : pathname;
  const versions = data.versions.map((v) => ({
    label: v.label,
    released: v.released,
    route: versionRoute(data.section, v.label),
  }));
  const current = versions.find((v) => route === v.route.slice(0, -1) || route.startsWith(v.route));
  return current ? { current: { ...current, operationSlug: operationSlugOf(route, current) }, versions } : undefined;
}

/**
 * The Starlight plugin that adds what the renderer's own plugin lacks: the Vite plugin
 * (virtual module and description splice) and the route middleware for the version nav.
 * It runs after the renderer's plugin, in a build or the dev server only. The
 * materialised list feeds the virtual module (its versions carry the operations,
 * FR-023) and the publisher (its bytes, FR-007), and the inner integration runs the
 * registry's `buildDoneHooks` after the publisher and its `devHandlers` on server
 * setup (plan.md's parallel-edit registry).
 */
export function openApiPlugin(options: NormalisedOpenApiOptions, specs: MaterialisedSpec[], base = '/') {
  const data: OpenApiModuleData = {
    section: options.section,
    versions: specs.map(({ label, released, operations }) => ({ label, released, operations })),
  };
  // WP05 (the plan's `sitemapPredicates` seam, FR-015): registered per site and only
  // when some version is unreleased, so a site with every version released keeps the
  // draft filter itself (WP02's byte-identity contract). This runs while
  // `defineDocKittyIntegrations` builds its plugins, before it composes the sitemap
  // filter, so `composeSitemapPredicates` sees it. Keyed, so a dev restart's
  // second registration replaces this one instead of stacking it — and
  // UNREGISTERED when every version is released, because the registry is
  // module-level and survives the re-evaluation: a restart whose versions are
  // all released must drop the predicate the earlier, unreleased evaluation
  // registered, not keep filtering with it (#285).
  if (data.versions.some((version) => !version.released)) {
    registerSitemapPredicate('openapi:unreleased-versions', openApiSitemapPredicate(options.section, data.versions, base));
  } else {
    unregisterSitemapPredicate('openapi:unreleased-versions');
  }
  const publishHooks = openApiPublishHooks({ section: options.section, specs });
  return {
    name: 'doc-kitty:openapi',
    hooks: {
      'config:setup'(params: Params) {
        // The renderer does nothing outside a build or the dev server; neither do we.
        if (params.command !== 'build' && params.command !== 'dev') return;
        registerBuildDoneHook('openapi:link-check', openApiLinkCheck({ section: options.section, base: params.astroConfig?.base ?? '/' }));
        params.addIntegration({
          name: 'doc-kitty:openapi',
          hooks: {
            'astro:config:setup': ({ updateConfig, config, command }: Params) => {
              updateConfig({ vite: { plugins: [openApiVitePlugin(data)] } });
              // The raw documents in `astro dev` (WP04): the registry's one
              // `devHandlers` registration, with Astro's own base. Astro's dev server
              // strips the base before user middleware, so the handler accepts
              // both forms; a build registers nothing. Keyed, so a restart
              // replaces the handler instead of stacking it.
              if (command === 'dev') {
                registerDevHandler('openapi:raw-documents', openApiDevHandler({ section: options.section, specs }, config.base));
              }
            },
            // The raw documents and their checksums (WP04; ADR-0049 section 3),
            // then every registered buildDoneHook, so one sees the published output.
            'astro:build:done': (buildDone: { dir: URL; logger?: { warn(message: string): void } }) => {
              publishHooks['astro:build:done'](buildDone);
              for (const hook of [...buildDoneHooks]) hook(buildDone);
            },
            'astro:server:setup': (server: Params) => {
              for (const handler of [...devHandlers]) handler(server);
            },
          },
        });
        params.addRouteMiddleware({ entrypoint: OPENAPI_ROUTE_MIDDLEWARE, order: 'post' });
      },
    },
  };
}

/**
 * Follow-on plugin: drops the renderer's stylesheet from `customCss` and adds
 * {@link OPENAPI_CHROME_SHEET} in its place, last, so the theme's `--dk-*` tokens
 * (declared earlier) are in place. Must come after the renderer.
 */
export function openApiStylesheetFilter() {
  return {
    name: 'doc-kitty:openapi-styles',
    hooks: {
      'config:setup'({ config, updateConfig }: Params) {
        updateConfig({
          customCss: [
            ...(config.customCss ?? []).filter(
              (sheet: string) => sheet !== OPENAPI_STYLESHEET && sheet !== OPENAPI_CHROME_SHEET,
            ),
            OPENAPI_CHROME_SHEET,
          ],
        });
      },
    },
  };
}

/** The Starlight plugins for the option, in the order they must run: the adopter's renderer first. */
export function openApiPlugins(options: NormalisedOpenApiOptions, specs: MaterialisedSpec[], base = '/') {
  const renderer = options.renderer(openApiRendererConfig(options, specs));
  return [renderer, openApiPlugin(options, specs, base), openApiStylesheetFilter()];
}

/**
 * Authored pages the reference pages would collide with, as the ADR-0050 message, or
 * `undefined`. A page collides when its route is a version's overview or under it.
 * The generated entry names its version: an explicit `specs[i]` by index and label,
 * an archive match by the label the pattern captured (WP08).
 */
export function openApiCollisionMessage(
  options: NormalisedOpenApiOptions,
  specs: MaterialisedSpec[],
  docsDir: string,
  indexBasename?: string | string[],
  gherkinSection?: string,
): string | undefined {
  const paths: string[] = walkMarkdownPaths(path.resolve(process.cwd(), docsDir));
  const { ids } = resolveIndexEntries(paths, { indexBasename } as never);
  const collisions: Array<{ route: string; paths: string[] }> = [];
  for (const [index, spec] of specs.entries()) {
    const root = `${options.section}/${spec.label}`;
    const ref =
      index < options.specs.length ? `specs[${index}] "${spec.label}"` : `archive match "${spec.label}"`;
    const authored = paths
      .filter((p) => {
        const id = (ids.get(p) ?? '').toLowerCase();
        return id === root || id.startsWith(`${root}/`);
      })
      .sort();
    // The gherkin pages are written after config time, so the walk above cannot see
    // them: compare their section (a folder under the docs root) with the version's.
    const gherkin =
      gherkinSection !== undefined && (root === gherkinSection || root.startsWith(`${gherkinSection}/`))
        ? [`${gherkinSection}/** (generated by the gherkin option, section "${gherkinSection}")`]
        : [];
    if (authored.length > 0 || gherkin.length > 0) {
      collisions.push({
        route: routeOfSlug(`${root}/index`),
        paths: [...authored, ...gherkin, `${root}/** (generated by the openapi option, ${ref})`],
      });
    }
  }
  return collisions.length > 0 ? formatRouteCollisions(collisions, { docsDir }) : undefined;
}

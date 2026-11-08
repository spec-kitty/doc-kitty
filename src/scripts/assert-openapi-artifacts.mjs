#!/usr/bin/env node
/**
 * assert-openapi-artifacts.mjs — build-artifact assertions for the OpenAPI reference
 * pages (mission openapi-reference-pages, WP04; FR-002, FR-003, FR-004, FR-006, FR-008,
 * FR-009, NFR-002; openapi-second-slice WP03/WP04: the agent records and the llms.txt
 * operation lines). Called from assert-build-artifacts.mjs, so `pnpm assert:artifacts`
 * runs it; it can also run alone:
 *
 *   node src/scripts/assert-openapi-artifacts.mjs example/dist
 *
 * It checks the example's two-version fixture (`example/openapi/{v1,main}.yaml`, the
 * `openapi` option in `example/astro.config.mjs`). Every check reads a published file,
 * so removing the behaviour it proves turns it red. Zero runtime dependencies beyond
 * the YAML reader and the operation-slug mirror the option's own surfaces use
 * (`extractOperations`, the pinned renderer's rules).
 *
 * What the pinned renderer shows. `starlight-openapi@0.27.0` writes one overview page
 * and one page per operation, and inlines every component schema where it is used; a
 * schema has no page and no heading of its own. "A schema is visible" therefore means
 * its property names are in the version's pages.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parseDocument } from '../lib/openapi/options.mjs';
import { extractOperations } from '../lib/openapi/operations.mjs';
import { slug as slugify } from 'github-slugger';

/**
 * The example's `openapi` option, as `example/astro.config.mjs` sets it, in the
 * order the materialised list has it (FR-023): the explicit `specs`, then the
 * archive match `openapi/v1-*.yaml` → label `v1-1`.
 */
export const EXAMPLE_OPENAPI = Object.freeze({
  section: 'reference/api',
  specs: Object.freeze([
    { label: 'v1', released: true, file: 'openapi/v1.yaml' },
    { label: 'main', released: false, file: 'openapi/main.yaml' },
    { label: 'v1-1', released: true, file: 'openapi/v1-1.yaml', origin: 'archive' },
  ]),
});

/**
 * NFR-002, as waived (DM plan.security.nfr002-waiver; ADR-0049 addendum). These are
 * the ONLY inline additions a reference page may carry over an ordinary page. They
 * are the CSP hashes of what `starlight-openapi@0.27.0` writes with code samples off:
 *  - scripts: the inline module script defining `starlight-openapi-content-picker`
 *    (on every operation page);
 *  - style attributes: `--sl-icon-size: 1.333em;` on each version's overview page.
 *    A style attribute only matches a hash in `style-src` with `'unsafe-hashes'`.
 *
 * RE-DERIVE BOTH WHEN THE PIN CHANGES (`starlight-openapi` in `src/package.json`):
 * build the example and run this file: each hash the renderer adds beyond the list is
 * named in the failure. Check it is the renderer's own, then copy it here. The how-to publishes the same list.
 */
export const OPENAPI_INLINE_ALLOWLIST = Object.freeze({
  pinnedVersion: 'starlight-openapi@0.27.0',
  scripts: Object.freeze(['sha256-28IjJBwKnS9sgb0aB8YXgnUhJmV3Az7aJiw6QBthXmo=']),
  styleAttributes: Object.freeze(['sha256-XlpZgcpFaLbPrgzm4PHCiD/OJXhR+DZxGuVpy2P4Cq0=']),
  styleBlocks: Object.freeze([]),
});

const sha256Base64 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'" };
const decodeEntities = (text) => text.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (m) => ENTITIES[m] ?? m);

/** Visible text of the page's `<main>`, scripts and styles removed. */
export function mainText(html) {
  const main = /<main[\s>][\s\S]*<\/main>/i.exec(html)?.[0] ?? html;
  const bare = main.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return decodeEntities(bare).replace(/\s+/g, ' ').trim();
}

/** CSP hashes of what a page carries inline: scripts, style blocks and style attributes. */
export function inlineHashes(html) {
  const scripts = new Set();
  const styleBlocks = new Set();
  const styleAttributes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].trim() !== '') scripts.add(sha256Base64(m[1]));
  }
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) styleBlocks.add(sha256Base64(m[1]));
  for (const m of html.matchAll(/<[a-z][^>]*?\sstyle=(?:"([^"]*)"|'([^']*)')/gi)) {
    styleAttributes.add(sha256Base64(decodeEntities(m[1] ?? m[2])));
  }
  return { scripts, styleBlocks, styleAttributes };
}

/** The origins a page loads or links with `src`, `href`, `action` or `srcset` (http/https only). */
export function externalOrigins(html) {
  const origins = new Set();
  for (const m of html.matchAll(/\s(?:src|href|action|poster|data)=["'](https?:\/\/[^"']+)["']/gi)) {
    origins.add(new URL(m[1]).origin);
  }
  return origins;
}

/**
 * What the reference pages add over ordinary pages: origins and inline hashes that no
 * ordinary page has. Anything outside the allowlist is returned as a problem.
 * @param {string[]} referenceHtml
 * @param {string[]} ordinaryHtml
 * @param {typeof OPENAPI_INLINE_ALLOWLIST} allow
 * @returns {{ origins: string[]; scripts: string[]; styleBlocks: string[]; styleAttributes: string[]; problems: string[] }}
 */
export function cspAdditions(referenceHtml, ordinaryHtml, allow = OPENAPI_INLINE_ALLOWLIST) {
  const known = { origins: new Set(), scripts: new Set(), styleBlocks: new Set(), styleAttributes: new Set() };
  for (const html of ordinaryHtml) {
    for (const o of externalOrigins(html)) known.origins.add(o);
    const h = inlineHashes(html);
    for (const key of ['scripts', 'styleBlocks', 'styleAttributes']) for (const v of h[key]) known[key].add(v);
  }
  const added = { origins: new Set(), scripts: new Set(), styleBlocks: new Set(), styleAttributes: new Set() };
  for (const html of referenceHtml) {
    for (const o of externalOrigins(html)) if (!known.origins.has(o)) added.origins.add(o);
    const h = inlineHashes(html);
    for (const key of ['scripts', 'styleBlocks', 'styleAttributes']) {
      for (const v of h[key]) if (!known[key].has(v)) added[key].add(v);
    }
  }
  const out = { origins: [...added.origins].sort(), scripts: [], styleBlocks: [], styleAttributes: [], problems: [] };
  for (const key of ['scripts', 'styleBlocks', 'styleAttributes']) {
    out[key] = [...added[key]].sort();
    for (const v of out[key]) {
      if (!allow[key].includes(v)) {
        out.problems.push(`an inline ${key.replace(/s$/, '')} hash beyond the pinned ${allow.pinnedVersion} allowlist: ${v}`);
      }
    }
  }
  for (const o of out.origins) out.problems.push(`an external origin no ordinary page has: ${o}`);
  return out;
}

/** Signs of a request console, or of the spec being fetched, in a served page. */
export function consoleSignals(html) {
  const main = /<main[\s>][\s\S]*<\/main>/i.exec(html)?.[0] ?? html;
  const signals = [];
  if (/<form[\s>]/i.test(main)) signals.push('form');
  if (/\bsl-openapi-snippet(s|-picker)?\b/.test(main)) signals.push('code samples');
  if (/\b(try[- ]?it|send[- ]request|api-?console)\b/i.test(main)) signals.push('try control');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (scripts.some((s) => /openapi\.(ya?ml|json)/.test(s))) signals.push('spec fetch');
  return signals;
}

/**
 * The operations and schema property names of a parsed document. Each
 * operation carries the renderer's route slug (`extractOperations`, the
 * toolkit's pinned mirror of `starlight-openapi`'s rules — same-path duplicate
 * `/<method>` suffix and path-as-operationId fallback included), so both the
 * page loop and the version-switcher link check expect the pages the renderer
 * actually writes.
 * @param {unknown} doc
 */
export function describeDocument(doc) {
  const operations = extractOperations(doc).map((operation) => ({
    operationId: operation.operationId,
    summary: operation.summary ?? operation.operationId,
    label: `${operation.method} ${operation.path}`,
    slug: operation.slug,
  }));
  const schemas = Object.entries(doc.components?.schemas ?? {}).map(([name, schema]) => ({
    name,
    properties: Object.keys(schema?.properties ?? {}),
  }));
  return { operations, schemas };
}

/**
 * The href the version switcher renders on `page` for version `other`
 * (openapi-second-slice WP07): that version's page for the SAME operation
 * when `page` is an operation page and `other` routes the operation, and its
 * overview otherwise. The label is slugified the way the switcher's own base
 * route slugifies it (`versionBase`), never taken verbatim.
 * @param {{ op?: { slug: string } }} page
 * @param {{ label: string }} other
 * @param {string} section
 * @param {Map<string, Set<string>>} operationSlugsOf
 * @returns {{ href: string; sameOperation: boolean }}
 */
function switcherHref(section, page, other, operationSlugsOf) {
  const sameOperation = operationSlugsOf.get(other.label)?.has(page.op?.slug) ?? false;
  return {
    href: `/${section}/${slugify(other.label)}${sameOperation ? `/${page.op.slug}/` : '/'}`,
    sameOperation,
  };
}

const routeOf = (section, label, rest = '') => `${section}/${label}/${rest}`;
const rawNameOf = (spec) => `openapi.${path.extname(spec.file).slice(1)}`;

async function readOr(file) {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

async function htmlFilesBelow(dir, skip) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const abs = path.join(entry.parentPath, entry.name);
    if (!skip(path.relative(dir, abs))) out.push(abs);
  }
  return out;
}

/** The fragment URLs (and decoded text) Pagefind indexed. */
async function pagefindFragments(distDir) {
  const dir = path.join(distDir, 'pagefind', 'fragment');
  const names = existsSync(dir) ? (await readdir(dir)).filter((n) => n.endsWith('.pf_fragment')) : [];
  const out = [];
  for (const n of names) {
    const decoded = gunzipSync(await readFile(path.join(dir, n))).toString('utf8');
    const url = decoded.match(/"url":"([^"]*)"/)?.[1];
    if (url) out.push({ url, text: decoded });
  }
  return out;
}

/** Every `<loc>` URL of every `sitemap*.xml` in `dist`, in file then document order. */
export async function readSitemapLocs(dist) {
  const sitemapText = (await Promise.all(
    (await readdir(dist)).filter((f) => /^sitemap.*\.xml$/i.test(f)).map((f) => readFile(path.join(dist, f), 'utf8')),
  )).join('\n');
  return [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/**
 * The synthetic agent records (openapi-second-slice WP03) from
 * `api/index.json`: its `pages` array, or the problem that stopped the read.
 * @param {string} dist
 * @returns {Promise<{ records?: Array<Record<string, unknown>>, problems: string[] }>}
 */
export async function readAgentRecords(dist) {
  const agentIndexText = await readOr(path.join(dist, 'api', 'index.json'));
  if (agentIndexText === undefined) {
    return { records: undefined, problems: ['agents: api/index.json is missing'] };
  }
  try {
    const parsedIndex = JSON.parse(agentIndexText);
    if (parsedIndex !== null && typeof parsedIndex === 'object' && Array.isArray(parsedIndex.pages)) {
      return { records: parsedIndex.pages, problems: [] };
    }
    return { records: undefined, problems: ['agents: api/index.json has no pages array'] };
  } catch {
    return { records: undefined, problems: ['agents: api/index.json is not valid JSON'] };
  }
}

/**
 * The configured specs, each read, parsed and described: `{ spec, input,
 * described }` with the spec's own bytes and its `describeDocument` view.
 * @param {typeof EXAMPLE_OPENAPI} config
 * @param {string} siteRoot
 */
export function parseSpecs(config, siteRoot) {
  return config.specs.map((spec) => {
    const input = readFileSync(path.join(siteRoot, spec.file));
    return { spec, input, described: describeDocument(parseDocument(input.toString('utf8'))) };
  });
}

/** Every page a version's renderer writes: the overview, then one per operation. */
export function versionPages(section, spec, operations) {
  const pages = [{ rel: routeOf(section, spec.label) }];
  for (const op of operations) pages.push({ rel: routeOf(section, spec.label, `${op.slug}/`), op });
  return pages;
}

/** The page's version navigation block, or '' when it has none. */
function navOf(html) {
  return /<[^>]*\bdk-openapi-nav\b[\s\S]*?<\/nav>/i.exec(html)?.[0] ?? '';
}

/** An operation page must show its operation summary and method+path label. */
export function pageNameProblems(page, text) {
  const problems = [];
  if (page.op) {
    if (!text.includes(page.op.summary)) problems.push(`names: ${page.rel} does not show the operation "${page.op.summary}"`);
    if (!text.includes(page.op.label)) problems.push(`names: ${page.rel} does not show "${page.op.label}"`);
  }
  return problems;
}

/**
 * The version navigation (FR-003, FR-004; WP07's mapping): present on every
 * page, and linking every OTHER version — at the same operation when that
 * version routes one, else at its overview.
 */
export function navProblems(section, specs, spec, page, html, operationSlugsOf) {
  const problems = [];
  const nav = navOf(html);
  if (nav === '') problems.push(`nav: ${page.rel} has no version navigation`);
  for (const other of specs.filter((s) => s.label !== spec.label)) {
    const { href, sameOperation } = switcherHref(section, page, other, operationSlugsOf);
    if (!new RegExp(`href="[^"]*${href}"`).test(nav)) {
      problems.push(`nav: ${page.rel} does not link to version ${other.label}${sameOperation ? ' at the same operation' : ''}`);
    }
  }
  return problems;
}

/** The released/unreleased badge (FR-004): on the current version only, unreleased versions only. */
export function badgeProblems(spec, page, html) {
  const problems = [];
  const current = /dk-openapi-nav__current[\s\S]*?<\/(?:li|p|div|span)>\s*(?:<\/\w+>)?/i.exec(navOf(html))?.[0] ?? '';
  const badged = /dk-openapi-badge/.test(current);
  if (spec.released && badged) problems.push(`badge: the released version ${spec.label} carries the unreleased badge on ${page.rel}`);
  if (!spec.released && !(badged && /unreleased/i.test(current))) {
    problems.push(`badge: the unreleased version ${spec.label} shows no "unreleased" text on ${page.rel}`);
  }
  return problems;
}

/**
 * A generated page is published, not a draft: no draft notice, not noindex (a
 * missing doc_status defaults to draft in the docs schema).
 */
export function statusProblems(page, html) {
  const problems = [];
  if (/\bdk-draft-notice\b/.test(html)) problems.push(`status: ${page.rel} carries the draft notice`);
  if (/<meta[^>]*name="robots"[^>]*noindex/i.test(html)) problems.push(`status: ${page.rel} is marked noindex`);
  return problems;
}

/** No request console, no fetch of the spec (FR-009). */
export function consoleProblems(page, html) {
  return consoleSignals(html).map((signal) => `console: ${page.rel} shows ${signal}`);
}

/**
 * Sitemap and search (FR-008, FR-015): a released version's pages are listed
 * and indexed; an unreleased version's pages are built and served but held
 * back from both, and carry no Pagefind marker (WP05).
 */
export function indexingProblems(spec, page, html, sitemapLocs, fragments) {
  const problems = [];
  const listed = sitemapLocs.some((loc) => loc.endsWith(`/${page.rel}`));
  const indexed = fragments.some(
    (f) => f.url.endsWith(`/${page.rel}`) || f.url.endsWith(`/${page.rel.replace(/\/$/, '')}`),
  );
  if (spec.released) {
    if (!listed) problems.push(`sitemap: no entry for ${page.rel}`);
    if (!indexed) problems.push(`search: ${page.rel} is not in the Pagefind index`);
  } else {
    if (listed) problems.push(`sitemap: unreleased ${page.rel} is listed (FR-015)`);
    if (indexed) problems.push(`search: unreleased ${page.rel} is in the Pagefind index (FR-015)`);
    if (/data-pagefind-body/i.test(html)) problems.push(`search: unreleased ${page.rel} carries data-pagefind-body (FR-015)`);
  }
  return problems;
}

/** A schema has no page of its own: "visible" means its property names are in the version's pages. */
export function schemaProblems(name, schemas, texts) {
  const problems = [];
  const allText = texts.join(' ');
  for (const schema of schemas) {
    for (const property of schema.properties) {
      if (!allText.includes(property)) problems.push(`names: property "${property}" of schema ${schema.name} is not shown in ${name}`);
    }
  }
  return problems;
}

/** The raw document and its checksum: byte for byte (FR-006). */
export async function rawDocumentProblems(dist, section, spec, input) {
  const name = `${section}/${spec.label}`;
  const rawName = rawNameOf(spec);
  const problems = [];
  const raw = existsSync(path.join(dist, name, rawName)) ? readFileSync(path.join(dist, name, rawName)) : undefined;
  if (raw === undefined) problems.push(`raw: ${name}/${rawName} is missing`);
  else if (Buffer.compare(raw, input) !== 0) problems.push(`raw: ${name}/${rawName} differs from ${spec.file}`);
  const sum = await readOr(path.join(dist, name, `${rawName}.sha256`));
  if (sum === undefined) problems.push(`raw: ${name}/${rawName}.sha256 is missing`);
  else if (sum !== `${sha256Hex(input)}  ${rawName}\n`) problems.push(`raw: ${name}/${rawName}.sha256 is not "<sha256 of ${spec.file}>  ${rawName}\\n"`);
  return problems;
}

/** The llms.txt version line (FR-008), released marker included. */
export function llmsVersionProblems(llms, section, spec) {
  const name = `${section}/${spec.label}`;
  const rawName = rawNameOf(spec);
  const line = new RegExp(`^- \\[${spec.label}\\]\\(https?://[^)\\s]*/${name}/${rawName.replace('.', '\\.')}\\)${spec.released ? '' : ' \\(unreleased\\)'}$`, 'm');
  if (!line.test(llms)) return [`llms.txt: no line for ${spec.label}${spec.released ? '' : ' (unreleased)'}`];
  return [];
}

/**
 * The llms.txt operation lines (openapi-second-slice WP04, FR-014): one
 * indented line per operation when the site opted in (`llmsOperations`),
 * none when it did not — the opt-out keeps llms.txt byte-identical
 * (NFR-002). Scoped to the version's own block (its line up to the next
 * version line), so two versions sharing an operation summary cannot satisfy
 * each other's check.
 */
export function llmsOperationsProblems(llms, config, spec, operations) {
  const name = `${config.section}/${spec.label}`;
  const versionLineMatch = new RegExp(`^- \\[${spec.label}\\]\\(https?://[^)\\s]*\\)[^\n]*$`, 'm').exec(llms);
  const block = versionLineMatch === null ? '' : llms.slice(versionLineMatch.index + versionLineMatch[0].length).split(/^(?=- \[)/m)[0];
  const problems = [];
  for (const op of operations) {
    const operationLine = op.summary === undefined ? `  - ${op.label}` : `  - ${op.label}: ${op.summary}`;
    if (config.llmsOperations === true) {
      if (!block.includes(operationLine)) {
        problems.push(`llms.txt: no operation line "${operationLine.trim()}" for ${name}`);
      }
    } else if (block.includes(operationLine)) {
      problems.push(`llms.txt: an operation line for ${name} is present without llmsOperations on`);
    }
  }
  return problems;
}

/**
 * The version's index record (WP03): it must name the raw document route and
 * carry the input's digest, so a drifted projection fails the gate (FR-006's
 * invariant, on the agent surfaces too). No check when the index itself
 * could not be read (`agentRecords === undefined` — already reported).
 */
export function agentRecordProblems(agentRecords, section, spec, digest) {
  if (agentRecords === undefined) return [];
  const name = `${section}/${spec.label}`;
  const rawRoute = `/${name}/${rawNameOf(spec)}`;
  const record = agentRecords.find((entry) => entry?.slug === `${section}/${spec.label}`);
  if (record === undefined) return [`agents: no api/index.json record for ${name}`];
  const problems = [];
  if (typeof record.rawDocumentUrl !== 'string' || !record.rawDocumentUrl.endsWith(rawRoute)) {
    problems.push(`agents: the ${name} record's rawDocumentUrl does not name ${rawRoute}`);
  }
  if (record.sha256 !== digest) {
    problems.push(`agents: the ${name} record's sha256 is not the digest of ${spec.file}`);
  }
  return problems;
}

/** The version's page payload (WP03): the same raw route and digest as its index record. */
export async function agentPayloadProblems(dist, section, spec, digest) {
  const name = `${section}/${spec.label}`;
  const rawRoute = `/${name}/${rawNameOf(spec)}`;
  const payloadText = await readOr(path.join(dist, 'api', 'pages', `${section}/${spec.label}.json`));
  if (payloadText === undefined) {
    return [`agents: api/pages/${section}/${spec.label}.json is missing`];
  }
  try {
    const payload = JSON.parse(payloadText);
    const problems = [];
    if (payload?.sha256 !== digest) {
      problems.push(`agents: the ${name} page payload's sha256 is not the digest of ${spec.file}`);
    }
    if (typeof payload?.rawDocumentUrl !== 'string' || !payload.rawDocumentUrl.endsWith(rawRoute)) {
      problems.push(`agents: the ${name} page payload's rawDocumentUrl does not name ${rawRoute}`);
    }
    return problems;
  } catch {
    return [`agents: the ${name} page payload is not valid JSON`];
  }
}

/**
 * One agent record per configured version, no more (WP03): a missing or
 * duplicated record in the section fails even when each spec's own lookups
 * found theirs.
 */
export function agentCountProblems(agentRecords, config) {
  if (agentRecords === undefined) return [];
  const held = agentRecords.filter(
    (entry) => typeof entry?.slug === 'string' && entry.slug.startsWith(`${config.section}/`),
  );
  if (held.length !== config.specs.length) {
    return [`agents: api/index.json holds ${held.length} ${config.section} record, expected ${config.specs.length}`];
  }
  return [];
}

/**
 * NFR-002, as waived: nothing beyond an ordinary page's, but the pinned
 * allowlist (see `cspAdditions`).
 */
export async function cspProblems(dist, config, reference, allow) {
  const ordinary = [];
  const isReference = (rel) => rel.split(path.sep).join('/').startsWith(`${config.section}/`);
  for (const file of await htmlFilesBelow(dist, isReference)) ordinary.push(await readFile(file, 'utf8'));
  return cspAdditions(reference, ordinary, allow).problems.map((p) => `csp: ${p}`);
}

/**
 * Every check of one spec version, in the gate's canonical order: its pages
 * (existence, names, nav, badge, status, console, sitemap/search), its
 * schemas' property names, its raw document and checksum, its llms.txt lines,
 * and its agent record and page payload.
 * @param {object} ctx Everything one version's checks need, gathered by the orchestrator.
 * @param {string} ctx.dist The resolved dist dir.
 * @param {typeof EXAMPLE_OPENAPI} ctx.config The site's openapi config.
 * @param {(typeof EXAMPLE_OPENAPI)['specs'][number]} ctx.spec This version.
 * @param {Buffer} ctx.input The spec's own bytes.
 * @param {ReturnType<typeof describeDocument>} ctx.described Its operations and schemas.
 * @param {string} ctx.llms The dist's llms.txt (or '').
 * @param {string[]} ctx.sitemapLocs The sitemap's `<loc>` URLs.
 * @param {Array<{ url: string, text: string }>} ctx.fragments The Pagefind fragments.
 * @param {Array<Record<string, unknown>> | undefined} ctx.agentRecords The index's pages array, when readable.
 * @param {Map<string, Set<string>>} ctx.operationSlugsOf Each version's operation slugs (WP07).
 * @param {string[]} ctx.reference Collector: every reference page's HTML (for the CSP check).
 * @returns {Promise<string[]>}
 */
async function checkOneSpec(ctx) {
  const { config, spec, input, described } = ctx;
  const texts = [];
  const problems = [];
  for (const page of versionPages(config.section, spec, described.operations)) {
    const html = await readOr(path.join(ctx.dist, page.rel, 'index.html'));
    if (html === undefined) {
      problems.push(`pages: ${page.rel}index.html is missing (${config.section}/${spec.label})`);
      continue;
    }
    ctx.reference.push(html);
    const text = mainText(html);
    texts.push(text);
    problems.push(...pageNameProblems(page, text));
    problems.push(...navProblems(config.section, config.specs, spec, page, html, ctx.operationSlugsOf));
    problems.push(...badgeProblems(spec, page, html));
    problems.push(...statusProblems(page, html));
    problems.push(...consoleProblems(page, html));
    problems.push(...indexingProblems(spec, page, html, ctx.sitemapLocs, ctx.fragments));
  }
  problems.push(...schemaProblems(`${config.section}/${spec.label}`, described.schemas, texts));
  problems.push(...(await rawDocumentProblems(ctx.dist, config.section, spec, input)));
  problems.push(...llmsVersionProblems(ctx.llms, config.section, spec));
  problems.push(...llmsOperationsProblems(ctx.llms, config, spec, described.operations));
  const digest = sha256Hex(input);
  problems.push(...agentRecordProblems(ctx.agentRecords, config.section, spec, digest));
  problems.push(...(await agentPayloadProblems(ctx.dist, config.section, spec, digest)));
  return problems;
}

/**
 * Check the example's reference pages in `distDir`. Returns every problem found
 * (empty when all hold), each starting with the check's name. One independent
 * helper per check (read, parse, then per-version and per-page assertions);
 * this orchestrator only composes them in the canonical order.
 * @param {string} distDir
 * @param {{ siteRoot?: string, config?: typeof EXAMPLE_OPENAPI, allow?: typeof OPENAPI_INLINE_ALLOWLIST }} [options]
 * @returns {Promise<string[]>}
 */
export async function checkOpenApiArtifacts(distDir, options = {}) {
  const dist = path.resolve(distDir);
  const siteRoot = path.resolve(options.siteRoot ?? path.join(dist, '..'));
  const config = options.config ?? EXAMPLE_OPENAPI;
  const allow = options.allow ?? OPENAPI_INLINE_ALLOWLIST;
  const problems = [];
  const reference = [];
  const sitemapLocs = await readSitemapLocs(dist);
  const llms = (await readOr(path.join(dist, 'llms.txt'))) ?? '';
  const fragments = await pagefindFragments(dist);
  const { records: agentRecords, problems: agentIndexProblems } = await readAgentRecords(dist);
  problems.push(...agentIndexProblems);
  const parsed = parseSpecs(config, siteRoot);
  // The operation slugs of every version, precomputed for the version
  // switcher's same-operation mapping (WP07): a version link on an operation
  // page targets the other version's page for the SAME operation when that
  // version routes one, and its overview otherwise.
  const operationSlugsOf = new Map(
    parsed.map(({ spec, described }) => [spec.label, new Set(described.operations.map((op) => op.slug))]),
  );
  for (const { spec, input, described } of parsed) {
    problems.push(
      ...(await checkOneSpec({ dist, config, spec, input, described, llms, sitemapLocs, fragments, agentRecords, operationSlugsOf, reference })),
    );
  }
  problems.push(...agentCountProblems(agentRecords, config));
  problems.push(...(await cspProblems(dist, config, reference, allow)));
  return problems;
}

/** Run the checks; print each failure and exit non-zero on any. */
export async function assertOpenApiArtifacts(distDir) {
  const problems = await checkOpenApiArtifacts(distDir);
  if (problems.length > 0) {
    for (const p of problems) process.stderr.write(`assert:openapi: FAIL — ${p}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `assert:openapi: ok — ${EXAMPLE_OPENAPI.specs.length} versions: pages, names, version links (same-operation mapping included) and badge, raw documents and checksums, agent records and page payloads (digest and raw document route), llms.txt (operation lines when opted in), sitemap, search, no console, CSP within the pinned allowlist\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('usage: node assert-openapi-artifacts.mjs <distDir>\n');
    process.exit(2);
  }
  await assertOpenApiArtifacts(dir);
}

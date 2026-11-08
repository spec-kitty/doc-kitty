/**
 * Build-time link integrity for rendered OpenAPI reference pages (FR-009,
 * FR-028, NFR-006; research R6).
 *
 * The renderer writes Markdown links after DocKitty's authored-Markdown link
 * rewrite has run, so this reads the built HTML instead. Only the documented
 * classes are in scope: relative `.md`/`.mdx`, root-relative URLs and
 * fragments. Other schemes and protocol-relative URLs are external and skip,
 * except the executable schemes, which always fail. The hook runs after the
 * raw-document publisher, so root-relative links to those documents count too.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = '[dk-openapi]';
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const DANGEROUS = /^(?:javascript|data|vbscript):/i;
const MARKDOWN = /\.mdx?$/i;
const ANCHOR_HREF = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>/gi;
const HTML_ID = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  colon: ':',
  gt: '>',
  lt: '<',
  newline: '\n',
  quot: '"',
  tab: '\t',
};

export interface OpenApiLinkCheckOptions {
  /** OpenAPI mount point, base-less and without surrounding slashes. */
  section: string;
  /** Astro's configured base, used for both page and target URL resolution. */
  base?: string;
}

interface ResolvedTarget {
  route: string;
  fragment: string;
  markdown: boolean;
}

/** Normalise Astro's `/` root base to the empty prefix used by dist paths. */
function normaliseBase(base = '/'): string {
  const stripped = base.replace(/\/+$/, '');
  if (stripped === '' || stripped === '/') return '';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/** Decode the HTML attribute entities a browser decodes before classifying a URL. */
function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z][\da-z]+));/gi, (match, decimal, hex, named) => {
    if (named !== undefined) return NAMED_ENTITIES[named.toLowerCase()] ?? match;
    const codePoint = Number.parseInt(decimal ?? hex, decimal === undefined ? 16 : 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
  });
}

/** Every `.html` file below `dir`, as sorted POSIX paths relative to it. */
function walkHtml(dir: string, root = dir): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(abs, root));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

/** The base-less route of one built HTML file, with Astro's directory-route shape. */
function pageRoute(relativeHtml: string, section: string): string {
  const posix = `${section}/${relativeHtml}`;
  if (posix.endsWith('/index.html')) return `/${posix.slice(0, -'index.html'.length)}`;
  return `/${posix.slice(0, -'.html'.length)}`;
}

/**
 * The renderer's Markdown content, not the later pagination/machine-link chrome.
 * Starlight closes that content before its `<footer>`; the `main` fallback keeps
 * small HTML fixtures usable without turning unrelated site chrome into R6 input.
 */
function contentOf(html: string): string {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  const marker = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bsl-markdown-content\b/i.exec(main);
  const start = marker?.index === undefined ? 0 : marker.index;
  const footer = main.slice(start).search(/<footer\b/i);
  return main.slice(start, footer === -1 ? undefined : start + footer);
}

function hrefsOf(html: string): string[] {
  return [...html.matchAll(ANCHOR_HREF)].map((match) => decodeEntities(match[1] ?? match[2] ?? match[3] ?? ''));
}

function idsOf(html: string): Set<string> {
  return new Set(
    [...html.matchAll(HTML_ID)].map((match) => decodeEntities(match[1] ?? match[2] ?? match[3] ?? '')),
  );
}

/** True for the executable schemes (also when URL-ignored ASCII controls hide them). */
function isDangerous(target: string): boolean {
  const withoutControls = Array.from(target)
    .filter((character) => character.charCodeAt(0) > 0x20 && character.charCodeAt(0) !== 0x7f)
    .join('');
  return DANGEROUS.test(withoutControls);
}

/** The classes R6 checks; all other relative URLs and external schemes skip. */
function inScope(target: string): boolean {
  if (target === '' || target.startsWith('//') || SCHEME.test(target)) return false;
  return target.startsWith('/') || target.startsWith('#') || /\.mdx?(?:[?#]|$)/i.test(target);
}

function stripBase(pathname: string, base: string): string | undefined {
  if (base === '') return pathname;
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) || '/' : undefined;
}

/** Resolve a target as a browser URL, then map a relative Markdown file to its route. */
function resolveTarget(target: string, route: string, base: string): ResolvedTarget | undefined {
  try {
    const markdown = !target.startsWith('/') && /\.mdx?(?:[?#]|$)/i.test(target);
    const resolved = new URL(target, new URL(`${base}${route}`, 'https://dist.invalid'));
    const pathname = stripBase(decodeURIComponent(resolved.pathname), base);
    if (pathname === undefined) return undefined;
    const mapped = markdown && MARKDOWN.test(pathname) ? pathname.replace(MARKDOWN, '/') : pathname;
    return { route: mapped, fragment: decodeURIComponent(resolved.hash.slice(1)), markdown };
  } catch {
    return undefined;
  }
}

/** The literal file or directory-route index for a base-less route, contained in dist. */
function targetFile(outDir: string, route: string): string | undefined {
  const relative = route.replace(/^\/+/, '');
  const candidates = route.endsWith('/') ? [`${relative}index.html`] : [relative, `${relative}/index.html`];
  for (const candidate of candidates) {
    const abs = path.resolve(outDir, candidate);
    if (abs !== outDir && !abs.startsWith(`${path.resolve(outDir)}${path.sep}`)) continue;
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return undefined;
}

/** A diagnostic-safe target: present and recognisable, but with its query redacted. */
function displayTarget(target: string): string {
  const query = target.indexOf('?');
  if (query === -1) return target;
  const fragment = target.indexOf('#', query);
  return `${target.slice(0, query)}?…${fragment === -1 ? '' : target.slice(fragment)}`;
}

/** One page's failures, in rendered document order. */
function checkPage(outDir: string, section: string, base: string, relativeHtml: string): string[] {
  const route = pageRoute(relativeHtml, section);
  const html = readFileSync(path.join(outDir, section, relativeHtml), 'utf8');
  const errors: string[] = [];
  for (const target of hrefsOf(contentOf(html)).map((href) => href.trim())) {
    if (isDangerous(target)) {
      errors.push(`${PREFIX} ${route}: broken link ${displayTarget(target)}`);
      continue;
    }
    if (!inScope(target)) continue;
    const resolved = resolveTarget(target, route, base);
    const file = resolved === undefined ? undefined : targetFile(outDir, resolved.route);
    if (file === undefined || resolved === undefined) {
      errors.push(`${PREFIX} ${route}: broken link ${displayTarget(target)}`);
      continue;
    }
    if (resolved.fragment !== '') {
      const hasFragment = file.endsWith('.html') && idsOf(readFileSync(file, 'utf8')).has(resolved.fragment);
      if (!hasFragment) errors.push(`${PREFIX} ${route}: broken link ${displayTarget(target)}`);
    }
  }
  return errors;
}

/** All broken-link messages under the configured OpenAPI section. */
export function findOpenApiBrokenLinks(outDir: string, options: OpenApiLinkCheckOptions): string[] {
  const sectionRoot = path.resolve(outDir, ...options.section.split('/'));
  const base = normaliseBase(options.base);
  return walkHtml(sectionRoot).flatMap((relativeHtml) => checkPage(outDir, options.section, base, relativeHtml));
}

/** The registered `astro:build:done` hook. Throws every failure, not just the first. */
export function openApiLinkCheck(options: OpenApiLinkCheckOptions) {
  return ({ dir }: { dir: URL }): void => {
    const errors = findOpenApiBrokenLinks(fileURLToPath(dir), options);
    if (errors.length > 0) throw new Error(errors.join('\n'));
  };
}

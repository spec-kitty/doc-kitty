/**
 * The REAL Markdown chain a docs page takes, for the Gherkin render tests:
 * Astro's content-entry renderer, the plugins `defineDocKittyIntegrations`
 * registers, then Starlight's directive parser. The test file mocks
 * `@astrojs/starlight` and `../lib/glossary/load.js` (vi.mock is per test file).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import gherkinFence, { type GherkinFenceOptions } from '../../lib/remark/gherkin-fence.js';
import { AGENT_INCLUDES_KEY } from '../../lib/gherkin/agent-includes.mjs';
import { docKittyIntegrations, runSetup } from './remark-stack.js';

const { defineDocKittyIntegrations } = await import('../../lib/config.js');
export { defineDocKittyIntegrations };
export type DocKittyOptions = Parameters<typeof defineDocKittyIntegrations>[0];

export interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}
interface EntryType {
  getEntryInfo: (o: { contents: string; fileUrl: URL }) => Promise<{ body: string; data: Record<string, unknown> }>;
  getRenderFunction: (config: Record<string, unknown>) => Promise<
    (entry: { id: string; data: Record<string, unknown>; body: string; filePath: string }) => Promise<{
      html: string;
      metadata: { headings: Array<{ depth: number; slug: string; text: string }> };
    }>
  >;
}

const req = createRequire(import.meta.url);
const astroDir = path.dirname(req.resolve('astro/package.json'));
const { markdownContentEntryType } = (await import(
  pathToFileURL(path.join(astroDir, 'dist/vite-plugin-markdown/content-entry-type.js')).href
)) as { markdownContentEntryType: EntryType };
const { markdownConfigDefaults } = (await import(
  createRequire(path.join(astroDir, 'package.json')).resolve('@astrojs/markdown-remark')
)) as { markdownConfigDefaults: Record<string, unknown> };

export interface DocKittyMarkdown {
  remark: unknown[];
  rehype: unknown[];
  /** The `doc-kitty:` integration names, in array order. */
  names: string[];
}
const stacks = new Map<string, DocKittyMarkdown>();

/**
 * The markdown plugins the doc-kitty integrations register for `options`, in
 * order (memoised per option set: building the array logs the drafts notice).
 */
export function docKittyMarkdown(options: Partial<DocKittyOptions>): DocKittyMarkdown {
  const key = JSON.stringify(options);
  const cached = stacks.get(key);
  if (cached) return cached;
  const stack: DocKittyMarkdown = { remark: [], rehype: [], names: [] };
  for (const entry of docKittyIntegrations(defineDocKittyIntegrations({ title: 'Docs', ...options }))) {
    stack.names.push(entry.name);
    if (!entry.hooks?.['astro:config:setup']) continue;
    for (const cfg of runSetup(entry)) {
      stack.remark.push(...(cfg.markdown?.remarkPlugins ?? []));
      stack.rehype.push(...(cfg.markdown?.rehypePlugins ?? []));
    }
  }
  stacks.set(key, stack);
  return stack;
}

/** Expressive Code's rehype plugin, resolved through Starlight (the build's own copy). */
export async function expressiveCodePlugin(): Promise<unknown> {
  const fromStarlight = createRequire(req.resolve('@astrojs/starlight'));
  const fromAec = createRequire(fromStarlight.resolve('astro-expressive-code'));
  return ((await import(fromAec.resolve('rehype-expressive-code'))) as { default: unknown }).default;
}

/** `leadingRehype` runs before the integrations' rehype plugins (Starlight puts Expressive Code there). */
export async function render(contents: string, options: Partial<DocKittyOptions>, filePath = 'docs/page.md', leadingRehype: unknown[] = []) {
  const { remark, rehype } = docKittyMarkdown(options);
  let hast: HastNode = { type: 'root' };
  const capture = () => (tree: HastNode) => {
    hast = structuredClone(tree);
  };
  const absPath = path.resolve(filePath);
  const { body, data } = await markdownContentEntryType.getEntryInfo({ contents, fileUrl: pathToFileURL(absPath) });
  const renderFn = await markdownContentEntryType.getRenderFunction({
    markdown: { ...markdownConfigDefaults, syntaxHighlight: false, remarkPlugins: [...remark, remarkDirective], rehypePlugins: [...leadingRehype, ...rehype, capture] },
  });
  const out = await renderFn({ id: 'page', data, body, filePath: absPath });
  return { html: out.html, headings: out.metadata.headings, hast };
}

const classes = (n: HastNode): string[] => {
  const c = n.properties?.className;
  return Array.isArray(c) ? c.map(String) : [];
};
export function all(root: HastNode, match: (n: HastNode) => boolean, out: HastNode[] = []): HastNode[] {
  if (match(root)) out.push(root);
  for (const c of root.children ?? []) all(c, match, out);
  return out;
}
export const text = (n: HastNode): string => (n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(text).join(''));
export const elements = (n: HastNode) => (n.children ?? []).filter((c) => c.type === 'element');
export const byClass = (root: HastNode, cls: string) => all(root, (n) => n.type === 'element' && classes(n).includes(cls));

/** Each heading's text followed by the text of the element right after it, when that is a result line. */
export function headingResults(root: HastNode): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (node: HastNode) => {
    const kids = elements(node);
    kids.forEach((k, i) => {
      if (/^h[1-6]$/.test(k.tagName ?? '')) {
        const next = kids[i + 1];
        out.push([text(k), next && classes(next).includes('dk-gherkin__result') ? text(next) : '']);
      }
    });
    for (const k of kids) walk(k);
  };
  walk(root);
  return out;
}

/** The agent Markdown of the first `::gherkin` include on a page. */
export function agentMarkdown(markdown: string, options: GherkinFenceOptions): string {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(gherkinFence as never, { warn: () => {}, ...options });
  const file = { path: path.resolve('docs/page.md'), value: markdown, data: { astro: { frontmatter: {} as Record<string, unknown> } } };
  processor.runSync(processor.parse(markdown), file as never);
  return (file.data.astro.frontmatter[AGENT_INCLUDES_KEY] as Array<{ markdown: string }>)[0].markdown;
}

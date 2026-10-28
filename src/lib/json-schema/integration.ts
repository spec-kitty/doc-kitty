/**
 * Opt-in Astro hook: regenerate the JSON schema output folder from JSON.
 */
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { AstroIntegration } from 'astro';
import {
  DEFAULT_JSON_SCHEMA_OUT,
  DEFAULT_JSON_SCHEMA_SOURCE,
  DEFAULT_JSON_GRAPH,
  JSON_GRAPH_TYPES,
  JSON_PUBLIC_DIR,
  generateJsonSchemaPages,
  publishJsonFiles,
} from './generate.mjs';

export type JsonGraph = (typeof JSON_GRAPH_TYPES)[number];

export interface JsonSchemaPagesOptions {
  /**
   * Directory of JSON schemas and content, absolute or relative to the project root.
   * Default `json-files`.
   */
  source?: string;
  /**
   * Folder inside the docs tree to regenerate, relative to `docsDir`.
   * Default `json-files-output`. Reserved section names are refused.
   */
  out?: string;
  /**
   * PlantUML drawing of each JSON document. `json` is the `@startjson` tree.
   * `uml` is the class-diagram box. Default `json`.
   */
  graph?: JsonGraph;
}

/** Reject an unknown or empty `jsonSchema` option before the build starts. */
export function resolveJsonSchemaOptions(raw: unknown): { source: string; out: string; graph: JsonGraph } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[dk-json-schema] jsonSchema must be an object');
  }
  const { source, out, graph, ...rest } = raw as Record<string, unknown>;
  const extra = Object.keys(rest)[0];
  if (extra !== undefined) {
    throw new Error(`[dk-json-schema] unknown key "${extra}" under jsonSchema; expected source, out, and graph`);
  }
  if (source !== undefined && (typeof source !== 'string' || source.trim() === '')) {
    throw new Error('[dk-json-schema] jsonSchema.source must be a non-empty path');
  }
  if (out !== undefined && (typeof out !== 'string' || out.trim() === '' || path.isAbsolute(out))) {
    throw new Error('[dk-json-schema] jsonSchema.out must be a relative folder inside the docs tree');
  }
  if (graph !== undefined && graph !== 'json' && graph !== 'uml') {
    throw new Error(
      `[dk-json-schema] jsonSchema.graph must be ${JSON_GRAPH_TYPES.map((name) => `"${name}"`).join(' or ')}`,
    );
  }
  return {
    source: (typeof source === 'string' ? source : DEFAULT_JSON_SCHEMA_SOURCE).trim(),
    out: (typeof out === 'string' ? out : DEFAULT_JSON_SCHEMA_OUT).trim(),
    graph: graph ?? DEFAULT_JSON_GRAPH,
  };
}

/**
 * The file under `public/json-files` for one request URL, or undefined when
 * the URL is not that tree. `..` segments are refused.
 *
 * @param url request URL, including an optional query
 * @param publicDir absolute `public/json-files` directory
 * @param base site base prefix (`''` or `/doc-kitty`)
 */
export function publishedJsonFile(url: string, publicDir: string, base: string): string | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return undefined;
  }
  const prefixed = `${base}/${JSON_PUBLIC_DIR}/`.replace(/\/{2,}/g, '/');
  const bare = `/${JSON_PUBLIC_DIR}/`;
  const rel = pathname.startsWith(prefixed)
    ? pathname.slice(prefixed.length)
    : base !== '' && pathname.startsWith(bare)
      ? pathname.slice(bare.length)
      : undefined;
  if (rel === undefined || rel === '') return undefined;
  const parts = rel.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return undefined;
  const root = path.resolve(publicDir);
  const file = path.resolve(root, ...parts);
  if (file !== root && !file.startsWith(root + path.sep)) return undefined;
  return file;
}

/**
 * Dev middleware for the published JSON. Astro's route guard answers a browser
 * navigation (`Accept: text/html`) with 404 when the same path exists at the
 * project root, and the default source directory is that path (`json-files/`).
 * The guard runs ahead of Vite's public-file handler, so the copy in
 * `public/json-files` is never reached. This handler is installed in front of
 * the guard and serves that copy.
 */
export function publishedJsonDevMiddleware(publicDir: string, base: string) {
  return (req: { url?: string; method?: string }, res: { setHeader: (name: string, value: string) => void; end: (body?: Buffer) => void }, next: () => void) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const file = publishedJsonFile(req.url ?? '', publicDir, base);
    if (file === undefined || !existsSync(file)) return next();
    const stat = lstatSync(file);
    if (!stat.isFile()) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', String(stat.size));
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
  };
}

export function jsonSchemaIntegration(
  source: string,
  docsDir: string,
  out: string,
  diagrams = true,
  graph: JsonGraph = DEFAULT_JSON_GRAPH,
  base = '',
): AstroIntegration {
  return {
    name: 'doc-kitty:json-schema',
    hooks: {
      'astro:config:setup': ({ addWatchFile, logger, updateConfig }) => {
        const root = process.cwd();
        const docsRoot = path.resolve(root, docsDir);
        const sourceDir = path.resolve(root, source);
        const result = generateJsonSchemaPages({
          sourceDir,
          docsRoot,
          outDir: path.resolve(docsRoot, out),
          diagrams,
          graph,
        });
        const publicDir = path.resolve(root, 'public', JSON_PUBLIC_DIR);
        publishJsonFiles(result.files, publicDir);
        // `enforce: 'post'` so the returned hook runs after `astro:server`,
        // whose post hook unshifts the route guard. Unshifting here puts this
        // handler in front of that guard.
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:json-schema-dev',
                enforce: 'post' as const,
                configureServer(server: { middlewares: { stack: { route: string; handle: unknown }[] } }) {
                  return () => {
                    server.middlewares.stack.unshift({
                      route: '',
                      handle: publishedJsonDevMiddleware(publicDir, base),
                    });
                  };
                },
              },
            ],
          },
        });
        addWatchFile(sourceDir);
        for (const file of result.sources) addWatchFile(file);
        if (typeof logger.info === 'function') {
          logger.info(
            `[dk-json-schema] ${result.sources.length} JSON file(s) → ${docsDir}/${out}: ` +
              `${result.written.length} written, ${result.unchanged.length} unchanged, ${result.removed.length} removed`,
          );
        }
      },
    },
  };
}

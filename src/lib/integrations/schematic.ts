/**
 * `kind: Schematic` pages (ADR-0067): registers the `schematic` remark plugin and
 * publishes each referenced schema file, byte for byte, next to its page so the
 * `Source` link works. Always on, but a site with no Schematic page pays only a
 * directory walk at the end of the build.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import matter from 'gray-matter';
import type { IndexBasenameOption } from '../metadata.js';
import { walkMarkdownPaths } from '../docs-walk.mjs';
import { publishDraftsInForce, unpublishedDraftPaths } from '../draft-publication.mjs';
import { readmeToIndexId, routeOfSlug } from '../vocabulary-core.mjs';
import schematic from '../remark/schematic.js';
import { SCHEMATIC_KIND, SCHEMATIC_MIME, loadSchematic, schematicPublishedPath } from '../schematic/core.mjs';
import { normalizeBasePrefix } from './shared.js';

interface Published {
  /** Path of the published file, without base: `/reference/events/lane.yaml`. */
  href: string;
  /** Absolute path of the schema file. */
  file: string;
}

/** The schema file of every published Schematic page. A bad reference throws `[dk-schematic]`. */
function publishedSchemas(docsRoot: string, root: string, indexBasename?: IndexBasenameOption): Published[] {
  const withheld = new Set<string>(unpublishedDraftPaths(docsRoot, publishDraftsInForce(), indexBasename));
  const out: Published[] = [];
  for (const rel of walkMarkdownPaths(docsRoot)) {
    const source = readFileSync(path.join(docsRoot, rel), 'utf8');
    if (!source.includes(SCHEMATIC_KIND) || withheld.has(rel)) continue;
    const data = matter(source).data;
    if (data.kind !== SCHEMATIC_KIND) continue;
    const loaded = loadSchematic(rel, data.schematic_path, root);
    const route = routeOfSlug(readmeToIndexId(rel, { indexBasename }));
    out.push({ href: schematicPublishedPath(route, loaded.ext), file: loaded.abs });
  }
  return out;
}

export function schematicIntegration(
  docsDir: string,
  indexBasename: IndexBasenameOption | undefined,
  diagram: boolean,
  base: string,
): AstroIntegration {
  const root = process.cwd();
  const docsRoot = path.resolve(root, docsDir);
  const prefix = normalizeBasePrefix(base);
  return {
    name: 'doc-kitty:schematic',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          markdown: { remarkPlugins: [[schematic, { docsRoot, root, indexBasename, diagram }]] },
          vite: {
            plugins: [
              {
                name: 'doc-kitty:schematic-dev',
                configureServer(server) {
                  // Dev only: serve the file the way the build publishes it. Only paths
                  // computed from a Schematic page are served, so nothing else is reachable.
                  server.middlewares.use(
                    (req, res, next) => {
                      const pathname = (req.url ?? '').split(/[?#]/)[0];
                      const ext = path.extname(pathname).toLowerCase();
                      if (!Object.hasOwn(SCHEMATIC_MIME, ext)) return next();
                      try {
                        const href = prefix && pathname.startsWith(prefix + '/') ? pathname.slice(prefix.length) : pathname;
                        const hit = publishedSchemas(docsRoot, root, indexBasename).find((p) => p.href === href);
                        if (!hit) return next();
                        res.setHeader('Content-Type', `${SCHEMATIC_MIME[ext as keyof typeof SCHEMATIC_MIME]}; charset=utf-8`);
                        res.setHeader('X-Content-Type-Options', 'nosniff');
                        res.end(readFileSync(hit.file));
                      } catch {
                        next();
                      }
                    },
                  );
                },
              },
            ],
          },
        });
      },
      'astro:build:done': ({ dir }) => {
        const dist = fileURLToPath(dir);
        for (const { href, file } of publishedSchemas(docsRoot, root, indexBasename)) {
          const target = path.join(dist, ...href.split('/'));
          mkdirSync(path.dirname(target), { recursive: true });
          copyFileSync(file, target);
        }
      },
    },
  };
}

// @ts-check
/**
 * The file-system edge of the OKF export (#178, FR-018): read the built graph and
 * the docs tree, run the pure core, write the bundle. The CLI and the
 * `astro:build:done` hook both call {@link exportOkfToDisk}, so they cannot differ.
 *
 * @module okf-export/disk
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { excludedFoldersFor, isExcludedPath, isInsideExcludedFolder, walkMarkdownPaths } from '../docs-walk.mjs';
import { exportOkfBundle } from './core.mjs';

/**
 * Every docs page (the shared docs walk) plus each `log.md`, which the walk leaves
 * out but the export copies verbatim (OKF §9).
 *
 * @param {string} docsDir
 * @returns {Map<string, string>} docs-relative path -> text
 */
export function readDocsSources(docsDir) {
  const root = path.resolve(docsDir);
  const logs = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name === 'log.md')
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .filter((rel) => !rel.split('/').some((seg) => seg.startsWith('.') || seg === '_meta'))
    // A log in a folder the site excludes (ADR-0068) is no more exported than its pages.
    .filter((rel) => !isInsideExcludedFolder(root) && !isExcludedPath(rel, excludedFoldersFor(root)));
  return new Map([...walkMarkdownPaths(root), ...logs].map((rel) => [rel, readFileSync(path.join(root, rel), 'utf8')]));
}

/**
 * Empty `outDir`, then write the bundle in its (sorted) map order.
 *
 * @param {string} outDir
 * @param {Map<string, string>} bundle
 */
export function writeBundle(outDir, bundle) {
  rmSync(outDir, { recursive: true, force: true });
  for (const [rel, text] of bundle) {
    const file = path.join(outDir, ...rel.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
}

/**
 * @param {object} args
 * @param {string} args.graphFile the built `content-graph.json`
 * @param {string} args.docsDir
 * @param {string} args.outDir
 * @param {import('./core.mjs').ExportOptions} [args.options]
 * @returns {Map<string, string>} what was written
 */
export function exportOkfToDisk({ graphFile, docsDir, outDir, options }) {
  const graph = JSON.parse(readFileSync(graphFile, 'utf8'));
  const bundle = exportOkfBundle(graph, readDocsSources(docsDir), options);
  writeBundle(outDir, bundle);
  return bundle;
}

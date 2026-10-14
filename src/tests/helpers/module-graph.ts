/**
 * `module-graph` — the static RUNTIME import graph of a toolkit source file, for
 * guards that keep a route's graph free of a heavy package (the Gherkin parser
 * must stay out of `llms.txt` and `/api/pages/<id>.json`; see
 * `scenario-index-filter.ts` and `gherkin/agent-includes.mjs`).
 *
 * It follows relative imports and re-exports transitively, skipping type-only
 * ones (`import type` / `export type` erase at build) and comments. `.js`
 * specifiers map to the `.ts` source the way the TypeScript build resolves
 * them. Bare specifiers are collected as packages and not followed.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function runtimeGraph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const specs = [
      ...code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?\bfrom\s+['"]([^'"]+)['"]/gm),
      ...code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
    ].map((m) => m[1]);
    for (const spec of specs) {
      if (!spec.startsWith('.')) {
        packages.add(spec);
        continue;
      }
      const abs = path.resolve(path.dirname(file), spec);
      const ts = abs.replace(/\.js$/, '.ts');
      queue.push(existsSync(ts) ? ts : abs);
    }
  }
  return { files, packages };
}

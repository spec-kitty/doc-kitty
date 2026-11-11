#!/usr/bin/env node
/**
 * Assert that a built site's diagrams were all drawn at build time (#314).
 *
 *   dockitty-assert-diagrams <dist>
 *
 * Reads every `.html` file under `<dist>` and applies `diagram-artifacts.mjs`:
 * every `<figure class="dk-diagram">` holds an `<svg>`, and no raw diagram code
 * block, client-rendered `<pre class="mermaid">`, `plantuml-error` block or
 * plantuml.com URL remains. Redirect stubs (legacy `.html` redirects and Astro's
 * own) are skipped: they share their target's route and hold no content.
 *
 * Run it on a build made with `DK_DIAGRAM_BUILD_RENDER=build`; a client-mode
 * build fails it by design. It checks the built HTML only: whether each source
 * fence reached a page is the site's own route question.
 *
 * Exits 0 on pass, 1 on a defect, 2 on a usage error. Node built-ins only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { diagramDefects, isRedirectStub } from './diagram-artifacts.mjs';

const NAME = 'assert-diagrams';
const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith('-')) {
  console.error(`${NAME}: usage: dockitty-assert-diagrams <dist>`);
  process.exit(2);
}
const dist = args[0];
let isDir = false;
try {
  isDir = statSync(dist).isDirectory();
} catch {
  // reported below
}
if (!isDir) {
  console.error(`${NAME}: ${dist} is not a directory`);
  process.exit(2);
}

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(abs));
    else if (entry.name.endsWith('.html')) out.push(abs);
  }
  return out.sort();
}

let pages = 0;
let stubs = 0;
let figures = 0;
let failed = 0;
for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  if (isRedirectStub(html)) {
    stubs += 1;
    continue;
  }
  pages += 1;
  const result = diagramDefects(html);
  figures += result.figures;
  const rel = path.relative(dist, file).split(path.sep).join('/');
  for (const defect of result.defects) {
    console.error(`${NAME}: FAIL — ${rel}: ${defect}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`${NAME}: ${failed} defect(s) across ${pages} page(s)`);
  process.exit(1);
}
console.log(`${NAME}: OK — ${figures} diagram figure(s) drawn at build time across ${pages} page(s); ${stubs} redirect stub(s) skipped`);

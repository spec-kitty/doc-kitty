#!/usr/bin/env node
/**
 * The PDF lane's client-mode determinism check (#394, review of #462 MEDIUM-2).
 *
 * The lane's main dist draws its diagrams at build time. A site that draws them in the
 * browser (client mode) prints Mermaid's client render, which jitters its edge paths
 * with `Math.random`; `dockitty-pdf` seeds it so two prints stay identical. This builds
 * the chrome fixture in client mode, with a page of Mermaid diagrams (an entity
 * relationship diagram's edges are where the jitter shows) in a section that has its
 * own PDF, checks that the print document really holds a client-mode diagram, then
 * runs `assert-pdf-determinism` on it. Needs Playwright's Chromium (the pdf lane's
 * container has it). Exit code: the determinism gate's, or 1 when the setup fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildChromeFixture, REPO_ROOT } from './harness.mjs';

const PAGE = `---
title: Client diagram
description: A page whose Mermaid diagram the browser draws, for the client-mode PDF determinism check.
doc_status: active
updated: 2026-11-25T00:00:00Z
kind: Reference
---

# Client diagram

\`\`\`mermaid
flowchart LR
  D[docs] --> L[toolkit loader]
  L --> S[Starlight]
  L --> M[sitemap-index.xml]
  L --> A["/api/*.json"]
  S --> H[dist]
\`\`\`

\`\`\`mermaid
erDiagram
  SECTION ||--o{ PAGE : holds
  PAGE ||--|| FRONTMATTER : carries
  PAGE }o--o{ PAGE : relates_to
  FRONTMATTER {
    string title
    string doc_status
  }
\`\`\`
`;

const build = buildChromeFixture({
  options: { diagrams: true, pdf: { sections: true, exclude: { sections: ['context', 'reference', 'adr', 'glossary'] } } },
  env: { DK_DIAGRAM_BUILD_RENDER: 'off' },
  files: { 'docs/guides/client-diagram.md': PAGE },
});
if (build.status !== 0) {
  console.error(`pdf-client-determinism: the client-mode fixture build failed\n${build.output}`);
  process.exit(1);
}
const printDoc = path.join(build.dist, 'print', 'guides', 'index.html');
if (!existsSync(printDoc) || !/<pre class="mermaid"/.test(readFileSync(printDoc, 'utf8'))) {
  console.error(`pdf-client-determinism: ${path.relative(REPO_ROOT, printDoc)} holds no client-mode diagram, so the check would prove nothing`);
  process.exit(1);
}
const run = spawnSync(
  process.execPath,
  [path.join(REPO_ROOT, 'src/scripts/assert-pdf-determinism.mjs'), build.dist, '--base', '/doc-kitty'],
  { stdio: 'inherit', env: { ...process.env, SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH ?? '1764028800' } },
);
process.exit(run.status ?? 1);

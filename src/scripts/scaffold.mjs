#!/usr/bin/env node
/**
 * Scaffold the full Common Docs — Kitty Variation tree under a docs root.
 *
 * Mirrors velvet-tiger/common-docs `common-docs-scaffold`, with the Kitty
 * twists applied: section indexes are `README.md` (not `index.md`) and DO carry
 * frontmatter. Never overwrites an existing file.
 *
 * Usage:
 *   node scripts/scaffold.mjs [base]            # default base: docs
 *   node scripts/scaffold.mjs docs --sections context,architecture,guides
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

const argv = process.argv.slice(2);
const base = argv.find((a) => !a.startsWith('--')) ?? 'docs';
const sectionsFlag = (() => {
  const i = argv.indexOf('--sections');
  return i !== -1 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()) : null;
})();

function expectedType(relPath) {
  const parts = relPath.split(sep);
  const section = parts[0];
  const file = parts[parts.length - 1];
  switch (section) {
    case 'context': return 'Context';
    case 'architecture': return 'Architecture';
    case 'adr': return file === 'template.md' ? 'Template' : 'ADR';
    case 'plans':
      if (parts[1] === 'epics') return 'Epic';
      if (parts[1] === 'features') return 'Feature';
      return 'Plan';
    case 'api': return 'API';
    case 'configuration': return 'Configuration';
    case 'integrations': return 'Integration';
    case 'security': return 'Security';
    case 'guides': return 'Guide';
    case 'operations': return parts[1] === 'runbooks' ? 'Runbook' : 'Operations';
    case 'migrations': return 'Migration';
    case 'changelog': return 'Changelog';
    default: return null;
  }
}

// Section -> leaf files (README index is added automatically per directory).
const SECTIONS = {
  context: ['product.md', 'domain.md', 'stakeholders.md'],
  architecture: ['overview.md', 'data-model.md', 'api-design.md', 'infrastructure.md', 'services.md', 'constraints.md'],
  adr: ['template.md'],
  plans: ['roadmap.md', 'epics/', 'features/'],
  api: ['endpoints.md', 'authentication.md', 'errors.md', 'rate-limiting.md', 'changelog.md'],
  configuration: ['environment.md', 'feature-flags.md', 'secrets.md'],
  integrations: [],
  security: ['threat-model.md', 'auth.md', 'data-handling.md', 'vulnerability-management.md', 'incident-response.md'],
  guides: ['getting-started.md', 'development.md', 'deployment.md', 'testing.md', 'contributing.md'],
  operations: ['monitoring.md', 'disaster-recovery.md', 'capacity-planning.md', 'runbooks/'],
  migrations: [],
  changelog: [],
};

const RUNBOOKS = ['deploy.md', 'rollback.md', 'scale.md', 'incident.md'];

const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

function titleize(name) {
  return name.replace(/\.md$/, '').replace(/[-_/]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function leafFrontmatter(relPath, title) {
  const type = expectedType(relPath);
  const typeLine = type ? `type: ${type}\n` : '';
  return `---
title: ${title}
description: TODO one sentence describing what this document contains.
status: draft
updated: ${today}
${typeLine}generated:
  by: agent/doc-kitty-scaffold
  at: ${now}
---

# ${title}

TODO write this page.
`;
}

function indexFrontmatter(relPath, title, blurb) {
  const type = expectedType(relPath);
  const typeLine = type ? `type: ${type}\n` : '';
  return `---
title: ${title}
description: ${blurb}
status: draft
updated: ${today}
${typeLine}generated:
  by: agent/doc-kitty-scaffold
  at: ${now}
---

# ${title}

${blurb}

TODO list and describe the files in this section.
`;
}

const written = [];
const skipped = [];

function write(relPath, content) {
  const full = join(base, relPath);
  if (existsSync(full)) { skipped.push(relPath); return; }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  written.push(relPath);
}

// Bundle-root README (okf_version, exempt from `type`).
write('README.md', `---
okf_version: "0.2"
title: Documentation
description: Master entry point for this project's documentation.
status: draft
updated: ${today}
generated:
  by: agent/doc-kitty-scaffold
  at: ${now}
---

# Documentation

TODO one-paragraph project summary.

## Sections

TODO ordered directory listing with one-line descriptions.
`);

const chosen = sectionsFlag ?? Object.keys(SECTIONS);
for (const section of chosen) {
  const leaves = SECTIONS[section];
  if (!leaves) { console.warn(`⚠ unknown section "${section}" — skipped`); continue; }

  write(join(section, 'README.md'), indexFrontmatter(join(section, 'README.md'), titleize(section), `The ${section} section.`));

  for (const leaf of leaves) {
    if (leaf.endsWith('/')) {
      // nested directory with its own README
      const sub = leaf.slice(0, -1);
      const rel = join(section, sub, 'README.md');
      write(rel, indexFrontmatter(rel, titleize(sub), `The ${section}/${sub} section.`));
      if (section === 'operations' && sub === 'runbooks') {
        for (const rb of RUNBOOKS) {
          const r = join(section, sub, rb);
          write(r, leafFrontmatter(r, titleize(rb)));
        }
      }
    } else {
      const rel = join(section, leaf);
      write(rel, leafFrontmatter(rel, titleize(leaf)));
    }
  }
}

console.log(`✓ scaffolded ${written.length} file(s) under ${base}/`);
if (skipped.length) console.log(`  (skipped ${skipped.length} existing file(s))`);

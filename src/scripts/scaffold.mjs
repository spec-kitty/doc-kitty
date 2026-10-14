#!/usr/bin/env node
/**
 * Scaffold the full DocKitty tree under a docs root.
 *
 * Mirrors velvet-tiger/common-docs `common-docs-scaffold`, with the Kitty
 * twists applied: section indexes are `README.md` (not `index.md`) and DO carry
 * frontmatter. Never overwrites an existing file.
 *
 * Usage:
 *   node scripts/scaffold.mjs [base]            # default base: docs
 *   node scripts/scaffold.mjs docs --sections context,architecture,guides
 *   node scripts/scaffold.mjs docs --index-basename index   # FR-001/FR-003
 *   node scripts/scaffold.mjs docs --astro-config site/astro.config.mjs
 *
 * The index names are read from the site's astro.config.* next to the docs folder;
 * with none, they are README and a warning says so. `--astro-config <path>` names a
 * config that lives elsewhere (missing or unloadable: exit 2).
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
// Single source of truth (#49 IC-02/NFR-001): import the section→type derivation
// from `vocabulary-core.mjs` (fs-free `.mjs`, resolves under plain `node`) rather
// than carrying a hardcoded `expectedType` switch. The core additionally derives
// `presentations` → `Presentation`, which this tool's old switch omitted — an
// additive alignment with the canonical map (NFR-002).
import { expectedDocType } from '../lib/vocabulary-core.mjs';
import { announceIndexNames, resolveSiteIndexBasenames } from './site-index-names.mjs';

const argv = process.argv.slice(2);
const base = argv.find((a) => !a.startsWith('--')) ?? 'docs';
const sectionsFlag = (() => {
  const i = argv.indexOf('--sections');
  return i !== -1 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()) : null;
})();
// FR-001/FR-007: the basename this tool scaffolds section indexes as. An
// existing site's config decides (its first name); a new tree has no config, so
// `--index-basename index` picks `index.md`, and `README` is the default
// (NFR-003). A flag that is not one of a configured site's names is an error.
const indexBasename = (() => {
  const i = argv.indexOf('--index-basename');
  const flag = i !== -1 && argv[i + 1] ? argv[i + 1] : undefined;
  try {
    const ci = argv.indexOf('--astro-config');
    const configPath = ci !== -1 && argv[ci + 1] ? argv[ci + 1] : undefined;
    const resolved = resolveSiteIndexBasenames(base, { tool: 'scaffold', configPath });
    announceIndexNames(resolved);
    const { names, fromConfig } = resolved;
    if (flag === undefined) return names[0];
    if (!fromConfig) return flag;
    const match = names.find((n) => n.toLowerCase() === flag.toLowerCase());
    if (match === undefined) {
      throw new Error(
        `[scaffold] --index-basename ${flag} is not one of the site's index names ${names.join(',')}. ` +
          'Remove the flag, or change indexBasename in the site config.',
      );
    }
    return match;
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }
})();
const indexFilename = `${indexBasename}.md`;

/**
 * A sensible `kind` placeholder for a scaffolded page (ADR-0009 vocabulary).
 * A section index is a `Hub`; otherwise the kind follows the section. `Reference`
 * is the neutral default — the author refines it.
 */
function expectedKind(relPath, isIndex) {
  if (isIndex) return 'Hub';
  const section = relPath.split(sep)[0];
  switch (section) {
    case 'adr': return 'ADR';
    case 'changelog': return 'Changelog';
    case 'guides': return 'How-To';
    case 'plans': return relPath.split(sep)[1] === 'features' ? 'Feature' : 'Planning';
    default: return 'Reference';
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
  const type = expectedDocType(relPath.split(sep).join('/'));
  const typeLine = type ? `type: ${type}\n` : '';
  return `---
title: ${title}
description: TODO one sentence describing what this document contains.
doc_status: draft
updated: ${today}
${typeLine}kind: ${expectedKind(relPath, false)}
generated:
  by: agent/doc-kitty-scaffold
  at: ${now}
---

# ${title}

TODO write this page.
`;
}

function indexFrontmatter(relPath, title, blurb) {
  const type = expectedDocType(relPath.split(sep).join('/'));
  const typeLine = type ? `type: ${type}\n` : '';
  return `---
title: ${title}
description: ${blurb}
doc_status: draft
updated: ${today}
${typeLine}kind: ${expectedKind(relPath, true)}
generated:
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

// Bundle-root index (okf_version, exempt from `type`).
write(indexFilename, `---
okf_version: "0.2"
title: Documentation
description: Master entry point for this project's documentation.
doc_status: draft
updated: ${today}
kind: Hub
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

  write(join(section, indexFilename), indexFrontmatter(join(section, indexFilename), titleize(section), `The ${section} section.`));

  for (const leaf of leaves) {
    if (leaf.endsWith('/')) {
      // nested directory with its own section index
      const sub = leaf.slice(0, -1);
      const rel = join(section, sub, indexFilename);
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

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
 *   node scripts/scaffold.mjs docs --preset operating-model   # #402
 *
 * `--preset operating-model` writes only that preset: an `operating-model/`
 * section index (a Hub, type Operations) and the 12 operating-model template
 * pages, with preset measures and authoring prompts. It is refused with
 * `--sections` (exit 2), as is an unknown preset. Existing files are skipped.
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
import { scaffoldMeta } from './scaffold-meta.mjs';
import { announceIndexNames, resolveSiteIndexBasenames } from './site-index-names.mjs';
import { OPERATING_MODEL_TEMPLATES, renderTemplatePage } from '../lib/operating-model-templates.mjs';

const argv = process.argv.slice(2);
// Flags that take a value: their value is not the base folder.
const VALUE_FLAGS = new Set(['--sections', '--index-basename', '--astro-config', '--preset']);
const base = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1])) ?? 'docs';

/** An argument error: say why, write nothing, exit 2. */
function argumentError(message) {
  console.error(`✖ ${message}`);
  process.exit(2);
}

// `--preset <id>` (#402). Only `operating-model` exists.
const PRESETS = ['operating-model'];
const presetFlag = (() => {
  const i = argv.indexOf('--preset');
  if (i === -1) return null;
  const id = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
  if (argv.includes('--sections')) argumentError('--preset writes only its own pages; do not combine --preset with --sections');
  if (!PRESETS.includes(id)) argumentError(`unknown preset "${id}". Known presets: ${PRESETS.join(', ')}`);
  return id;
})();
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

const meta = scaffoldMeta();

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
${typeLine}kind: ${expectedKind(relPath, false)}
${meta}
---

# ${title}

TODO write this page.
`;
}

function indexFrontmatter(relPath, title, blurb, typeOverride) {
  const type = typeOverride ?? expectedDocType(relPath.split(sep).join('/'));
  const typeLine = type ? `type: ${type}\n` : '';
  return `---
title: ${title}
description: ${blurb}
doc_status: draft
okf_version: "0.2"
${typeLine}kind: ${expectedKind(relPath, true)}
${meta}
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

if (presetFlag === 'operating-model') {
  // The section is opt-in (its sections.yaml entry is a documented snippet), so
  // the frozen section map derives no type for it: set Operations explicitly.
  const sectionIndex = join('operating-model', indexFilename);
  write(
    sectionIndex,
    indexFrontmatter(
      sectionIndex,
      'Operating model',
      'How the organisation runs, with its structure, roles, governance, processes and policies.',
      'Operations',
    ),
  );
  for (const record of OPERATING_MODEL_TEMPLATES) {
    write(`${record.path}.md`, renderTemplatePage(record));
  }
} else {
  writeDefaultTree();
}

/** The default DocKitty tree, as before #402. */
function writeDefaultTree() {
  // Bundle-root index (okf_version, exempt from `type`).
  write(indexFilename, `---
okf_version: "0.2"
title: Documentation
description: Master entry point for this project's documentation.
doc_status: draft
kind: Hub
${meta}
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
}

console.log(`✓ scaffolded ${written.length} file(s) under ${base}/`);
if (skipped.length) console.log(`  (skipped ${skipped.length} existing file(s))`);

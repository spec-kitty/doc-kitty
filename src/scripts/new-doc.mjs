#!/usr/bin/env node
/**
 * Scaffold a single DocKitty page with correct frontmatter.
 *
 * Usage:
 *   node scripts/new-doc.mjs <slug> [--title "Title"] [--type Guide]
 *                                    [--base docs] [--section]
 *                                    [--index-basename index] [--astro-config <path>]
 *   node scripts/new-doc.mjs --template <id> [slug] [--title "Title"] [--type T]
 *                                    [--base docs]
 *
 *   <slug>       path under the docs root, e.g. "guides/deployment"
 *   --template   write an operating-model template page (#402): frontmatter with
 *                preset measures, a heading skeleton and authoring prompts. The
 *                slug defaults to the template's path. The template fixes the
 *                kind, so --kind and --section are refused with it (exit 2), as
 *                is an unknown id. Never overwrites an existing file.
 *   --title      one line: a control character (such as a newline) is refused
 *   --section    create the directory's section-index file (default
 *                README.md; FR-001/FR-003) instead of "<slug>.md"
 *   --type       override the type inferred from the path
 *   --index-basename  which of the site's index names to create with --section.
 *                The names come from the site's astro.config.* (the first is
 *                the default); a site with no config uses this flag, else README.
 *   --astro-config  site config file, when it is not astro.config.* next to the
 *                docs folder. Missing or unloadable: exit 2. With no config at all
 *                the index name is README, with a warning.
 *
 * Examples:
 *   node scripts/new-doc.mjs guides/deployment --title "Deployment"
 *   node scripts/new-doc.mjs integrations --section --title "Integrations"
 *   node scripts/new-doc.mjs --template incident-response
 *   node scripts/new-doc.mjs --template role operating-model/roles/dpo --title "Data Protection Officer"
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
// Single source of truth (#49 IC-02/NFR-001): the section→type derivation lives
// in `vocabulary-core.mjs`. This bare-Node scaffolder imports it (the core is
// fs-free `.mjs`, so it resolves under plain `node`) instead of carrying its own
// hardcoded `expectedType` switch. The core also derives `presentations` →
// `Presentation`, which this tool's old local switch omitted — an additive
// alignment with the canonical map (NFR-002: no existing value's meaning changes).
import { expectedDocType } from '../lib/vocabulary-core.mjs';
import { scaffoldMeta } from './scaffold-meta.mjs';
import { announceIndexNames, resolveSiteIndexBasenames } from './site-index-names.mjs';
import { TEMPLATE_IDS, renderTemplatePage, siteDocType, templateById } from '../lib/operating-model-templates.mjs';

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args.flags[key] = next; i++; }
      else args.flags[key] = true;
    } else args._.push(a);
  }
  return args;
}

/**
 * A sensible `kind` placeholder for a new page (ADR-0009 vocabulary). A section
 * index is a `Hub`; otherwise the kind follows the section. `Reference` is the
 * neutral default — the author refines it (or passes `--kind`).
 */
function expectedKind(relPath, isSection) {
  if (isSection) return 'Hub';
  const section = relPath.split(sep)[0];
  switch (section) {
    case 'adr': return 'ADR';
    case 'changelog': return 'Changelog';
    case 'guides': return 'How-To';
    case 'plans': return relPath.split(sep)[1] === 'features' ? 'Feature' : 'Planning';
    default: return 'Reference';
  }
}

const { _: positional, flags } = parseArgs(process.argv.slice(2));
const slug = positional[0];

/** An argument error: say why, write nothing, exit 2. */
function argumentError(message) {
  console.error(`✖ ${message}`);
  process.exit(2);
}

// A title is one frontmatter line and the page's `# ` heading; a control
// character (a newline, a tab, or a C1 control such as U+0085, which YAML also
// reads as a line break) would split the heading, so refuse it.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
if (typeof flags.title === 'string' && CONTROL_CHARACTERS.test(flags.title)) {
  argumentError('--title must not contain control characters (such as a newline or a tab)');
}

// Guards shared by plain and template mode: nothing is written on a bad call.
if (positional.length > 1) argumentError(`expected one slug, got ${positional.length}: ${positional.join(' ')}`);
if (flags.title === true) argumentError('--title needs a value');
if (slug !== undefined && slug.split(/[\\/]/).includes('..')) {
  argumentError(`the slug must not contain a ".." segment: ${slug}`);
}

if (flags.template !== undefined) writeTemplatePage();
else writePlainStub();

/**
 * `--template <id>` (#402): write one operating-model template page. The slug is
 * optional (the template's path is the default). The type follows the page's
 * real path and the site's section registry, as the gate derives it, so a slug
 * outside the template's section, or a registry that types the section, still
 * validates.
 */
function writeTemplatePage() {
  if (flags.kind !== undefined) argumentError('--template fixes the kind; do not combine --template with --kind');
  if (flags.section !== undefined) argumentError('--template writes a page, not a section index; do not combine --template with --section');
  for (const flag of ['base', 'type']) {
    if (flags[flag] === true) argumentError(`--${flag} needs a value`);
  }
  const id = typeof flags.template === 'string' ? flags.template : '';
  const record = templateById(id);
  if (!record) argumentError(`unknown template "${id}". Known templates: ${TEMPLATE_IDS.join(', ')}`);

  const base = flags.base ?? 'docs';
  const relPath = `${slug ?? record.path}.md`;
  const target = join(base, relPath);
  if (existsSync(target)) {
    console.error(`✖ refusing to overwrite existing file: ${target}`);
    process.exit(1);
  }
  const type = flags.type ?? siteDocType(relPath.split(sep).join('/'), base) ?? record.defaultType;
  const page = renderTemplatePage(record, {
    title: typeof flags.title === 'string' ? flags.title : undefined,
    type,
  });
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page, 'utf8');
  console.log(`✓ created ${target} (type: ${type}, kind: ${record.kind})`);
}

/** The plain stub, as before #402: frontmatter and a TODO body. */
function writePlainStub() {
  if (!slug) {
    console.error('Usage: node scripts/new-doc.mjs <slug> [--title …] [--type …] [--section]');
    process.exit(2);
  }

  const base = flags.base ?? 'docs';
  const title =
    flags.title ??
    slug.split('/').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // FR-001/FR-007: the basename a --section target is created under. The site
  // config's names are the authority; the flag only picks one of them (or names the
  // index for a site with no config). No config and no flag: `README` (NFR-003).
  const indexFlag = typeof flags['index-basename'] === 'string' ? flags['index-basename'] : undefined;
  const indexBasename = (() => {
    try {
      const configPath = typeof flags['astro-config'] === 'string' ? flags['astro-config'] : undefined;
      const resolved = resolveSiteIndexBasenames(base, { tool: 'new-doc', configPath });
      announceIndexNames(resolved);
      const { names, fromConfig } = resolved;
      if (indexFlag === undefined) return names[0];
      if (!fromConfig) return indexFlag;
      const match = names.find((n) => n.toLowerCase() === indexFlag.toLowerCase());
      if (match === undefined) {
        throw new Error(
          `[new-doc] --index-basename ${indexFlag} is not one of the site's index names ${names.join(',')}. ` +
            'Remove the flag, or change indexBasename in the site config.',
        );
      }
      return match;
    } catch (err) {
      console.error(`✖ ${err.message}`);
      process.exit(2);
    }
  })();
  const relPath = flags.section ? join(slug, `${indexBasename}.md`) : `${slug}.md`;
  const target = join(base, relPath);
  const type = flags.type ?? expectedDocType(relPath.split(sep).join('/'));
  const kind = flags.kind ?? expectedKind(relPath, Boolean(flags.section));

  if (existsSync(target)) {
    console.error(`✖ refusing to overwrite existing file: ${target}`);
    process.exit(1);
  }

  const meta = scaffoldMeta();
  const extraLines = (flags.section ? 'okf_version: "0.2"\n' : '') + (type ? `type: ${type}\n` : '');
  const frontmatter = `---
title: ${title}
description: TODO one sentence describing what this document contains.
doc_status: draft
${extraLines}kind: ${kind}
${meta}
---

# ${title}

TODO write this page.
`;

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, frontmatter, 'utf8');
  console.log(`✓ created ${target}${type ? ` (type: ${type}, kind: ${kind})` : ` (kind: ${kind})`}`);
}

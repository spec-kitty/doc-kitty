#!/usr/bin/env node
/**
 * Scaffold a single Common Docs — Kitty Variation page with correct frontmatter.
 *
 * Usage:
 *   node scripts/new-doc.mjs <slug> [--title "Title"] [--type Guide]
 *                                    [--base docs] [--section]
 *                                    [--index-basename index]
 *
 *   <slug>       path under the docs root, e.g. "guides/deployment"
 *   --section    create the directory's section-index file (default
 *                README.md; FR-001/FR-003) instead of "<slug>.md"
 *   --type       override the type inferred from the path
 *   --index-basename  the section-index basename to target with --section
 *                (default README — NFR-003)
 *
 * Examples:
 *   node scripts/new-doc.mjs guides/deployment --title "Deployment"
 *   node scripts/new-doc.mjs integrations --section --title "Integrations"
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

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

/** Expected `type` for a slug path (null = unknown / bundle root). */
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
if (!slug) {
  console.error('Usage: node scripts/new-doc.mjs <slug> [--title …] [--type …] [--section]');
  process.exit(2);
}

const base = flags.base ?? 'docs';
const title =
  flags.title ??
  slug.split('/').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// FR-001/FR-002/FR-003: the basename a --section target is created under.
// Default `README` reproduces today's output exactly (NFR-003).
const indexBasename = typeof flags['index-basename'] === 'string' ? flags['index-basename'] : 'README';
const relPath = flags.section ? join(slug, `${indexBasename}.md`) : `${slug}.md`;
const target = join(base, relPath);
const type = flags.type ?? expectedType(relPath);
const kind = flags.kind ?? expectedKind(relPath, Boolean(flags.section));

if (existsSync(target)) {
  console.error(`✖ refusing to overwrite existing file: ${target}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();
const typeLine = type ? `type: ${type}\n` : '';
const frontmatter = `---
title: ${title}
description: TODO one sentence describing what this document contains.
doc_status: draft
updated: ${today}
${typeLine}kind: ${kind}
generated:
  by: agent/doc-kitty-new-doc
  at: ${now}
---

# ${title}

TODO write this page.
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, frontmatter, 'utf8');
console.log(`✓ created ${target}${type ? ` (type: ${type}, kind: ${kind})` : ` (kind: ${kind})`}`);

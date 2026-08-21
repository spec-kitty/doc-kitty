#!/usr/bin/env node
/**
 * Validate a Common Docs — Kitty Variation tree without a full Astro build.
 * Fast enough for a CI gate.
 *
 * Usage:
 *   node scripts/validate-frontmatter.mjs <docs-dir>   # default: docs
 *
 * Rules mirror the convention (velvet-tiger/common-docs v1.2 + Kitty twists)
 * and `lib/schema.ts`. Duplicated here in plain JS so the validator runs in
 * bare Node without loading Astro/Starlight.
 *
 *   - README.md is the section index and (Kitty twist) carries frontmatter.
 *   - The bundle-root README.md is exempt from `type` and may carry okf_version.
 *   - log.md is a reserved, frontmatter-free change log — skipped.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import matter from 'gray-matter';

const STATUSES = ['draft', 'active', 'deprecated', 'superseded'];
const TYPES = [
  'Context', 'Architecture', 'ADR', 'Template', 'Plan', 'Epic', 'Feature',
  'API', 'Configuration', 'Integration', 'Security', 'Guide', 'Operations',
  'Runbook', 'Migration', 'Changelog',
];

const root = process.argv[2] ?? 'docs';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.mdx?$/i.test(name)) out.push(full);
  }
  return out;
}

/** Expected `type` for a path relative to the docs root (null = unknown). */
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

/** @returns {{problems: string[], warnings: string[]}} */
function validate(relPath, data) {
  const problems = [];
  const warnings = [];
  const isString = (v) => typeof v === 'string' && v.trim() !== '';
  const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const isRootReadme = relPath === 'README.md';

  // Required on every file.
  for (const key of ['title', 'description']) {
    if (!isString(data[key])) problems.push(`missing required \`${key}\``);
  }
  if (!isString(data.status)) problems.push('missing required `status`');
  else if (!STATUSES.includes(data.status)) {
    problems.push(`\`status\` must be one of ${STATUSES.join(', ')}`);
  }
  if (!('updated' in data)) problems.push('missing required `updated`');

  // `type` required everywhere except the bundle-root README.
  if (isRootReadme) {
    if ('type' in data) warnings.push('bundle-root README should not carry `type`');
  } else {
    if (!isString(data.type)) problems.push('missing required `type`');
    else if (!TYPES.includes(data.type)) {
      problems.push(`\`type\` must be one of ${TYPES.join(', ')}`);
    } else {
      const want = expectedType(relPath);
      if (want && data.type !== want) {
        warnings.push(`\`type: ${data.type}\` but path suggests \`${want}\``);
      }
    }
  }

  for (const key of ['authors', 'related', 'tags']) {
    if (key in data && !isStringArray(data[key])) {
      problems.push(`\`${key}\` must be an array of strings`);
    }
  }
  if ('agent' in data && data.agent && typeof data.agent === 'object') {
    const a = data.agent;
    if ('priority' in a && (typeof a.priority !== 'number' || a.priority < 0 || a.priority > 1)) {
      problems.push('`agent.priority` must be a number between 0 and 1');
    }
    if ('discoverable' in a && typeof a.discoverable !== 'boolean') {
      problems.push('`agent.discoverable` must be a boolean');
    }
  }
  return { problems, warnings };
}

let files;
try {
  files = walk(root);
} catch (err) {
  console.error(`✖ cannot read docs dir "${root}": ${err.message}`);
  process.exit(2);
}

let failures = 0;
let warned = 0;
for (const file of files) {
  const rel = relative(root, file);
  if (/(^|[\\/])log\.md$/i.test(rel)) continue; // reserved, frontmatter-free

  const raw = readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    console.error(`✖ ${relative('.', file)}: unparseable frontmatter — ${err.message}`);
    failures++;
    continue;
  }
  const { problems, warnings } = validate(rel, parsed.data ?? {});
  if (problems.length) {
    failures++;
    console.error(`✖ ${relative('.', file)}`);
    for (const p of problems) console.error(`    - ${p}`);
  }
  for (const w of warnings) {
    warned++;
    console.warn(`⚠ ${relative('.', file)}: ${w}`);
  }
}

if (failures) {
  console.error(`\n${failures} file(s) failed validation${warned ? `, ${warned} warning(s)` : ''}.`);
  process.exit(1);
}
console.log(`✓ ${files.length} file(s) valid against Common Docs — Kitty Variation${warned ? ` (${warned} warning(s))` : ''}.`);

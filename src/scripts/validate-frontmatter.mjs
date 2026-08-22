#!/usr/bin/env node
/**
 * Validate a Common Docs — Kitty Variation tree without a full Astro build.
 * Fast enough for a CI gate.
 *
 * Usage:
 *   node src/scripts/validate-frontmatter.mjs [<root> ...]   # default: docs
 *
 * Accepts one OR MORE roots and validates every `.md`/`.mdx` under each, so the
 * same gate covers both `docs/` (the toolkit's own docs) and `example/docs/`
 * (the deliverable site) — a schema/validator change can invalidate either tree.
 *
 * The frontmatter contract is the one declared in `src/lib/schema.ts`
 * (velvet-tiger/common-docs v1.2 + Kitty twists): the field shape is validated
 * with the same `zod` primitives the toolkit schema uses (re-derived here as a
 * plain `z.object`, because `schema.ts` pulls Astro/Starlight and cannot run in
 * bare Node), and `gray-matter` parses the frontmatter — no re-implementation of
 * the field contract in ad-hoc string checks. Path-aware rules that `schema.ts`
 * documents but leaves to this standalone gate (strict `type` presence by path,
 * `type`-by-path agreement, bundle-root README exemptions) are applied on top.
 *
 *   - README.md is the section index and (Kitty twist) carries frontmatter.
 *   - The bundle-root README.md is exempt from `type` and may carry okf_version.
 *   - log.md is a reserved, frontmatter-free change log — skipped.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';

// Mirrors `STATUSES`/`DOC_TYPES` in src/lib/schema.ts (kept in sync by hand
// because that TS module imports Astro and cannot be loaded in bare Node).
const STATUSES = ['draft', 'active', 'deprecated', 'superseded'];
const DOC_TYPES = [
  'Context', 'Architecture', 'ADR', 'Template', 'Plan', 'Epic', 'Feature',
  'API', 'Configuration', 'Integration', 'Security', 'Guide', 'Operations',
  'Runbook', 'Migration', 'Changelog',
];

// Convention (docs/architecture/metadata-model.md): description is 50–180 chars.
// The upper bound is enforced as an error (a bounded description is the CI
// guardrail that matters); the lower bound is a non-fatal warning so short-but-
// clear one-liners are not padded just to satisfy a counter.
const DESCRIPTION_MAX = 180;
const DESCRIPTION_SOFT_MIN = 50;

const stamp = z.object({ by: z.string(), at: z.string() });

// Field contract, re-derived from `docKittyFields` in src/lib/schema.ts using
// the same zod primitives. Unlike the lenient site schema (which defaults
// `status` and leaves `updated`/`type` optional so partial stubs still build),
// this standalone gate enforces strict presence — as schema.ts's own comment
// delegates to it. `.passthrough()` tolerates forward-compatible extra keys.
const frontmatterSchema = z
  .object({
    title: z.string().min(1, 'must be a non-empty string'),
    description: z
      .string()
      .min(1, 'must be a non-empty string')
      .max(DESCRIPTION_MAX, `must be at most ${DESCRIPTION_MAX} characters`),
    status: z.enum(STATUSES),
    updated: z.coerce.date(),
    type: z.enum(DOC_TYPES).optional(),
    okf_version: z.string().optional(),
    authors: z.array(z.string()).optional(),
    related: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    resource: z.string().optional(),
    generated: stamp.optional(),
    verified: z.array(stamp).optional(),
    sources: z
      .array(z.object({ resource: z.string(), title: z.string() }))
      .optional(),
    stale_after: z.coerce.date().optional(),
    agent: z
      .object({
        discoverable: z.boolean().optional(),
        priority: z.number().min(0).max(1).optional(),
        keywords: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough();

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
  const parts = relPath.split('/');
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
 * Validate one file's parsed frontmatter.
 * @returns {{problems: string[], warnings: string[]}}
 */
function validate(relPath, data) {
  const problems = [];
  const warnings = [];
  const isRootReadme = relPath === 'README.md';

  const result = frontmatterSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const where = issue.path.length ? `\`${issue.path.join('.')}\`: ` : '';
      problems.push(`${where}${issue.message}`);
    }
  }

  // Path-aware rules that schema.ts documents but leaves to this gate.
  if (isRootReadme) {
    if ('type' in data) warnings.push('bundle-root README should not carry `type`');
  } else if (!('type' in data)) {
    problems.push('missing required `type`');
  } else if (DOC_TYPES.includes(data.type)) {
    const want = expectedType(relPath);
    if (want && data.type !== want) {
      warnings.push(`\`type: ${data.type}\` but path suggests \`${want}\``);
    }
  }

  // Soft lower bound on description length (non-fatal).
  if (typeof data.description === 'string') {
    const len = data.description.trim().length;
    if (len > 0 && len < DESCRIPTION_SOFT_MIN) {
      warnings.push(
        `description is ${len} chars; convention suggests ${DESCRIPTION_SOFT_MIN}–${DESCRIPTION_MAX}`,
      );
    }
  }

  return { problems, warnings };
}

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('docs');

let failures = 0;
let warned = 0;
let total = 0;

for (const root of roots) {
  let files;
  try {
    files = walk(root);
  } catch (err) {
    console.error(`✖ cannot read docs dir "${root}": ${err.message}`);
    process.exit(2);
  }
  total += files.length;

  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/');
    if (/(^|\/)log\.md$/i.test(rel)) continue; // reserved, frontmatter-free

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
}

if (failures) {
  console.error(`\n${failures} file(s) failed validation${warned ? `, ${warned} warning(s)` : ''}.`);
  process.exit(1);
}
console.log(
  `✓ ${total} file(s) valid against Common Docs — Kitty Variation across ${roots.length} root(s): ${roots.join(', ')}${warned ? ` (${warned} warning(s))` : ''}.`,
);

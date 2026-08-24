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
 * (velvet-tiger/common-docs v1.2 + Kitty twists, finalized in ADR-0009): the
 * field shape is validated with the same `zod` primitives the toolkit schema
 * uses (re-derived here as a plain `z.object`, because `schema.ts` pulls
 * Astro/Starlight and cannot run in bare Node), and `gray-matter` parses the
 * frontmatter — no re-implementation of the field contract in ad-hoc string
 * checks. Path-aware rules that `schema.ts` documents but leaves to this
 * standalone gate (strict `doc_status`/`kind` presence, `type` presence by path,
 * `type`-by-path agreement, bundle-root README exemptions) are applied on top.
 *
 *   - README.md is the section index and (Kitty twist) carries frontmatter.
 *   - The bundle-root README.md is exempt from `type` and may carry okf_version,
 *     but still requires `doc_status` and `kind`.
 *   - log.md is a reserved, frontmatter-free change log — skipped.
 *
 * This module is importable (for the schema/validator parity test): the field
 * schema, the path rules, and the canonical vocabularies are exported, and the
 * CLI runner only executes when the file is invoked directly.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';

// Mirrors `STATUSES`/`DOC_TYPES`/`KINDS` in src/lib/schema.ts (kept in sync by
// hand because that TS module imports Astro and cannot be loaded in bare Node;
// parity is enforced by src/tests/schema-validator-parity.test.ts).
export const STATUSES = ['draft', 'active', 'deprecated', 'superseded'];
export const DOC_TYPES = [
  'Context', 'Architecture', 'ADR', 'Template', 'Plan', 'Epic', 'Feature',
  'API', 'Configuration', 'Integration', 'Security', 'Guide', 'Operations',
  'Runbook', 'Migration', 'Changelog', 'Presentation',
];
// The canonical `kind` vocabulary (ADR-0009): four Divio quadrants + structural
// kinds. Open vocabulary — an unknown value warns, it does not fail.
export const KINDS = [
  'Tutorial', 'How-To', 'Reference', 'Explanation',
  'Hub', 'ADR', 'Changelog', 'Glossary', 'Presentation', 'Persona',
  'Planning', 'Feature', 'User-Journey',
];

// Convention (docs/architecture/metadata-model.md): description is 50–180 chars.
// The upper bound is enforced as an error (a bounded description is the CI
// guardrail that matters); the lower bound is a non-fatal warning so short-but-
// clear one-liners are not padded just to satisfy a counter.
export const DESCRIPTION_MAX = 180;
export const DESCRIPTION_SOFT_MIN = 50;

const stamp = z.object({ by: z.string(), at: z.string() });

// A `related` entry: a bare slug or `{ ref, note? }` (ADR-0009). Ref integrity
// is check-links.mjs's job; this only shapes the entries. An object without
// `ref` fails both arms of the union — a real error.
const relatedRef = z.union([
  z.string(),
  z.object({ ref: z.string(), note: z.string().optional() }),
]);

const externalReference = z.union([
  z.object({ url: z.string(), title: z.string(), note: z.string().optional() }),
  z.object({ type: z.string(), id: z.string() }),
]);

// Field contract, re-derived from `docKittyFields` in src/lib/schema.ts using
// the same zod primitives. Unlike the lenient site schema (which defaults
// `doc_status` and leaves `updated`/`type`/`kind` optional so partial stubs
// still build), this standalone gate enforces strict presence — as schema.ts's
// own comment delegates to it. `.passthrough()` tolerates forward-compatible
// extra keys.
export const frontmatterSchema = z
  .object({
    title: z.string().min(1, 'must be a non-empty string'),
    description: z
      .string()
      .min(1, 'must be a non-empty string')
      .max(DESCRIPTION_MAX, `must be at most ${DESCRIPTION_MAX} characters`),
    doc_status: z.enum(STATUSES),
    updated: z.coerce.date(),
    // Open vocabulary: an unknown `type` is an advisory warning (below), not a
    // schema error — matching the site schema's graceful-degradation posture
    // (ADR-0004, metadata-model.md).
    type: z.string().optional(),
    kind: z.string().min(1, 'must be a non-empty string'),
    okf_version: z.string().optional(),
    authors: z.array(z.string()).optional(),
    related: z.array(relatedRef).optional(),
    external_references: z.array(externalReference).optional(),
    audience: z
      .array(z.object({ profile: z.string(), guidance_text: z.string() }))
      .optional(),
    moscow: z
      .object({
        level: z.enum(['Must', 'Should', 'Could', "Won't"]),
        rationale: z.string(),
      })
      .optional(),
    hero_image: z.object({ src: z.string(), alt: z.string() }).optional(),
    social_thumb: z
      .union([z.object({ src: z.string(), alt: z.string() }), z.string()])
      .optional(),
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
export function expectedType(relPath) {
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
    case 'presentations': return 'Presentation';
    default: return null;
  }
}

/**
 * Validate one file's parsed frontmatter.
 * @returns {{problems: string[], warnings: string[]}}
 */
export function validate(relPath, data) {
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
  } else if (!DOC_TYPES.includes(data.type)) {
    // Open vocabulary: an unknown `type` degrades to an advisory warning.
    warnings.push(`\`type: ${data.type}\` is not in the canonical set (${DOC_TYPES.join(', ')})`);
  } else {
    const want = expectedType(relPath);
    if (want && data.type !== want) {
      warnings.push(`\`type: ${data.type}\` but path suggests \`${want}\``);
    }
  }

  // `kind` is required (enforced by the schema above); an unknown value is a
  // non-fatal, observably-printed warning (open vocabulary, ADR-0009).
  if (typeof data.kind === 'string' && data.kind.length > 0 && !KINDS.includes(data.kind)) {
    warnings.push(`\`kind: ${data.kind}\` is not in the canonical set (${KINDS.join(', ')})`);
  }

  // FR-022 / ADR-0021 D1: a `kind: Presentation` page MUST live under
  // `presentations/`. This is the path+kind invariant the out-of-frame deck
  // route override depends on — a `Presentation` filed anywhere else would be a
  // silent in-frame render (the route only shadows `/presentations/*`), so it is
  // a BLOCKING error, not a warning. The check keys off the first path segment,
  // mirroring `sectionOf`; the bundle-root README (no slash) can never match.
  if (data.kind === 'Presentation' && relPath.split('/')[0] !== 'presentations') {
    problems.push(
      '`kind: Presentation` must live under `presentations/` (ADR-0021 path+kind invariant, FR-022)',
    );
  }

  // Kind-aware requiredness for `kind: Persona` (ADR-0019). The build zod schema
  // stays lenient — these three persona-attribute fields are optional there — so
  // requiredness lives HERE, the one place that already owns contextual presence
  // rules (parity discipline, mirroring the strict `type`/`doc_status` handling
  // above). `role` is a non-empty string; `goals`/`responsibilities` are non-empty
  // string arrays. Enforced regardless of `doc_status`, so a draft persona is held
  // to the same identity contract as a published one.
  if (data.kind === 'Persona') {
    if (typeof data.role !== 'string' || data.role.trim().length === 0) {
      problems.push('`role`: persona requires a non-empty string');
    }
    for (const field of ['goals', 'responsibilities']) {
      const value = data[field];
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every((item) => typeof item === 'string' && item.trim().length > 0)
      ) {
        problems.push(`\`${field}\`: persona requires a non-empty list of non-empty strings`);
      }
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

/** CLI entry point: validate every `.md`/`.mdx` under each given root. */
export function run(argv) {
  const roots = argv.slice(2);
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
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv);
}

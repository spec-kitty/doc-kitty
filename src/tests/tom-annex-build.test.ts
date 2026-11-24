/**
 * The evidence index on real builds (WP05 T022, T024, T025, #401).
 *
 * Two small sites built with `astro build`, as an adopter would:
 * - "classified": a published classified page, a classified DRAFT (the only
 *   page that lists `user-identification-authorisation`), and an
 *   organisation-scope page. Drafts and their edges must not count (FR-006).
 * - "bare": the same pages with no classification. Nothing is emitted,
 *   linked or failed (FR-012).
 * Both are checked with the artifact gate's own rules (`tomAnnexProblems`).
 * Two-builds byte stability (FR-007) is covered on the example by
 * `draft-publication-build.test.ts`, whose machine surfaces include the index.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOM_ANNEX_LABEL } from '../lib/tom-annex/core.mjs';
import { tomAnnexProblems } from '../lib/tom-annex/verify.mjs';
import { loadMeasuresCatalog } from '../lib/measures-loader.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'bin', 'astro.mjs');
const SITE_URL = 'https://example.test';
const BASE = '/site';
const VARIANTS = ['classified', 'bare'] as const;
type Variant = (typeof VARIANTS)[number];
const siteDir = (v: Variant) => path.join(REPO_ROOT, 'example', `.dk-test-tom-annex-${v}`);
const dist = (v: Variant, ...rel: string[]) => path.join(siteDir(v), 'dist', ...rel);

const page = (fm: Record<string, unknown>, body: string) =>
  `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')}\n---\n\n${body}\n`;
const meta = (title: string, kind: string, extra: Record<string, unknown> = {}) => ({
  title,
  description: 'Fixture page for the evidence index.',
  doc_status: 'active',
  updated: '2026-11-20T00:00:00Z',
  kind,
  ...extra,
});

function files(variant: Variant): Record<string, string> {
  const classify = (entries: unknown[]) => (variant === 'classified' ? { tom_classification: entries } : {});
  return {
    'astro.config.mjs': `import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
export default defineConfig({
  site: '${SITE_URL}',
  base: '${BASE}',
  integrations: defineDocKittyIntegrations({ title: 'Evidence fixture', base: '${BASE}' }),
});
`,
    'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';
export const collections = { docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }) };
`,
    'src/pages/api/index.json.ts': `import { agentIndexRoute } from '@spec-kitty/doc-toolkit/routes';
export const GET = agentIndexRoute({ title: 'Evidence fixture' });
`,
    'docs/README.md': page(meta('Evidence fixture', 'Hub'), '# Evidence fixture'),
    'docs/security/README.md': page(meta('Security', 'Hub'), '# Security'),
    'docs/security/audit.md': page(
      meta('Audit logging', 'Reference', classify([{ measure: 'events-logging', note: 'Kept for 13 months.' }])),
      '# Audit logging',
    ),
    'docs/security/draft-access.md': page(
      meta('Access (draft)', 'Reference', { doc_status: 'draft', ...classify([{ measure: 'user-identification-authorisation' }]) }),
      '# Access (draft)',
    ),
    'docs/security/incidents.md': page(
      meta('Incident handling', 'Explanation', classify([{ measure: 'accountability', scope: 'organisation' }])),
      '# Incident handling',
    ),
  };
}

const buildMs: Partial<Record<Variant, number>> = {};

function buildSite(variant: Variant): void {
  const root = siteDir(variant);
  rmSync(root, { recursive: true, force: true });
  for (const [rel, text] of Object.entries(files(variant))) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  const started = Date.now();
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DK_OUTDIR;
  // Vitest sets BASE_URL=/ in the test process; a child build would take it over the configured base.
  delete env.BASE_URL;
  const r = spawnSync(process.execPath, [ASTRO_BIN, 'build'], { cwd: root, encoding: 'utf8', env });
  buildMs[variant] = Date.now() - started;
  expect(r.status, `${variant} build failed:\n${r.stdout}\n${r.stderr}`).toBe(0);
}

const readJson = (variant: Variant, ...rel: string[]) => JSON.parse(readFileSync(dist(variant, ...rel), 'utf8'));

/** The gate's rules, run on a built fixture site. */
function gateProblems(variant: Variant): string[] {
  const annexPath = dist(variant, 'api', 'tom-annex.json');
  const prefix = `${SITE_URL}${BASE}/`;
  return tomAnnexProblems({
    graph: readJson(variant, 'api', 'content-graph.json'),
    indexLinks: readJson(variant, 'api', 'index.json')._links,
    annexText: existsSync(annexPath) ? readFileSync(annexPath, 'utf8') : undefined,
    pageBuilt: (url: string) =>
      url.startsWith(prefix) && existsSync(dist(variant, url.slice(prefix.length), 'index.html')),
    catalogIds: loadMeasuresCatalog(path.join(siteDir(variant), 'docs')).records.map((r: { id: string }) => r.id),
  });
}

beforeAll(() => {
  for (const v of VARIANTS) buildSite(v);
  // NFR-002 evidence for the hand-off (not asserted: timing in CI is noisy).
  console.info(`[tom-annex-build] build ms: ${JSON.stringify(buildMs)}`);
}, 600_000);

afterAll(() => {
  for (const v of VARIANTS) rmSync(siteDir(v), { recursive: true, force: true });
});

describe('a classified site: drafts never count as evidence (WP05 T022, FR-006)', () => {
  it('builds the index, links it with its label, and passes the gate', () => {
    expect(existsSync(dist('classified', 'api', 'tom-annex.json'))).toBe(true);
    expect(readJson('classified', 'api', 'index.json')._links.tomAnnex).toEqual({
      href: `${SITE_URL}${BASE}/api/tom-annex.json`,
      title: TOM_ANNEX_LABEL,
    });
    expect(gateProblems('classified')).toEqual([]);
  });

  it('lists the published page (the positive control) and leaves the draft out', () => {
    const annex = readJson('classified', 'api', 'tom-annex.json');
    const urls = [...annex.scopes.system, ...annex.scopes.organisation].flatMap((m: { evidence: Array<{ url: string }> }) =>
      m.evidence.map((e) => e.url),
    );
    expect(urls).toContain(`${SITE_URL}${BASE}/security/audit/`);
    expect(urls.some((u: string) => u.includes('draft-access'))).toBe(false);
    // The measure only the draft lists is uncovered.
    expect(annex.uncovered.map((u: { id: string }) => u.id)).toContain('user-identification-authorisation');
    expect(annex.uncovered.map((u: { id: string }) => u.id)).not.toContain('events-logging');
  });

  it('files the organisation-scope page under organisation, once', () => {
    const annex = readJson('classified', 'api', 'tom-annex.json');
    expect(annex.scopes.organisation.map((m: { id: string }) => m.id)).toEqual(['accountability']);
    expect(annex.scopes.organisation[0].evidence).toHaveLength(1);
  });

  it('carries the same bytes in the OKF bundle', () => {
    expect(readFileSync(dist('classified', 'okf', 'tom-annex.json'), 'utf8')).toBe(
      readFileSync(dist('classified', 'api', 'tom-annex.json'), 'utf8'),
    );
  });
});

describe('a site with no classified pages gains nothing (WP05 T024, FR-012)', () => {
  it('builds no index, no link and no OKF copy, and passes the gate', () => {
    expect(existsSync(dist('bare', 'api', 'tom-annex.json'))).toBe(false);
    expect(readJson('bare', 'api', 'index.json')._links).not.toHaveProperty('tomAnnex');
    expect(existsSync(dist('bare', 'okf', 'tom-annex.json'))).toBe(false);
    expect(gateProblems('bare')).toEqual([]);
  });
});

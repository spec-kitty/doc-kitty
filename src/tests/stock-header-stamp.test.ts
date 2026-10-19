/**
 * The stock-header fixture stamp (#207; FR-002, FR-003, NFR-003, SC-003).
 *
 * `fixtures/header-theme/stock-header.html` is Starlight's own header block, as
 * the example builds it with the `Header` carrier switched off. It changes when
 * Starlight, Astro or the toolkit's `compressHTML` pin changes, and the build
 * test that compares against it (`header-carrier.test.ts`) only says "differs".
 * `stock-header.meta.json` records what the fixture was captured with; this file
 * compares that stamp with what is installed and configured now, and on a
 * mismatch names the field and the command that recaptures both files.
 *
 * Build-free and fast (fast Vitest project): it reads two small files, two
 * `package.json`s and the toolkit's `compressHTML` integration.
 *
 * Contract: kitty-specs/layout-guards-decisions-01M59CGE/contracts/stock-header-stamp.schema.json
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressHtmlIntegration } from '../lib/integrations/compress-html.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/header-theme/', import.meta.url));
const FIXTURE = path.join(FIXTURE_DIR, 'stock-header.html');
const STAMP = path.join(FIXTURE_DIR, 'stock-header.meta.json');
const REGENERATE = 'run `pnpm fixture:stock-header` and review the diff';

interface Stamp {
  starlight: string;
  astro: string;
  compressHTML: boolean;
  carrier: 'disabled';
  capturedFrom: 'example/dist/index.html';
}
type Field = keyof Stamp;

const FIELDS: Field[] = ['starlight', 'astro', 'compressHTML', 'carrier', 'capturedFrom'];
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** How each field reads in a mismatch message: what it is, and where today's value comes from. */
const LABEL: Record<Field, { name: string; now: string }> = {
  starlight: { name: '@astrojs/starlight', now: 'is installed' },
  astro: { name: 'astro', now: 'is installed' },
  compressHTML: { name: 'compressHTML', now: 'is what the toolkit pins' },
  carrier: { name: 'the Header carrier', now: 'is what a stock capture requires' },
  capturedFrom: { name: 'the page', now: 'is the page the fixture must come from' },
};

/**
 * The directory of `name` as `example/` resolves it. Its `package.json` is read
 * directly because Starlight's `exports` do not expose `./package.json`.
 */
function packageVersion(name: string): string {
  const require = createRequire(path.join(REPO_ROOT, 'example', 'package.json'));
  for (const dir of require.resolve.paths(name) ?? []) {
    const manifest = path.join(dir, name, 'package.json');
    if (existsSync(manifest)) return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
  }
  throw new Error(`${name} is not resolvable from example/`);
}

/** The value the toolkit's integration hands Astro, read by running its hook. */
function pinnedCompressHtml(): boolean {
  let value: unknown;
  const setup = compressHtmlIntegration.hooks['astro:config:setup'] as (p: unknown) => void;
  setup({ updateConfig: (patch: { compressHTML?: unknown }) => (value = patch.compressHTML) });
  if (typeof value !== 'boolean') throw new Error(`compressHTML pin is not a boolean: ${String(value)}`);
  return value;
}

/** What a capture made now would stamp. */
function currentStamp(): Stamp {
  return {
    starlight: packageVersion('@astrojs/starlight'),
    astro: packageVersion('astro'),
    compressHTML: pinnedCompressHtml(),
    carrier: 'disabled',
    capturedFrom: 'example/dist/index.html',
  };
}

/** The mismatch message for one field, or `null` when the stamp still holds. Pure. */
function stampMismatch(field: Field, stamp: Stamp, current: Stamp): string | null {
  if (stamp[field] === current[field]) return null;
  const { name, now } = LABEL[field];
  return `stock-header fixture was captured with ${name} ${String(stamp[field])}, but ${String(current[field])} ${now} — ${REGENERATE}`;
}

/** Plain shape checks against the contract's fields (no JSON-schema library). */
function shapeProblems(value: unknown): string[] {
  if (value === undefined) return ['stock-header.meta.json is missing'];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['stamp is not an object'];
  const record = value as Record<string, unknown>;
  const problems = Object.keys(record)
    .filter((key) => !FIELDS.includes(key as Field))
    .map((key) => `unknown field ${key}`);
  for (const field of FIELDS) if (!(field in record)) problems.push(`missing field ${field}`);
  for (const field of ['starlight', 'astro'] as const) {
    if (typeof record[field] !== 'string' || !VERSION.test(record[field])) problems.push(`${field} is not a version`);
  }
  if (typeof record.compressHTML !== 'boolean') problems.push('compressHTML is not a boolean');
  if (record.carrier !== 'disabled') problems.push('carrier is not "disabled"');
  if (record.capturedFrom !== 'example/dist/index.html') problems.push('capturedFrom is not example/dist/index.html');
  return problems;
}

/** `undefined` when the stamp is missing, so the shape test reports it with the command. */
const raw: unknown = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, 'utf8')) : undefined;
const stamp = (raw ?? {}) as Stamp;
const current = currentStamp();

describe('stock-header fixture stamp (#207)', () => {
  it('has the contract shape', () => {
    expect(shapeProblems(raw), `${STAMP} — ${REGENERATE}`).toEqual([]);
  });

  it.each(FIELDS)('%s matches what is installed and configured now', (field) => {
    const message = stampMismatch(field, stamp, current);
    expect(message, message ?? '').toBeNull();
  });

  it('the fixture exists, is non-empty and has no trailing newline', () => {
    expect(existsSync(FIXTURE), `${FIXTURE} is missing — ${REGENERATE}`).toBe(true);
    const html = readFileSync(FIXTURE, 'utf8');
    expect(html.length).toBeGreaterThan(0);
    expect(html.endsWith('\n'), 'stock-header.html ends with a newline').toBe(false);
  });

  it('positive control: a doctored stamp is reported with the field and the command', () => {
    const doctored: Stamp = { ...current, starlight: '0.0.0' };
    expect(stampMismatch('starlight', doctored, current)).toBe(
      `stock-header fixture was captured with @astrojs/starlight 0.0.0, but ${current.starlight} is installed — ${REGENERATE}`,
    );
    expect(stampMismatch('astro', doctored, current)).toBeNull();
    expect(stampMismatch('compressHTML', { ...current, compressHTML: !current.compressHTML }, current)).toContain(
      'compressHTML',
    );
    expect(shapeProblems({ ...current, extra: 1, starlight: 'latest' })).toEqual([
      'unknown field extra',
      'starlight is not a version',
    ]);
  });
});

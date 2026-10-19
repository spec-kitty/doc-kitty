/**
 * The imperative-step lint (#196) on its PRODUCTION entry points (FR-009,
 * FR-011, C-002; tactic acceptance-criteria-non-vacuity). Each surface is proven
 * through the code a site runs, as an on/off pair on one shared fixture:
 *
 *  1. generated pages: `generateFeaturePages` warns at `features/x.feature:<line>`
 *     and writes the same bytes with the lint on as with it off;
 *  2. the integration: `gherkin.lint` in `defineDocKittyIntegrations` reaches
 *     `logger.warn` through `doc-kitty:gherkin`'s `astro:config:setup` hook (the
 *     option is written INLINE, so the public `DocKittyGherkinOption` type is
 *     checked too: `tsc` rejects an undeclared key or a bad keyword type);
 *  3. includes stay silent: a `::gherkin{src=…}` of an imperative feature gives
 *     no lint line, while a fence of the same step on the same page does;
 *  4. the CLI stays silent: `generate-feature-pages.mjs --check` prints no lint
 *     line (D1: the lint has no CLI twin).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFeaturePages } from '../lib/gherkin/generate.mjs';
import { loadFeatures } from '../lib/gherkin/load.mjs';
import { resetFatal } from '../lib/gherkin/errors.mjs';
import { render, type DocKittyOptions } from './helpers/gherkin-render-harness.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));
vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

const SCRIPT = fileURLToPath(new URL('../scripts/generate-feature-pages.mjs', import.meta.url));

/** The shared fixture: line 4 is the imperative step, the rest is clean. */
const FEATURE = ['Feature: Booking', '  Scenario: Book', '    Given a sailing', '    When I click "Book"', '    Then it is booked', ''].join('\n');
const LINT_LINE =
  '[dk-gherkin] features/x.feature:4 step "When I click "Book"" names a UI action ("click") — describe the behaviour instead; silence with @dk:allow=imperative';
/** WP01's normalised `{ imperativeSteps: true }`. */
const NORMALISED: NonNullable<Parameters<typeof generateFeaturePages>[1]['lint']> = {
  imperativeSteps: { verbs: undefined, extend: [], keywords: ['context', 'action'] },
};
const isLint = (m: string) => m.includes('describe the behaviour instead');

let site: string;
let originalCwd: string;
beforeEach(() => {
  originalCwd = process.cwd();
  site = mkdtempSync(path.join(tmpdir(), 'dk-lint-wiring-'));
  mkdirSync(path.join(site, 'features'), { recursive: true });
  mkdirSync(path.join(site, 'docs'), { recursive: true });
  writeFileSync(path.join(site, 'features', 'x.feature'), FEATURE);
  resetFatal();
});
afterEach(() => {
  process.chdir(originalCwd);
  rmSync(site, { recursive: true, force: true });
  resetFatal();
});

/** Every file under `dir`, POSIX-relative → contents. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out[path.relative(dir, abs).split(path.sep).join('/')] = readFileSync(abs, 'utf8');
    }
  };
  walk(dir);
  return out;
}

describe('generated pages: generateFeaturePages', () => {
  const generate = (lint?: typeof NORMALISED) => {
    const warnings: string[] = [];
    const warn = (m: string) => warnings.push(m);
    const model = loadFeatures({ sources: ['features'], root: site, warn });
    const result = generateFeaturePages(model, {
      sources: ['features'],
      docsRoot: path.join(site, 'docs'),
      outDir: path.join(site, 'docs', 'behaviour'),
      sourceRoot: site,
      ...(lint ? { lint } : {}),
      warn,
    });
    return { warnings, result };
  };

  it('warns at the source line when on, not when off, and writes the same bytes (FR-009)', () => {
    const on = generate(NORMALISED);
    expect(on.warnings.filter(isLint)).toEqual([LINT_LINE]);
    expect(on.result.written.length).toBeGreaterThan(0);
    const pages = snapshot(path.join(site, 'docs'));

    const off = generate();
    expect(off.warnings.filter(isLint)).toEqual([]);
    // Nothing to rewrite: every page the lint-on run wrote is byte-identical.
    expect(off.result.written).toEqual([]);
    expect(snapshot(path.join(site, 'docs'))).toEqual(pages);
  });
});

describe('the integration: gherkin.lint reaches logger.warn', () => {
  const setup = (gherkin: DocKittyOptions['gherkin']) => {
    process.chdir(site);
    const integrations = defineDocKittyIntegrations({ title: 't', gherkin }) as unknown as Array<{
      name?: string;
      hooks?: Record<string, (ctx: unknown) => void>;
    }>;
    const entry = integrations.find((i) => i?.name === 'doc-kitty:gherkin');
    if (!entry?.hooks?.['astro:config:setup']) throw new Error('doc-kitty:gherkin has no astro:config:setup hook');
    const logger = { warn: vi.fn(), info: vi.fn() };
    entry.hooks['astro:config:setup']({
      addWatchFile: vi.fn(),
      updateConfig: vi.fn(),
      injectScript: vi.fn(),
      injectRoute: vi.fn(),
      config: undefined,
      logger,
    });
    return logger.warn.mock.calls.map(([m]) => String(m));
  };

  it('on: the lint line is a logger.warn; off: none', () => {
    // Inline on purpose: the public option type must declare both keys.
    expect(
      setup({
        sources: ['features'],
        defaultGlossaryContext: {},
        lint: { imperativeSteps: { extend: ['activate'], keywords: ['context', 'action'] } },
      }).filter(isLint),
    ).toEqual([LINT_LINE]);
    expect(setup({ sources: ['features'] }).filter(isLint)).toEqual([]);
    expect(setup({ sources: ['features'], lint: { imperativeSteps: false } }).filter(isLint)).toEqual([]);
  });

  it('the public option type refuses a keyword type that is not one of context, action, outcome', () => {
    const bad: DocKittyOptions['gherkin'] = {
      // @ts-expect-error -- `given` is a keyword, not a keyword TYPE.
      lint: { imperativeSteps: { keywords: ['given'] } },
    };
    expect(() => defineDocKittyIntegrations({ title: 't', gherkin: bad })).toThrow(/is not a step keyword type/);
  });
});

describe('includes stay silent; a fence on the same page is the positive control', () => {
  const PAGE = [
    '---',
    'title: Guide',
    '---',
    '',
    '# Guide', // 5
    '',
    '::gherkin{src="features/x.feature"}', // 7
    '',
    '```gherkin', // 9
    'Feature: Fenced',
    '  Scenario: S',
    '    When I click "Book"', // 12
    '```',
    '',
  ].join('\n');

  async function lintWarnings(gherkin: DocKittyOptions['gherkin']): Promise<{ msgs: string[]; html: string }> {
    process.chdir(site);
    const file = path.join(site, 'docs', 'page.md');
    writeFileSync(file, PAGE);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { html } = await render(PAGE, { gherkin }, file);
      return { msgs: warn.mock.calls.map(([m]) => String(m)).filter(isLint), html };
    } finally {
      warn.mockRestore();
    }
  }

  it('on: only the fence warns (at the host page line); off: nothing; the HTML is the same', async () => {
    const on = await lintWarnings({ includeRoots: ['features'], lint: { imperativeSteps: true } });
    // Non-vacuity: the include rendered (its feature title is on the page).
    expect(on.html).toContain('Booking');
    expect(on.msgs).toEqual([
      '[dk-gherkin] docs/page.md:12 step "When I click "Book"" names a UI action ("click") — describe the behaviour instead; silence with @dk:allow=imperative',
    ]);
    const off = await lintWarnings({ includeRoots: ['features'] });
    expect(off.msgs).toEqual([]);
    expect(on.html).toBe(off.html);
  });
});

describe('the CLI stays silent (D1)', () => {
  it('generate-feature-pages.mjs --check prints no lint line on a feature with an imperative step', () => {
    const args = [SCRIPT, '--root', site, '--sources', 'features', '--docs', 'docs', '--section', 'behaviour'];
    const write = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(write.status).toBe(0);
    const check = spawnSync(process.execPath, [...args, '--check'], { encoding: 'utf8' });
    expect(check.status).toBe(0);
    expect(`${write.stderr}${write.stdout}`).not.toContain('describe the behaviour instead');
    expect(`${check.stderr}${check.stdout}`).not.toContain('describe the behaviour instead');
  });
});

/**
 * WP01/T001 (doc-kitty-mcp-server, squad A1): the contract module is the ONE
 * published surface the MCP server compiles against, and it must stay
 * dependency-free — any import into `src/lib/contract.ts` risks dragging
 * `astro:content` (which resolves only inside an Astro build) into a plain
 * `tsc` consumer. Two complementary assertions:
 *
 *   1. A source scan: the module holds types only — no `import`, no
 *      `export ... from`, so no module graph exists to regress.
 *   2. A compile proof: a scratch project (written on the fly, not committed —
 *      its node_modules member is a machine-specific symlink) that imports
 *      ONLY types from `@spec-kitty/doc-toolkit/contract` through the real
 *      `package.json` exports entry passes `tsc --noEmit` outside Astro. If a
 *      future edit adds an Astro-coupled import to contract.ts, this fails CI
 *      on the spot, in the toolkit lane, instead of surfacing in the mcp
 *      package build.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTRACT = path.join(SRC_ROOT, 'lib', 'contract.ts');

const scratchDirs: string[] = [];
afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

describe('contract module purity (WP01/T001)', () => {
  it('contract.ts exports types only: no imports, no re-exports, no runtime code', () => {
    const source = readFileSync(CONTRACT, 'utf8');
    // No value-level pulls from other modules. (`import type` is pointless
    // here by construction — contract types are self-contained — so every
    // `import` statement is rejected outright.)
    expect(source.match(/^\s*import[\s{*]/m), 'contract.ts must not import anything').toBeNull();
    expect(
      source.match(/^\s*export\s+(?:type\s+)?\{[^}]*\}\s*from\s/m) ?? source.match(/^\s*export\s+\*\s+from\s/m),
      'contract.ts must not re-export from other modules',
    ).toBeNull();
  });

  it('a types-only import from "@spec-kitty/doc-toolkit/contract" compiles under plain tsc, outside Astro', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'contract-import-proof-'));
    scratchDirs.push(dir);
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'contract-import-proof', private: true, type: 'module' }, null, 2),
    );
    // Satisfy the `@spec-kitty/doc-toolkit/contract` specifier through the
    // package's REAL exports map — no tsconfig path alias, so the proof reports
    // on the wiring a published consumer gets.
    const scope = path.join(dir, 'node_modules', '@spec-kitty');
    mkdirSync(scope, { recursive: true });
    symlinkSync(SRC_ROOT, path.join(scope, 'doc-toolkit'), 'dir');
    writeFileSync(
      path.join(dir, 'consumer.ts'),
      [
        "import type {",
        '  AgentIndex,',
        '  AgentPagePayload,',
        '  AgentRecordEntry,',
        '  McpWiringPointer,',
        '  ScenarioIndex,',
        '  SectionRecord,',
        "} from '@spec-kitty/doc-toolkit/contract';",
        '',
        'export function buildIdOf(index: AgentIndex): string {',
        '  return index.buildId;',
        '}',
        '',
        'export function describeSection(section: SectionRecord): string {',
        '  return `${section.order}: ${section.id}`;',
        '}',
        '',
        'export function pageMarkdown(payload: AgentPagePayload): string {',
        '  return payload.markdown;',
        '}',
        '',
        'export function scenarioCount(index: ScenarioIndex): number {',
        '  return index.features.reduce((n, feature) => n + feature.scenarios.length, 0);',
        '}',
        '',
        'export function usageOf(pointer: McpWiringPointer | undefined): string {',
        "  return pointer?.usage ?? '';",
        '}',
        '',
        'export function sectionOfEntry(entry: AgentRecordEntry): string {',
        '  return entry.section;',
        '}',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            types: [],
          },
          files: ['consumer.ts'],
        },
        null,
        2,
      ),
    );
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
    const run = spawnSync(process.execPath, [tsc, '--noEmit', '-p', dir], { encoding: 'utf8' });
    expect(run.status, `tsc stdout:\n${run.stdout}\nstderr:\n${run.stderr}`).toBe(0);
  }, 120_000);
});

/**
 * C-003 boundary test (T022): the SHIPPED graph must not import an HTTP
 * listener surface. "v1 ships no HTTP listener code at all" is a structural
 * property of the built artifact, so this scans `mcp/dist` - not src/ - from
 * the binary entry `dist/cli.js`, following relative edges, and asserts that
 * no BARE import specifier names an HTTP/socket module.
 *
 * Why a local scanner: src/tests/helpers/module-graph.ts maps `./x.js`
 * specifiers onto `.ts` sources, which is the right behaviour for src guards;
 * over dist it can silently drop or misresolve edges (reviewer warning), and
 * it belongs to the toolkit package, not this one. The scan below is a small
 * static one, kept deliberately dumb: strip comments, collect
 * import/export-from and side-effect-import specifiers, follow the relative
 * ones inside dist, collect the bare ones. Multi-line `import { a, b } from`
 * emits are handled because the specifier class spans newlines.
 *
 * Non-vacuity, durably: the second suite below points the SAME scan at a
 * synthetic graph with a seeded `node:http` import and requires the finding.
 * (The red proof against the real graph was also executed during development:
 * seeding `import 'node:http'` into mcp/src/cli.ts turns the first suite red;
 * the seed was removed after the red run.)
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MCP_ROOT, ensureMcpDistBuilt } from './perf-helpers.js';

const DIST = path.join(MCP_ROOT, 'dist');
const ENTRY = path.join(DIST, 'cli.js');

/**
 * Specifiers that would place HTTP/listener machinery in the shipped graph:
 * the node HTTP/HTTPS/NET modules (prefixed or bare) and any SDK transport
 * subpath whose name carries the streamable-HTTP or SSE surface. The SDK's
 * root and ./stdio subpaths are the pinned, allowed imports (stdio-only, C-003).
 */
const FORBIDDEN_EXACT = new Set(['http', 'https', 'net', 'node:http', 'node:https', 'node:net']);
const FORBIDDEN_PATTERN = /^@modelcontextprotocol\/.*(streamable|sse)/i;

export interface DistScan {
  /** Every dist .js file the scan visited (the reachable graph). */
  files: string[];
  /** Every bare (non-relative) specifier collected from the graph. */
  bareSpecifiers: string[];
  /** Bare specifiers matching the forbidden set/pattern. */
  violations: string[];
}

/** Scan the runtime import graph of `entry` (a dist .js file) for bare specifiers. */
export function scanDistEntry(entry: string): DistScan {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const specs = [
      ...code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?\bfrom\s+['"]([^'"]+)['"]/gm),
      ...code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
      ...code.matchAll(/^\s*export\s+['"]([^'"]+)['"]/gm),
    ].map((m) => m[1]!);
    for (const spec of specs) {
      if (!spec.startsWith('.')) {
        bare.add(spec);
        continue;
      }
      const resolved = path.resolve(path.dirname(file), spec);
      // Dist edges are always emitted with the .js suffix; skip anything else.
      if (resolved.endsWith('.js')) queue.push(resolved);
    }
  }
  const bareSpecifiers = [...bare].sort();
  return {
    files: [...files].sort(),
    bareSpecifiers,
    violations: bareSpecifiers.filter((s) => FORBIDDEN_EXACT.has(s) || FORBIDDEN_PATTERN.test(s)),
  };
}

beforeAll(() => {
  ensureMcpDistBuilt();
}, 120_000);

describe('C-003: the built server graph carries no HTTP listener import', () => {
  it('scans the whole dist entry graph and finds no forbidden bare specifier', () => {
    const scan = scanDistEntry(ENTRY);
    // Non-vacuity (positive shape): the scan must actually see the shipped
    // graph - all four dist subtrees - and the pinned allowed specifiers.
    // A scanner that collected nothing would pass a bare "no violation" check.
    expect(scan.files.some((f) => f.endsWith(`${path.sep}cli.js`))).toBe(true);
    expect(scan.files.some((f) => f.includes(`${path.sep}corpus${path.sep}`))).toBe(true);
    expect(scan.files.some((f) => f.includes(`${path.sep}surface${path.sep}`))).toBe(true);
    expect(scan.bareSpecifiers).toContain('@modelcontextprotocol/server');
    expect(scan.bareSpecifiers).toContain('@modelcontextprotocol/server/stdio');
    expect(scan.bareSpecifiers).toContain('node:fs');
    expect(scan.bareSpecifiers).toContain('node:path');
    // The boundary itself.
    expect(scan.violations).toEqual([]);
  });

  it('allows exactly the dist-relative closure plus the pinned node/SDK specifiers', () => {
    const scan = scanDistEntry(ENTRY);
    for (const spec of scan.bareSpecifiers) {
      const allowed =
        spec.startsWith('node:') || spec === '@modelcontextprotocol/server' || spec === '@modelcontextprotocol/server/stdio';
      expect(allowed, `unexpected bare specifier in dist graph: ${spec}`).toBe(true);
    }
  });
});

describe('C-003 non-vacuity: the scan flags a seeded http import', () => {
  let seededDir: string;

  afterAll(() => {
    if (seededDir !== undefined) rmSync(seededDir, { recursive: true, force: true });
  });

  it('reports node:http and a streamable transport subpath when present', () => {
    seededDir = mkdtempSync(path.join(tmpdir(), 'wp08-boundary-'));
    mkdirSync(path.join(seededDir, 'nested'));
    writeFileSync(
      path.join(seededDir, 'entry.js'),
      [
        `import { helper } from './nested/helper.js';`,
        `import { createServer } from 'node:http';`,
        `export const port = createServer ? 8080 : 0;`,
        `export const name = helper;`,
        ``,
      ].join('\n'),
    );
    writeFileSync(
      path.join(seededDir, 'nested', 'helper.js'),
      [
        `// A comment mentioning node:https must not count; comments are stripped.`,
        `export const helper = 'x';`,
        `export { StreamableHTTPServerTransport } from '@modelcontextprotocol/server/streamable-http';`,
        ``,
      ].join('\n'),
    );
    const scan = scanDistEntry(path.join(seededDir, 'entry.js'));
    expect(scan.files).toHaveLength(2);
    expect(scan.violations).toEqual(['@modelcontextprotocol/server/streamable-http', 'node:http']);
  });
});

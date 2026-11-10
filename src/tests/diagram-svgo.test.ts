/**
 * #315 — the build-mode SVGO config must survive the style values Mermaid emits.
 *
 * Mermaid 11.17.1's erDiagram renderer writes `style="undefined;undefined"` on
 * every relationship edge `<path>`. SVGO's `preset-default` runs `minifyStyles`,
 * whose csso throws on that value ("Cannot read properties of undefined (reading
 * '0')"), so before the fix ANY erDiagram failed the whole Astro build.
 *
 * These tests run the SAME svgo that `@beoe/rehype-code-hook-img` calls (resolved
 * from its own location, so a version skew in the lockfile cannot hide a crash)
 * with the exact `BUILD_SVGO_CONFIG` the toolkit registers. Nothing here launches
 * Chromium: the input is the SVG shape Mermaid hands to SVGO.
 */
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { describe, it, expect } from 'vitest';
import { BUILD_SVGO_CONFIG } from '../lib/integrations/diagrams.js';

type Optimize = (svg: string, config: unknown) => { data: string };

async function beoeSvgo(): Promise<Optimize> {
  // `@beoe/rehype-code-hook-img` is ESM-only with no `require` export, so locate
  // it on disk: pnpm links it next to `@beoe/rehype-mermaid` in that package's
  // own `node_modules`, and svgo resolves from the hook's real directory.
  const mermaidEntry = createRequire(import.meta.url).resolve('@beoe/rehype-mermaid');
  const marker = `${sep}node_modules${sep}@beoe${sep}rehype-mermaid${sep}`;
  const nodeModules = mermaidEntry.slice(0, mermaidEntry.lastIndexOf(marker) + `${sep}node_modules${sep}`.length);
  const hookImgDir = realpathSync(join(nodeModules, '@beoe', 'rehype-code-hook-img'));
  const svgoEntry = createRequire(join(hookImgDir, 'package.json')).resolve('svgo');
  const { optimize } = (await import(svgoEntry)) as { optimize: Optimize };
  return optimize;
}

const SVG = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>ER</title>${body}</svg>`;

describe('BUILD_SVGO_CONFIG survives Mermaid erDiagram edge styles (#315)', () => {
  it('optimises an edge whose style is "undefined;undefined" and drops the attribute', async () => {
    const optimize = await beoeSvgo();
    const out = optimize(
      SVG('<path d="M0 0L100 100" style="undefined;undefined" stroke="#123456"/>'),
      BUILD_SVGO_CONFIG,
    ).data;
    expect(out).toContain('<path');
    expect(out).not.toContain('undefined');
    expect(out).not.toMatch(/style="/);
  });

  it('keeps the valid declarations next to an undefined one', async () => {
    const optimize = await beoeSvgo();
    const out = optimize(
      SVG('<path d="M0 0L100 100" style="fill:none;undefined;stroke-width:2px"/>'),
      BUILD_SVGO_CONFIG,
    ).data;
    expect(out).not.toContain('undefined');
    expect(out).toMatch(/fill[:=]"?none/);
    expect(out).toMatch(/stroke-width[:=]"?2/);
  });

  it('never cuts a style value that itself holds a semicolon', async () => {
    const optimize = await beoeSvgo();
    const out = optimize(
      SVG('<rect width="10" height="10" style="fill:url(data:image/png;base64,QUJD)"/>'),
      BUILD_SVGO_CONFIG,
    ).data;
    expect(out).toContain('data:image/png;base64,QUJD');
  });

  it('leaves a well-formed style alone and keeps the a11y overrides', async () => {
    const optimize = await beoeSvgo();
    const out = optimize(
      SVG('<path d="M0 0L100 100" style="fill:none;stroke:#abcdef"/>'),
      BUILD_SVGO_CONFIG,
    ).data;
    expect(out).toMatch(/#abcdef/i);
    expect(out).toContain('<title>ER</title>'); // removeTitle stays off
    expect(out).toContain('viewBox="0 0 100 100"'); // removeViewBox stays off
  });
});

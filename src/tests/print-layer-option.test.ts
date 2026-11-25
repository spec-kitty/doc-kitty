/**
 * The print layer is opt-in (ADR-0081 as amended, operator ruling on #405 of 2026-11-25):
 * a site without `print`, `printControl` or a PDF builds byte for byte what it built
 * before the print layer existed (SC-004 arm A). These tests pin the three seams that
 * keep it so: the option's resolution, the manifest that alone brings the layer into the
 * module graph, and the absence of any other import of the print client.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePrintLayer } from '../lib/pdf-options.js';
import { generateManifestSource } from '../lib/manifest.js';
import { resolveTheme } from '../lib/theme.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRINT_LAYER_PATH = '@spec-kitty/doc-toolkit/components/print/PrintLayer.astro';

describe('resolvePrintLayer', () => {
  it('is off by default', () => {
    expect(resolvePrintLayer({ pdfDocuments: [] })).toBe(false);
  });

  it('is on when the site sets print: true', () => {
    expect(resolvePrintLayer({ print: true, pdfDocuments: [] })).toBe(true);
  });

  it('is on with the print control, which prints the page', () => {
    expect(resolvePrintLayer({ printControl: true, pdfDocuments: [] })).toBe(true);
  });

  it('is on with any PDF, whose print documents need the print rules', () => {
    expect(resolvePrintLayer({ pdfDocuments: ['guides'] })).toBe(true);
    expect(resolvePrintLayer({ pdfDocuments: ['site'] })).toBe(true);
  });

  it('stays off with print: false and nothing that needs it', () => {
    expect(resolvePrintLayer({ print: false, printControl: false, pdfDocuments: [] })).toBe(false);
  });

  it('refuses print: false next to a setting that needs the layer, naming it', () => {
    expect(() => resolvePrintLayer({ print: false, printControl: true, pdfDocuments: [] })).toThrow(
      /\[dk-config\] print: false.*printControl/,
    );
    expect(() => resolvePrintLayer({ print: false, pdfDocuments: ['guides'] })).toThrow(/\[dk-config\] print: false.*pdf/);
  });

  it('refuses a value that is not a boolean', () => {
    expect(() => resolvePrintLayer({ print: 'yes' as unknown as boolean, pdfDocuments: [] })).toThrow(
      /\[dk-config\] print must be a boolean/,
    );
  });
});

describe('the manifest brings the print layer in only when it is on', () => {
  const resolved = resolveTheme(undefined);

  it('exports PrintLayer as undefined, and imports nothing of it, by default', () => {
    const source = generateManifestSource(resolved);
    expect(source).toContain('export const PrintLayer = undefined;');
    expect(source).not.toContain('PrintLayer.astro');
  });

  it('imports and exports the PrintLayer component when the layer is on', () => {
    const source = generateManifestSource(resolved, { printLayer: true });
    expect(source).toContain(JSON.stringify(PRINT_LAYER_PATH));
    expect(source).toMatch(/export const PrintLayer = __dk_print_\d+;/);
  });
});

describe('nothing else loads the print client', () => {
  /** A static `import`, a re-`export … from`, or a dynamic `import()` of the print client. */
  const PRINT_CLIENT_IMPORT =
    /(?:\b(?:import|export)\s*(?:[^'"]*from\s*)?|\bimport\s*\(\s*)['"][^'"]*print\/print\.client(?:\.ts)?['"]/;

  it('the import pattern matches every form of import, and not a mention in a comment', () => {
    for (const form of [
      "import '../lib/print/print.client.ts';",
      "import x from './print/print.client';",
      "export { y } from '../print/print.client.ts';",
      "await import('../lib/print/print.client.ts');",
    ]) {
      expect(PRINT_CLIENT_IMPORT.test(form), form).toBe(true);
    }
    expect(PRINT_CLIENT_IMPORT.test('the handler lives in `print/print.client.ts`')).toBe(false);
  });

  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });

  it('only PrintLayer.astro imports print.client, so a site without the layer bundles none of it', () => {
    const importers = [...files(path.join(SRC, 'components')), ...files(path.join(SRC, 'lib')), ...files(path.join(SRC, 'layouts'))]
      .filter((file) => /\.(astro|ts|mjs|js)$/.test(file))
      .filter((file) => PRINT_CLIENT_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));
    expect(importers).toEqual(['components/print/PrintLayer.astro']);
  });

  it('the diagram renderer, shipped on every site, carries no print coupling', () => {
    const renderer = readFileSync(path.join(SRC, 'lib', 'diagram', 'diagram-render.client.ts'), 'utf8');
    expect(renderer).not.toMatch(/data-dk-printing|data-dk-diagram-theme/);
  });
});

/**
 * The PDF reader and post-pass (ADR-0081, #393, #395), on a synthetic PDF shaped like
 * Chromium's output: classic xref, an info dictionary with wall-clock dates, a tagged
 * catalog with an outline, and drifting structure ids.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { inspectPdf, outlineAt } from '../scripts/pdf-inspect.mjs';
import { firstDifference, normaliseStructIds, objectAt, pdfDate, pdfString, pinPdf } from '../scripts/pdf-postprocess.mjs';
import { checkPdfs, existingDirUnder, inOrder } from '../scripts/assert-pdf-artifacts.mjs';
import { comparePdfDirs } from '../scripts/assert-pdf-determinism.mjs';
import { manifestEpoch, parseArgs, sourceDateEpoch, UsageError } from '../scripts/dockitty-pdf.mjs';
import { fakePdf } from './fixtures/fake-pdf.js';

describe('inspectPdf', () => {
  it('reads pages, tagging, language, outline and info', () => {
    const info = inspectPdf(fakePdf());
    expect(info).toMatchObject({ pages: 2, lang: 'en', structTreeRoot: true, markInfo: true });
    expect(info.outline).toEqual([{ title: 'Architecture', children: [{ title: 'Overview', children: [] }] }]);
    expect(outlineAt(info.outline, 2).map((n: { title: string }) => n.title)).toEqual(['Overview']);
    expect(info.info.Producer).toBe('Skia/PDF m157');
  });

  it('refuses a PDF with a cross-reference stream, by name', () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<</Type /XRef>>\nendobj\nstartxref\n9\n%%EOF', 'latin1');
    expect(() => inspectPdf(pdf)).toThrow(/cross-reference streams/);
  });
});

describe('pinPdf', () => {
  const opts = { epochSeconds: 1767225600, title: 'Architecture', producer: 'doc-kitty-pdf/9.9.9' };

  it('pins both dates and stamps title and producer through an incremental update', () => {
    const out = pinPdf(fakePdf(), opts);
    const info = inspectPdf(out);
    expect(info.info).toEqual({
      Title: 'Architecture',
      Producer: 'doc-kitty-pdf/9.9.9',
      CreationDate: "D:20260101000000+00'00'",
      ModDate: "D:20260101000000+00'00'",
    });
    // The original bytes keep their offsets: the first object is untouched in length.
    expect(out.toString('latin1')).toContain("/CreationDate (D:20260101000000+00'00')\n/ModDate (D:20260101000000+00'00')>>\nendobj\n2 0 obj");
    expect(info.pages).toBe(2);
  });

  it('gives identical bytes for two runs that differ only in clock and DOM node ids', () => {
    const a = pinPdf(fakePdf({ created: "D:20261120175635+00'00'", idBase: 922 }), opts);
    const b = pinPdf(fakePdf({ created: "D:20261120180101+00'00'", idBase: 4711 }), opts);
    expect(firstDifference(a, b)).toBe(-1);
    // Control: without the post-pass the two differ.
    expect(firstDifference(fakePdf({ idBase: 922 }), fakePdf({ idBase: 4711 }))).toBeGreaterThan(0);
  });

  it('renumbers structure ids in order, in place, element and name tree alike', () => {
    const text = '(node00000922) (node00000930) (node00000922)';
    expect(normaliseStructIds(text)).toBe('(node00000001) (node00000002) (node00000001)');
  });

  it('never touches stream data that happens to spell an id', () => {
    const text = '1 0 obj\n<</ID (node00000922)>>\nendobj\n2 0 obj\n<</Length 15>>\nstream\n(node00000500)\nendstream\nendobj\n';
    expect(normaliseStructIds(text)).toBe(text.replace('(node00000922)', '(node00000001)'));
  });

  it('formats dates and strings the PDF way', () => {
    expect(pdfDate(0)).toBe("D:19700101000000+00'00'");
    expect(pdfString('a (b) \\c')).toBe('(a \\(b\\) \\\\c)');
    expect(pdfString('Ünïcode')).toMatch(/^<FEFF00DC/);
  });

  it('names the object that holds a difference', () => {
    const pdf = fakePdf();
    const at = pdf.toString('latin1').indexOf('/Count 2');
    expect(objectAt(pdf, at)).toBe('3 0 obj');
  });
});

describe('the PDF gate', () => {
  function distWith(pdfs: Record<string, Buffer>, documents: unknown[]) {
    const dist = mkdtempSync(path.join(tmpdir(), 'dk-pdf-gate-'));
    mkdirSync(path.join(dist, 'print'));
    mkdirSync(path.join(dist, 'pdf'));
    writeFileSync(path.join(dist, 'print', 'manifest.json'), JSON.stringify({ version: 1, documents }));
    for (const [name, buf] of Object.entries(pdfs)) writeFileSync(path.join(dist, 'pdf', name), buf);
    return dist;
  }
  const doc = { name: 'architecture', route: '/print/architecture/', title: 'Architecture', lang: 'en', titleLevel: 2, pages: 1, titles: ['Overview'] };

  it('passes a tagged, outlined PDF per document', () => {
    expect(checkPdfs(distWith({ 'architecture.pdf': fakePdf() }, [doc]))).toEqual([]);
  });

  it('fails a missing, extra, wrong-language, untitled or empty document', () => {
    expect(checkPdfs(distWith({}, [{ ...doc, name: '../escape' }]))[0], 'a name is never a path').toMatch(/not a document name/);
    expect(checkPdfs(distWith({}, [doc]))[0]).toMatch(/missing architecture\.pdf/);
    expect(checkPdfs(distWith({ 'architecture.pdf': fakePdf(), 'x.pdf': fakePdf() }, [doc]))[0]).toMatch(/unexpected x\.pdf/);
    expect(checkPdfs(distWith({ 'architecture.pdf': fakePdf({ lang: 'nl' }) }, [doc]))[0]).toMatch(/\/Lang is "nl"/);
    expect(checkPdfs(distWith({ 'architecture.pdf': fakePdf() }, [{ ...doc, titles: ['Other'] }]))[0]).toMatch(/outline does not list/);
    expect(checkPdfs(distWith({ 'architecture.pdf': fakePdf() }, [{ ...doc, pages: Number.NaN, titles: [] }]))[0]).toMatch(/no page count/);
  });

  it('finds a whole-site top-level page one outline level up, beside the section dividers', () => {
    // The fake outline is Architecture > Overview: in a whole-site document (page titles
    // at level 3), "Overview" is a page outside any folder, printed at h2.
    const site = { ...doc, name: 'site', route: '/print/', titleLevel: 3 };
    expect(checkPdfs(distWith({ 'site.pdf': fakePdf() }, [site]))).toEqual([]);
  });

  it('reads only an existing directory under the working directory', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-pdf-root-'));
    mkdirSync(path.join(root, 'site', 'dist'), { recursive: true });
    expect(existingDirUnder(root, 'site/dist')).toBe(path.join(root, 'site', 'dist'));
    expect(existingDirUnder(root, '.')).toBe(root);
    expect(existingDirUnder(root, 'site/missing')).toBeNull();
    expect(existingDirUnder(root, '../elsewhere')).toBeNull();
    expect(existingDirUnder(root, '/etc')).toBeNull();
  });

  it('accepts a cover-only document: a section with no page besides its index', () => {
    expect(checkPdfs(distWith({ 'architecture.pdf': fakePdf() }, [{ ...doc, pages: 0, titles: [] }]))).toEqual([]);
  });

  it('matches titles in order, gaps allowed', () => {
    expect(inOrder(['a', 'x', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(inOrder(['b', 'a'], ['a', 'b'])).toBe(false);
  });

  it('the determinism comparison reports the first difference', () => {
    const a = distWith({ 'architecture.pdf': fakePdf() }, [doc]);
    const b = distWith({ 'architecture.pdf': fakePdf({ idBase: 1 }) }, [doc]);
    expect(comparePdfDirs(a, a)).toEqual([]);
    expect(comparePdfDirs(a, b)[0]).toMatch(/^architecture\.pdf: first difference at byte \d+, in \d+ 0 obj/);
  });
});

describe('dockitty-pdf arguments', () => {
  it('parses the documented flags', () => {
    expect(parseArgs(['--dist', 'd', '--base', '/doc-kitty/', '--sections', 'a, site'])).toMatchObject({
      dist: 'd',
      base: '/doc-kitty',
      sections: ['a', 'site'],
    });
    expect(parseArgs(['--dist', 'd', '--base', '/']).base).toBe('');
  });

  it.each([[[]], [['--dist', 'd']], [['--dist', 'd', '--base', '/', '--bogus']], [['--dist', 'd', '--base', '/', '--timeout', '-1']]])(
    'refuses %j as a usage error (exit 2)',
    (argv) => {
      expect(() => parseArgs(argv)).toThrow(UsageError);
    },
  );

  it('exits 2 on a usage error or missing input, as a command', () => {
    const cli = fileURLToPath(new URL('../scripts/dockitty-pdf.mjs', import.meta.url));
    const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, SOURCE_DATE_EPOCH: '0' } });
    expect(run(['--base', '/']).status).toBe(2);
    expect(run(['--dist', path.join(tmpdir(), 'dk-no-such-dist'), '--base', '/']).status).toBe(2);
    const empty = mkdtempSync(path.join(tmpdir(), 'dk-pdf-nomanifest-'));
    const noManifest = run(['--dist', empty, '--base', '/']);
    expect(noManifest.status).toBe(2);
    expect(noManifest.stderr).toMatch(/manifest\.json is missing/);
  });

  it('pins to SOURCE_DATE_EPOCH, and refuses a malformed one', () => {
    expect(sourceDateEpoch({ SOURCE_DATE_EPOCH: '1767225600' })).toBe(1767225600);
    expect(() => sourceDateEpoch({ SOURCE_DATE_EPOCH: 'yesterday' })).toThrow(UsageError);
  });

  it('falls back to the build time the manifest records, and runs no git', () => {
    expect(sourceDateEpoch({}, 1767225600)).toBe(1767225600);
    expect(sourceDateEpoch({ SOURCE_DATE_EPOCH: '5' }, 1767225600), 'the variable wins').toBe(5);
    expect(() => sourceDateEpoch({}, undefined)).toThrow(/no date to pin/);
    const dist = mkdtempSync(path.join(tmpdir(), 'dk-pdf-epoch-'));
    mkdirSync(path.join(dist, 'print'));
    writeFileSync(path.join(dist, 'print', 'manifest.json'), JSON.stringify({ version: 1, documents: [{ name: 'a', sourceDateEpoch: 42 }] }));
    expect(manifestEpoch(dist)).toBe(42);
    expect(manifestEpoch(path.join(dist, 'none'))).toBeUndefined();
  });
});

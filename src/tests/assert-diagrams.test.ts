/**
 * #314 — `dockitty-assert-diagrams`: a built site's diagrams were all drawn at
 * build time. One case per rule on the page check, then the bin end to end.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagramDefects } from '../scripts/diagram-artifacts.mjs';
import { renderLegacyStub } from '../lib/legacy-html-redirects.mjs';
import toolkitPkg from '../package.json' with { type: 'json' };

const FIGURE = '<figure class="dk-diagram" role="group"><svg viewBox="0 0 1 1"><title>T</title></svg></figure>';
const page = (body: string): string => `<!doctype html><html><head><title>P</title></head><body>${body}</body></html>`;

describe('diagramDefects (one built page)', () => {
  it('passes a page whose figures all hold an <svg>, and counts them', () => {
    expect(diagramDefects(page(FIGURE + FIGURE))).toEqual({ figures: 2, defects: [] });
  });

  it.each([
    ['a figure with no <svg>', '<figure class="dk-diagram"><pre>x</pre></figure>', /figure 1 holds no <svg>/],
    ['a raw mermaid fence', '<pre data-language="mermaid"><code>graph LR</code></pre>', /raw diagram code block/],
    ['a raw plantuml fence', '<pre><code class="language-plantuml">@startuml</code></pre>', /raw diagram code block/],
    ['a single-quoted raw fence', "<pre data-language='mermaid'><code>graph LR</code></pre>", /raw diagram code block/],
    ['a client-mode mermaid block', '<figure class="dk-diagram"><pre class="mermaid">graph LR</pre></figure>', /client-rendered/],
    ['a plantuml-error block', '<div class="plantuml-error">boom</div>', /plantuml-error block/],
    ['an image loaded from plantuml.com', '<img src="https://www.plantuml.com/plantuml/svg/abc">', /plantuml\.com URL/],
    ['a figure whose <svg> sits after the figure closes', '<figure class="dk-diagram"><pre>x</pre></figure><svg></svg>', /figure 1 holds no <svg>/],
  ])('fails %s', (_name, body, defect) => {
    expect(diagramDefects(page(body)).defects.join('\n')).toMatch(defect);
  });

  it('does not read prose or a link naming plantuml.com, a code sample in another language, or a nested figure as a defect', () => {
    const body =
      '<p>Never use plantuml.com.</p><a href="https://plantuml.com/yaml">YAML diagrams</a>' +
      '<pre data-language="markdown"><code>```mermaid</code></pre>' +
      '<figure class="dk-diagram"><figure class="inner"></figure><svg></svg></figure>';
    expect(diagramDefects(page(body)).defects).toEqual([]);
  });
});

describe('dockitty-assert-diagrams <dist>', () => {
  const bin = fileURLToPath(new URL(`../${toolkitPkg.bin['dockitty-assert-diagrams']}`, import.meta.url));
  const run = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

  it('passes a build-mode site, skips redirect stubs, and fails a page that shipped a raw fence', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'dk-assert-diagrams-'));
    try {
      mkdirSync(path.join(dist, 'guide'), { recursive: true });
      writeFileSync(path.join(dist, 'guide', 'index.html'), page(FIGURE));
      writeFileSync(path.join(dist, 'guide.html'), renderLegacyStub({ from: '/guide.html', to: '/guide/' }));
      const ok = run(dist);
      expect(ok.stdout).toMatch(/OK — 1 diagram figure\(s\) drawn at build time across 1 page\(s\); 1 redirect stub\(s\) skipped/);
      expect(ok.status).toBe(0);

      writeFileSync(path.join(dist, 'guide', 'index.html'), page('<pre data-language="plantuml"><code>@startuml</code></pre>'));
      const bad = run(dist);
      expect(bad.stderr).toMatch(/FAIL — guide\/index\.html: raw diagram code block/);
      expect(bad.status).toBe(1);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });

  it('exits 2 without a directory', () => {
    const none = run();
    expect(none.stderr).toMatch(/usage: dockitty-assert-diagrams <dist>/);
    expect(none.status).toBe(2);
    const missing = run('/no/such/dist');
    expect(missing.stderr).toMatch(/\/no\/such\/dist is not a directory/);
    expect(missing.status).toBe(2);
  });
});

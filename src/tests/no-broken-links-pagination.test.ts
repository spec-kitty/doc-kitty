/**
 * The built-output link gate covers the paged hub listing's pagination (#342,
 * WP06, T027; FR-015, SC-004): a pagination link to a built listing page passes,
 * and the same link with the listing page missing fails the gate.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATE = fileURLToPath(new URL('../scripts/assert-no-broken-links.mjs', import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The pagination markup the hub page renders (HubPagination.astro), base `/site`. */
const pagination = (current: number, total: number) =>
  `<nav class="dk-hub-pagination" aria-label="Pagination"><ul class="dk-hub-pagination__list" role="list">${Array.from({ length: total }, (_, i) => i + 1)
    .map((n) =>
      n === current
        ? `<li><span class="dk-hub-pagination__current" aria-current="page"><span class="sr-only">Page </span>${n}</span></li>`
        : `<li><a class="dk-hub-pagination__link" href="/site/missions/${n === 1 ? '' : `page/${n}/`}" aria-label="Page ${n}">${n}</a></li>`,
    )
    .join('')}</ul></nav>`;

function dist(withPage2: boolean): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-pagination-links-'));
  dirs.push(root);
  const write = (rel: string, html: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), `<!doctype html><html><body>${html}</body></html>`);
  };
  write('missions/index.html', pagination(1, 2));
  if (withPage2) write('missions/page/2/index.html', pagination(2, 2));
  return root;
}

const gate = (root: string) => spawnSync(process.execPath, [GATE, root, '--base', '/site'], { encoding: 'utf8' });

describe('the link gate on pagination links (T027)', () => {
  it('passes when every listing page the pagination links to is built', () => {
    const result = gate(dist(true));
    expect(result.status, result.stderr + result.stdout).toBe(0);
  });

  it('fails when a listing page the pagination links to is missing', () => {
    const result = gate(dist(false));
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('/site/missions/page/2/');
  });
});

/**
 * Docs for the PlantUML external-include opt-in (#268, ADR-0074). Only drift
 * guards live here: the recommended SANDBOX block is unchanged, and the guide's
 * allowlist service block equals the one the `plantuml-allowlist` CI lane runs.
 * Prose (keywords, ADR frontmatter, changelog fragments, doc links) is left to
 * `validate:docs` and review.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => readFileSync(repo(p), 'utf8');
const fixture = (p: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/plantuml-opt-in-docs/${p}`, import.meta.url)), 'utf8');

const GUIDE = 'docs/guides/consumer-setup.md';

describe('recommended SANDBOX block (FR-007, C-001)', () => {
  it('stays byte-identical in the guide', () => {
    const guide = read(GUIDE);
    expect(fixture('recommended-sandbox-block.yml').length).toBeGreaterThan(100);
    expect(guide).toContain(fixture('recommended-sandbox-block.yml'));
    expect(guide).toContain(fixture('recommended-sandbox-run.sh'));
  });
});

/** The text of the `#### Allowing external includes` subsection, up to the next `##`/`####` heading of its level or above. */
function guideSubsection(): string {
  const guide = read(GUIDE);
  const start = guide.indexOf('#### Allowing external includes');
  expect(start).toBeGreaterThan(-1);
  const rest = guide.slice(start + 1);
  const next = rest.search(/\n#{2,4} /);
  return next === -1 ? guide.slice(start) : guide.slice(start, start + 1 + next);
}

/** The first fenced block of `lang` in `text` that satisfies `pick`. */
function fenced(text: string, lang: string, pick: (body: string) => boolean): string {
  const re = new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g');
  for (const m of text.matchAll(re)) if (pick(m[1])) return m[1];
  throw new Error(`no ${lang} block matched`);
}

const dedent = (text: string, n: number) =>
  text
    .split('\n')
    .map((l) => (l.startsWith(' '.repeat(n)) ? l.slice(n) : l))
    .join('\n');

/** The guide's allowlist block (declared entry swapped for the lane's) next to the lane's service block. */
function allowlistComparison(subsection: string): { guide: string; lane: string } {
  const ci = read('.github/workflows/ci.yml');
  const job = ci.slice(ci.indexOf('\n  plantuml-allowlist:'));
  const svcStart = job.indexOf('    services:\n');
  const stepsStart = job.indexOf('    steps:\n');
  expect(svcStart).toBeGreaterThan(-1);
  expect(stepsStart).toBeGreaterThan(svcStart);
  const lane = dedent(job.slice(svcStart, stepsStart), 4).trimEnd();
  const guide = fenced(subsection, 'yaml', (b) => b.includes('ALLOWLIST'))
    .replace(/^#.*\n/, '')
    .trimEnd()
    .replace('https://styles.example.org/plantuml/;', 'http://dk-canary:18091/dk-declared/;');
  return { guide, lane };
}

describe('guide: Allowing external includes (FR-008)', () => {
  const sub = guideSubsection();

  it('sits after the hardened section and before the next section', () => {
    const guide = read(GUIDE);
    expect(guide.indexOf('#### Run the PlantUML service hardened')).toBeLessThan(
      guide.indexOf('#### Allowing external includes'),
    );
  });

  it('shows the same allowlist service block the plantuml-allowlist CI lane runs', () => {
    const { guide, lane } = allowlistComparison(sub);
    expect(lane).toContain('PLANTUML_ALLOWLIST_URL');
    expect(guide).toBe(lane);
  });

  it('shows an internet-mode service block: same pinned image, INTERNET profile, no allowlist variable', () => {
    const ci = read('.github/workflows/ci.yml');
    const image = /image: (plantuml\/plantuml-server:\S+)/.exec(ci)![1];
    const block = fenced(sub, 'yaml', (b) => b.includes('PLANTUML_SECURITY_PROFILE: INTERNET'));
    expect(block).toContain(`image: ${image}`);
    expect(block).toContain('- 8091:8080');
    expect(block).not.toContain('PLANTUML_ALLOWLIST_URL');
    // positive control on the same fixture: the allowlist block is not mistaken for it
    expect(fenced(sub, 'yaml', (b) => b.includes('ALLOWLIST'))).not.toContain('INTERNET');
  });

  it('keeps the docker run form beside the YAML form with the same profile and canary entry', () => {
    const sh = fenced(sub, 'sh', (b) => b.includes('docker run'));
    expect(sh).toContain('PLANTUML_SECURITY_PROFILE=ALLOWLIST');
    expect(sh).toContain('http://dk-canary:18091/dk-canary/allowed/');
    expect(sh).toContain('--add-host dk-canary:host-gateway');
  });
});

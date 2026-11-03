/**
 * Docs for the PlantUML external-include opt-in (#268, ADR-0074): the consumer
 * guide subsection, the ADR, the architecture pointer and the changelog
 * fragment. These tests assert that the pages exist and carry the required
 * facts (substrings, not wording), that the recommended SANDBOX block is
 * unchanged, and that the guide's allowlist service block equals the one the
 * `plantuml-allowlist` CI lane runs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => readFileSync(repo(p), 'utf8');
const fixture = (p: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/plantuml-opt-in-docs/${p}`, import.meta.url)), 'utf8');

const GUIDE = 'docs/guides/consumer-setup.md';
const ADR = 'docs/adr/0074-plantuml-external-include-opt-in.md';
const FRAGMENT = 'docs/changelog/unreleased/268-plantuml-external-include-opt-in.md';
const CHANGED_FRAGMENT = 'docs/changelog/unreleased/268-plantuml-include-check-stricter.md';

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

  it('carries every required fact', () => {
    const required = [
      'PLANTUML_ALLOWLIST_URL',
      ';',
      'End with',
      'host.evil.com',
      'dk-canary:18091/dk-canary/allowed/',
      '<C4/',
      'local-file',
      'internal networks',
      'cloud metadata',
      'redirect',
      'docker inspect',
      '--astro-config',
      'no environment off-switch',
      'internet',
      '@',
      'exactly as declared',
      'PLANTUML_SECURITY_PROFILE',
      'empty',
      '--service-container',
      '--add-host dk-canary:host-gateway',
      'verdict: declared allowlist, observed allowlist',
      '--print-declared',
      'SANDBOX',
      'behaviour change',
    ];
    const flat = sub.toLowerCase().replace(/\s+/g, ' ');
    const missing = required.filter((s) => !flat.includes(s.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('shows the same allowlist service block the plantuml-allowlist CI lane runs', () => {
    const { guide, lane } = allowlistComparison(sub);
    expect(lane).toContain('PLANTUML_ALLOWLIST_URL');
    expect(guide).toBe(lane);
  });

  it('positive control: altering one line of the real guide block breaks the comparison', () => {
    const real = guideSubsection();
    const block = fenced(real, 'yaml', (b) => b.includes('ALLOWLIST'));
    const mutated = real.replace(block, block.replace('- 8091:8080', '- 8092:8080'));
    expect(mutated).not.toBe(real);
    expect(allowlistComparison(mutated).guide).not.toBe(allowlistComparison(mutated).lane);
    expect(allowlistComparison(real).guide).toBe(allowlistComparison(real).lane);
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

describe('ADR-0074 (FR-009)', () => {
  it('exists with the required frontmatter', () => {
    expect(existsSync(repo(ADR))).toBe(true);
    const fm = read(ADR).split('---')[1];
    for (const key of ['title:', 'description:', 'doc_status:', 'updated:', 'kind:']) expect(fm).toContain(key);
  });

  it('records the decision, the limits and the consequences', () => {
    const adr = read(ADR);
    const lower = adr.toLowerCase().replace(/\s+/g, ' ');
    const required = [
      'sandbox',
      'default',
      'plantumlAllowExternal',
      'DK_PLANTUML_ALLOW_EXTERNAL',
      'internet',
      'environment wins',
      '--astro-config',
      'docker inspect',
      'cannot prove',
      '--service-allowlist-url',
      'unconditional',
      'SANDBOX',
      'ADR-0007',
    ];
    const missing = required.filter((s) => !lower.includes(s.toLowerCase()));
    expect(missing).toEqual([]);
    expect(adr).toMatch(/^Accepted/m);
  });
});

describe('changelog fragments (FR-010, C-002)', () => {
  it('the Added fragment names the setting and the default, feature only', () => {
    const f = read(FRAGMENT);
    expect(f).toMatch(/^---\nsection: Added\n---\n/);
    for (const s of ['plantumlAllowExternal', 'DK_PLANTUML_ALLOW_EXTERNAL', 'internet', 'default', '(#268)', '<C4/'])
      expect(f).toContain(s);
    expect(f.length).toBeLessThan(1200);
  });

  it('the Breaking fragment states the stricter check, impact first, and the fix', () => {
    const f = read(CHANGED_FRAGMENT);
    expect(f).toMatch(/^---\nsection: Breaking\n---\n/);
    for (const s of ['--service-container', 'SANDBOX', '(#268)', 'PLANTUML_SECURITY_PROFILE=SANDBOX', 'To fix', '-D', 'PLANTUML_PROPERTY_FILE', '--server'])
      expect(f).toContain(s);
    expect(f.length).toBeLessThan(1200);
  });
});

describe('architecture pointer (FR-009)', () => {
  it('diagrams.md links ADR-0074 and the guide subsection', () => {
    const d = read('docs/architecture/diagrams.md');
    expect(d).toContain('0074-plantuml-external-include-opt-in.md');
    expect(d).toContain('consumer-setup.md#allowing-external-includes');
  });

  it('both CI docs name the plantuml-allowlist lane', () => {
    expect(read('docs/architecture/ci-cd-pipeline.md')).toContain('plantuml-allowlist');
    expect(read('docs/ops/ci-cd.md')).toContain('plantuml-allowlist');
  });
});

/**
 * Guard for `styles/disclosure.css` (page-chrome mission review, LOW-6). The sheet is
 * inline in every docs page, and the chrome golden strips it, so a rule that reaches
 * past the control (`.sl-markdown-content{display:none}`) would pass the page
 * comparisons. This pins that every selector in it names the control: `.dk-disclosure`
 * (or its `__`/`--` parts) or `.dk-panel`, including inside `@media print`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SHEET = fileURLToPath(new URL('../styles/disclosure.css', import.meta.url));
const SCOPE = /\.dk-(?:disclosure|panel)(?:__[\w-]+|--[\w-]+)?(?![\w-])/;

/*
 * What is checked, and why it is narrower than "the rightmost compound names the
 * control": the sheet's own rules end in `summary`, `details` or `svg`
 * (`.dk-disclosure > details > summary`), so the rightmost compound cannot be required
 * to name the control. What keeps a rule inside the control is its anchor, the
 * leftmost compound, so that is what must name it. On top of that:
 *  - the anchor is judged without its `:not(...)`/`:has(...)` arguments, so
 *    `:not(.dk-disclosure) p` does not count as scoped;
 *  - a sibling combinator (`~`, `+`) must come after a child or descendant step, so
 *    `.dk-disclosure ~ p` (a sibling of the control) is rejected while
 *    `.dk-disclosure > .dk-disclosure__toggle + details` (inside it) passes;
 *  - `&` and nested rule blocks are rejected, as is any at-rule except `@media`
 *    (so `@import` is out);
 *  - a bare anchor (no further step, no pseudo-element) with `display:none`.
 * The sheet's `:not(:has(> svg))` is on a summary, after the anchor, so it passes.
 */

interface Rule {
  selector: string;
  body: string;
  context: string;
}

/** Every style rule, with the at-rule it sits in (`''` at the top level) and problems the walk itself finds. */
function readSheet(css: string): { rules: Rule[]; problems: string[] } {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const problems: string[] = [];
  for (const m of text.matchAll(/@import\b[^;{]*;?/gi)) problems.push(m[0].trim());
  const walk = (from: number, to: number, context: string) => {
    let i = from;
    while (i < to) {
      const open = text.indexOf('{', i);
      if (open === -1 || open >= to) break;
      const prelude = text.slice(i, open).trim().replace(/^[^{}]*;\s*/, '');
      let depth = 1;
      let j = open + 1;
      while (j < to && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@')) {
        if (/^@media\b/i.test(prelude)) walk(open + 1, j - 1, prelude);
        else problems.push(`${context ? `${context} ` : ''}${prelude}`);
      } else {
        if (body.includes('{')) problems.push(`${prelude} (nested rule)`);
        rules.push({ selector: prelude, body, context });
      }
      i = j;
    }
  };
  walk(0, text.length, '');
  return { rules, problems };
}

/** `[compounds, combinators]` of one selector; combinators[i] sits between compounds[i] and [i+1]. */
function tokenize(selector: string): { compounds: string[]; combinators: string[] } {
  const compounds: string[] = [];
  const combinators: string[] = [];
  let current = '';
  let depth = 0;
  let pendingComb = '';
  const push = () => {
    if (current) {
      if (compounds.length) combinators.push(pendingComb || ' ');
      compounds.push(current);
      current = '';
      pendingComb = '';
    }
  };
  for (const ch of selector.trim()) {
    if ('(['.includes(ch)) depth++;
    if (')]'.includes(ch)) depth--;
    if (depth === 0 && /[\s>+~]/.test(ch)) {
      push();
      if (/[>+~]/.test(ch)) pendingComb = ch;
    } else current += ch;
  }
  push();
  return { compounds, combinators };
}

/** Removes `:not(...)`, `:has(...)`, `:is(...)` and `:where(...)` with their (balanced) arguments. */
function withoutFunctional(compound: string): string {
  let out = '';
  for (let i = 0; i < compound.length; i++) {
    const m = /^:(?:not|has|is|where)\(/.exec(compound.slice(i));
    if (!m) {
      out += compound[i];
      continue;
    }
    let depth = 1;
    i += m[0].length;
    while (i < compound.length && depth > 0) {
      if (compound[i] === '(') depth++;
      else if (compound[i] === ')') depth--;
      i++;
    }
    i--;
  }
  return out;
}

function problemsOf(css: string): string[] {
  const { rules, problems } = readSheet(css);
  const out = [...problems];
  for (const { selector, body, context } of rules) {
    const at = context ? `${context} ` : '';
    if (selector.includes('&')) {
      out.push(`${at}${selector} (&)`);
      continue;
    }
    for (const part of selector.split(',').map((x) => x.trim())) {
      const { compounds, combinators } = tokenize(part);
      if (!compounds.length || !SCOPE.test(withoutFunctional(compounds[0]))) {
        out.push(`${at}${part}`);
        continue;
      }
      const firstStep = combinators.findIndex((c) => c === '>' || c === ' ');
      const firstSibling = combinators.findIndex((c) => c === '+' || c === '~');
      if (firstSibling !== -1 && (firstStep === -1 || firstSibling < firstStep)) out.push(`${at}${part} (sibling combinator outside the control)`);
      if (compounds.length === 1 && !compounds[0].includes('::') && /(?:^|;)\s*display\s*:\s*none\b/i.test(body)) {
        out.push(`${at}${part} (hides the control or panel itself)`);
      }
    }
  }
  return out;
}

describe('disclosure.css scope', () => {
  const css = readFileSync(SHEET, 'utf8');

  it('reads the sheet as a set of rules (control)', () => {
    const { rules } = readSheet(css);
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.some((r) => r.context === '@media print')).toBe(true);
    expect(rules.some((r) => /display\s*:\s*none/.test(r.body)), 'control: the sheet does hide things').toBe(true);
    expect(rules.some((r) => r.selector.includes(':has(')), 'control: it has a :has rule').toBe(true);
    expect(rules.some((r) => r.selector.includes(' + ')), 'control: it has a sibling rule').toBe(true);
  });

  it('every rule is anchored at the disclosure control or the panel, and stays inside it', () => {
    expect(problemsOf(css)).toEqual([]);
  });

  it('goes red on a rule outside the control, top level or in a media query', () => {
    expect(problemsOf(`${css}\n.sl-markdown-content{display:none}`)).toEqual(['.sl-markdown-content']);
    expect(problemsOf(`${css}\n@media print{.dk-disclosure p, main{display:none}}`)).toEqual(['@media print main']);
    expect(problemsOf(`${css}\n.dk-disclosure-evil{display:none}`)).toEqual(['.dk-disclosure-evil']);
  });

  it('goes red on a rule that escapes the control while naming it', () => {
    expect(problemsOf(`${css}\n.dk-disclosure ~ p{margin:0}`)).toEqual(['.dk-disclosure ~ p (sibling combinator outside the control)']);
    expect(problemsOf(`${css}\n.dk-panel + .x{margin:0}`)).toEqual(['.dk-panel + .x (sibling combinator outside the control)']);
    expect(problemsOf(`${css}\n:not(.dk-disclosure) p{margin:0}`)).toEqual([':not(.dk-disclosure) p']);
    expect(problemsOf(`${css}\n:has(.dk-panel){margin:0}`)).toEqual([':has(.dk-panel)']);
    expect(problemsOf(`${css}\n@import url(x.css);`)).toEqual(['@import url(x.css);']);
    expect(problemsOf(`${css}\n.dk-disclosure{ .x &{display:none} }`)).toEqual(['.dk-disclosure (nested rule)']);
    expect(problemsOf(`${css}\n.dk-disclosure{display:none}`)).toEqual(['.dk-disclosure (hides the control or panel itself)']);
    expect(problemsOf(`${css}\n.dk-panel{display:none}`)).toEqual(['.dk-panel (hides the control or panel itself)']);
  });
});

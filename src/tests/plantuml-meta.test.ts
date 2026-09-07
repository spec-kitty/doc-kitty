/**
 * Unit matrix for the PlantUML metadata twin (#13 WP02, FR-006/007/008,
 * C-001/C-003) — the `'`-comment parser, the skinparam sentinel preamble, the
 * SVG accessibility helpers, the shared figure wrap over a raw `astro-plantuml`
 * node, and the self-hosted `serverUrl` guard. Astro-free: everything here is a
 * pure string / hast-node exercise (the config-side resolver reads only env).
 */
import { describe, it, expect } from 'vitest';
import {
  parsePlantumlMeta,
  injectSkinparam,
  plantumlFigureFields,
  escapeHtml,
  stripPlantumlPis,
  injectSvgAccessibleName,
  SKINPARAM_PREAMBLE,
  PLANTUML_SENTINELS,
} from '../lib/remark/plantuml-meta.internal.js';
import plantumlMeta, { type PlantumlFigure } from '../lib/remark/plantuml-meta.js';
import diagramFigure from '../lib/rehype/diagram-figure.js';
import {
  DIAGRAM_SENTINELS,
  sentinelThemeRewrite,
  resolvePlantumlServerUrl,
  DEFAULT_PLANTUML_SERVER_URL,
} from '../lib/config.js';

describe('parsePlantumlMeta (the `\'`-comment twin of parseMeta)', () => {
  it('captures the closed set from a leading `\' key: value` block and strips it', () => {
    const { fields, strippedCode } = parsePlantumlMeta(
      "' title: My diagram\n' description: A flow\n' attribution: Me\n' source: https://e.com\nrectangle A",
    );
    expect(fields).toEqual({
      title: 'My diagram',
      description: 'A flow',
      attribution: 'Me',
      source: 'https://e.com',
    });
    expect(strippedCode).toBe('rectangle A');
  });

  it('requires whitespace after `\'` — a `\'{` form is never a metadata line', () => {
    // `'{ ... }` is not a real PlantUML construct, but the guard mirrors the
    // Mermaid `%%{` init-directive guard: no space after the comment marker → the
    // line is a plain comment, left in place, and NOT captured as metadata.
    const { fields, strippedCode } = parsePlantumlMeta("'{title: nope}\nrectangle A");
    expect(fields.title).toBeUndefined();
    expect(strippedCode).toBe("'{title: nope}\nrectangle A");
  });

  it('keeps non-metadata `\'` comments and blank lines, first-occurrence wins', () => {
    const { fields, strippedCode } = parsePlantumlMeta(
      "' just a comment\n\n' title: First\n' title: Second\nrectangle A",
    );
    expect(fields.title).toBe('First');
    expect(strippedCode).toBe("' just a comment\n\nrectangle A");
  });

  it('stops scanning at the first non-blank, non-`\'` line', () => {
    // A `' title:` AFTER the first statement line is body, not leading metadata.
    const { fields } = parsePlantumlMeta("rectangle A\n' title: too late");
    expect(fields.title).toBeUndefined();
  });
});

describe('injectSkinparam (theme the SVG via the six sentinels)', () => {
  it('prepends the preamble when the body has no @startuml', () => {
    const out = injectSkinparam('rectangle A');
    expect(out.startsWith(SKINPARAM_PREAMBLE)).toBe(true);
    expect(out.endsWith('rectangle A')).toBe(true);
  });

  it('inserts the preamble AFTER an explicit @startuml line', () => {
    const out = injectSkinparam('@startuml\nrectangle A\n@enduml');
    // The whole (multi-line) preamble block sits between @startuml and the body.
    expect(out.startsWith(`@startuml\n${SKINPARAM_PREAMBLE}\n`)).toBe(true);
    expect(out).toContain('rectangle A');
    expect(out.trimEnd().endsWith('@enduml')).toBe(true);
  });

  it('the preamble carries all six sentinel hexes exactly once as skinparams', () => {
    for (const hex of Object.values(PLANTUML_SENTINELS)) {
      expect(SKINPARAM_PREAMBLE).toContain(hex);
    }
  });
});

describe('PLANTUML_SENTINELS parity with config DIAGRAM_SENTINELS (C-003, no drift)', () => {
  it('is byte-identical to the config-owned sentinel table', () => {
    expect(PLANTUML_SENTINELS).toEqual(DIAGRAM_SENTINELS);
  });
});

describe('plantumlFigureFields (title is the accessible name only, not a caption field)', () => {
  it('projects description/attribution/source and drops title', () => {
    expect(
      plantumlFigureFields({ title: 'T', description: 'D', attribution: 'A', source: 'S' }),
    ).toEqual({ description: 'D', attribution: 'A', source: 'S' });
  });
});

describe('SVG helpers', () => {
  it('escapeHtml escapes the five metacharacters', () => {
    expect(escapeHtml(`<a href="x">& '`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp; &#39;');
  });

  it('stripPlantumlPis removes the version + source processing instructions', () => {
    const svg = '<?plantuml 1.2026.2?><svg><rect/><?plantuml-src ABCDEF?></svg>';
    const out = stripPlantumlPis(svg);
    expect(out).toBe('<svg><rect/></svg>');
    expect(out).not.toContain('plantuml-src');
  });

  it('injectSvgAccessibleName inserts <title>+<desc> as the first SVG children', () => {
    const out = injectSvgAccessibleName('<svg viewBox="0 0 1 1"><rect/></svg>', 'Name', 'Desc');
    expect(out).toBe('<svg viewBox="0 0 1 1"><title>Name</title><desc>Desc</desc><rect/></svg>');
  });

  it('injectSvgAccessibleName omits <desc> when there is no description, and no-ops with no name', () => {
    expect(injectSvgAccessibleName('<svg><rect/></svg>', 'Only name', undefined)).toBe(
      '<svg><title>Only name</title><rect/></svg>',
    );
    expect(injectSvgAccessibleName('<svg><rect/></svg>', undefined, undefined)).toBe(
      '<svg><rect/></svg>',
    );
  });

  it('injectSvgAccessibleName escapes the injected text', () => {
    const out = injectSvgAccessibleName('<svg><rect/></svg>', 'A & B', '<x>');
    expect(out).toContain('<title>A &amp; B</title>');
    expect(out).toContain('<desc>&lt;x&gt;</desc>');
  });
});

describe('resolvePlantumlServerUrl (FR-006, C-001 self-hosted guard)', () => {
  it('defaults to the self-hosted example server (never plantuml.com)', () => {
    expect(resolvePlantumlServerUrl({})).toBe(DEFAULT_PLANTUML_SERVER_URL);
    expect(DEFAULT_PLANTUML_SERVER_URL).not.toMatch(/plantuml\.com/i);
    expect(DEFAULT_PLANTUML_SERVER_URL).toMatch(/^https?:\/\/localhost/i);
  });

  it('honours an explicit self-hosted DK_PLANTUML_SERVER_URL', () => {
    expect(
      resolvePlantumlServerUrl({ DK_PLANTUML_SERVER_URL: 'http://plantuml.internal:8080/svg/' }),
    ).toBe('http://plantuml.internal:8080/svg/');
  });

  it('THROWS on any plantuml.com endpoint — the public endpoint can never be reached (C-001)', () => {
    expect(() =>
      resolvePlantumlServerUrl({ DK_PLANTUML_SERVER_URL: 'https://www.plantuml.com/plantuml/svg/' }),
    ).toThrow(/plantuml\.com/i);
  });
});

describe('plantumlMeta remark plugin (stash + skinparam injection)', () => {
  it('strips the `\'`-metadata, injects skinparam, and stashes the figure entry', () => {
    const node = {
      type: 'code',
      lang: 'plantuml',
      value: "' title: T\n' description: D\n' attribution: A\n' source: https://e.com\nrectangle X",
    };
    const tree = { type: 'root', children: [node] };
    const file: { data?: { dkPlantuml?: PlantumlFigure[] } } = {};
    plantumlMeta()(tree as never, file as never);

    // node.value: metadata stripped, skinparam preamble prepended, body kept.
    expect(node.value.startsWith(SKINPARAM_PREAMBLE)).toBe(true);
    expect(node.value).toContain('rectangle X');
    expect(node.value).not.toContain("' title:");

    // stash: caption fields + accessible name/desc, in an array (document order).
    expect(file.data?.dkPlantuml).toEqual([
      { description: 'D', attribution: 'A', source: 'https://e.com', name: 'T', desc: 'D' },
    ]);
  });

  it('the accessible name falls back to the description when title is absent', () => {
    const node = { type: 'code', lang: 'plantuml', value: "' description: Only desc\nrectangle X" };
    const file: { data?: { dkPlantuml?: PlantumlFigure[] } } = {};
    plantumlMeta()({ type: 'root', children: [node] } as never, file as never);
    expect(file.data?.dkPlantuml?.[0]).toMatchObject({ name: 'Only desc', desc: 'Only desc' });
  });

  it('leaves non-plantuml code nodes untouched (no stash)', () => {
    const node = { type: 'code', lang: 'mermaid', value: 'flowchart LR\nA-->B' };
    const file: { data?: { dkPlantuml?: PlantumlFigure[] } } = {};
    plantumlMeta()({ type: 'root', children: [node] } as never, file as never);
    expect(node.value).toBe('flowchart LR\nA-->B');
    expect(file.data?.dkPlantuml).toBeUndefined();
  });
});

describe('diagramFigure — PlantUML raw-node branch (shared figure + var rewrite)', () => {
  /** Simulate the raw node astro-plantuml emits (sentinel hexes, both PIs). */
  const rawPlantuml =
    '<?plantuml 1.2026.2?><figure class="plantuml-diagram">\n' +
    '  <svg class="plantuml-svg" viewBox="0 0 10 10">' +
    '<rect fill="#E1F0C1" style="stroke:#C14F8A"/>' +
    '<text fill="#1A2B3C">X</text>' +
    '<?plantuml-src ZZZ?></svg>\n</figure>';

  function runPasses(stash: PlantumlFigure) {
    const raw = { type: 'raw', value: rawPlantuml };
    const tree = { type: 'root', children: [raw] };
    const file = { data: { dkPlantuml: [stash] } };
    // The build rehype order: sentinel→var rewrite BEFORE the figure wrap.
    sentinelThemeRewrite()(tree as never);
    diagramFigure()(tree as never, file as never);
    return raw.value;
  }

  it('themes the SVG, injects <title>/<desc>, strips PIs, and wraps in the shared figure', () => {
    const out = runPasses({
      description: 'A flow',
      attribution: 'Me',
      source: 'https://e.com',
      name: 'My diagram',
      desc: 'A flow',
    });

    // Shared figure shape (role=group + aria-labelledby → namespaced caption id).
    expect(out).toContain(
      '<figure class="dk-diagram" role="group" aria-labelledby="dk-diagram-caption-plantuml-0">',
    );
    // The plantuml-diagram wrapper is gone; the <svg> is the direct inner node.
    expect(out).not.toContain('plantuml-diagram');
    // Accessible name/description injected into the SVG.
    expect(out).toContain('<title>My diagram</title>');
    expect(out).toContain('<desc>A flow</desc>');
    // Sentinels rewritten to var(--dk-diagram-*), no raw sentinel hex left.
    expect(out).toContain('var(--dk-diagram-node-fill)');
    expect(out).toContain('var(--dk-diagram-node-border)');
    expect(out).toContain('var(--dk-diagram-node-text)');
    expect(out).not.toMatch(/#E1F0C1|#C14F8A|#1A2B3C/i);
    // PIs stripped.
    expect(out).not.toContain('plantuml-src');
    expect(out).not.toContain('<?plantuml');
    // Caption after the svg, in document order.
    const svgClose = out.lastIndexOf('</svg>');
    const captionIdx = out.indexOf('<figcaption');
    expect(svgClose).toBeGreaterThan(-1);
    expect(captionIdx).toBeGreaterThan(svgClose);
    expect(out).toContain(
      '<figcaption class="dk-diagram__caption" id="dk-diagram-caption-plantuml-0">',
    );
    expect(out).toContain('<span class="dk-diagram__desc">A flow</span>');
    expect(out).toContain('<span class="dk-diagram__attr"><a href="https://e.com">Me</a></span>');
  });

  it('omits the figcaption (and aria-labelledby) for a metadata-free diagram', () => {
    const out = runPasses({ name: 'Just a name', desc: undefined });
    expect(out).toContain('<figure class="dk-diagram" role="group">');
    expect(out).not.toContain('aria-labelledby');
    expect(out).not.toContain('<figcaption');
    expect(out).toContain('<title>Just a name</title>');
  });

  it('a non-allowlisted source scheme falls back to plain-text attribution (DIAG-SEC-01)', () => {
    const out = runPasses({
      description: 'D',
      attribution: 'Credit',
      // Intentional: asserts the deny-by-default scheme allowlist (DIAG-SEC-01).
      source: 'javascript:alert(1)',
      name: 'N',
    });
    expect(out).toContain('<span class="dk-diagram__attr">Credit</span>');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('<a ');
  });
});

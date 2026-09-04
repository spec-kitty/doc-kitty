#!/usr/bin/env node
/**
 * assert-build-artifacts.mjs — post-build gate for the example docsite.
 *
 * Usage:
 *   node src/scripts/assert-build-artifacts.mjs <distDir>
 *   pnpm assert:artifacts example/dist
 *
 * Asserts that a clean `astro build` produced every artifact the corpus
 * promises, and exits NON-ZERO with a precise message on the FIRST failure.
 * This is the "what is gated equals what is published" check (FR-010/FR-011):
 * it runs as a step in the WP04 build-example JOB, after the shared composite
 * build action (it is deliberately NOT part of the composite, so the WP05
 * deploy can reuse the pure build without inheriting this PR-gate assertion).
 *
 * Assertions target the example output shape/count (design "Test taxonomy").
 *
 * Zero runtime dependencies: WP01 vendors no XML parser, so XML
 * well-formedness is checked at the string level by a small, honest,
 * stack-based scanner (below) — not by a filename grep, and not by adding a
 * parser dependency.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
// WP05 out-of-map edit (recorded): the chrome + pagefind assertions live in their
// own WP05-owned module to keep lane ownership clean; the main gate awaits them so
// `pnpm assert:artifacts` runs the full set. See kitty-specs/.../WP05-*.md.
import { assertChromeArtifacts } from './assert-chrome-artifacts.mjs';

// ---------------------------------------------------------------------------
// Pinned expectations for today's example content (T015).
//
// The agent index at /api/index.json lists every *published, agent-discoverable*
// page. Its top-level shape is { title, version, generatedFrom, count, pages[] }
// and its `count` must equal both `pages.length` and the number below.
//
// EXPECTED_INDEX_ENTRY_COUNT is pinned, not hand-waved. Cross-check (authoring
// time), so a wrong build cannot silently lock in a wrong baseline. Derivation
// from the published-`.md` count minus drafts (`isPublished()` excludes drafts
// from the agent index):
//   - PRE-WP03 baseline: example/docs held 14 Markdown files with TWO drafts —
//     example/docs/adr/template.md AND the persona (draft, at its old
//     personas/ location) — i.e. 14 − 2 = 12 published, discoverable pages.
//   - WP03 (ADR-0020) INTERIM delta: the persona is promoted draft → active
//     (+1 published) and relocates to context/audience/; an Audiences hub
//     README is added (+1 published); one retained draft demonstrator persona is
//     added (0 published — still draft). So 12 + 1 + 1 + 0 = 14.
//   - audience-related mission FINAL delta: the three-block demonstrator
//     (architecture/blocks-demonstrator.md, published, +1) and its stale related
//     target (architecture/superseded-note.md, published, +1) are added — both
//     published, so +2. So 14 + 2 = 16 (the prior-mission published set).
//   - slide-decks WP01 delta: a DRAFT smoke deck
//     (presentations/draft-preview.md, doc_status: draft) is added — 0 published,
//     +0 to both counts (BA-7: it must not move the pins).
//   - slide-decks WP04 delta (THIS recompute, atomic — BA-1): the published
//     showcase deck (presentations/showcase-deck.md, kind:Presentation,
//     doc_status:active, +1 — it stays fully enumerated by Starlight and the
//     generators; the deck route only shadows the URL, "shadow, not exclude")
//     AND the presentations overview Hub (presentations/README.md, kind:Hub,
//     doc_status:active, +1). Both published, so +2. So 16 + 2 = 18.
//   - slide-decks POST-WP04 tree: 21 Markdown files with THREE drafts (adr/template,
//     the retained draft persona context/audience/draft-persona.md, and the WP01
//     draft deck presentations/draft-preview.md) → 21 − 3 = 18 published.
//   - diagrams WP04 delta (THIS recompute): the published diagram demonstrator
//     (architecture/diagram-demonstrator.md, doc_status:active, +1) is added — the
//     SOLE new published route of the M5 diagrams mission. The parallel deck WP05
//     edits an ALREADY-published deck route (adds a diagram to it, adds no URL), so
//     it moves no count. So 18 + 1 = 19.
//   - POST-diagrams-WP04 tree: 22 Markdown files with THREE drafts (unchanged
//     draft set) → 22 − 3 = 19 published, cross-checking the +1 delta above.
// The diagram demonstrator is the ONE count-moving published page of the diagrams
// mission (WP04 owns this +1; WP05 changes no count — BA/F5-sizing single-pin guard).
//
// Sitemap parity (INV-1): the @astrojs/sitemap `filter` DROPS every draft page's
// URL, so the sitemap's page-URL count equals this same published set — 19 — and
// every draft page (adr/template + the draft persona + the draft deck) is absent
// from it. The published showcase deck IS present in the sitemap (it is a normal
// enumerated collection entry; the out-of-frame route only changes what HTML the
// URL renders, not whether the URL is generated).
//
// Bump this ONLY as a deliberate, reviewable act when example content changes.
// WP09 (M4 glossary on-switch) adds SIX published pages — the three glossary-demo
// pages and the three codegen'd glossary pages (the hub + one per context) — taking
// the published set from 19 to 25.
//   - reveal-deck-remediation adds one published diagram-free deck
//     (presentations/roadmap-deck.md, doc_status:active, +1) → 25 → 26. Its sibling
//     showcase-deck edits only add diagrams INSIDE an already-published deck, so they
//     move no count; roadmap-deck.md is the sole count-moving page of this mission.
//   - markua-syntax-support WP10 adds TWO published guides (guides/markua-showcase.md
//     and guides/markua-malformed.md, both doc_status:active, +2) — the verification
//     corpus for the Markua seam → 26 → 28. They are the only count-moving pages of
//     this mission (the on-switch flips a preset; every other WP was dormant).
const EXPECTED_INDEX_ENTRY_COUNT = 28;

// Sitemap page-URL count == the published set (drafts excluded by the filter).
// WP09 adds the same six glossary pages (3 demo + 3 generated), 19 → 25.
// reveal-deck-remediation adds presentations/roadmap-deck.md (published, +1), 25 → 26.
// markua-syntax-support WP10 adds the two published markua guides (+2), 26 → 28.
const EXPECTED_SITEMAP_URL_COUNT = 28;

// The single draft page (example/docs/adr/template.md, doc_status: draft). Its
// route MUST NOT appear in the sitemap once the draft filter is in place.
const DRAFT_ROUTE_MARKER = 'adr/template';

// Required top-level keys of the agent index and their JS types.
const EXPECTED_INDEX_SHAPE = {
  title: 'string',
  version: 'string',
  generatedFrom: 'string',
  count: 'number',
  pages: 'array',
};

// Required STRING keys on each entry in `pages[]`. `doc_status` and `kind` land
// with the finalized metadata contract (ADR-0009 / C-010). The enriched agent
// surface (WP05/WP06) also adds `audience` and `related`, but those are ARRAYS of
// objects — they are DELIBERATELY not listed here: this loop hard-asserts every
// listed key is a `string` (below), so an array key would red a correct build.
// They get a bespoke shape assertion outside that loop instead (agent-surface
// contract).
const EXPECTED_PAGE_KEYS = ['slug', 'route', 'section', 'title', 'doc_status', 'kind'];

// The concrete agent-API `version`. WP05/T028 bumped the owned default from '1' to
// '2' because `related` changed shape (raw slugs → resolved objects) and records
// gained `audience` — a published-contract change consumers branch on (DIRECTIVE_018).
// Pinned to the CONCRETE value, not just its type, so a silent re-bump/regress reds.
const EXPECTED_AGENT_API_VERSION = '2';

// `/api/bibliography.json` is a catalog projection emitted OUTSIDE page gating
// (ADR-0018 / FR-015): { version, count, records[] } with each record carrying at
// least id/title/url (catalog-and-citation contract).
const BIBLIOGRAPHY_ENDPOINT_RELPATH = path.join('api', 'bibliography.json');
const EXPECTED_BIBLIOGRAPHY_RECORD_KEYS = ['id', 'title', 'url'];

// README-as-index proof: a section's README.md served at its directory route.
// The ADR section's README H1 is "Decision Records"; it must appear in the HTML
// rendered at /adr/ (dist/adr/index.html).
const SECTION_INDEX_RELPATH = path.join('adr', 'index.html');
const SECTION_INDEX_MARKER = 'Decision Records';
const SECTION_INDEX_SOURCE = 'example/docs/adr/README.md';
// #44 / FR-013 / SC-003b: the example ADR README dropped its hand table, so the
// `kind: Hub` layout must AUTO-LIST the ADRs on build. The example's ADR-0001
// renders at /adr/0001-use-astro-starlight/. That link is NOT in the source
// Markdown (the prose links /adr/template/, not 0001), so a built link to it can
// ONLY come from the Hub auto-list — non-fakeable by grepping source Markdown.
const SECTION_INDEX_HUB_LINK = 'adr/0001-use-astro-starlight/';

// A known content page (non-index) that must render to HTML.
const KNOWN_PAGE_RELPATH = path.join('guides', 'getting-started', 'index.html');

// --- slide-decks WP04: the published showcase deck ------------------------------
// The published deck's canonical collection slug. `deckSlug(entry)` (WP01's
// src/lib/deck/deck-slug.ts) is `slugFromEntryId(entry.id)`, and the agent index
// emits that SAME `slug` for each page, so the shipped `slug` field IS deckSlug's
// output — the shared oracle, read from the artifact rather than recomputed.
//
// [Recorded deviation — BA-3 oracle import] The contract asks BA-3 to `import`
// deckSlug directly. This gate runs as `node src/scripts/assert-build-artifacts.mjs`
// with NO TypeScript loader, and deck-slug.ts imports `../metadata.js` (a `.js`
// specifier that resolves only to the `.ts` source under a bundler) — so a runtime
// `import` of the helper throws ERR_MODULE_NOT_FOUND and would red every build.
// The faithful substitute keeps ONE oracle: the deck's route/url parity is checked
// against the agent index's own `slug` (== deckSlug's output) plus the canonical
// `/${slug}/` reconstruction, which catches the prefix-doubling trap deckSlug
// guards (a doubled route would be `/presentations/presentations/showcase-deck/`).
const DECK_SLUG = 'presentations/showcase-deck';
const DECK_ROUTE = `/${DECK_SLUG}/`; // canonical reconstruction — must equal the emitted route
// The WP01 draft smoke deck: absent from every generator AND Pagefind (BA-7).
const DRAFT_DECK_SLUG = 'presentations/draft-preview';
// The published overview Hub route (BA-1 second count-moving page; BA-10 present).
const OVERVIEW_ROUTE = '/presentations/';

// --- diagrams WP04: the published diagram demonstrator (BD-1/BD-2/BD-4) ----------
// The demonstrator renders TWO diagrams spanning two guaranteed types, so the a11y
// lane confirms Mermaid emits a labelled figure for more than one type. Its built
// HTML is the browser-free proof surface: the raw `<pre class="mermaid">` source
// (with injected accTitle/accDescr) + the `<figcaption>` caption must be present in
// document order, and there must be NO rendered `<svg>` inside `figure.dk-diagram`
// (an SVG in the STATIC file would prove a build-time render ran — i.e. NOT
// browser-free; client-side rendering is the M5 premise, ADR-0023 / NFR-004).
const DEMO_RELPATH = path.join('architecture', 'diagram-demonstrator', 'index.html');

// --- diagram-component-css WP01: the third diagram page (#59/T006) --------------
// `architecture/overview.md` carries its own ```mermaid fence and, pre-WP01, was
// in NO test lane — the double-`<pre>` defect (#59) could regress there silently.
const ARCH_OVERVIEW_RELPATH = path.join('architecture', 'overview', 'index.html');

// The two demonstrator diagrams, in DOCUMENT ORDER, each keyed by the tokens the
// no-JS degradation guarantee (FR-008/NFR-003) must preserve in the static HTML:
//   - `keyword` — the diagram-TYPE declaration (proves the raw source survives),
//   - `label`   — a concrete node/actor label from the page (real content, not just
//                 a `<pre>` shell),
//   - `caption` — the exact `<figcaption>` description span (the caption survives),
//   - `accName` — the injected `accTitle` value (BD-1 accessible name in source).
// Diagram 1 is the all-fields FLOWCHART (title present → accName ≠ description).
// Diagram 2 is the description-only SEQUENCE (title ABSENT → accName == description,
// the accTitle→description name fallback, proven on a non-flowchart type).
const DEMO_DIAGRAMS = [
  {
    what: 'all-fields flowchart',
    keyword: 'flowchart',
    label: 'Docs tree',
    caption: 'The docs tree is loaded once, fanned out to the site and the feeds, then Starlight emits the static HTML.',
    accName: 'Build-and-publish pipeline', // from `%% title` (distinct from description)
    nameIsFallback: false,
  },
  {
    what: 'description-only sequence',
    keyword: 'sequenceDiagram',
    label: 'Reader',
    caption: 'A reader requests a page and the static host returns pre-rendered HTML, with no server in the loop.',
    accName: 'A reader requests a page and the static host returns pre-rendered HTML, with no server in the loop.',
    nameIsFallback: true, // no `%% title` → accTitle falls back to the description
  },
];

// --- BD-4: pinned diagram deps + no CDN -----------------------------------------
// The toolkit manifest that DECLARES the diagram deps (exact pins, no `^`/`~`), and
// the pnpm lockfile that RESOLVES them. Resolved relative to THIS script so the gate
// does not depend on the caller's cwd.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const TOOLKIT_MANIFEST = path.join(REPO_ROOT, 'src', 'package.json');
const PNPM_LOCKFILE = path.join(REPO_ROOT, 'pnpm-lock.yaml');
const PINNED_DIAGRAM_DEPS = { mermaid: '11.17.1' };
// A CDN import of mermaid in a shipped asset would defeat the self-contained,
// no-external-runtime-request guarantee (NFR-004). Mermaid must be BUNDLED — an
// `_astro/mermaid*.js` chunk — and no shipped JS may pull it from a CDN host.
const CDN_MERMAID_RE = /https?:\/\/[a-z0-9.-]*(?:jsdelivr|unpkg|cdnjs|skypack|esm\.sh|jspm|googleapis)[^"'` )]*mermaid[^"'` )]*/i;

// ---------------------------------------------------------------------------

/** Emit a precise failure and exit non-zero (first failure wins). */
function fail(message) {
  process.stderr.write(`assert:artifacts: FAIL — ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`assert:artifacts: ok — ${message}\n`);
}

async function readTextOrFail(absPath, label) {
  try {
    return await readFile(absPath, 'utf8');
  } catch (err) {
    fail(`${label}: could not read ${absPath} (${err.code ?? err.message})`);
  }
}

async function assertNonEmptyFile(absPath, label) {
  let info;
  try {
    info = await stat(absPath);
  } catch {
    fail(`${label}: missing (${absPath})`);
  }
  if (!info.isFile()) fail(`${label}: not a file (${absPath})`);
  if (info.size === 0) fail(`${label}: present but empty (${absPath})`);
  return info;
}

/**
 * String-level XML well-formedness check — no parser dependency.
 *
 * A stack-based scanner that honours the XML declaration, comments, CDATA and
 * processing instructions, respects quoted attribute values (so a `>` inside a
 * value does not end a tag), and verifies that every element is closed in the
 * right order. It is not a validating parser, but it genuinely proves the
 * document is balanced and nested — far more than a filename check.
 * Throws Error(reason) on the first structural problem.
 */
function assertWellFormedXml(text) {
  const src = text;
  const len = src.length;
  const stack = [];
  let sawElement = false;
  let i = 0;

  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break; // trailing text only
    i = lt;

    // XML declaration / processing instruction: <? ... ?>
    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      if (end === -1) throw new Error('unterminated processing instruction / XML declaration');
      i = end + 2;
      continue;
    }

    // Comment: <!-- ... -->
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) throw new Error('unterminated comment');
      i = end + 3;
      continue;
    }

    // CDATA: <![CDATA[ ... ]]>
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) throw new Error('unterminated CDATA section');
      i = end + 3;
      continue;
    }

    // DOCTYPE or other declaration: <! ... >
    if (src.startsWith('<!', i)) {
      const end = src.indexOf('>', i + 2);
      if (end === -1) throw new Error('unterminated declaration');
      i = end + 1;
      continue;
    }

    // A real element start/end tag. Find its terminating '>' honouring quotes.
    let j = i + 1;
    let quote = null;
    while (j < len) {
      const ch = src[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j += 1;
    }
    if (j >= len) throw new Error('unterminated tag');

    const inner = src.slice(i + 1, j).trim();
    if (inner.length === 0) throw new Error('empty tag <>');

    if (inner.startsWith('/')) {
      // Closing tag </name>
      const name = inner.slice(1).trim().split(/[\s>]/)[0];
      if (!name) throw new Error('closing tag has no name');
      const open = stack.pop();
      if (open === undefined) throw new Error(`unexpected closing tag </${name}>`);
      if (open !== name) throw new Error(`mismatched tag: expected </${open}>, got </${name}>`);
    } else {
      // Opening or self-closing tag.
      const selfClosing = inner.endsWith('/');
      const body = selfClosing ? inner.slice(0, -1).trim() : inner;
      const name = body.split(/[\s/]/)[0];
      if (!name) throw new Error('opening tag has no name');
      sawElement = true;
      if (!selfClosing) stack.push(name);
    }

    i = j + 1;
  }

  if (!sawElement) throw new Error('no XML element found');
  if (stack.length > 0) throw new Error(`unclosed element(s): ${stack.reverse().join(', ')}`);
}

// --- Deck slide-structure scanners (BA-2 flatten proof) --------------------
// The emitted deck is flat HTML; these depth-aware scanners prove the transform's
// slides are TOP-LEVEL `.slides > section` (not nested inside one wrapper) without
// a DOM parser (NFR-006, zero deps).

/** The inner HTML of the `.slides` container (balanced `<div>` scan), or null. */
function extractSlidesInner(html) {
  const open = html.match(/<div\b[^>]*\bclass="[^"]*\bslides\b[^"]*"[^>]*>/);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tagRe = /<\/?div\b[^>]*>/g;
  tagRe.lastIndex = start;
  let depth = 1;
  let t;
  while ((t = tagRe.exec(html)) !== null) {
    depth += t[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, t.index);
  }
  return html.slice(start);
}

/** Count DIRECT-child `<section>`s of the given inner HTML (section-depth 0). */
function countDirectChildSections(inner) {
  const re = /<\/?section\b[^>]*>/g;
  let depth = 0;
  let count = 0;
  let m;
  while ((m = re.exec(inner)) !== null) {
    if (m[0].startsWith('</')) depth -= 1;
    else {
      if (depth === 0) count += 1;
      depth += 1;
    }
  }
  return count;
}

/** True iff some top-level `<section>` contains a nested `<section>` (a stack). */
function hasNestedSectionStack(inner) {
  const re = /<\/?section\b[^>]*>/g;
  let depth = 0;
  let nested = false;
  let m;
  while ((m = re.exec(inner)) !== null) {
    if (m[0].startsWith('</')) depth -= 1;
    else {
      if (depth >= 1) nested = true;
      depth += 1;
    }
  }
  return nested;
}

// --- Diagram figure scanner (BD-1/BD-2 / browser-free proof) ----------------
/** Every `<figure class="dk-diagram">…</figure>` block in the HTML, in document
 * order. Non-greedy to `</figure>`; the demonstrator figures hold no nested
 * `<figure>`, so a flat match is exact for this corpus. */
function extractDkDiagramFigures(html) {
  const re = /<figure\b[^>]*\bclass="[^"]*\bdk-diagram\b[^"]*"[^>]*>[\s\S]*?<\/figure>/g;
  return html.match(re) ?? [];
}

/**
 * Assert the diagram demonstrator's STATIC HTML carries, for BOTH diagrams:
 *   - BD-1: `<figure class="dk-diagram">` + `<pre class="mermaid">` with the
 *     injected `accTitle`/`accDescr` a11y statements IN THE SOURCE;
 *   - BD-2 (no-JS, real content): the diagram-TYPE keyword AND a concrete
 *     node/actor label AND the `<figcaption>` description — in document order
 *     (source inside the `<pre>`, caption after it) — so the meaning survives
 *     without the client render;
 *   - browser-free proof (NFR-004): NO rendered `<svg>` inside the figure — a
 *     static SVG would prove a build-time render ran.
 * Diagram 2 additionally proves the accTitle→description NAME FALLBACK on a
 * non-flowchart type (accTitle value == the description).
 */
async function assertDiagramDemonstrator(distDir) {
  const demoAbs = path.join(distDir, DEMO_RELPATH);
  await assertNonEmptyFile(demoAbs, `diagram demonstrator (${DEMO_RELPATH})`);
  const html = await readTextOrFail(demoAbs, `diagram demonstrator (${DEMO_RELPATH})`);

  const figures = extractDkDiagramFigures(html);
  if (figures.length !== DEMO_DIAGRAMS.length) {
    fail(
      `diagram demonstrator: found ${figures.length} <figure class="dk-diagram"> block(s), ` +
        `expected ${DEMO_DIAGRAMS.length} (an all-fields flowchart + a description-only sequence) — BD-1`,
    );
  }

  DEMO_DIAGRAMS.forEach((spec, i) => {
    const fig = figures[i];
    const tag = `diagram demonstrator: diagram ${i + 1} (${spec.what})`;

    // BD-1 — figure carries the mermaid <pre> with injected acc-statements.
    // Attribute-tolerant match (not an exact-string search): post-WP01, this is
    // now the ONLY `<pre>` in the figure (the #59 fix), so Starlight's generic
    // `rehypeRtlCodeSupport` pass (which SKIPS descending into an already-
    // matched `<pre>`'s children) correctly reaches it and adds `dir="ltr"` —
    // previously that attribute landed on the stray OUTER `<pre>` instead,
    // never on this inner one, which is why an exact-string match happened to
    // work before. The precise attribute set is not this gate's concern (T006
    // covers the double-wrap and CSS-delivery invariants); only tag identity is.
    const preOpenMatch = /<pre class="mermaid"[^>]*>/.exec(fig);
    const preOpen = preOpenMatch ? preOpenMatch.index : -1;
    const preClose = fig.indexOf('</pre>');
    if (preOpen === -1 || preClose === -1 || !(preOpen < preClose)) {
      fail(`${tag}: no <pre class="mermaid"> source block inside the figure — BD-1`);
    }
    const source = fig.slice(preOpen, preClose); // the raw diagram source only
    if (!source.includes('accTitle:')) {
      fail(`${tag}: the mermaid source has no injected \`accTitle:\` statement (accessible name) — BD-1`);
    }
    if (!source.includes('accDescr:')) {
      fail(`${tag}: the mermaid source has no injected \`accDescr:\` statement (accessible description) — BD-1`);
    }
    if (!source.includes(`accTitle: ${spec.accName}`)) {
      fail(
        `${tag}: injected accTitle is not "accTitle: ${spec.accName}" — the accessible name derived from ` +
          `the ${spec.nameIsFallback ? 'description (title-absent FALLBACK)' : '%% title'} is wrong — BD-1`,
      );
    }
    // Name-fallback proof (title-absent diagram): the accessible name IS the
    // description, not a distinct title.
    if (spec.nameIsFallback && !source.includes(`accDescr: ${spec.accName}`)) {
      fail(
        `${tag}: with no \`%% title\`, accTitle must fall back to the description — accTitle and accDescr ` +
          `should both be the description text, proving the name fallback on a non-flowchart type — BD-1`,
      );
    }

    // BD-2 — real source content: the diagram-TYPE keyword AND a concrete label
    // are present INSIDE the <pre> (not just an empty shell).
    const kwIdx = source.indexOf(spec.keyword);
    const labelIdx = source.indexOf(spec.label);
    if (kwIdx === -1) {
      fail(`${tag}: the diagram-type keyword "${spec.keyword}" is absent from the static source — the raw source did not survive (BD-2 no-JS)`);
    }
    if (labelIdx === -1) {
      fail(`${tag}: the concrete label "${spec.label}" is absent from the static source — the built <pre> is an empty shell, not the real diagram (BD-2 no-JS)`);
    }
    if (!(kwIdx < labelIdx)) {
      fail(`${tag}: "${spec.keyword}" does not precede "${spec.label}" in the source — malformed diagram source (BD-2)`);
    }

    // BD-2 — the caption (figcaption description span) is present AND after the
    // source, in document order (source first, caption below it).
    const captionSpan = `<span class="dk-diagram__desc">${spec.caption}</span>`;
    const captionIdx = fig.indexOf(captionSpan);
    if (captionIdx === -1) {
      fail(`${tag}: the <figcaption> description span "${spec.caption}" is absent — the caption did not survive to the static HTML (BD-2/FR-008)`);
    }
    if (!(preClose < captionIdx)) {
      fail(`${tag}: the caption appears before the diagram source — source + caption are not in document order (BD-2)`);
    }

    // Browser-free proof (NFR-004): no rendered <svg> inside the static figure.
    if (/<svg[\s>]/i.test(fig)) {
      fail(
        `${tag}: the STATIC figure contains a rendered <svg> — a build-time render ran, so the build is NOT ` +
          `browser-free. M5 diagrams render CLIENT-SIDE only (ADR-0023 / NFR-004); the static file must carry ` +
          `the raw source, never an SVG`,
      );
    }
  });

  ok(
    `diagram demonstrator: ${figures.length} dk-diagram figure(s) — figure + <pre class="mermaid"> + injected ` +
      `accTitle/accDescr; keyword+label+caption in document order; NO static <svg> (browser-free) (BD-1/BD-2/NFR-004)`,
  );
}

/**
 * BD-4 — the diagram deps are pinned to the exact versions and mermaid is
 * bundled (no CDN). Proven three ways: the toolkit manifest declares exact pins,
 * the lockfile resolves those same versions, and no shipped `_astro/*.js` asset
 * pulls mermaid from a CDN host (a local `mermaid*.js` chunk is present instead).
 */
async function assertPinnedDepsNoCdn(distDir) {
  // (a) Manifest declares the EXACT pins (no `^`/`~` range).
  const manifestText = await readTextOrFail(TOOLKIT_MANIFEST, `toolkit manifest (${TOOLKIT_MANIFEST})`);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    fail(`pinned deps: toolkit manifest is not valid JSON (${err.message}) — BD-4`);
  }
  const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  for (const [name, version] of Object.entries(PINNED_DIAGRAM_DEPS)) {
    if (declared[name] !== version) {
      fail(
        `pinned deps: src/package.json declares "${name}": ${JSON.stringify(declared[name])}, expected the exact ` +
          `pin ${JSON.stringify(version)} (no range) — a floating diagram dep breaks the reproducible build (BD-4/NFR-004)`,
      );
    }
  }

  // (b) Lockfile RESOLVES those same versions (`name@version:` package key).
  const lockText = await readTextOrFail(PNPM_LOCKFILE, `pnpm lockfile (${PNPM_LOCKFILE})`);
  for (const [name, version] of Object.entries(PINNED_DIAGRAM_DEPS)) {
    if (!lockText.includes(`${name}@${version}:`)) {
      fail(
        `pinned deps: pnpm-lock.yaml has no resolved \`${name}@${version}:\` entry — the lockfile does not ` +
          `resolve the pinned version (BD-4)`,
      );
    }
  }

  // (c) No shipped JS asset pulls mermaid from a CDN; mermaid is bundled locally.
  const astroDir = path.join(distDir, '_astro');
  let astroEntries;
  try {
    astroEntries = await readdir(astroDir);
  } catch (err) {
    fail(`no-CDN: could not read ${path.join('_astro')} (${err.code ?? err.message}) — BD-4`);
  }
  const jsAssets = astroEntries.filter((f) => f.endsWith('.js'));
  const hasBundledMermaid = astroEntries.some((f) => /^mermaid.*\.js$/i.test(f));
  if (!hasBundledMermaid) {
    fail(
      `no-CDN: no bundled \`_astro/mermaid*.js\` chunk — mermaid must be BUNDLED (self-contained), not fetched ` +
        `from a CDN at runtime (BD-4/NFR-004)`,
    );
  }
  for (const n of jsAssets) {
    const js = await readFile(path.join(astroDir, n), 'utf8');
    const hit = js.match(CDN_MERMAID_RE);
    if (hit) {
      fail(`no-CDN: shipped asset _astro/${n} references a CDN mermaid URL (${hit[0]}) — mermaid must be bundled, no external runtime request (BD-4/NFR-004)`);
    }
  }
  ok(
    `pinned deps + no CDN: mermaid@${PINNED_DIAGRAM_DEPS.mermaid} pinned (manifest + lockfile), ` +
      `mermaid bundled locally, no CDN reference in ${jsAssets.length} shipped JS asset(s) (BD-4)`,
  );
}

// ---------------------------------------------------------------------------
// markua-syntax-support WP10 — Markua verification gates over the built dist.
// The named non-fakeable gates (plan IC-06): the T>→starlight-aside--tip
// ordering lock, the identity-anchored figure width:75% __ASTRO_IMAGE_
// round-trip, the no-new-client-JS footprint, per-variant discriminators, and
// the SC-005 coverage manifest that maps each of the 35 data-model rows to a
// specific dist-level assertion that fails RED if that row's behaviour
// regresses. The byte-identical three-form proof (rows 5–14) and the axe scan
// are Playwright's (tests/a11y/markua.spec.ts); the preset-off literal-text
// portability (SC-003) and the malformed build-exits-0 warning (NFR-002) are
// the build-result gate (src/scripts/assert-markua-builds.mjs) — they need a
// second/cold build, not a dist read.
const MARKUA_SHOWCASE_RELPATH = path.join('guides', 'markua-showcase', 'index.html');
const MARKUA_MALFORMED_RELPATH = path.join('guides', 'markua-malformed', 'index.html');

/** Count non-overlapping occurrences of a literal needle. */
function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** The FIRST `<figure class="dk-figure …">…</figure>` block whose figcaption text
 * equals `caption` — identity-anchored (never a whole-file substring scan). */
function figureByCaption(html, caption) {
  const figRe = /<figure\b[^>]*\bclass="[^"]*\bdk-figure\b[^"]*"[^>]*>[\s\S]*?<\/figure>/g;
  for (const block of html.match(figRe) ?? []) {
    if (block.includes(`<figcaption class="dk-figure__caption">${caption}</figcaption>`)) {
      return block;
    }
  }
  return null;
}

/** The `<img …>` tag inside a figure block, or null. */
function imgTagOf(figureBlock) {
  const m = figureBlock.match(/<img\b[^>]*>/);
  return m ? m[0] : null;
}

/** The FIRST `<figure class="dk-figure …">…</figure>` block whose <img> `src`
 * contains `srcSubstr` — identity-anchored by image source, boundary-safe (each
 * figure block is matched whole, so it never spans across two figures). */
function figureByImgSrc(html, srcSubstr) {
  const figRe = /<figure\b[^>]*\bclass="[^"]*\bdk-figure\b[^"]*"[^>]*>[\s\S]*?<\/figure>/g;
  for (const block of html.match(figRe) ?? []) {
    const img = imgTagOf(block);
    if (img && img.includes(srcSubstr)) return block;
  }
  return null;
}

async function assertMarkuaArtifacts(distDir) {
  const showcaseAbs = path.join(distDir, MARKUA_SHOWCASE_RELPATH);
  const malformedAbs = path.join(distDir, MARKUA_MALFORMED_RELPATH);
  await assertNonEmptyFile(showcaseAbs, `markua showcase (${MARKUA_SHOWCASE_RELPATH})`);
  await assertNonEmptyFile(malformedAbs, `markua malformed (${MARKUA_MALFORMED_RELPATH})`);
  const showcase = await readTextOrFail(showcaseAbs, `markua showcase (${MARKUA_SHOWCASE_RELPATH})`);
  const malformed = await readTextOrFail(malformedAbs, `markua malformed (${MARKUA_MALFORMED_RELPATH})`);

  // --- Named gate: ordering lock (T> → starlight-aside--tip). A `T>` renders a
  // NATIVE Starlight tip aside only because the markua remark plugins run BEFORE
  // Starlight's remarkAsides (integration prepends markua before starlight()).
  // A future array reorder makes this vanish — fails loudly (ADR-0030 Risk).
  if (!showcase.includes('starlight-aside--tip')) {
    fail(
      'markua ordering lock: no `starlight-aside--tip` in the showcase — a bare `T>` did NOT render as a ' +
        'native Starlight tip aside, so the markua plugins no longer run BEFORE remarkAsides (plugin reorder) — IC-06',
    );
  }

  // --- Named gate: identity-anchored figure __ASTRO_IMAGE_ round-trip. Locate
  // the palm-trees figure by its figcaption IDENTITY (NOT a substring scan for
  // "width:75%" anywhere), then on THAT figure's final optimised <img> assert
  // BOTH the width AND the alt survived — proving markuaFigure ran BEFORE
  // rehypeImages and both properties rode the __ASTRO_IMAGE_ marker (NFR-004).
  const palmFig = figureByCaption(showcase, 'Palm Trees');
  if (palmFig === null) {
    fail(
      'markua figure round-trip: no `<figure class="dk-figure">` with figcaption "Palm Trees" in the showcase — ' +
        'the local-image figure did not render (markuaFigure/markuaAttributes wiring) — rows 16/19',
    );
  }
  const palmImg = imgTagOf(palmFig);
  if (palmImg === null) {
    fail('markua figure round-trip: the "Palm Trees" figure has no <img> — the optimised image was lost — row 16');
  }
  if (!/style="[^"]*width:\s*75%/.test(palmImg)) {
    fail(
      `markua figure round-trip: the "Palm Trees" <img> has no \`width: 75%\` style — the {width:} did NOT survive ` +
        `the __ASTRO_IMAGE_ round-trip (markuaFigure must run BEFORE rehypeImages). img was: ${palmImg} — row 21/NFR-004`,
    );
  }
  if (!/alt="[^"]*palm-lined tropical beach/.test(palmImg)) {
    fail(
      `markua figure round-trip: the "Palm Trees" <img> lost its {alt:} value on the SAME optimised img — ` +
        `alt and width must survive together. img was: ${palmImg} — row 18/NFR-004`,
    );
  }
  if (!/src="[^"]*palm-trees[^"]*\.svg/.test(palmImg)) {
    fail(
      `markua figure round-trip: the "Palm Trees" <img> src is not the optimised local palm-trees asset — the ` +
        `local-optimise path did not run. img was: ${palmImg} — row 16`,
    );
  }

  // --- Named gate: no new client-side JavaScript (NFR-005). Asides, callouts,
  // figures and ids are build-time hast only — they ship ZERO client script.
  // Assert no emitted JS asset is a markua island and the showcase mounts none.
  const astroDir = path.join(distDir, '_astro');
  let astroFiles = [];
  try {
    astroFiles = await readdir(astroDir);
  } catch {
    astroFiles = [];
  }
  const markuaJs = astroFiles.filter((f) => f.endsWith('.js') && /markua|callout|dk-figure/i.test(f));
  if (markuaJs.length > 0) {
    fail(
      `markua footprint: emitted client JS chunk(s) ${JSON.stringify(markuaJs)} — the Markua seam must ship NO ` +
        `client script (asides/callouts/figures/ids are build-time hast only) — NFR-005`,
    );
  }
  if (/<script\b[^>]*\bsrc="[^"]*(markua|callout)[^"]*"/i.test(showcase)) {
    fail('markua footprint: the showcase mounts a markua/callout client <script> — the seam ships no client JS — NFR-005');
  }

  // --- Named gate: per-variant discriminators. Each of the SIX theme variants is
  // present as `<aside class="dk-callout dk-callout--{variant}">`, and each of the
  // FOUR native mapped asides is present — so a single broken variant goes RED,
  // not manifest-vacuously green.
  for (const variant of ['discussion', 'question', 'exercise', 'generic', 'center']) {
    const n = countOccurrences(showcase, `dk-callout dk-callout--${variant}"`);
    if (n !== 3) {
      fail(
        `markua variant discriminator: expected exactly 3 \`dk-callout--${variant}\` theme callouts (the three-form ` +
          `equivalence trio), found ${n} — a broken input form or variant routing — rows 5–14`,
      );
    }
  }
  if (countOccurrences(showcase, 'dk-callout dk-callout--aside"') < 3) {
    fail('markua variant discriminator: fewer than 3 `dk-callout--aside` — the aside three-form trio is incomplete — rows 5–14');
  }
  for (const variant of ['tip', 'caution', 'danger', 'note']) {
    const n = countOccurrences(showcase, `starlight-aside--${variant}`);
    if (n !== 3) {
      fail(
        `markua variant discriminator: expected exactly 3 native \`starlight-aside--${variant}\` asides (the three ` +
          `input forms of the mapped class), found ${n} — a broken fold or ordering regression — rows 5–14`,
      );
    }
  }

  // --- Named gate: markua-icon-render (FR-009 positive). The mapped icon
  // {icon: fa-lightbulb} resolves (→ "rocket") and emits the dk-callout__icon
  // child on the theme tip callout, carrying the resolved-name discriminator…
  if (!/<aside class="dk-callout dk-callout--tip" id="icon-tip">[\s\S]*?dk-callout__icon"[^>]*data-icon="rocket"/.test(showcase)) {
    fail(
      'markua icon render: the `{icon: fa-lightbulb}` tip (#icon-tip) has no `dk-callout__icon` child with ' +
        'data-icon="rocket" — the mapped icon did not resolve/render — row 32/FR-009',
    );
  }
  // …AND rendering the ACTUAL glyph: the resolved Starlight icon inlined as an
  // <svg class="dk-callout__icon-glyph"> inside that span (FR-009 requires the
  // mapped icon to RENDER, not merely be named by data-icon).
  if (!/data-icon="rocket"><svg[^>]*class="dk-callout__icon-glyph"[^>]*>\s*<path/.test(showcase)) {
    fail(
      'markua icon render: the #icon-tip icon span carries data-icon="rocket" but no inline ' +
        '`<svg class="dk-callout__icon-glyph">…<path>` glyph — the mapped icon must render a VISIBLE glyph, ' +
        'not just reserve the box — row 32/FR-009',
    );
  }

  // --- SC-005 coverage manifest: each data-model.md row → the SPECIFIC dist-level
  // assertion that FAILS RED if that row's behaviour regresses (not "a test
  // exists"). Rows 5–14 (byte-identical three-form) and the axe scan are the
  // Playwright spec's; row 33's build warning + row 35's preset-off portability
  // are the build-result gate's — cross-referenced here so the denominator is the
  // full 35-row matrix.
  const showcaseHas = (needle) => showcase.includes(needle);
  const COVERAGE_MANIFEST = [
    { row: 1, what: 'aside A> single-line', ok: () => /dk-callout--aside">[\s\S]*?This is a short aside\./.test(showcase) },
    { row: 2, what: 'aside A> multi + internal heading (title extracted)', ok: () => showcaseHas('dk-callout__title') && showcaseHas('Notes for the curious') },
    { row: 3, what: 'nested {aside} inside {aside}', ok: () => {
      const i = showcase.indexOf('id="a-wrapped-nested-aside"');
      const seg = i === -1 ? '' : showcase.slice(i, i + 1400);
      return countOccurrences(seg, 'dk-callout--aside"') >= 2; // parent + nested
    } },
    { row: 4, what: 'aside wrapping a fenced code block (code intact)', ok: () => showcaseHas('literal code, not a blockquote') },
    { row: '5-14', what: '10 callout classes × 3 forms (byte-identical)', ok: () =>
      ['tip', 'caution', 'danger', 'note'].every((v) => countOccurrences(showcase, `starlight-aside--${v}`) === 3) &&
      ['discussion', 'question', 'exercise', 'generic', 'center'].every((v) => countOccurrences(showcase, `dk-callout dk-callout--${v}"`) === 3),
      note: 'authoritative byte-identical proof is Playwright markua-three-form-equivalence' },
    { row: 15, what: 'mapped class + {#id} routes to theme hast, id survives', ok: () => showcaseHas('<aside class="dk-callout dk-callout--tip" id="pinned-tip">') },
    { row: 16, what: 'figure local optimised', ok: () => palmFig !== null && /src="[^"]*palm-trees[^"]*\.svg/.test(palmImg ?? '') },
    { row: 17, what: 'figure web-URL passthrough', ok: () => /<img\b[^>]*src="https:\/\/example\.com\/mac\.jpg"/.test(showcase) },
    { row: '18-25', what: 'figure attrs (alt/caption/title/width/height/align/class/#id)', ok: () => {
      // Local palm figure carries alt(18)/title(20)/width(21)/align→center(23)/class(24)/#id(25).
      const local = /alt="[^"]*palm-lined tropical beach/.test(palmImg ?? '') &&
        /title="[^"]*On the shore/.test(palmImg ?? '') &&
        /style="[^"]*width:\s*75%/.test(palmImg ?? '') &&
        (palmFig ?? '').includes('dk-figure--center') &&
        (palmFig ?? '').includes('featured') &&
        (palmFig ?? '').includes('id="palm-fig"');
      // Web mac figure (anchored by its src) carries caption-override(19)/
      // height(22)/align→left, and passes the web URL through unoptimised.
      const macFig = figureByImgSrc(showcase, 'https://example.com/mac.jpg');
      const macImg = macFig ? imgTagOf(macFig) : null;
      const web = macImg !== null &&
        /style="[^"]*height:\s*240/.test(macImg) &&
        (macFig ?? '').includes('dk-figure--left') &&
        (macFig ?? '').includes('The original Macintosh');
      return local && web;
    } },
    { row: 26, what: '{fullbleed:} silently ignored', ok: () => {
      const fig = figureByCaption(showcase, 'Lighthouse');
      return fig !== null && !/fullbleed/i.test(fig);
    } },
    { row: 27, what: 'crosslink id {#intro} + [text](#intro) resolves', ok: () => /<h2\b[^>]*id="intro"/.test(showcase) && showcaseHas('<a href="#intro">introduction</a>') },
    { row: 28, what: 'crosslink id collision — explicit wins (single #overview)', ok: () => countOccurrences(showcase, 'id="overview"') === 1 && showcaseHas('<a href="#overview">overview</a>') },
    { row: 29, what: 'auto heading id kept (no markua)', ok: () => /id="plain-heading-automatic-anchor"/.test(showcase) },
    { row: 30, what: 'span id [text]{#id} + link resolves', ok: () => showcaseHas('<span id="beach-span">the beach</span>') && showcaseHas('<a href="#beach-span">beach span</a>') },
    { row: 31, what: 'span id word{#id} trailing + link resolves', ok: () => showcaseHas('<span id="shoreline-span">shoreline</span>') && showcaseHas('<a href="#shoreline-span">shoreline span</a>') },
    { row: 32, what: 'mapped icon renders GLYPH (fa-lightbulb → rocket <svg>)', ok: () => /dk-callout--tip" id="icon-tip">[\s\S]*?data-icon="rocket"><svg[^>]*class="dk-callout__icon-glyph"[^>]*>\s*<path/.test(showcase) },
    { row: 33, what: 'unmapped icon dropped + build warning + exit 0', ok: () => malformed.includes('<aside class="dk-callout dk-callout--tip">') && !/(dk-callout--tip"[\s\S]{0,120}?dk-callout__icon)/.test(malformed),
      note: 'the `fa-obscure-name` build WARNING + exit-0 are asserted by assert-markua-builds.mjs (cold build)' },
    { row: 34, what: 'attr {#id} above {aside} wrapper lands on container', ok: () => showcaseHas('id="anchored-aside"') },
    { row: 35, what: 'malformed unbalanced wrapper stays literal; preset-off portability', ok: () => malformed.includes('{aside}'),
      note: 'the load-bearing literal-text SC-003 gate is preset-off in assert-markua-builds.mjs' },
  ];

  const failedRows = [];
  for (const entry of COVERAGE_MANIFEST) {
    let passed = false;
    try {
      passed = entry.ok() === true;
    } catch (err) {
      passed = false;
    }
    if (!passed) failedRows.push(`row ${entry.row} (${entry.what})`);
  }
  if (failedRows.length > 0) {
    fail(
      `markua SC-005 coverage manifest: ${failedRows.length} row(s) regressed — their fixture occurrence or the ` +
        `named failing-on-regression assertion is gone:\n  - ${failedRows.join('\n  - ')}`,
    );
  }

  ok(
    `markua: ordering lock (T>→starlight-aside--tip), identity-anchored figure width:75%+alt __ASTRO_IMAGE_ ` +
      `round-trip, no client JS, 6 theme + 4 native variant discriminators, icon-render, and all ` +
      `${COVERAGE_MANIFEST.length} SC-005 coverage-matrix groups pass (rows 5–14 byte-identical proof in Playwright)`,
  );
}

// ---------------------------------------------------------------------------
// diagram-component-css WP01 — T006 build-artifact gates (#59/#60/#68).
//
// Both gates close the mutation-dead zone D5 identified: today's 7 diagram
// gates all match INSIDE `<figure>` and none check for a wrapping `<pre>` or
// for CSS delivery, so #59 and #68 shipped with nothing red. Each function
// below is self-contained (does its own file reads) so it is independently
// provable RED on the pre-fix build (T001-T004 not yet landed) and GREEN
// after — not merely riding along inside another assertion's success.
// ---------------------------------------------------------------------------

// The historic double-wrap defect (#59): a still-`code`-typed mermaid mdast
// node's `hName` projection ran through mdast-util-to-hast's `code` handler,
// which unconditionally wraps its own output in an EXTRA outer `<pre>` —
// producing `<pre><figure class="dk-diagram">…</figure></pre>`. This is the
// exact pattern quickstart.md's manual verification grep checks
// (`<pre[^>]*>\s*<figure[^>]*dk-diagram`); asserted here as a build gate so a
// regression fails CI, not just a human's spot-check.
const PRE_WRAPS_DK_DIAGRAM_RE = /<pre\b[^>]*>\s*<figure\b[^>]*\bdk-diagram\b/;

/** Fail if `html` contains a `<pre>` directly wrapping a `<figure class="dk-diagram">`
 * (the #59 double-wrap defect). `label` names the page in the failure message. */
function assertNoPreWrapsDkDiagram(html, label) {
  const hit = PRE_WRAPS_DK_DIAGRAM_RE.exec(html);
  if (hit) {
    fail(
      `${label}: found "${hit[0]}…" — a <pre> directly wraps <figure class="dk-diagram"> (the #59 double-wrap ` +
        `defect: a still-\`code\`-typed mermaid node's hName projection ran through mdast-util-to-hast's \`code\` ` +
        `handler, which adds its OWN outer <pre>) — FR-001/C-001`,
    );
  }
}

/**
 * T006 (#59, red-first): across ALL 3 diagram pages (deck, architecture/overview,
 * architecture/diagram-demonstrator) assert no `<pre>` directly wraps a
 * `<figure class="dk-diagram">` — the double-wrap defect the fence-transform
 * retype (T001) fixes at its origin. `architecture/overview` was, pre-WP01, in
 * NO test lane at all.
 */
async function assertNoStrayPreWrapsDiagramFigures(distDir) {
  const pages = [
    { relpath: path.join(DECK_SLUG, 'index.html'), label: `deck (${DECK_SLUG})` },
    { relpath: ARCH_OVERVIEW_RELPATH, label: `architecture overview (${ARCH_OVERVIEW_RELPATH})` },
    { relpath: DEMO_RELPATH, label: `diagram demonstrator (${DEMO_RELPATH})` },
  ];
  for (const { relpath, label } of pages) {
    const abs = path.join(distDir, relpath);
    await assertNonEmptyFile(abs, label);
    const html = await readTextOrFail(abs, label);
    assertNoPreWrapsDkDiagram(html, label);
  }
  ok(
    'diagram markup: no <pre> wraps <figure class="dk-diagram"> on the deck, architecture/overview, or ' +
      'the diagram demonstrator (#59/FR-001)',
  );
}

/** Every `<link rel="stylesheet" href="…">` href on a page, attribute-order-agnostic. */
function linkedStylesheetHrefs(html) {
  const hrefs = [];
  const re = /<link\b[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (!/\brel="stylesheet"/.test(tag)) continue;
    const hrefMatch = /\bhref="([^"]+)"/.exec(tag);
    if (hrefMatch) hrefs.push(hrefMatch[1]);
  }
  return hrefs;
}

/**
 * T006 (#60/#68, red-first): a branded docs page that renders a callout/diagram
 * must LINK a stylesheet that actually CONTAINS the corresponding component
 * rules — "bundled ≠ applied" is the false-green trap (a sheet merely existing
 * under `_astro/` proves nothing if the page never links it — #68; a page
 * linking SOME sheet proves nothing if that sheet lacks the rule — #60, the
 * stylesheet was never written). Checked on two identity-anchored pages: the
 * markua showcase (renders `.dk-callout`) and the diagram demonstrator
 * (renders `.dk-diagram__caption`).
 */
async function assertComponentCssDelivered(distDir) {
  const astroDir = path.join(distDir, '_astro');
  let cssFiles;
  try {
    cssFiles = (await readdir(astroDir)).filter((f) => f.endsWith('.css'));
  } catch (err) {
    fail(`component CSS delivery: could not read ${path.join('_astro')} (${err.code ?? err.message}) — #60/#68`);
  }

  const sheetsWithRule = async (selectorText) => {
    const hits = [];
    for (const f of cssFiles) {
      const css = await readFile(path.join(astroDir, f), 'utf8');
      if (css.includes(selectorText)) hits.push(f);
    }
    return hits;
  };

  const calloutSheets = await sheetsWithRule('.dk-callout');
  const diagramCaptionSheets = await sheetsWithRule('.dk-diagram__caption');

  if (calloutSheets.length === 0) {
    fail(
      `component CSS delivery: no shipped _astro/*.css contains \`.dk-callout\` rules — the component sheet was ` +
        `not built/bundled at all (#68)`,
    );
  }

  // Finding #1 (pre-merge review, red-first): a shipped sheet can contain the
  // `.dk-callout` SELECTOR text while every custom property those rules read
  // (`var(--dk-callout-bg)`, etc.) resolves to nothing, because the TOKEN
  // declarations were left behind in `theme.css` — a sheet the branded build
  // never links (its token-sheet slot is replaced by the generated brand
  // sheet, which does not emit `--dk-callout-*`). "Rules present" is not
  // "rules applied": this asserts the DECLARATION (`--dk-callout-bg: value;`),
  // not just a `var(--dk-callout-bg)` USAGE, is present in a sheet that also
  // links from the branded page — i.e. the tokens the rules consume actually
  // ship. A `var(--dk-callout-bg)` reference has no trailing `:`, so this
  // regex (which requires the colon) cannot be satisfied by usage alone.
  const CALLOUT_TOKEN_DECLARATIONS = [
    /--dk-callout-bg:\s*[^;]+;/,
    /--dk-callout-border:\s*[^;]+;/,
    /--dk-callout-aside-accent:\s*[^;]+;/,
  ];
  const sheetsWithCalloutTokens = async () => {
    const hits = [];
    for (const f of cssFiles) {
      const css = await readFile(path.join(astroDir, f), 'utf8');
      if (CALLOUT_TOKEN_DECLARATIONS.every((re) => re.test(css))) hits.push(f);
    }
    return hits;
  };
  const calloutTokenSheets = await sheetsWithCalloutTokens();
  if (calloutTokenSheets.length === 0) {
    fail(
      `component CSS delivery: no shipped _astro/*.css declares the \`--dk-callout-*\` TOKENS ` +
        `(--dk-callout-bg/-border/-aside-accent) that \`.dk-callout\` rules consume — the rules are ` +
        `bundled (in ${JSON.stringify(calloutSheets)}) but the custom properties they read resolve to ` +
        `nothing on a branded build (no background, border-style: none, all variants render identically) ` +
        `— the tokens were left behind in a sheet the branded build never links (#68 finding #1)`,
    );
  }
  if (diagramCaptionSheets.length === 0) {
    fail(
      `component CSS delivery: no shipped _astro/*.css contains \`.dk-diagram__caption\` rules — the caption ` +
        `stylesheet is missing (#60)`,
    );
  }

  const showcaseAbs = path.join(distDir, MARKUA_SHOWCASE_RELPATH);
  await assertNonEmptyFile(showcaseAbs, `markua showcase (${MARKUA_SHOWCASE_RELPATH})`);
  const showcaseHtml = await readTextOrFail(showcaseAbs, `markua showcase (${MARKUA_SHOWCASE_RELPATH})`);
  const showcaseLinks = linkedStylesheetHrefs(showcaseHtml);
  const showcaseLinksCallout = showcaseLinks.some((href) => calloutSheets.some((f) => href.includes(f)));
  if (!showcaseLinksCallout) {
    fail(
      `component CSS delivery: the markua showcase (${MARKUA_SHOWCASE_RELPATH}) renders \`.dk-callout\` markup ` +
        `but links no stylesheet containing \`.dk-callout\` rules (bundled in ${JSON.stringify(calloutSheets)}, ` +
        `but not linked from this page's <head>) — the brand slot-0 replacement is dropping the component ` +
        `sheet (#68)`,
    );
  }
  // Finding #1: "rules present ≠ tokens resolve" — the showcase must link a
  // sheet that ALSO declares the `--dk-callout-*` tokens, not merely a sheet
  // that contains the rule selectors (see CALLOUT_TOKEN_DECLARATIONS above).
  const showcaseLinksCalloutTokens = showcaseLinks.some((href) =>
    calloutTokenSheets.some((f) => href.includes(f)),
  );
  if (!showcaseLinksCalloutTokens) {
    fail(
      `component CSS delivery: the markua showcase (${MARKUA_SHOWCASE_RELPATH}) links a \`.dk-callout\`-bearing ` +
        `sheet, but none of its linked sheets DECLARES the \`--dk-callout-*\` tokens those rules consume ` +
        `(token-declaring sheets bundled: ${JSON.stringify(calloutTokenSheets)}) — on this branded build the ` +
        `callout rules apply with every custom property unresolved (no background, no colour stripe) (#68 ` +
        `finding #1)`,
    );
  }

  const demoAbs = path.join(distDir, DEMO_RELPATH);
  await assertNonEmptyFile(demoAbs, `diagram demonstrator (${DEMO_RELPATH})`);
  const demoHtml = await readTextOrFail(demoAbs, `diagram demonstrator (${DEMO_RELPATH})`);
  const demoLinks = linkedStylesheetHrefs(demoHtml);
  const demoLinksDiagramCaption = demoLinks.some((href) => diagramCaptionSheets.some((f) => href.includes(f)));
  if (!demoLinksDiagramCaption) {
    fail(
      `component CSS delivery: the diagram demonstrator (${DEMO_RELPATH}) renders \`.dk-diagram\` figures but ` +
        `links no stylesheet containing \`.dk-diagram__caption\` rules (bundled in ` +
        `${JSON.stringify(diagramCaptionSheets)}, but not linked from this page's <head>) — the caption sheet ` +
        `is not reaching branded docs (#60/#68)`,
    );
  }

  ok(
    'component CSS delivery: the markua showcase links a `.dk-callout`-bearing sheet that ALSO declares the ' +
      '`--dk-callout-*` tokens those rules consume, the diagram demonstrator links a `.dk-diagram__caption`-' +
      'bearing sheet (#60/#68, finding #1)',
  );
}

// ---------------------------------------------------------------------------

async function main() {
  const distArg = process.argv[2];
  if (!distArg) {
    fail('usage: node src/scripts/assert-build-artifacts.mjs <distDir>');
  }
  const distDir = path.resolve(distArg);

  try {
    const info = await stat(distDir);
    if (!info.isDirectory()) fail(`distDir is not a directory: ${distDir}`);
  } catch {
    fail(`distDir does not exist: ${distDir} (did you run \`pnpm build\`?)`);
  }

  // 1) sitemap*.xml — present, non-empty, well-formed.
  const topLevel = await readdir(distDir);
  const sitemaps = topLevel.filter((f) => /^sitemap.*\.xml$/i.test(f)).sort();
  if (sitemaps.length === 0) {
    fail('sitemap: no sitemap*.xml file found at the dist root');
  }
  let sitemapUrlCount = 0;
  let draftSeenIn = null;
  for (const name of sitemaps) {
    const abs = path.join(distDir, name);
    await assertNonEmptyFile(abs, `sitemap ${name}`);
    const xml = await readTextOrFail(abs, `sitemap ${name}`);
    try {
      assertWellFormedXml(xml);
    } catch (err) {
      fail(`sitemap ${name}: not well-formed XML (${err.message})`);
    }
    // Count page URLs only: page entries are <url>…</url>; the sitemap index
    // uses <sitemap>…</sitemap>, so <url> never over-counts sub-sitemap refs.
    sitemapUrlCount += (xml.match(/<url\b/g) ?? []).length;
    if (xml.includes(DRAFT_ROUTE_MARKER)) draftSeenIn = name;
  }
  ok(`sitemap: ${sitemaps.length} file(s) present, non-empty, well-formed (${sitemaps.join(', ')})`);

  // Draft-exclusion (INV-1 / WP02 filter): the draft route must be absent and
  // the page-URL count must equal the published set.
  if (draftSeenIn !== null) {
    fail(
      `sitemap: draft route "${DRAFT_ROUTE_MARKER}" is present in ${draftSeenIn} — ` +
        `the @astrojs/sitemap draft filter must exclude every doc_status:draft page`,
    );
  }
  if (sitemapUrlCount !== EXPECTED_SITEMAP_URL_COUNT) {
    fail(
      `sitemap: page-URL count is ${sitemapUrlCount}, expected ${EXPECTED_SITEMAP_URL_COUNT} ` +
        `(the published set — 22 example .md files − 3 drafts; if example content changed ` +
        `intentionally, update EXPECTED_SITEMAP_URL_COUNT and re-cross-check example/docs)`,
    );
  }
  ok(`sitemap: draft "${DRAFT_ROUTE_MARKER}" absent, ${sitemapUrlCount} page URL(s) (published set)`);

  // 2) rss.xml — present, well-formed.
  const rssAbs = path.join(distDir, 'rss.xml');
  await assertNonEmptyFile(rssAbs, 'rss.xml');
  const rss = await readTextOrFail(rssAbs, 'rss.xml');
  try {
    assertWellFormedXml(rss);
  } catch (err) {
    fail(`rss.xml: not well-formed XML (${err.message})`);
  }
  ok('rss.xml: present and well-formed');

  // 3) llms.txt — present, non-empty.
  const llmsAbs = path.join(distDir, 'llms.txt');
  await assertNonEmptyFile(llmsAbs, 'llms.txt');
  ok('llms.txt: present and non-empty');

  // 4) agent index JSON — valid JSON, expected top-level shape, pinned count.
  const indexAbs = path.join(distDir, 'api', 'index.json');
  await assertNonEmptyFile(indexAbs, 'agent index (api/index.json)');
  const indexText = await readTextOrFail(indexAbs, 'agent index (api/index.json)');
  let index;
  try {
    index = JSON.parse(indexText);
  } catch (err) {
    fail(`agent index: not valid JSON (${err.message})`);
  }
  if (index === null || typeof index !== 'object' || Array.isArray(index)) {
    fail('agent index: top level is not a JSON object');
  }
  for (const [key, expectedType] of Object.entries(EXPECTED_INDEX_SHAPE)) {
    const value = index[key];
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (!(key in index)) fail(`agent index: missing top-level key "${key}"`);
    if (actualType !== expectedType) {
      fail(`agent index: key "${key}" should be ${expectedType}, got ${actualType}`);
    }
  }
  if (index.count !== index.pages.length) {
    fail(`agent index: count (${index.count}) does not match pages.length (${index.pages.length})`);
  }
  if (index.count !== EXPECTED_INDEX_ENTRY_COUNT) {
    fail(
      `agent index: entry count is ${index.count}, expected ${EXPECTED_INDEX_ENTRY_COUNT} ` +
        `(pinned baseline for today's example content — if the change is intentional, ` +
        `update EXPECTED_INDEX_ENTRY_COUNT in this script and re-cross-check against example/docs)`,
    );
  }
  index.pages.forEach((page, idx) => {
    if (page === null || typeof page !== 'object' || Array.isArray(page)) {
      fail(`agent index: pages[${idx}] is not an object`);
    }
    for (const key of EXPECTED_PAGE_KEYS) {
      if (!(key in page)) fail(`agent index: pages[${idx}] missing required key "${key}"`);
      if (typeof page[key] !== 'string') {
        fail(`agent index: pages[${idx}].${key} should be a string, got ${typeof page[key]}`);
      }
    }
  });
  ok(`agent index: valid JSON, expected shape, ${index.count} entries (pinned)`);

  // 4a) Concrete agent-API version (WP05/T028 bump). Pinned to the exact value so a
  // silent re-bump or regress is caught, not just "some string" (agent-surface
  // contract / DIRECTIVE_018).
  if (index.version !== EXPECTED_AGENT_API_VERSION) {
    fail(
      `agent index: version is ${JSON.stringify(index.version)}, expected ` +
        `${JSON.stringify(EXPECTED_AGENT_API_VERSION)} — the enriched-record shape bump (raw slugs → ` +
        `resolved related objects + audience) must carry version "2" (DIRECTIVE_018)`,
    );
  }
  ok(`agent index: version pinned to "${index.version}" (enriched-record contract)`);

  // 4b) BESPOKE shape for the ENRICHED array keys (agent-surface contract). These
  // are arrays of objects, so they cannot live in the string-type loop above.
  //   - related:  { ref, title, kind, doc_status }[]  — RESOLVED (never raw slugs)
  //   - audience: { profile, guidance_text }[]        — carried as authored
  // Asserted on EVERY page (the keys are always present, empty when unused), and at
  // least one page must actually carry a non-empty resolved `related` so the
  // enrichment is proven non-vacuously (the demonstrator does).
  let sawResolvedRelated = false;
  let sawAudience = false;
  index.pages.forEach((page, idx) => {
    if (!('related' in page) || !Array.isArray(page.related)) {
      fail(`agent index: pages[${idx}].related must be an array (enriched record), got ${typeof page.related}`);
    }
    if (!('audience' in page) || !Array.isArray(page.audience)) {
      fail(`agent index: pages[${idx}].audience must be an array (enriched record), got ${typeof page.audience}`);
    }
    for (const rel of page.related) {
      if (rel === null || typeof rel !== 'object' || Array.isArray(rel)) {
        fail(`agent index: pages[${idx}].related[] entry is not an object — related must be RESOLVED, not a raw slug string`);
      }
      for (const key of ['ref', 'title', 'kind', 'doc_status']) {
        if (typeof rel[key] !== 'string') {
          fail(
            `agent index: pages[${idx}].related[] missing/typed key "${key}" ` +
              `(resolved related is { ref, title, kind, doc_status }, all strings)`,
          );
        }
      }
      sawResolvedRelated = true;
    }
    for (const aud of page.audience) {
      if (aud === null || typeof aud !== 'object' || Array.isArray(aud)) {
        fail(`agent index: pages[${idx}].audience[] entry is not an object ({ profile, guidance_text })`);
      }
      for (const key of ['profile', 'guidance_text']) {
        if (typeof aud[key] !== 'string') {
          fail(`agent index: pages[${idx}].audience[] missing/typed key "${key}" (audience is { profile, guidance_text })`);
        }
      }
      sawAudience = true;
    }
  });
  if (!sawResolvedRelated) {
    fail(
      `agent index: no page carries a non-empty resolved \`related\` — the enrichment (resolveRelated in ` +
        `the route) is unexercised; the demonstrator must contribute at least one resolved related object`,
    );
  }
  if (!sawAudience) {
    fail(
      `agent index: no page carries a non-empty \`audience\` — the enriched audience field is unexercised; ` +
        `the demonstrator must contribute at least one audience entry`,
    );
  }
  ok(`agent index: enriched related[] ({ref,title,kind,doc_status}) + audience[] ({profile,guidance_text}) shapes valid`);

  // 4c) /api/bibliography.json — a catalog projection OUTSIDE page gating: valid
  // JSON, { version, count, records[] }, each record carrying id/title/url
  // (catalog-and-citation contract / FR-015).
  const biblioAbs = path.join(distDir, BIBLIOGRAPHY_ENDPOINT_RELPATH);
  await assertNonEmptyFile(biblioAbs, `bibliography endpoint (${BIBLIOGRAPHY_ENDPOINT_RELPATH})`);
  const biblioText = await readTextOrFail(biblioAbs, `bibliography endpoint (${BIBLIOGRAPHY_ENDPOINT_RELPATH})`);
  let biblio;
  try {
    biblio = JSON.parse(biblioText);
  } catch (err) {
    fail(`bibliography endpoint: not valid JSON (${err.message})`);
  }
  if (biblio === null || typeof biblio !== 'object' || Array.isArray(biblio)) {
    fail('bibliography endpoint: top level is not a JSON object');
  }
  if (typeof biblio.version !== 'string') {
    fail(`bibliography endpoint: "version" should be a string, got ${typeof biblio.version}`);
  }
  if (!Array.isArray(biblio.records)) {
    fail(`bibliography endpoint: "records" should be an array, got ${typeof biblio.records}`);
  }
  if (biblio.count !== biblio.records.length) {
    fail(`bibliography endpoint: count (${biblio.count}) does not match records.length (${biblio.records.length})`);
  }
  if (biblio.records.length === 0) {
    fail('bibliography endpoint: records is empty — the example bibliography catalog projects at least one record');
  }
  biblio.records.forEach((record, idx) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      fail(`bibliography endpoint: records[${idx}] is not an object`);
    }
    for (const key of EXPECTED_BIBLIOGRAPHY_RECORD_KEYS) {
      if (typeof record[key] !== 'string') {
        fail(`bibliography endpoint: records[${idx}].${key} should be a string, got ${typeof record[key]}`);
      }
    }
  });
  ok(`bibliography endpoint: valid JSON, { version, count, records[] }, ${biblio.count} record(s) with id/title/url`);

  // 5) README-as-index — a section README.md served at its directory route.
  const sectionIndexAbs = path.join(distDir, SECTION_INDEX_RELPATH);
  await assertNonEmptyFile(sectionIndexAbs, `README-as-index (${SECTION_INDEX_RELPATH})`);
  const sectionHtml = await readTextOrFail(sectionIndexAbs, `README-as-index (${SECTION_INDEX_RELPATH})`);
  if (!sectionHtml.includes(SECTION_INDEX_MARKER)) {
    fail(
      `README-as-index: ${SECTION_INDEX_RELPATH} does not contain the ${SECTION_INDEX_SOURCE} ` +
        `heading "${SECTION_INDEX_MARKER}" — the section README is not served at its directory route`,
    );
  }
  ok(`README-as-index: ${SECTION_INDEX_SOURCE} served at /adr/ (marker "${SECTION_INDEX_MARKER}" present)`);

  // README-as-index, Hub auto-list proof (SC-003b): with the hand table removed,
  // the built /adr/ HTML must still link ADR-0001 — that link can only come from
  // the `kind: Hub` layout auto-listing the sibling ADRs.
  if (!sectionHtml.includes(SECTION_INDEX_HUB_LINK)) {
    fail(
      `Hub auto-list: ${SECTION_INDEX_RELPATH} does not contain a link to "${SECTION_INDEX_HUB_LINK}" — ` +
        `after ${SECTION_INDEX_SOURCE} dropped its hand table, the kind: Hub layout must auto-list the ADRs ` +
        `(SC-003b); a missing link means the Hub is not rendering the ADR index`,
    );
  }
  ok(`Hub auto-list: /adr/ links ADR-0001 ("${SECTION_INDEX_HUB_LINK}") from the Hub layout, not a hand table (SC-003b)`);

  // 6) A known content page rendered to HTML.
  const knownAbs = path.join(distDir, KNOWN_PAGE_RELPATH);
  await assertNonEmptyFile(knownAbs, `known page (${KNOWN_PAGE_RELPATH})`);
  const knownHtml = await readTextOrFail(knownAbs, `known page (${KNOWN_PAGE_RELPATH})`);
  const looksLikeHtml = /<!doctype html/i.test(knownHtml) || /<html[\s>]/i.test(knownHtml);
  if (!looksLikeHtml) {
    fail(`known page: ${KNOWN_PAGE_RELPATH} does not look like a rendered HTML document`);
  }
  ok(`known page: ${KNOWN_PAGE_RELPATH} rendered to HTML`);

  // 6a) diagrams WP04: the published diagram demonstrator — figure + injected
  // acc-statements + no-JS source & caption in document order + browser-free
  // (no static <svg>) (BD-1/BD-2/NFR-004).
  await assertDiagramDemonstrator(distDir);

  // 6b) diagrams WP04: pinned diagram deps + no CDN (BD-4/NFR-004).
  await assertPinnedDepsNoCdn(distDir);

  // 6b2) diagram-component-css WP01 (#59/T006, red-first): no <pre> wraps
  // <figure class="dk-diagram"> across all 3 diagram pages.
  await assertNoStrayPreWrapsDiagramFigures(distDir);

  // 6b3) diagram-component-css WP01 (#60/#68/T006, red-first): component CSS is
  // actually bundled AND linked on the branded pages that render it.
  await assertComponentCssDelivered(distDir);

  // 6c) markua-syntax-support WP10: the Markua verification gates — ordering
  // lock, identity-anchored figure round-trip, no-new-client-JS, per-variant
  // discriminators, icon-render, and the SC-005 coverage manifest (IC-06).
  await assertMarkuaArtifacts(distDir);

  // 7) slide-decks WP04: published-deck build-artifact assertions (BA-2/3/6/7/9).
  // The published showcase deck renders OUT-OF-FRAME via the deck route yet stays a
  // normal enumerated collection entry, so it is present in every published-set
  // generator and absent from RSS; the WP01 draft deck is absent everywhere.
  const llmsText = await readTextOrFail(llmsAbs, 'llms.txt');
  const sitemapText = (
    await Promise.all(
      sitemaps.map((n) => readTextOrFail(path.join(distDir, n), `sitemap ${n}`)),
    )
  ).join('\n');
  const indexJson = JSON.stringify(index);

  // BA-2 — Route-uniqueness + flatten: exactly one HTML at /presentations/showcase-deck/,
  // and it is the reveal deck document (`.reveal > .slides`), NOT the Starlight
  // article shell. The transform's slides are TOP-LEVEL `.slides > section`
  // (multiple horizontals + a `##`+`###` stack that nests `section > section`),
  // never a single wrapper `<section>` that would collapse the deck into one
  // vertical stack (the WP04 DeckLayout flatten).
  const deckHtmlAbs = path.join(distDir, DECK_SLUG, 'index.html');
  await assertNonEmptyFile(deckHtmlAbs, `deck route (${DECK_SLUG}/index.html)`);
  const deckHtml = await readTextOrFail(deckHtmlAbs, `deck route (${DECK_SLUG})`);
  const revealIdx = deckHtml.search(/class="[^"]*\breveal\b[^"]*"/);
  const slidesIdx = deckHtml.search(/class="[^"]*\bslides\b[^"]*"/);
  if (revealIdx === -1 || slidesIdx === -1 || !(revealIdx < slidesIdx)) {
    fail(`deck route: ${DECK_SLUG}/index.html is not the reveal shell (.reveal > .slides missing or misordered) — BA-2`);
  }
  if (/sl-markdown-content/.test(deckHtml)) {
    fail(
      `deck route: ${DECK_SLUG}/index.html contains the Starlight article shell (sl-markdown-content) — ` +
        `the deck is not rendering out-of-frame (BA-2)`,
    );
  }
  const slidesInner = extractSlidesInner(deckHtml);
  if (slidesInner === null) {
    fail(`deck route: could not locate the .slides container in ${DECK_SLUG}/index.html (BA-2)`);
  }
  const topSections = countDirectChildSections(slidesInner);
  if (topSections < 2) {
    fail(
      `deck route: .slides has ${topSections} direct-child <section>(s) — the transform's slides are nested ` +
        `inside a single wrapper <section> instead of being TOP-LEVEL (reveal would collapse the deck into ` +
        `one vertical stack). DeckLayout must render <Content/> as the direct child of .slides (BA-2 flatten)`,
    );
  }
  if (!hasNestedSectionStack(slidesInner)) {
    fail(
      `deck route: no vertical stack (a top-level <section> containing nested <section>s) in ${DECK_SLUG} — ` +
        `the ###-stack did not render (BA-2)`,
    );
  }
  ok(
    `deck route: single reveal deck at ${DECK_ROUTE} with ${topSections} top-level slides (flattened) + a ` +
      `nested stack, not the Starlight shell (BA-2)`,
  );

  // BA-3 — URL parity via the deckSlug oracle (see the DECK_SLUG note). The
  // canonical route is `/${DECK_SLUG}/`; the deck's agent-index entry, its llms.txt
  // URL, and its emitted dist path must all agree, and the `presentations/` prefix
  // must not double.
  const refPage = index.pages.find(
    (p) =>
      p.section !== 'presentations' &&
      typeof p.url === 'string' &&
      typeof p.route === 'string' &&
      p.url.endsWith(p.route),
  );
  if (!refPage) {
    fail('deck URL parity: no non-deck reference page (url ending in route) to derive the site origin — BA-3');
  }
  const origin = refPage.url.slice(0, refPage.url.length - refPage.route.length);
  const expectedDeckUrl = `${origin}${DECK_ROUTE}`;
  const deckPage = index.pages.find((p) => p.slug === DECK_SLUG);
  if (!deckPage) {
    fail(`deck URL parity: the published deck (slug "${DECK_SLUG}") is absent from the agent index — it must stay enumerated (BA-3)`);
  }
  if (deckPage.route !== DECK_ROUTE) {
    fail(
      `deck URL parity: agent-index route is ${JSON.stringify(deckPage.route)}, expected ` +
        `${JSON.stringify(DECK_ROUTE)} — the deck slug already carries "presentations/", so a route built ` +
        `from the raw slug would DOUBLE the prefix (BA-3 prefix-doubling guard)`,
    );
  }
  if (deckPage.url !== expectedDeckUrl) {
    fail(
      `deck URL parity: agent-index url is ${JSON.stringify(deckPage.url)}, expected ` +
        `${JSON.stringify(expectedDeckUrl)} (absolute(site, ${DECK_ROUTE})) — BA-3`,
    );
  }
  if (!llmsText.includes(`(${expectedDeckUrl})`)) {
    fail(`deck URL parity: llms.txt does not list the deck at ${expectedDeckUrl} — the llms URL diverges from the agent API/route (BA-3)`);
  }
  const doubled = `/presentations${DECK_ROUTE}`; // /presentations/presentations/showcase-deck/
  if (llmsText.includes(doubled) || sitemapText.includes(doubled) || indexJson.includes(doubled)) {
    fail(`deck URL parity: the prefix-doubled path ${doubled} appears in a generator — deckRouteParams must strip the presentations/ prefix (BA-3)`);
  }
  ok(`deck URL parity: agent index + llms.txt + emitted route all resolve the deck to ${expectedDeckUrl} (one oracle, no prefix-doubling) (BA-3)`);

  // BA-6 — RSS exclusion: the published deck URL is absent from rss.xml (the RSS
  // route excludes kind: Presentation).
  if (rss.includes(DECK_SLUG)) {
    fail(`deck RSS exclusion: the published deck ${DECK_SLUG} appears in rss.xml — kind:Presentation must be excluded from the feed (BA-6)`);
  }
  ok(`deck RSS exclusion: ${DECK_SLUG} absent from rss.xml (BA-6)`);

  // BA-7 — Draft deck exclusion (build generators): the WP01 draft deck is absent
  // from sitemap, RSS, llms.txt, and the agent index; and it did NOT move the pins
  // (proven by the count assertions above passing at 18 with the draft deck in the
  // tree — it contributes 0). Its Pagefind-index absence is asserted in the chrome
  // gate below (the BA-7 Pagefind half).
  for (const [artifact, text] of [
    ['sitemap', sitemapText],
    ['rss.xml', rss],
    ['llms.txt', llmsText],
    ['agent index', indexJson],
  ]) {
    if (text.includes(DRAFT_DECK_SLUG)) {
      fail(`draft deck exclusion: the draft deck ${DRAFT_DECK_SLUG} appears in ${artifact} — a doc_status:draft deck must be absent from every published-set generator (BA-7)`);
    }
  }
  ok(`draft deck exclusion: ${DRAFT_DECK_SLUG} absent from sitemap/rss/llms/agent, and did not move the pins (BA-7)`);

  // BA-9 — Print asset/bundle check. reveal 6.0.1 has NO separate print/pdf.css
  // export; the print rules are folded into core reveal.css `@media print`, and the
  // print VIEW is activated at runtime by reveal-init.client on `?print-pdf`. So the
  // check is (a) an emitted _astro CSS asset carries the reveal core sentinel AND an
  // `@media print` block (the bundled print rules), and (b) an emitted reveal-init
  // JS chunk references `print-pdf` under the `view:'print'` branch. There is
  // deliberately NO distinct ?print-pdf HTML artifact (SSG emits one page).
  const astroDir = path.join(distDir, '_astro');
  let astroEntries;
  try {
    astroEntries = await readdir(astroDir);
  } catch (err) {
    fail(`print asset: could not read ${path.join('_astro')} (${err.code ?? err.message}) — BA-9`);
  }
  // The reveal CORE sheet is pinned by the core-UNIQUE viewport-hijack literal
  // `.reveal-viewport{color:#000` (the token-map sheet references `.reveal-viewport`
  // as a selector and even carries its own `@media print`, so a bare substring would
  // mis-identify it). The core sheet's `@media print` block is reveal 6's folded
  // print stylesheet — there is no separate print/pdf.css.
  const REVEAL_CORE_PRINT_SENTINEL = '.reveal-viewport{color:#000';
  let printSheet = null;
  for (const n of astroEntries.filter((f) => f.endsWith('.css'))) {
    const sheet = await readFile(path.join(astroDir, n), 'utf8');
    if (sheet.includes(REVEAL_CORE_PRINT_SENTINEL) && /@media\s+print/.test(sheet)) {
      printSheet = n;
      break;
    }
  }
  if (printSheet === null) {
    fail(
      `print asset: no emitted _astro/*.css carries reveal's core sheet ` +
        `(${JSON.stringify(REVEAL_CORE_PRINT_SENTINEL)}) WITH an @media print block — reveal 6 folds print ` +
        `into core reveal.css, so the bundled print rules must ship (BA-9/FR-013)`,
    );
  }
  let printChunk = null;
  for (const n of astroEntries.filter((f) => f.endsWith('.js') && f.includes('reveal-init'))) {
    const js = await readFile(path.join(astroDir, n), 'utf8');
    if (js.includes('print-pdf') && /view:\s*["']print["']/.test(js)) {
      printChunk = n;
      break;
    }
  }
  if (printChunk === null) {
    fail(
      `print asset: no emitted reveal-init client chunk references \`print-pdf\` under the \`view:'print'\` ` +
        `branch — the ?print-pdf activation (FR-013) is not bundled (BA-9)`,
    );
  }
  ok(`print asset: reveal core sheet (${printSheet}) ships @media print, and ${printChunk} activates the print view on ?print-pdf (BA-9)`);

  // 8) Chrome + pagefind assertions (WP05-owned module + WP04 deck additions).
  // Fails non-zero on the first stubbed/missing chrome element, same contract.
  await assertChromeArtifacts(distDir);

  process.stdout.write(`assert:artifacts: PASS — all build artifacts present and valid in ${distDir}\n`);
}

main().catch((err) => {
  fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`);
});

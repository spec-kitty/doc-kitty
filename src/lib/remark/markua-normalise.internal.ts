/**
 * Pure, Astro-free block-detection state machine for the Markua normaliser
 * (ADR-0030, contract `normaliser-block-detection.md`; FR-001/FR-004/FR-012).
 *
 * `markua-normalise.ts` (the remark plugin) reconstructs line text from the
 * parsed mdast (paragraph text + opaque-node placeholders) and delegates ALL
 * recognition/grouping to this module; nothing here imports remark, unified,
 * mdast, hast, or vfile, so the vitest matrix exercises the load-bearing
 * correctness — fence suppression, run termination, wrapper balance, unbalanced
 * degradation — with zero build runtime.
 *
 * The rules are stated at the LINE level (the contract's unit of work). The
 * single piece of carried state is `insideFence`: a code fence toggles it, and
 * WHILE INSIDE A FENCE NO OTHER RULE FIRES — every line passes through verbatim.
 * That is the correctness core behind `fence-suppresses-line-prefix` and
 * `unterminated-fence-at-EOF` (the fence does not unwind at end of input).
 *
 * The normaliser is TOTAL (contract Guarantees): every input produces valid
 * output and nothing throws. An unmatched wrapper marker degrades to literal
 * text; a look-alike in prose (`see W> here`) is left alone; a real blockquote
 * (`> quote`) and a `Z>` outside the recognised set are ordinary.
 *
 * This module emits directive NAMES per `callout-mapping.md` (aside / tip /
 * caution / danger / note / discussion / question / exercise / center /
 * generic). It does NOT decide Starlight-vs-theme routing (WP04) and does NOT
 * parse or attach `{key: value}` attribute lists (WP08) — it recognises the
 * wrapper MARKERS and the line-prefix runs and emits the container, leaving an
 * attribute-list paragraph (e.g. `{#id}` / `{class: …}`) as the container's
 * immediate predecessor for WP08 to fold on the same tree.
 */

/** The Markua line-prefix letters this normaliser recognises. */
export const RECOGNISED_LETTERS = ['A', 'B', 'C', 'D', 'E', 'I', 'Q', 'T', 'W', 'X'] as const;

/** One recognised Markua line-prefix letter. */
export type MarkuaLetter = (typeof RECOGNISED_LETTERS)[number];

const RECOGNISED_SET: ReadonlySet<string> = new Set(RECOGNISED_LETTERS);

/**
 * Family mapping — a line-prefix letter (or `{blurb, class: …}` name) to its
 * Markua construct class. `A` is the aside; `B` is the generic blurb; the rest
 * are their callout class. Exported so WP04's render mapping and the vitest
 * reuse the same table (contract "recognised letters").
 */
export const LETTER_TO_CLASS: Record<MarkuaLetter, string> = {
  A: 'aside',
  B: 'generic',
  C: 'center',
  D: 'discussion',
  E: 'error',
  I: 'information',
  Q: 'question',
  T: 'tip',
  W: 'warning',
  X: 'exercise',
};

/**
 * Markua class → emitted `containerDirective` NAME (`callout-mapping.md`). The
 * four Starlight-mapped classes rename to Starlight's aside types
 * (`warning`→`caution`, `error`→`danger`, `information`→`note`, `tip`→`tip`);
 * the six theme classes keep their own name. This is why the three input forms
 * of a class normalise to ONE directive (FR-004): `W>` and `{blurb, class:
 * warning}` both resolve to `caution`.
 */
export const CLASS_TO_DIRECTIVE: Record<string, string> = {
  aside: 'aside',
  generic: 'generic',
  center: 'center',
  discussion: 'discussion',
  question: 'question',
  exercise: 'exercise',
  tip: 'tip',
  warning: 'caution',
  error: 'danger',
  information: 'note',
};

/** Resolve a Markua class name to its directive name; unknown → generic (FR-012). */
export function directiveNameForClass(markuaClass: string): string {
  return CLASS_TO_DIRECTIVE[markuaClass] ?? 'generic';
}

/** The five line kinds the classifier reports. */
export type LineKind =
  | 'fence-toggle'
  | 'line-prefix'
  | 'wrapper-open'
  | 'wrapper-close'
  | 'ordinary';

// A CommonMark code fence: 3+ backticks or 3+ tildes, indented at most 3 spaces.
// (The info string on an opening fence is irrelevant to toggling.)
const FENCE_RE = /^ {0,3}(?:`{3,}|~{3,})/;
// A Markua line-prefix marker at column 0: a single capital letter, `>`, then a
// space or end-of-line. The `^` anchor is load-bearing — `see W> here` mid-line
// is ordinary, and `> quote` (a real blockquote) never matches `^[A-Z]>`.
const LINE_PREFIX_RE = /^([A-Z])>(?:\s|$)/;
// Wrapper markers, matched against the TRIMMED line; whitespace inside braces is
// tolerated. `{blurb, class: <name>}` captures its class in group 1.
const WRAPPER_ASIDE_OPEN_RE = /^\{\s*aside\s*\}$/;
const WRAPPER_BLURB_OPEN_RE = /^\{\s*blurb\s*(?:,\s*class\s*:\s*([^,}]+?)\s*)?\}$/;
const WRAPPER_ASIDE_CLOSE_RE = /^\{\s*\/\s*aside\s*\}$/;
const WRAPPER_BLURB_CLOSE_RE = /^\{\s*\/\s*blurb\s*\}$/;

/** A recognised wrapper's type. Nesting balance is tracked per type. */
export type WrapperType = 'aside' | 'blurb';

/** A recognised wrapper-open marker, resolved to its emitted directive. */
export interface WrapperOpen {
  type: WrapperType;
  /** Markua class carried by the marker (`aside` / `generic` / a `{blurb, class:}`). */
  markuaClass: string;
  /** Emitted `containerDirective` name (per `callout-mapping.md`). */
  directiveName: string;
}

/**
 * Classify one line given the single carried state `insideFence`. A fence line
 * is reported FIRST regardless of state (so the closing fence is seen); while
 * inside a fence every other line is `ordinary` — no rule fires (contract
 * "Line classification").
 */
export function classifyLine(line: string, insideFence: boolean): LineKind {
  if (FENCE_RE.test(line)) return 'fence-toggle';
  if (insideFence) return 'ordinary';

  const trimmed = line.trim();
  if (WRAPPER_ASIDE_OPEN_RE.test(trimmed) || WRAPPER_BLURB_OPEN_RE.test(trimmed)) {
    return 'wrapper-open';
  }
  if (WRAPPER_ASIDE_CLOSE_RE.test(trimmed) || WRAPPER_BLURB_CLOSE_RE.test(trimmed)) {
    return 'wrapper-close';
  }

  const m = LINE_PREFIX_RE.exec(line);
  if (m && RECOGNISED_SET.has(m[1])) return 'line-prefix';

  return 'ordinary';
}

/** Parse a line-prefix line (already classified) into its letter + stripped content. */
export function parseLinePrefix(line: string): { letter: MarkuaLetter; content: string } | null {
  const m = LINE_PREFIX_RE.exec(line);
  if (!m || !RECOGNISED_SET.has(m[1])) return null;
  return { letter: m[1] as MarkuaLetter, content: stripPrefix(line) };
}

/** Strip the `X>` marker and the single following space (if any) from a line. */
export function stripPrefix(line: string): string {
  const rest = line.slice(2); // drop the letter and `>`
  if (rest.startsWith(' ') || rest.startsWith('\t')) return rest.slice(1);
  return rest;
}

/** Resolve a trimmed wrapper-open line to its type / class / directive name. */
export function matchWrapperOpen(trimmed: string): WrapperOpen | null {
  if (WRAPPER_ASIDE_OPEN_RE.test(trimmed)) {
    return { type: 'aside', markuaClass: 'aside', directiveName: 'aside' };
  }
  const blurb = WRAPPER_BLURB_OPEN_RE.exec(trimmed);
  if (blurb) {
    const rawClass = blurb[1]?.trim();
    // Bare `{blurb}` is the generic blurb; `{blurb, class: <name>}` resolves the
    // class (unknown class degrades to generic, FR-012).
    const markuaClass = rawClass && rawClass in CLASS_TO_DIRECTIVE ? rawClass : 'generic';
    return { type: 'blurb', markuaClass, directiveName: directiveNameForClass(markuaClass) };
  }
  return null;
}

/** Whether a trimmed line closes a wrapper of the given type. */
export function isWrapperCloseOfType(trimmed: string, type: WrapperType): boolean {
  return type === 'aside'
    ? WRAPPER_ASIDE_CLOSE_RE.test(trimmed)
    : WRAPPER_BLURB_CLOSE_RE.test(trimmed);
}

/**
 * A normalised block. `raw` lines pass through untouched (ordinary text, fenced
 * code, opaque-node placeholders); a `container` is a recognised line-prefix run
 * or wrapper, whose `children` are the recursively-normalised inner content.
 */
export type NormBlock =
  | { kind: 'raw'; lines: string[] }
  | {
      kind: 'container';
      /** Emitted `containerDirective` name (per `callout-mapping.md`). */
      directiveName: string;
      /** Markua construct class (before Starlight rename). */
      markuaClass: string;
      /** What produced this container — a run vs an `{aside}` / `{blurb}` wrapper. */
      source: 'line-prefix' | 'wrapper-aside' | 'wrapper-blurb';
      children: NormBlock[];
    };

/**
 * Run the full line-level state machine over a document's lines and return the
 * ordered blocks. TOTAL: never throws. Fence-safe (a fenced `W>` stays raw and
 * the fence does not unwind at EOF), blockquote-safe (a `>` line is ordinary),
 * balance-aware (nested wrappers close at count zero), and degrading (an
 * unmatched marker stays literal).
 */
export function normaliseDocument(lines: string[]): NormBlock[] {
  const blocks: NormBlock[] = [];
  let rawBuf: string[] = [];
  let insideFence = false;
  let i = 0;

  const flushRaw = (): void => {
    if (rawBuf.length > 0) {
      blocks.push({ kind: 'raw', lines: rawBuf });
      rawBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const kind = classifyLine(line, insideFence);

    if (kind === 'fence-toggle') {
      insideFence = !insideFence;
      rawBuf.push(line);
      i += 1;
      continue;
    }

    // While inside a fence (or on an ordinary/stray-close line) the content is
    // verbatim: it accumulates into the current raw block.
    if (insideFence || kind === 'ordinary' || kind === 'wrapper-close') {
      rawBuf.push(line);
      i += 1;
      continue;
    }

    if (kind === 'wrapper-open') {
      const consumed = consumeWrapper(lines, i);
      if (consumed) {
        flushRaw();
        blocks.push(consumed.block);
        i = consumed.nextIndex;
        continue;
      }
      // Unbalanced open: leave the marker literal and carry on (never throw).
      rawBuf.push(line);
      i += 1;
      continue;
    }

    // kind === 'line-prefix'
    const run = consumeLinePrefixRun(lines, i);
    flushRaw();
    blocks.push(run.block);
    i = run.nextIndex;
  }

  flushRaw();
  return blocks;
}

/**
 * Consume a line-prefix run starting at `start`. It extends across consecutive
 * line-prefix lines of the SAME family (a bare `A>` marker continues an aside);
 * a different family, an ordinary/blank line, a wrapper marker, a fence, or EOF
 * ends it. The prefix is stripped from every line and the remainder compiled as
 * the container's inner content.
 */
function consumeLinePrefixRun(
  lines: string[],
  start: number,
): { block: NormBlock; nextIndex: number } {
  const first = parseLinePrefix(lines[start]);
  // `start` was classified as line-prefix, so this is non-null; guard anyway.
  const family = first?.letter;
  const innerLines: string[] = [];
  let i = start;

  while (i < lines.length) {
    const parsed = parseLinePrefix(lines[i]);
    if (!parsed || parsed.letter !== family) break;
    innerLines.push(parsed.content);
    i += 1;
  }

  const markuaClass = LETTER_TO_CLASS[family as MarkuaLetter];
  return {
    block: {
      kind: 'container',
      directiveName: directiveNameForClass(markuaClass),
      markuaClass,
      source: 'line-prefix',
      children: normaliseDocument(innerLines),
    },
    nextIndex: i,
  };
}

/**
 * Consume a wrapper starting at its open marker `start`. Tracks an open-count
 * for THIS wrapper type so nesting closes by balance (not first-close-wins), and
 * tracks `insideFence` so a marker inside a fenced block in the body does not
 * close the wrapper. Returns `null` when no matching close exists before EOF
 * (unbalanced degradation — the caller leaves the open marker literal).
 */
function consumeWrapper(
  lines: string[],
  start: number,
): { block: NormBlock; nextIndex: number } | null {
  const open = matchWrapperOpen(lines[start].trim());
  if (!open) return null;

  let depth = 1;
  let insideFence = false;
  const bodyLines: string[] = [];
  let i = start + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      insideFence = !insideFence;
      bodyLines.push(line);
      i += 1;
      continue;
    }

    if (!insideFence) {
      const trimmed = line.trim();
      const nestedOpen = matchWrapperOpen(trimmed);
      if (nestedOpen && nestedOpen.type === open.type) {
        depth += 1;
        bodyLines.push(line);
        i += 1;
        continue;
      }
      if (isWrapperCloseOfType(trimmed, open.type)) {
        depth -= 1;
        if (depth === 0) {
          return {
            block: {
              kind: 'container',
              directiveName: open.directiveName,
              markuaClass: open.markuaClass,
              source: open.type === 'aside' ? 'wrapper-aside' : 'wrapper-blurb',
              children: normaliseDocument(bodyLines),
            },
            nextIndex: i + 1,
          };
        }
        bodyLines.push(line);
        i += 1;
        continue;
      }
    }

    bodyLines.push(line);
    i += 1;
  }

  return null; // unbalanced — no matching close before EOF
}

/**
 * The PDF post-pass (ADR-0081, #393): pin the two dates and stamp the document info,
 * so two prints of one build are byte-identical. Node built-ins only (NFR-004).
 *
 * Chromium writes `/CreationDate` and `/ModDate` from the wall clock. In a tagged PDF
 * it also gives each structure element an `/ID (nodeNNNNNNNN)` from Blink's per-process
 * DOM node counter, which drifts between runs (a script that creates nodes in a
 * different order is enough). This pass:
 *  0. renumbers those structure ids in place: same width, order-preserving (so the
 *     `/IDTree` name tree stays sorted), every occurrence (element and name tree) alike;
 *  1. overwrites every `/CreationDate (D:…)` and `/ModDate (D:…)` value IN PLACE with a
 *     date of the same width, so no byte offset moves and the xref stays valid;
 *  2. appends one standard incremental update: a new document-info object (`Title`,
 *     `Producer: doc-kitty-pdf/<version>`, the pinned dates), a one-entry xref section
 *     and a trailer that points back with `/Prev`.
 * The output is a pure function of the input bytes and the arguments. These two dates
 * are the documented build-clock fields a two-build byte check masks (#300).
 */
import { dictValue, lastStartxref, openPdf } from './pdf-inspect.mjs';

/** `D:YYYYMMDDHHmmSS+00'00'` for an epoch in seconds (UTC). */
export function pdfDate(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) throw new Error(`not an epoch: ${epochSeconds}`);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `D:${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}+00'00'`;
}

/** A PDF literal string for `text`: ASCII escaped, or UTF-16BE hex with a BOM otherwise. */
export function pdfString(text) {
  if (/^[\x20-\x7e]*$/.test(text)) return `(${text.replace(/([\\()])/g, '\\$1')})`;
  const be = Buffer.alloc(2 + text.length * 2);
  be[0] = 0xfe;
  be[1] = 0xff;
  for (let i = 0; i < text.length; i++) be.writeUInt16BE(text.charCodeAt(i), 2 + i * 2);
  return `<${be.toString('hex').toUpperCase()}>`;
}

/**
 * Pin the dates and stamp the info dictionary.
 * @param {Buffer} input A PDF from Chromium.
 * @param {{ epochSeconds: number, title: string, producer: string }} options
 * @returns {Buffer}
 */
export function pinPdf(input, { epochSeconds, title, producer }) {
  const date = pdfDate(epochSeconds);
  // 0 and 1. Same-width rewrites: structure ids, then every date value Chromium wrote.
  const text = normaliseStructIds(input.toString('latin1')).replace(/\/(CreationDate|ModDate)\s*\((D:[^)]*)\)/g, (match, key, value) => {
    const pinned = date.length <= value.length ? date.padEnd(value.length, ' ') : date.slice(0, value.length);
    return match.replace(value, pinned);
  });
  const patched = Buffer.from(text, 'latin1');
  if (patched.length !== input.length) throw new Error('date pinning changed the file length');

  // 2. The incremental update.
  const pdf = openPdf(patched);
  const root = dictValue(pdf.trailer, 'Root');
  const size = Number(dictValue(pdf.trailer, 'Size')?.word);
  if (root?.ref === undefined || !Number.isInteger(size)) throw new Error('malformed PDF: trailer lacks /Root or /Size');
  const prev = lastStartxref(text);
  const n = size;
  const sep = patched[patched.length - 1] === 0x0a ? '' : '\n';
  const objOffset = patched.length + sep.length;
  const obj =
    `${n} 0 obj\n<</Title ${pdfString(title)}\n/Producer ${pdfString(producer)}\n` +
    `/CreationDate (${date})\n/ModDate (${date})>>\nendobj\n`;
  const xrefOffset = objOffset + Buffer.byteLength(obj, 'latin1');
  const xref = `xref\n${n} 1\n${String(objOffset).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<</Size ${n + 1}\n/Root ${root.ref} 0 R\n/Info ${n} 0 R\n/Prev ${prev}>>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.concat([patched, Buffer.from(`${sep}${obj}${xref}${trailer}`, 'latin1')]);
}

/** The structure-element id literals Chromium writes, e.g. `(node00000922)`. */
const STRUCT_ID = /\(node(\d+)\)/g;

/**
 * Renumber `(nodeN…)` structure ids to their rank among all ids in the file, padded to
 * the original width. Order-preserving, so a sorted `/IDTree` stays sorted; applied to
 * every occurrence, so element and name tree agree; same width, so no offset moves.
 * @param {string} text the PDF as latin1
 */
export function normaliseStructIds(text) {
  // Only outside stream data: compressed bytes could spell `(node…)` by chance.
  const parts = splitStreams(text);
  const ids = [...new Set(parts.filter((p) => !p.stream).flatMap((p) => [...p.text.matchAll(STRUCT_ID)].map((m) => m[1])))].sort((a, b) =>
    a.length - b.length || (a < b ? -1 : a > b ? 1 : 0),
  );
  if (ids.length === 0) return text;
  const rank = new Map(ids.map((id, i) => [id, String(i + 1).padStart(id.length, '0')]));
  for (const [id, renumbered] of rank) {
    if (renumbered.length !== id.length) throw new Error(`structure id ${id} cannot be renumbered in place`);
  }
  return parts.map((p) => (p.stream ? p.text : p.text.replace(STRUCT_ID, (_m, id) => `(node${rank.get(id)})`))).join('');
}

/** Split a PDF's text into stream data and everything else, in order. */
export function splitStreams(text) {
  const parts = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    const dataStart = m.index + m[0].indexOf('\n') + 1;
    const dataEnd = m.index + m[0].length - 'endstream'.length;
    parts.push({ stream: false, text: text.slice(at, dataStart) });
    parts.push({ stream: true, text: text.slice(dataStart, dataEnd) });
    at = dataEnd;
  }
  parts.push({ stream: false, text: text.slice(at) });
  return parts;
}

/** The first byte offset where two buffers differ, or -1 when they are equal. */
export function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/** The `N G obj` that holds byte `offset`, for a readable difference report. */
export function objectAt(buf, offset) {
  const before = buf.subarray(0, offset + 1).toString('latin1');
  const m = [...before.matchAll(/(\d+) (\d+) obj\b/g)].pop();
  if (!m) return 'the file header';
  const end = before.indexOf('endobj', m.index);
  return end === -1 ? `${m[1]} ${m[2]} obj` : 'the space between objects (xref or trailer)';
}

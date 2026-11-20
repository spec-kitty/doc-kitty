/**
 * A small PDF reader for the PDF gate and the post-pass (ADR-0081, #393, #395).
 * Node built-ins only: no PDF library is a dependency of the toolkit (NFR-004).
 *
 * It reads what Chromium's Skia writer produces: classic cross-reference tables
 * (followed through `/Prev`, so an incremental update is read too), with the catalog,
 * page tree, outline and document info as plain dictionaries. Content streams are
 * never decoded. A PDF that uses cross-reference streams is refused, by name.
 */

/** @param {Buffer} buf */
const latin1 = (buf) => buf.toString('latin1');

/** The byte offset after the last `startxref`. */
export function lastStartxref(text) {
  const at = text.lastIndexOf('startxref');
  if (at === -1) throw new Error('not a PDF: no startxref');
  const m = text.slice(at + 9).match(/^\s*(\d+)/);
  if (!m) throw new Error('not a PDF: startxref has no offset');
  return Number(m[1]);
}

/**
 * Parse every classic xref section reachable from the last `startxref`, newest first,
 * into `objectNumber → byte offset` (newest wins) and the newest trailer dictionary.
 */
export function readXref(text) {
  /** @type {Map<number, number>} */
  const offsets = new Map();
  let trailer = '';
  const seen = new Set();
  let at = lastStartxref(text);
  while (at !== undefined && !seen.has(at)) {
    seen.add(at);
    if (!text.startsWith('xref', at)) {
      throw new Error('unsupported PDF: no classic xref table at startxref (cross-reference streams are not read)');
    }
    let pos = at + 4;
    const trailerAt = text.indexOf('trailer', pos);
    if (trailerAt === -1) throw new Error('malformed PDF: xref without trailer');
    const table = text.slice(pos, trailerAt);
    const lines = table.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
    let i = 0;
    while (i < lines.length) {
      const [startText, countText] = lines[i].split(/\s+/);
      const start = Number(startText);
      const count = Number(countText);
      for (let k = 0; k < count; k++) {
        const entry = lines[i + 1 + k];
        if (!entry) break;
        const [offset, , kind] = entry.split(/\s+/);
        if (kind === 'n' && !offsets.has(start + k)) offsets.set(start + k, Number(offset));
      }
      i += 1 + count;
    }
    const dict = readDictAt(text, text.indexOf('<<', trailerAt));
    if (!trailer) trailer = dict;
    const prev = dict.match(/\/Prev\s+(\d+)/);
    at = prev ? Number(prev[1]) : undefined;
  }
  return { offsets, trailer };
}

/** The balanced `<< … >>` dictionary text starting at `start`. */
export function readDictAt(text, start) {
  if (start < 0 || !text.startsWith('<<', start)) throw new Error('malformed PDF: expected a dictionary');
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '(') {
      // Skip a literal string, honouring escapes and nesting.
      let nest = 1;
      for (i += 1; i < text.length && nest > 0; i++) {
        if (text[i] === '\\') i += 1;
        else if (text[i] === '(') nest += 1;
        else if (text[i] === ')') nest -= 1;
      }
      i -= 1;
      continue;
    }
    if (text[i] === '<' && text[i + 1] === '<') {
      depth += 1;
      i += 1;
    } else if (text[i] === '>' && text[i + 1] === '>') {
      depth -= 1;
      i += 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('malformed PDF: unterminated dictionary');
}

/** Decode a PDF string token: `(literal)` with escapes, or `<hex>` (UTF-16BE with BOM). */
export function decodePdfString(token) {
  if (token.startsWith('<')) {
    const hex = token.slice(1, -1).replace(/\s+/g, '');
    const bytes = Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex');
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      const swapped = Buffer.alloc(bytes.length - 2);
      for (let i = 2; i + 1 < bytes.length; i += 2) {
        swapped[i - 2] = bytes[i + 1];
        swapped[i - 1] = bytes[i];
      }
      return swapped.toString('utf16le');
    }
    return bytes.toString('latin1');
  }
  const body = token.slice(1, -1);
  const out = body.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_m, esc) => {
    const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
    if (esc in map) return map[esc];
    if (/^[0-7]/.test(esc)) return String.fromCharCode(parseInt(esc, 8));
    return '';
  });
  if (out.charCodeAt(0) === 0xfe && out.charCodeAt(1) === 0xff) {
    return latin1ToUtf16be(out.slice(2));
  }
  return out;
}

function latin1ToUtf16be(text) {
  let s = '';
  for (let i = 0; i + 1 < text.length; i += 2) s += String.fromCharCode((text.charCodeAt(i) << 8) | text.charCodeAt(i + 1));
  return s;
}

/** Read the value token of `key` in a dictionary text (reference, string, name or number). */
export function dictValue(dict, key) {
  const at = dict.search(new RegExp(`/${key}(?![A-Za-z0-9])`));
  if (at === -1) return undefined;
  const rest = dict.slice(at + key.length + 1).replace(/^\s+/, '');
  const ref = rest.match(/^(\d+)\s+(\d+)\s+R/);
  if (ref) return { ref: Number(ref[1]) };
  if (rest.startsWith('(')) {
    let nest = 0;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '\\') i += 1;
      else if (rest[i] === '(') nest += 1;
      else if (rest[i] === ')' && --nest === 0) return { string: decodePdfString(rest.slice(0, i + 1)), raw: rest.slice(0, i + 1) };
    }
  }
  if (rest.startsWith('<<')) return { dict: readDictAt(rest, 0) };
  if (rest.startsWith('<')) {
    const end = rest.indexOf('>');
    return { string: decodePdfString(rest.slice(0, end + 1)), raw: rest.slice(0, end + 1) };
  }
  const word = rest.match(/^(\/[^\s/<>[\]()]+|-?\d+(?:\.\d+)?|true|false|null)/);
  return word ? { word: word[1] } : undefined;
}

/** A reader over one PDF buffer. */
export function openPdf(buf) {
  const text = latin1(buf);
  if (!text.startsWith('%PDF-')) throw new Error('not a PDF: no %PDF- header');
  const { offsets, trailer } = readXref(text);
  /** The dictionary of object `n` (the text after `n 0 obj`). */
  const object = (n) => {
    const at = offsets.get(n);
    if (at === undefined) throw new Error(`malformed PDF: object ${n} is not in the xref`);
    const header = text.slice(at, at + 32).match(/^(\d+)\s+(\d+)\s+obj\s*/);
    if (!header || Number(header[1]) !== n) throw new Error(`malformed PDF: object ${n} is not at its xref offset`);
    return readDictAt(text, at + header[0].length);
  };
  const resolve = (value) => (value?.ref !== undefined ? { dict: object(value.ref) } : value);
  return { text, offsets, trailer, object, resolve };
}

/**
 * What the gate needs to know about a PDF: page count, language, tagging, outline
 * (titles, nested) and document info.
 * @param {Buffer} buf
 */
export function inspectPdf(buf) {
  const pdf = openPdf(buf);
  const rootRef = dictValue(pdf.trailer, 'Root');
  if (rootRef?.ref === undefined) throw new Error('malformed PDF: trailer has no /Root');
  const catalog = pdf.object(rootRef.ref);
  const pagesRef = dictValue(catalog, 'Pages');
  const pagesDict = pagesRef ? pdf.resolve(pagesRef)?.dict : undefined;
  const pages = Number(pagesDict ? dictValue(pagesDict, 'Count')?.word : 0) || 0;
  const markInfo = pdf.resolve(dictValue(catalog, 'MarkInfo'));
  const outline = [];
  const outlinesRef = dictValue(catalog, 'Outlines');
  const walk = (firstRef, into, guard = new Set()) => {
    let ref = firstRef;
    while (ref?.ref !== undefined && !guard.has(ref.ref)) {
      guard.add(ref.ref);
      const item = pdf.object(ref.ref);
      const node = { title: dictValue(item, 'Title')?.string ?? '', children: [] };
      into.push(node);
      walk(dictValue(item, 'First'), node.children, guard);
      ref = dictValue(item, 'Next');
    }
  };
  if (outlinesRef?.ref !== undefined) walk(dictValue(pdf.object(outlinesRef.ref), 'First'), outline);
  const infoRef = dictValue(pdf.trailer, 'Info');
  const infoDict = infoRef?.ref !== undefined ? pdf.object(infoRef.ref) : '';
  /** @type {Record<string, string>} */
  const info = {};
  for (const key of ['Title', 'Producer', 'Creator', 'CreationDate', 'ModDate']) {
    const v = infoDict ? dictValue(infoDict, key) : undefined;
    if (v?.string !== undefined) info[key] = v.string;
  }
  return {
    pages,
    lang: dictValue(catalog, 'Lang')?.string,
    structTreeRoot: dictValue(catalog, 'StructTreeRoot') !== undefined,
    markInfo: markInfo?.dict !== undefined && /\/Marked\s+true/.test(markInfo.dict),
    outline,
    info,
  };
}

/** The outline items at `depth` (1 = top level), flattened in order. */
export function outlineAt(outline, depth) {
  if (depth <= 1) return outline;
  return outline.flatMap((node) => outlineAt(node.children, depth - 1));
}

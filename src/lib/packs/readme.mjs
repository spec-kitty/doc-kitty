/**
 * The pack document (`README.md` at the pack root, the charter's `pack-document`
 * shape, ADR-0079 D3): optional frontmatter, an optional H1 title, a preamble,
 * and the H2 sections in order. doc-kitty parses it with its own Markdown
 * pipeline (remark) and never validates it: an ambiguity the charter's codec
 * would refuse is reported as a warning, and the content is kept.
 *
 * The frontmatter block is split off here and parsed as YAML data only (never
 * through gray-matter, which caches by input and can evaluate `---js` blocks):
 * a pack is content from another repository.
 *
 * @module packs/readme
 */

import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

/**
 * @typedef {object} PackDocument
 * @property {Record<string, unknown>} [frontmatter]
 * @property {string} [title]
 * @property {string} preamble
 * @property {{ title: string, content: string }[]} sections
 * @property {{ code: string, message: string }[]} problems
 */

/** @param {any} node @returns {string} */
function plainText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return Array.isArray(node.children) ? node.children.map(plainText).join('') : '';
}

/** A frontmatter fence line: `---`, optionally followed by spaces or tabs. */
const FENCE = /^---[ \t]*$/;

/**
 * Split a frontmatter block off the text: `---` on the first line, up to the
 * next line that is `---`. One pass over the lines, no backtracking. Undefined
 * when the text has no closed block.
 *
 * @param {string} text LF-normalised
 * @returns {{ block: string, body: string } | undefined}
 */
function splitFrontmatter(text) {
  const firstEnd = text.indexOf('\n');
  if (firstEnd === -1 || !FENCE.test(text.slice(0, firstEnd))) return undefined;
  let lineStart = firstEnd + 1;
  while (lineStart <= text.length) {
    const end = text.indexOf('\n', lineStart);
    const lineEnd = end === -1 ? text.length : end;
    if (FENCE.test(text.slice(lineStart, lineEnd))) {
      return {
        block: text.slice(firstEnd + 1, Math.max(firstEnd + 1, lineStart - 1)),
        body: end === -1 ? '' : text.slice(end + 1),
      };
    }
    if (end === -1) return undefined;
    lineStart = end + 1;
  }
  return undefined;
}

/** Trim blank lines around a block, keeping its inner layout. @param {string} s */
const trimBlock = (s) => s.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');

/**
 * @param {string} source the README's text
 * @returns {PackDocument}
 */
export function parsePackDocument(source) {
  /** @type {{ code: string, message: string }[]} */
  const problems = [];
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  /** @type {Record<string, unknown> | undefined} */
  let frontmatter;
  let body = text;
  const block = splitFrontmatter(text);
  if (block) {
    body = block.body;
    try {
      // Data only: known tags (`!!binary`, `!!set`, …) are not resolved to objects.
      const data = parseYaml(block.block, { resolveKnownTags: false, logLevel: 'error' });
      if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        if (Object.keys(data).length > 0) frontmatter = data;
      } else if (data !== null && data !== undefined) {
        problems.push({ code: 'readme-frontmatter', message: 'README frontmatter is not a mapping; it is ignored' });
      }
    } catch (error) {
      problems.push({
        code: 'readme-frontmatter',
        message: `README frontmatter does not parse: ${/** @type {Error} */ (error).message.split('\n')[0]}`,
      });
    }
  }
  const tree = /** @type {any} */ (unified().use(remarkParse).parse(body));
  const children = /** @type {any[]} */ (tree.children);
  /** @type {string | undefined} */
  let title;
  let cursor = 0;
  let startIndex = 0;
  if (children[0]?.type === 'heading' && children[0].depth === 1) {
    title = plainText(children[0]).trim() || undefined;
    cursor = children[0].position.end.offset;
    startIndex = 1;
  }
  /** @type {{ title: string, start: number, end: number }[]} */
  const heads = [];
  for (let i = startIndex; i < children.length; i++) {
    const node = children[i];
    if (node.type !== 'heading') continue;
    if (node.depth === 2) heads.push({ title: plainText(node).trim(), start: node.position.start.offset, end: node.position.end.offset });
    else if (node.depth === 1) {
      problems.push({
        code: 'readme-ambiguous-heading',
        message: `README has a level-1 heading "${plainText(node).trim()}" after its start; it is kept as content`,
      });
    }
  }
  const preamble = trimBlock(body.slice(cursor, heads[0]?.start ?? body.length));
  const sections = heads.map((h, i) => ({
    title: h.title,
    content: trimBlock(body.slice(h.end, heads[i + 1]?.start ?? body.length)),
  }));
  return {
    ...(frontmatter ? { frontmatter } : {}),
    ...(title !== undefined ? { title } : {}),
    preamble,
    sections,
    problems,
  };
}

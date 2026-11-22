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

/** A frontmatter block: `---` on the first line, up to the next line that is `---`. */
const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/;

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
  const block = FRONTMATTER.exec(text);
  if (block) {
    body = text.slice(block[0].length);
    try {
      const data = parseYaml(block[1]);
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

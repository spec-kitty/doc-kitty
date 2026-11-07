// @ts-check
/**
 * The sidebar icon resolver (page-chrome WP07; FR-026, FR-027, C-003).
 *
 * Plain ESM with JSDoc types, like `vocabulary-core.mjs`, because the bare-Node
 * `validate-frontmatter.mjs` gate and the build must resolve a name the same way.
 *
 * A name is `fa-<name>` for Font Awesome's solid set, or bare for a Starlight
 * built-in. Each data file is read the first time a name needs it, so a site that
 * authors no `fa-` name never reads the 900 KB Font Awesome file.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const FA_PREFIX = 'fa-';
/** The viewBox of every Starlight built-in (`<Icon>` in Starlight 0.42.6). */
const BUILTIN_BOX = { left: 0, top: 0, width: 24, height: 24 };

/** @typedef {{ svg: string, source: 'fa' | 'starlight' }} ResolvedIcon */
/** @typedef {{ body: string, left?: number, top?: number, width?: number, height?: number }} IconifyIcon */

/** @param {string} file */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** @type {{ left?: number, top?: number, width?: number, height?: number, icons: Record<string, IconifyIcon> } | undefined} */
let fontAwesome;
/** @type {Record<string, string> | undefined} */
let builtIns;

function fontAwesomeIcons() {
  return (fontAwesome ??= readJson(createRequire(import.meta.url).resolve('@iconify-json/fa6-solid/icons.json')));
}

function starlightIcons() {
  builtIns ??= /** @type {{ icons: Record<string, string> }} */ (
    readJson(fileURLToPath(new URL('./sidebar-icons-builtin.json', import.meta.url)))
  ).icons;
  return builtIns;
}

/**
 * An inline SVG that follows the text's colour and size. Font Awesome's viewBoxes
 * vary, so the width in `em` keeps each icon's own proportions.
 *
 * @param {string} body
 * @param {{ left: number, top: number, width: number, height: number }} box
 */
function inlineSvg(body, { left, top, width, height }) {
  const widthEm = Number((width / height).toFixed(4));
  return `<svg aria-hidden="true" focusable="false" fill="currentColor" width="${widthEm}em" height="1em" viewBox="${left} ${top} ${width} ${height}">${body}</svg>`;
}

/**
 * Resolve an authored icon name, or `undefined` when no such icon exists.
 *
 * @param {unknown} name
 * @returns {ResolvedIcon | undefined}
 */
export function resolveIcon(name) {
  if (typeof name !== 'string') return undefined;
  if (name.startsWith(FA_PREFIX)) {
    const set = fontAwesomeIcons();
    const key = name.slice(FA_PREFIX.length);
    if (!Object.hasOwn(set.icons, key)) return undefined;
    const icon = set.icons[key];
    return {
      source: 'fa',
      svg: inlineSvg(icon.body, {
        left: icon.left ?? set.left ?? 0,
        top: icon.top ?? set.top ?? 0,
        width: icon.width ?? set.width ?? 16,
        height: icon.height ?? set.height ?? 16,
      }),
    };
  }
  const set = starlightIcons();
  return Object.hasOwn(set, name) ? { source: 'starlight', svg: inlineSvg(set[name], BUILTIN_BOX) } : undefined;
}

/**
 * The one message for an unknown name (FR-027), from the build and the gate alike.
 *
 * @param {string} where a docs-relative file, or `section "<id>"`
 * @param {unknown} name
 */
export function unknownIconMessage(where, name) {
  return `[dk-sidebar-icons] ${where}: unknown icon "${String(name)}"`;
}

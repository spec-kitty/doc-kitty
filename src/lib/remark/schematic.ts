/**
 * `schematic` — the remark plugin behind `kind: Schematic` pages (ADR-0067). The page
 * is authored Markdown with `schematic_path: <file>` in its frontmatter; at build time
 * this plugin reads that JSON Schema file and ADDS generated parts around the body:
 *
 *   1. before the body: the schema `description` as a lead paragraph;
 *   2. after the body, in order: `## Diagram` (PlantUML `@startjson`, only when the
 *      diagram pipeline renders it), `## Properties` (with one `###` per `$ref`'d
 *      object type), `## Source` (link to the published file).
 *
 * An authored `##` heading with the same text suppresses that generated section: the
 * author's text wins. The schema stays the single source of truth: nothing generated
 * is committed.
 *
 * Scope guard (the `deck-split` pattern): the transform returns at once unless
 * `file.data.astro.frontmatter.kind === 'Schematic'`, so every other page is untouched
 * and a site without a Schematic page pays nothing.
 */
import path from 'node:path';
import { readmeToIndexId, routeOfSlug } from '../vocabulary-core.mjs';
import type { IndexBasenameOption } from '../metadata.js';
import {
  GENERATED_HEADINGS,
  SCHEMATIC_KIND,
  buildModel,
  diagramSource,
  loadSchematic,
  schematicHref,
  type Property,
  type Segment,
} from '../schematic/core.mjs';

export interface SchematicOptions {
  /** Absolute docs root, to name the page and compute its route. */
  docsRoot: string;
  /** Absolute project root, the base of `schematic_path`. */
  root: string;
  indexBasename?: IndexBasenameOption;
  /** Add `## Diagram` (the build-mode PlantUML pipeline renders the fence). */
  diagram: boolean;
}

interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  [key: string]: unknown;
}

interface SchematicFile {
  path?: string;
  data?: { astro?: { frontmatter?: Record<string, unknown> } };
}

const text = (value: string): MdNode => ({ type: 'text', value });
const para = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children });
const heading = (depth: number, value: string): MdNode => ({ type: 'heading', depth, children: [text(value)] });

/** Plain text of a node, for matching authored headings. */
function plain(node: MdNode): string {
  return node.value ?? (node.children ?? []).map(plain).join('');
}

function segment(seg: Segment): MdNode {
  if (typeof seg === 'string') return text(seg);
  if ('def' in seg) return { type: 'link', url: `#${seg.def}`, children: [text(seg.label)] };
  return { type: 'link', url: seg.href, children: [text(seg.href)] };
}

function item(prop: Property): MdNode {
  const flags = prop.required ? ', required' : '';
  const children = [
    { type: 'inlineCode', value: prop.name },
    text(' ('),
    ...prop.type.map(segment),
    text(`${flags})${prop.description ? ': ' + prop.description : ''}`),
  ];
  const nested = prop.children.length > 0 ? [list(prop.children)] : [];
  return { type: 'listItem', spread: false, children: [para(...children), ...nested] };
}

const list = (props: Property[]): MdNode => ({ type: 'list', ordered: false, spread: false, children: props.map(item) });

export default function schematic(options: SchematicOptions) {
  return function transformer(tree: MdNode, file: SchematicFile): void {
    const frontmatter = file.data?.astro?.frontmatter;
    if (!frontmatter || frontmatter.kind !== SCHEMATIC_KIND) return;

    const rel = path.relative(options.docsRoot, file.path ?? '').split(path.sep).join('/');
    if (rel === '' || rel.startsWith('..')) {
      throw new Error(`[dk-schematic] ${file.path}: a Schematic page must be inside the docs root`);
    }
    const loaded = loadSchematic(rel, frontmatter.schematic_path, options.root);
    const model = buildModel(loaded);
    const title = model.title || String(frontmatter.title ?? rel);
    const route = routeOfSlug(readmeToIndexId(rel, { indexBasename: options.indexBasename }));

    const body = tree.children ?? [];
    const authored = new Set(
      body.filter((n) => n.type === 'heading' && n.depth === 2).map((n) => plain(n).trim().toLowerCase()),
    );
    const wants = (name: (typeof GENERATED_HEADINGS)[number]) => !authored.has(name.toLowerCase());

    const lead = model.description ? [para(text(model.description))] : [];
    const tail: MdNode[] = [];
    if (options.diagram && wants('Diagram')) {
      tail.push(heading(2, 'Diagram'), { type: 'code', lang: 'plantuml', meta: null, value: diagramSource(loaded, title) });
    }
    if (model.properties.length > 0 && wants('Properties')) {
      tail.push(heading(2, 'Properties'), list(model.properties));
      for (const def of model.defs) {
        tail.push(heading(3, def.label));
        if (def.description) tail.push(para(text(def.description)));
        tail.push(list(def.properties));
      }
    }
    if (wants('Source')) {
      const href = schematicHref(route, String(frontmatter.schematic_path));
      tail.push(heading(2, 'Source'), para(text('Schema file: '), { type: 'link', url: href, children: [text(loaded.rel)] }));
    }
    tree.children = [...lead, ...body, ...tail];
  };
}

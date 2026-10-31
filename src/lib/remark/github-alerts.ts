/**
 * `githubAlerts` — renders GitHub alert blockquotes as Starlight asides (#250,
 * ADR-0068).
 *
 * ```md
 * > [!WARNING]
 * > Text.
 * ```
 *
 * A TOP-LEVEL blockquote whose first line is exactly one of GitHub's five
 * markers is rewritten in place into the `containerDirective` that Starlight's
 * own `remarkAsides` turns into a native aside — the same path the Markua mapped
 * callouts ride (`markua-callouts.ts`), so the alert is themed, titled and
 * labelled exactly like `:::note`. The type → variant table lives in
 * `github-alerts.internal.ts`. When the Starlight label differs from GitHub's
 * (IMPORTANT, WARNING, CAUTION), the GitHub label is passed as the directive
 * label, which `remarkAsides` uses as the aside title and `aria-label`.
 *
 * Left untouched, so they render as the blockquote they are:
 *   - a plain blockquote, an unknown `[!X]` marker, and a marker with text after
 *     it on the same line (none of these is an alert on GitHub);
 *   - an alert with no body (nothing to put in the aside);
 *   - a blockquote nested in a list or another container (GitHub renders alerts
 *     only at the top level);
 *   - every blockquote on a `kind: Presentation` page: `DeckLayout.astro` links
 *     no Starlight aside CSS, so a native aside would render unstyled there.
 *
 * Fallback: the directive carries `data.hName: 'blockquote'`. `remarkAsides`
 * replaces the whole node, so this is ignored on a docs page; on a Markdown file
 * Starlight does not process, `mdast-util-to-hast` renders the body as a
 * blockquote (minus the marker) rather than as an unknown `<div>`.
 *
 * Registered only when `defineDocKittyIntegrations({ githubAlerts: true })`, and
 * before Starlight, so its directives exist when `remarkAsides` visits. Hand-rolled
 * walk, no new dependency, build-time only.
 */
import { ALERT_TO_ASIDE, parseAlertMarker } from './github-alerts.internal.js';
import { isPresentationFile } from '../deck/is-presentation.js';
import type { MdastLike } from './markua-callouts.internal.js';

/** The subset of the remark VFile this plugin reads (deck detection). */
interface GithubAlertsVFile {
  data?: { astro?: { frontmatter?: { kind?: unknown } } };
}

/**
 * The body of `blockquote` with its leading marker removed, plus the alert type;
 * `undefined` when the blockquote is not an alert. Pure: the input is not changed.
 */
function stripMarker(blockquote: MdastLike): { type: keyof typeof ALERT_TO_ASIDE; body: MdastLike[] } | undefined {
  const [first, ...restBlocks] = blockquote.children ?? [];
  if (first?.type !== 'paragraph') return undefined;
  const [lead, ...inlines] = first.children ?? [];
  if (lead?.type !== 'text' || typeof lead.value !== 'string') return undefined;
  const marker = parseAlertMarker(lead.value);
  if (!marker) return undefined;

  const kept: MdastLike[] = [];
  if (marker.rest.length > 0) {
    kept.push({ ...lead, value: marker.rest, position: undefined });
  } else if (inlines[0]?.type === 'break') {
    // `[!NOTE]` + two trailing spaces parses as text + hard break.
    inlines.shift();
  }
  kept.push(...inlines);

  const body = kept.length > 0 ? [{ ...first, children: kept }, ...restBlocks] : restBlocks;
  if (body.length === 0) return undefined;
  return { type: marker.type, body };
}

/** Remark plugin factory (a unified `Plugin<[], Root>`). */
export default function githubAlerts() {
  return function transformer(tree: MdastLike, file?: GithubAlertsVFile): void {
    if (isPresentationFile(file)) return;
    const children = tree.children;
    if (!Array.isArray(children)) return;

    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];
      if (node.type !== 'blockquote') continue;
      const alert = stripMarker(node);
      if (!alert) continue;

      const { variant, title } = ALERT_TO_ASIDE[alert.type];
      const label: MdastLike[] =
        title === undefined
          ? []
          : [{ type: 'paragraph', data: { directiveLabel: true }, children: [{ type: 'text', value: title }] }];
      children[i] = {
        type: 'containerDirective',
        name: variant,
        attributes: {},
        data: { hName: 'blockquote' },
        children: [...label, ...alert.body],
        position: node.position,
      };
    }
  };
}

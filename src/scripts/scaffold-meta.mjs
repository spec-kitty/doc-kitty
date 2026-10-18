/**
 * The OKF metadata every scaffolded page starts with (#177, FR-003): a UTC
 * `updated` instant, a `human:` placeholder author and a versioned generator
 * stamp. Shared by `scaffold.mjs` and `new-doc.mjs`, which both write pages.
 *
 * @module scaffold-meta
 */
import { toolkitVersion } from '../lib/generator-stamp.mjs';
import { formatInstant } from '../lib/vocabulary-core.mjs';

/**
 * The frontmatter lines shared by every scaffolded page: `updated`, `authors`
 * (a `human:` placeholder the author replaces) and the `generated` stamp. The
 * stamp has no `content_hash`: the page is a template its author rewrites.
 *
 * @param {Date} [now] injectable clock
 * @returns {string} lines without a trailing newline
 */
export function scaffoldMeta(now = new Date()) {
  const instant = formatInstant(now);
  return [
    `updated: ${instant}`,
    'authors:',
    '  - human:TODO-your-id',
    'generated:',
    `  by: doc-kitty-scaffold/${toolkitVersion()}`,
    `  at: ${instant}`,
  ].join('\n');
}

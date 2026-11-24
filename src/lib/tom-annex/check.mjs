// @ts-check
/**
 * The ADR-0087 D3 verdicts for the evidence index's opt-in committed files
 * (#401, WP07): the snapshot (`--snapshot`) and the hub page (`--hub`),
 * compared with the build. Pure: the CLI reads the files.
 *
 * Precedence, first match wins: `missing`, `unowned`, `hand-edited`,
 * `stale-source`, `stale-render`, else `ok`. `orphan` cannot occur, because the
 * paths are named explicitly. A hand edit ranks above the staleness verdicts
 * because it is the most actionable: regenerating would silently discard it.
 *
 * - `unowned`: the path holds something not stamped by `doc-kitty-tom-annex`
 *   (an authored file, or a deleted or mistyped stamp).
 * - `hand-edited`: the file's body no longer matches its own `content_hash`;
 *   for the snapshot, also a `generated.at` that its own evidence does not
 *   give, since `at` is masked in the byte comparison below.
 * - `stale-source`: its `source_digest` differs from the build's.
 * - `stale-render`: the digests agree, but the bytes differ from what the build
 *   gives once `generated.at` is masked (ADR-0087 D5). This also catches a
 *   formatting-only edit, which `content_hash` (over the re-serialised index,
 *   D2) cannot.
 *
 * @module tom-annex/check
 */

import matter from 'gray-matter';
import { isProducerOwnedPage } from '../producer-output.mjs';
import { isGeneratedStamp } from '../generator-stamp.mjs';
import { serializeTomAnnex, TOM_ANNEX_FORMAT } from './core.mjs';
import { pageContentHash, renderHubPage } from './hub-page.mjs';
import { annexInstant, contentHash, TOM_ANNEX_PRODUCER } from './stamp.mjs';

/** @typedef {'ok' | 'missing' | 'unowned' | 'hand-edited' | 'stale-source' | 'stale-render'} Verdict */

/** @param {string} text @returns {any} the parsed JSON, or undefined */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Is `text` an evidence index stamped by this producer?
 *
 * @param {any} annex
 */
export function isOwnedSnapshot(annex) {
  return annex?.format === TOM_ANNEX_FORMAT && isGeneratedStamp(annex?.generated?.by, TOM_ANNEX_PRODUCER);
}

/**
 * @param {{ committedText: string | undefined, builtText: string }} args
 * @returns {Verdict}
 */
export function checkSnapshot({ committedText, builtText }) {
  if (committedText === undefined) return 'missing';
  const committed = parseJson(committedText);
  if (!isOwnedSnapshot(committed)) return 'unowned';
  let ownHash;
  let ownAt;
  try {
    ownHash = contentHash(committed);
    ownAt = annexInstant(committed);
  } catch {
    // A body that cannot be re-serialised was edited into another shape.
    return 'hand-edited';
  }
  if (committed.generated.content_hash !== ownHash || committed.generated.at !== ownAt) return 'hand-edited';
  const built = JSON.parse(builtText);
  if (committed.generated.source_digest !== built.generated.source_digest) return 'stale-source';
  const expected = serializeTomAnnex({ ...built, generated: { ...built.generated, at: committed.generated.at } });
  return committedText === expected ? 'ok' : 'stale-render';
}

/**
 * @param {{ committedText: string | undefined, builtAnnex: any }} args
 * @returns {Verdict}
 */
export function checkHub({ committedText, builtAnnex }) {
  if (committedText === undefined) return 'missing';
  if (!isProducerOwnedPage(committedText, TOM_ANNEX_PRODUCER)) return 'unowned';
  const stamp = matter(committedText).data.generated;
  if (pageContentHash(committedText) !== stamp.content_hash) return 'hand-edited';
  if (stamp.source_digest !== builtAnnex.generated.source_digest) return 'stale-source';
  // Mask `at`: render the build's index with the committed page's `at` (which also drives `updated`).
  const at = stamp.at instanceof Date ? stamp.at.toISOString().replace(/\.\d{3}Z$/, 'Z') : stamp.at;
  const expected = renderHubPage({ ...builtAnnex, generated: { ...builtAnnex.generated, at } });
  return committedText === expected ? 'ok' : 'stale-render';
}

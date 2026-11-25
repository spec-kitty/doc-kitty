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
 * `by` carries over (operator ruling on #455, the rule `makeStamp` applies
 * since #454, through the shared `keepsBy`): while a file's `content_hash` is
 * unchanged, it keeps the `by` of the stamp already committed, so a toolkit
 * upgrade alone changes nothing. A `by` whose version is not SemVer 2.0.0, such as a
 * hand edit, is not kept, so it reads as `stale-render`.
 * {@link snapshotToWrite} and {@link hubToWrite} apply the rule for writing,
 * and the checks compare against the same result.
 *
 * @module tom-annex/check
 */

import matter from 'gray-matter';
import { isProducerOwnedPage } from '../producer-output.mjs';
import { isGeneratedStamp, keepsBy } from '../generator-stamp.mjs';
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
 * The committed `by` when the committed file has the same `content_hash` and
 * its `by` is one {@link keepsBy} keeps (this producer's, a SemVer version), else
 * the built one. A hand-edited `by` is therefore not carried over.
 *
 * @param {any} committedStamp
 * @param {string} contentHash the new content hash
 * @param {string} builtBy
 */
function carriedBy(committedStamp, contentHash, builtBy) {
  return committedStamp?.content_hash === contentHash && keepsBy(committedStamp?.by, TOM_ANNEX_PRODUCER)
    ? committedStamp.by
    : builtBy;
}

/**
 * The snapshot to write: the built index, with the committed `by` carried over
 * while the content is unchanged.
 *
 * @param {string} builtText
 * @param {string | undefined} committedText
 * @returns {string}
 */
export function snapshotToWrite(builtText, committedText) {
  const built = JSON.parse(builtText);
  const committed = committedText === undefined ? undefined : parseJson(committedText);
  const by = carriedBy(isOwnedSnapshot(committed) ? committed.generated : undefined, built.generated.content_hash, built.generated.by);
  return by === built.generated.by ? builtText : serializeTomAnnex({ ...built, generated: { ...built.generated, by } });
}

/**
 * The hub page to write: rendered from the built index, with the committed
 * `by` carried over while the page content is unchanged.
 *
 * @param {any} builtAnnex
 * @param {string | undefined} committedText
 * @returns {string}
 */
export function hubToWrite(builtAnnex, committedText) {
  const rendered = renderHubPage(builtAnnex);
  const stamp = ownedHubStamp(committedText);
  const by = carriedBy(stamp, pageContentHash(rendered), builtAnnex.generated.by);
  return by === builtAnnex.generated.by ? rendered : renderHubPage({ ...builtAnnex, generated: { ...builtAnnex.generated, by } });
}

/** @param {string | undefined} text @returns {any} the hub page's stamp, when this producer wrote it */
function ownedHubStamp(text) {
  if (text === undefined || !isProducerOwnedPage(text, TOM_ANNEX_PRODUCER)) return undefined;
  return matter(text).data.generated;
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
  // Mask `at`; carry `by` over while the content is unchanged (the same rule as writing).
  const by = carriedBy(committed.generated, built.generated.content_hash, built.generated.by);
  const expected = serializeTomAnnex({ ...built, generated: { ...built.generated, at: committed.generated.at, by } });
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
  const masked = { ...builtAnnex, generated: { ...builtAnnex.generated, at } };
  // Carry `by` over while the page content is unchanged (the same rule as writing).
  const by = carriedBy(stamp, pageContentHash(renderHubPage(masked)), builtAnnex.generated.by);
  const expected = renderHubPage({ ...masked, generated: { ...masked.generated, by } });
  return committedText === expected ? 'ok' : 'stale-render';
}

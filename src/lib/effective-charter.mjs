/**
 * Effective-charter projection (documentation-charter WP02, IC-04/FR-015).
 *
 * A small, read-only projection of the resolved governance in force for a docs
 * root — the "derived-but-committed catalog" analogue that lets an adopter VERIFY
 * what governance actually applies (which terms are forbidden/aliased, which
 * statuses are legal, which fields are required, which section registry wins).
 *
 * It is a PURE PROJECTION of {@link resolveGovernance} — no new engine, no config
 * UI, no filesystem logic of its own (all fs stays in `vocabulary-loader.mjs`).
 * The projection is intentionally SIDE-EFFECT-FREE: it asks `resolveGovernance`
 * NOT to emit the legacy-deprecation notice, so inspecting the effective charter
 * never trips a build-time warning (the enforcement path owns that notice).
 *
 * @module effective-charter
 */

import { resolveGovernance } from './vocabulary-loader.mjs';

/**
 * The serializable effective charter — the resolved axes plus provenance. Every
 * field is plain data (no resolver functions), so it round-trips through
 * `JSON.stringify` and can be written to disk / printed for verification.
 *
 * @typedef {object} EffectiveCharter
 * @property {{ aliases: Record<string, string>, forbidden: string[] }} types The
 *   effective `type` axis definition (winning source).
 * @property {{ aliases: Record<string, string>, forbidden: string[] }} kinds The
 *   effective `kind` axis definition (winning source).
 * @property {string[]} statuses The legal `doc_status` set (canonical ∪ added).
 * @property {Record<string, unknown> | import('./vocabulary-loader.mjs').SectionRegistry | null} sections
 *   The winning section registry (charter mapping, legacy array, or `null`).
 * @property {{ required: string[], floor: string[] }} requiredFields The
 *   effective required-field policy (`floor` is always `['title']`).
 * @property {{ fromCharter: boolean, legacyPresent: boolean }} sourceMeta
 *   Provenance — whether a non-empty charter drove resolution, and whether any
 *   legacy file is still present.
 */

/**
 * Compute the effective (resolved) charter for a docs root — a faithful,
 * serializable projection of {@link resolveGovernance}. Same per-axis precedence
 * and defaults, but every axis rendered as inspectable data.
 *
 * @param {string} docsRoot
 * @returns {EffectiveCharter}
 */
export function computeEffectiveCharter(docsRoot) {
  const governance = resolveGovernance(docsRoot, { emitDeprecation: false });
  return {
    types: {
      aliases: { ...governance.vocabulary.types.aliases },
      forbidden: [...governance.vocabulary.types.forbidden],
    },
    kinds: {
      aliases: { ...governance.vocabulary.kinds.aliases },
      forbidden: [...governance.vocabulary.kinds.forbidden],
    },
    statuses: [...governance.legalStatuses],
    sections: governance.sections,
    requiredFields: {
      required: [...governance.requiredFields.required],
      floor: [...governance.requiredFields.floor],
    },
    sourceMeta: {
      fromCharter: governance.sourceMeta.fromCharter,
      legacyPresent: governance.sourceMeta.legacyPresent,
    },
  };
}

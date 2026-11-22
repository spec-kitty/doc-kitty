// @ts-check
/**
 * Default measures catalog (ADR-0080). Not legal advice.
 *
 * Each label is a short identifier for one example heading of the technical and
 * organisational measures in Decision (EU) 2021/914, Annex II. Headings 1 to 4
 * restate GDPR Article 32(1)(a) to (d), so those records carry that reference
 * too. The `dpv` IRI names the nearest W3C Data Privacy Vocabulary (DPV 2.3)
 * concept. It is a pointer for linked-data tools, not a legal equivalence.
 *
 * A consumer `docs/_meta/measures.yaml` replaces this list wholesale; there is no
 * merge. Copy the records you still want into your own file.
 *
 * A data module, not a YAML file: the content-graph and agent-page routes are
 * bundled by Vite, where a file read relative to `import.meta.url` no longer
 * finds a sibling file. A static import travels with the bundle and loads
 * the same in bare Node (the `validate-catalog.mjs` gate).
 *
 * @module measures-default
 */

/**
 * Freeze a record list and everything in it, so no caller can change a shared
 * default record or its framework references.
 *
 * @template T
 * @param {T[]} records
 * @returns {ReadonlyArray<T>}
 */
function freezeRecords(records) {
  for (const record of records) {
    const r = /** @type {{ frameworks?: object[] }} */ (record);
    for (const ref of r.frameworks ?? []) Object.freeze(ref);
    if (r.frameworks) Object.freeze(r.frameworks);
    Object.freeze(record);
  }
  return Object.freeze(records);
}

const SCC = 'eu-scc-2021-914-annex-ii';
const DPV = 'https://w3id.org/dpv#';

/**
 * One row per Annex II heading, in heading order: id, label, nature, DPV term,
 * and, for headings 1 to 4, the GDPR Article 32(1) reference they restate.
 *
 * @type {ReadonlyArray<[string, string, import('./measures-core.mjs').MeasureNature, string, string?]>}
 */
const HEADINGS = [
  ['pseudonymisation-encryption', 'Pseudonymisation and encryption', 'technical', 'Encryption', 'Art. 32(1)(a)'],
  ['confidentiality-integrity-availability-resilience', 'Confidentiality, integrity, availability and resilience of systems and services', 'technical', 'SecurityMethod', 'Art. 32(1)(b)'],
  ['availability-restoration', 'Restoring availability and access after an incident', 'technical', 'DataBackupProtocols', 'Art. 32(1)(c)'],
  ['testing-evaluation', 'Regular testing, assessing and evaluating of the measures', 'organisational', 'SecurityAssessment', 'Art. 32(1)(d)'],
  ['user-identification-authorisation', 'User identification and authorisation', 'technical', 'AccessControlMethod'],
  ['transmission-protection', 'Protection of data during transmission', 'technical', 'EncryptionInTransfer'],
  ['storage-protection', 'Protection of data during storage', 'technical', 'EncryptionAtRest'],
  ['physical-security', 'Physical security of processing locations', 'physical', 'PhysicalAccessControlMethod'],
  ['events-logging', 'Events logging', 'technical', 'ActivityMonitoring'],
  ['system-configuration', 'System configuration, including default configuration', 'technical', 'PrivacyByDefault'],
  ['it-security-governance', 'Internal IT and IT security governance and management', 'organisational', 'InformationSecurityPolicy'],
  ['certification-assurance', 'Certification and assurance of processes and products', 'organisational', 'Certification'],
  ['data-minimisation', 'Data minimisation', 'organisational', 'PrivacyByDesign'],
  ['data-quality', 'Data quality', 'organisational', 'DataQualityManagement'],
  ['limited-retention', 'Limited data retention', 'organisational', 'DataStoragePolicy'],
  ['accountability', 'Accountability', 'organisational', 'ComplianceMonitoring'],
  ['portability-erasure', 'Data portability and erasure', 'organisational', 'DataErasurePolicy'],
];

/** @type {ReadonlyArray<import('./measures-core.mjs').MeasureRecord>} */
export const DEFAULT_MEASURES = freezeRecords(
  HEADINGS.map(([id, label, nature, term, gdpr], index) => ({
    id,
    label,
    nature,
    frameworks: [
      { framework: SCC, ref: String(index + 1) },
      ...(gdpr ? [{ framework: 'eu-gdpr', ref: gdpr }] : []),
    ],
    dpv: `${DPV}${term}`,
  })),
);

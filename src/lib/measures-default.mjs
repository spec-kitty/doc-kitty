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

/** @type {ReadonlyArray<import('./measures-core.mjs').MeasureRecord>} */
export const DEFAULT_MEASURES = Object.freeze([
  {
    id: 'pseudonymisation-encryption',
    label: 'Pseudonymisation and encryption',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '1' },
      { framework: 'eu-gdpr', ref: 'Art. 32(1)(a)' },
    ],
    dpv: 'https://w3id.org/dpv#Encryption',
  },
  {
    id: 'confidentiality-integrity-availability-resilience',
    label: 'Confidentiality, integrity, availability and resilience of systems and services',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '2' },
      { framework: 'eu-gdpr', ref: 'Art. 32(1)(b)' },
    ],
    dpv: 'https://w3id.org/dpv#SecurityMethod',
  },
  {
    id: 'availability-restoration',
    label: 'Restoring availability and access after an incident',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '3' },
      { framework: 'eu-gdpr', ref: 'Art. 32(1)(c)' },
    ],
    dpv: 'https://w3id.org/dpv#DataBackupProtocols',
  },
  {
    id: 'testing-evaluation',
    label: 'Regular testing, assessing and evaluating of the measures',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '4' },
      { framework: 'eu-gdpr', ref: 'Art. 32(1)(d)' },
    ],
    dpv: 'https://w3id.org/dpv#SecurityAssessment',
  },
  {
    id: 'user-identification-authorisation',
    label: 'User identification and authorisation',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '5' },
    ],
    dpv: 'https://w3id.org/dpv#AccessControlMethod',
  },
  {
    id: 'transmission-protection',
    label: 'Protection of data during transmission',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '6' },
    ],
    dpv: 'https://w3id.org/dpv#EncryptionInTransfer',
  },
  {
    id: 'storage-protection',
    label: 'Protection of data during storage',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '7' },
    ],
    dpv: 'https://w3id.org/dpv#EncryptionAtRest',
  },
  {
    id: 'physical-security',
    label: 'Physical security of processing locations',
    nature: 'physical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '8' },
    ],
    dpv: 'https://w3id.org/dpv#PhysicalAccessControlMethod',
  },
  {
    id: 'events-logging',
    label: 'Events logging',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '9' },
    ],
    dpv: 'https://w3id.org/dpv#ActivityMonitoring',
  },
  {
    id: 'system-configuration',
    label: 'System configuration, including default configuration',
    nature: 'technical',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '10' },
    ],
    dpv: 'https://w3id.org/dpv#PrivacyByDefault',
  },
  {
    id: 'it-security-governance',
    label: 'Internal IT and IT security governance and management',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '11' },
    ],
    dpv: 'https://w3id.org/dpv#InformationSecurityPolicy',
  },
  {
    id: 'certification-assurance',
    label: 'Certification and assurance of processes and products',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '12' },
    ],
    dpv: 'https://w3id.org/dpv#Certification',
  },
  {
    id: 'data-minimisation',
    label: 'Data minimisation',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '13' },
    ],
    dpv: 'https://w3id.org/dpv#PrivacyByDesign',
  },
  {
    id: 'data-quality',
    label: 'Data quality',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '14' },
    ],
    dpv: 'https://w3id.org/dpv#DataQualityManagement',
  },
  {
    id: 'limited-retention',
    label: 'Limited data retention',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '15' },
    ],
    dpv: 'https://w3id.org/dpv#DataStoragePolicy',
  },
  {
    id: 'accountability',
    label: 'Accountability',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '16' },
    ],
    dpv: 'https://w3id.org/dpv#ComplianceMonitoring',
  },
  {
    id: 'portability-erasure',
    label: 'Data portability and erasure',
    nature: 'organisational',
    frameworks: [
      { framework: 'eu-scc-2021-914-annex-ii', ref: '17' },
    ],
    dpv: 'https://w3id.org/dpv#DataErasurePolicy',
  },
]);

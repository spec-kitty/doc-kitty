// @ts-check
/**
 * Operating-model templates (#402). Each template is a record here plus a
 * Markdown body under `./templates/operating-model/`. The body holds structure
 * and prompts only: headings and HTML-comment prompts, never policy or legal
 * wording (charter scope: the toolkit does not author content). Not legal advice.
 *
 * Every template presets its `tom_classification` (ADR-0080) at organisation
 * scope. The Role template uses the `Role` kind (ADR-0085). The two runbook
 * templates are How-To pages under `operations/runbooks/`, so their `type`
 * `Runbook` is derived from the path; `Runbook` is not a kind.
 *
 * Bare-Node module: the stub tools (`new-doc.mjs`, `scaffold.mjs`) import it and
 * read the bodies relative to `import.meta.url`, so it works from the installed
 * package.
 *
 * @module operating-model-templates
 */
import { readFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { expectedDocType } from './vocabulary-core.mjs';
import { loadSectionRegistry, sectionSubtypes, sectionTypes } from './vocabulary-loader.mjs';
import { scaffoldMeta } from '../scripts/scaffold-meta.mjs';

/**
 * @typedef {object} OperatingModelTemplate
 * @property {string} id Stable kebab-case id, used by `--template <id>`.
 * @property {string} title Default page title.
 * @property {string} kind A canonical kind.
 * @property {string} path Default page path under the docs root, without `.md`.
 * @property {string} defaultType The `type` when the path derives none.
 * @property {readonly string[]} measures Preset measure ids (default catalog).
 * @property {string} body Body file name under `templates/operating-model/`.
 */

/** @param {OperatingModelTemplate} record */
const freezeRecord = (record) => Object.freeze({ ...record, measures: Object.freeze([...record.measures]) });

/**
 * The starter set, one row per template:
 * `[id, title, kind, path, defaultType, measures]`. Each body file is named
 * after its id (`templates/operating-model/<id>.md`).
 *
 * @type {readonly [string, string, string, string, string, string[]][]}
 */
const STARTER_SET = [
  ['organisation', 'Organisation and teams', 'Explanation', 'operating-model/organisation', 'Operations', ['it-security-governance']],
  ['role', 'Accountable role', 'Role', 'operating-model/roles/accountable-role', 'Operations', ['accountability']],
  ['governance-forums', 'Governance forums and decision rights', 'Reference', 'operating-model/governance-forums', 'Operations', ['it-security-governance', 'accountability']],
  ['policy-index', 'Policy index', 'Hub', 'operating-model/policy-index', 'Operations', ['it-security-governance']],
  ['access-management', 'Access management', 'How-To', 'operating-model/access-management', 'Operations', ['user-identification-authorisation']],
  ['change-management', 'Change and release management', 'How-To', 'operating-model/change-management', 'Operations', ['system-configuration', 'testing-evaluation']],
  ['incident-response', 'Incident and breach response', 'How-To', 'operations/runbooks/incident-response', 'Runbook', ['availability-restoration', 'accountability']],
  ['business-continuity', 'Business continuity and recovery', 'How-To', 'operations/runbooks/business-continuity', 'Runbook', ['availability-restoration', 'confidentiality-integrity-availability-resilience']],
  ['supplier-management', 'Supplier and sub-processor management', 'How-To', 'operating-model/supplier-management', 'Operations', ['certification-assurance']],
  ['people', 'People: onboarding, training, confidentiality and offboarding', 'How-To', 'operating-model/people', 'Operations', ['it-security-governance']],
  ['data-lifecycle', 'Data lifecycle: retention and deletion', 'How-To', 'operating-model/data-lifecycle', 'Operations', ['limited-retention', 'portability-erasure']],
  ['assurance-audits', 'Assurance and audits', 'Reference', 'operating-model/assurance-audits', 'Operations', ['testing-evaluation', 'certification-assurance']],
];

/** @type {readonly OperatingModelTemplate[]} */
export const OPERATING_MODEL_TEMPLATES = Object.freeze(
  STARTER_SET.map(([id, title, kind, path, defaultType, measures]) =>
    freezeRecord({ id, title, kind, path, defaultType, measures, body: `${id}.md` }),
  ),
);

/** The template ids, in manifest order. */
export const TEMPLATE_IDS = Object.freeze(OPERATING_MODEL_TEMPLATES.map((t) => t.id));

/**
 * @param {string} id
 * @returns {OperatingModelTemplate | undefined}
 */
export function templateById(id) {
  return OPERATING_MODEL_TEMPLATES.find((t) => t.id === id);
}

/**
 * The template's body, read from the package (not the working directory).
 *
 * @param {OperatingModelTemplate} record
 * @returns {string}
 */
export function templateBody(record) {
  return readFileSync(new URL(`./templates/operating-model/${record.body}`, import.meta.url), 'utf8');
}

/**
 * The `type` a page at `relPath` is expected to carry on this site, derived the
 * way the frontmatter gate derives it: from the site's section registry
 * (`<docsRoot>/_meta/sections.yaml`) when there is one, else from the frozen
 * section map. `null` when the section has no type. An unreadable registry falls
 * back to the frozen map, as the gate does.
 *
 * @param {string} relPath page path under the docs root, with `/` separators
 * @param {string} docsRoot
 * @returns {string | null}
 */
export function siteDocType(relPath, docsRoot) {
  let registry = null;
  try {
    registry = loadSectionRegistry(docsRoot);
  } catch {
    registry = null;
  }
  return registry
    ? expectedDocType(relPath, sectionTypes(registry), sectionSubtypes(registry))
    : expectedDocType(relPath);
}

/**
 * Render a template into a page: frontmatter, a title heading, then the body.
 * Pure apart from reading the body file; deterministic for a fixed `now`.
 *
 * The `type` is the explicit one, else the one the record's path derives from
 * the frozen section map (`Runbook` under `operations/runbooks/`), else the
 * record's default. A caller writing into a site should pass
 * `siteDocType(path, docsRoot) ?? record.defaultType`, so the page follows the
 * site's section registry, as the stub tools do. A Role page gets
 * non-empty `role` and `responsibilities` placeholders, so it passes the gate
 * (ADR-0085) while it is a draft.
 *
 * @param {OperatingModelTemplate} record
 * @param {{ title?: string, type?: string, now?: Date }} [options]
 * @returns {string}
 */
export function renderTemplatePage(record, { title = record.title, type, now = new Date() } = {}) {
  const resolvedType = type ?? expectedDocType(`${record.path}.md`) ?? record.defaultType;
  /** @type {Record<string, unknown>} */
  const fields = {
    title,
    description: 'TODO one sentence describing what this page documents for your organisation.',
    doc_status: 'draft',
    type: resolvedType,
    kind: record.kind,
  };
  if (record.kind === 'Role') {
    fields.role = 'TODO name the accountable function';
    fields.responsibilities = ['TODO list one duty per entry'];
  }
  fields.tom_classification = record.measures.map((measure) => ({ measure, scope: 'organisation' }));

  const yamlBlock = stringify(fields, { lineWidth: 0 }).trimEnd();
  return `---\n${yamlBlock}\n${scaffoldMeta(now)}\n---\n\n# ${title}\n\n${templateBody(record)}`;
}

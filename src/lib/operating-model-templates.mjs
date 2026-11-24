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

/** @type {readonly OperatingModelTemplate[]} */
export const OPERATING_MODEL_TEMPLATES = Object.freeze(
  [
    {
      id: 'organisation',
      title: 'Organisation and teams',
      kind: 'Explanation',
      path: 'operating-model/organisation',
      defaultType: 'Operations',
      measures: ['it-security-governance'],
      body: 'organisation.md',
    },
    {
      id: 'role',
      title: 'Accountable role',
      kind: 'Role',
      path: 'operating-model/roles/accountable-role',
      defaultType: 'Operations',
      measures: ['accountability'],
      body: 'role.md',
    },
    {
      id: 'governance-forums',
      title: 'Governance forums and decision rights',
      kind: 'Reference',
      path: 'operating-model/governance-forums',
      defaultType: 'Operations',
      measures: ['it-security-governance', 'accountability'],
      body: 'governance-forums.md',
    },
    {
      id: 'policy-index',
      title: 'Policy index',
      kind: 'Hub',
      path: 'operating-model/policy-index',
      defaultType: 'Operations',
      measures: ['it-security-governance'],
      body: 'policy-index.md',
    },
    {
      id: 'access-management',
      title: 'Access management',
      kind: 'How-To',
      path: 'operating-model/access-management',
      defaultType: 'Operations',
      measures: ['user-identification-authorisation'],
      body: 'access-management.md',
    },
    {
      id: 'change-management',
      title: 'Change and release management',
      kind: 'How-To',
      path: 'operating-model/change-management',
      defaultType: 'Operations',
      measures: ['system-configuration', 'testing-evaluation'],
      body: 'change-management.md',
    },
    {
      id: 'incident-response',
      title: 'Incident and breach response',
      kind: 'How-To',
      path: 'operations/runbooks/incident-response',
      defaultType: 'Runbook',
      measures: ['availability-restoration', 'accountability'],
      body: 'incident-response.md',
    },
    {
      id: 'business-continuity',
      title: 'Business continuity and recovery',
      kind: 'How-To',
      path: 'operations/runbooks/business-continuity',
      defaultType: 'Runbook',
      measures: ['availability-restoration', 'confidentiality-integrity-availability-resilience'],
      body: 'business-continuity.md',
    },
    {
      id: 'supplier-management',
      title: 'Supplier and sub-processor management',
      kind: 'How-To',
      path: 'operating-model/supplier-management',
      defaultType: 'Operations',
      measures: ['certification-assurance'],
      body: 'supplier-management.md',
    },
    {
      id: 'people',
      title: 'People: onboarding, training, confidentiality and offboarding',
      kind: 'How-To',
      path: 'operating-model/people',
      defaultType: 'Operations',
      measures: ['it-security-governance'],
      body: 'people.md',
    },
    {
      id: 'data-lifecycle',
      title: 'Data lifecycle: retention and deletion',
      kind: 'How-To',
      path: 'operating-model/data-lifecycle',
      defaultType: 'Operations',
      measures: ['limited-retention', 'portability-erasure'],
      body: 'data-lifecycle.md',
    },
    {
      id: 'assurance-audits',
      title: 'Assurance and audits',
      kind: 'Reference',
      path: 'operating-model/assurance-audits',
      defaultType: 'Operations',
      measures: ['testing-evaluation', 'certification-assurance'],
      body: 'assurance-audits.md',
    },
  ].map(freezeRecord),
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

/**
 * Pack file classification (#330, ADR-0079 D1): the outcome the charter's packs
 * contract (`file-kinds.yaml`) gives a pack file. doc-kitty reimplements
 * CLASSIFICATION ONLY, and is held to the charter's own conformance cases
 * (`contract/conformance/classifier-cases.yaml`), not to a reading of the YAML.
 *
 * A path is relative to the directory that holds the pack directories, with
 * forward slashes (`core/directives/a.directive.yaml`). Globs: `*` matches
 * within one segment (a leading dot included), `**\/` matches zero or more whole
 * segments, every other character is literal.
 *
 * The order, as the conformance cases state it:
 *   1. `files`, then `exclusions`, then `retired`: the first rule in table order
 *      decides, except that a `retired` rule beats a matching `files` rule unless
 *      an `exclusions` rule matches too.
 *   2. `payloads`: the first match is mapped, with no schema.
 *   3. A root case variant: `<pack>/<name>` equal, ignoring case, to the file of
 *      a root `files` or `retired` rule (`*\/<name>`) is retired under that rule.
 *   4. `ignored`, matched ignoring case, except for a path a `files`, `retired`
 *      or `payloads` rule takes with path and glob both in lower case: that path
 *      is `unmodelled`.
 *   5. Anything else is `unmodelled`.
 *
 * Pure: no fs.
 *
 * @module packs/classify
 */

/**
 * @typedef {object} Classification
 * @property {'mapped' | 'excluded' | 'retired' | 'unmodelled'} expect
 * @property {string} [rule] the deciding rule's `match`
 * @property {string} [kind] mapped: the `files` rule's schema name or the payload's kind
 * @property {string} [schema] mapped by a `files` rule: `schemas/<schema>.schema.json`
 * @property {string} [contentForm] mapped: `yaml` (default), `markdown` or `bytes`
 * @property {string} [reason] the rule's reason (exclusions, retired, ignored)
 */

/** @param {string} s */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Compile a contract glob to an anchored regular expression.
 *
 * @param {string} glob
 * @param {{ caseInsensitive?: boolean }} [options]
 * @returns {RegExp}
 */
export function compileGlob(glob, { caseInsensitive = false } = {}) {
  let source = '';
  for (let i = 0; i < glob.length; ) {
    if (glob.startsWith('**/', i)) {
      source += '(?:[^/]+/)*';
      i += 3;
    } else if (glob[i] === '*') {
      source += '[^/]*';
      i += 1;
    } else {
      source += escapeRegExp(glob[i]);
      i += 1;
    }
  }
  return new RegExp(`^${source}$`, caseInsensitive ? 'i' : '');
}

/**
 * @typedef {{ match: string, regex: RegExp, lower: RegExp, rule: Record<string, any> }} CompiledRule
 */

/**
 * @param {unknown} rules
 * @param {{ caseInsensitive?: boolean }} [options]
 * @returns {CompiledRule[]}
 */
function compileSection(rules, options) {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((rule) => rule && typeof rule.match === 'string')
    .map((rule) => ({
      match: rule.match,
      regex: compileGlob(rule.match, options),
      lower: compileGlob(rule.match.toLowerCase()),
      rule,
    }));
}

/** A root rule's file name (`*\/<name>`, no `*` or `/` in `<name>`), else undefined. @param {string} match */
function rootRuleName(match) {
  const m = /^\*\/([^*/]+)$/.exec(match);
  return m ? m[1] : undefined;
}

/** @type {WeakMap<object, (path: string) => Classification>} */
const classifiers = new WeakMap();

/**
 * A classifier for one contract's `file-kinds.yaml`, with its globs compiled
 * once. Cached per `fileKinds` object.
 *
 * @param {Record<string, any>} fileKinds the parsed `file-kinds.yaml`
 * @returns {(path: string) => Classification}
 */
export function createClassifier(fileKinds) {
  const cached = classifiers.get(fileKinds);
  if (cached) return cached;
  const files = compileSection(fileKinds.files);
  const exclusions = compileSection(fileKinds.exclusions);
  const retired = compileSection(fileKinds.retired);
  const payloads = compileSection(fileKinds.payloads);
  const ignored = compileSection(fileKinds.ignored, { caseInsensitive: true });
  const roots = [...files, ...retired]
    .map((r) => ({ name: rootRuleName(r.match), r }))
    .filter((x) => x.name !== undefined);

  /** @param {CompiledRule[]} section @param {string} path */
  const first = (section, path) => section.find((r) => r.regex.test(path));

  /** @param {CompiledRule} r @returns {Classification} */
  const mappedByFile = (r) => ({
    expect: 'mapped',
    rule: r.match,
    kind: r.rule.schema,
    schema: `schemas/${r.rule.schema}.schema.json`,
    contentForm: r.rule.content_form ?? 'yaml',
  });

  /** @param {string} path @returns {Classification} */
  const classify = (path) => {
    const f = first(files, path);
    const e = first(exclusions, path);
    const r = first(retired, path);
    if (f && r && !e) return { expect: 'retired', rule: r.match, reason: r.rule.reason };
    if (f) return mappedByFile(f);
    if (e) return { expect: 'excluded', rule: e.match, reason: e.rule.reason };
    if (r) return { expect: 'retired', rule: r.match, reason: r.rule.reason };
    const p = first(payloads, path);
    if (p) return { expect: 'mapped', rule: p.match, kind: p.rule.kind, contentForm: p.rule.content_form ?? 'bytes' };
    const segments = path.split('/');
    if (segments.length === 2) {
      const variant = roots.find(({ name }) => name?.toLowerCase() === segments[1].toLowerCase());
      if (variant) {
        return {
          expect: 'retired',
          rule: variant.r.match,
          reason: `differs only in letter case from \`${variant.name}\``,
        };
      }
    }
    const lowerPath = path.toLowerCase();
    if ([...files, ...retired, ...payloads].some((rule) => rule.lower.test(lowerPath))) return { expect: 'unmodelled' };
    const i = first(ignored, path);
    if (i) return { expect: 'excluded', rule: i.match, reason: i.rule.reason };
    return { expect: 'unmodelled' };
  };
  classifiers.set(fileKinds, classify);
  return classify;
}

/**
 * Classify one path against a contract's `file-kinds.yaml`.
 *
 * @param {string} path
 * @param {Record<string, any>} fileKinds
 * @returns {Classification}
 */
export function classify(path, fileKinds) {
  return createClassifier(fileKinds)(path);
}

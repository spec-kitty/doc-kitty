// Change-surface classifier — first-match precedence + run_* derivation.
//
// The binding oracle is spec.md §"Change-surface map". `dorny/paths-filter` is a
// MULTI-match filter: a single file can light up several groups. This module owns
// the deterministic FIRST-MATCH-WINS collapse and the run_* signal derivation, so
// the precedence is offline-provable (see derive-change-groups.test.mjs) rather
// than eyeballed inside YAML.
//
// Two input modes, one output shape:
//   1. A list of changed paths          → each path classified to its single
//                                          primary group via first-match.
//   2. The per-group booleans from       → taken as the set of present groups.
//      paths-filter (what the live job      (paths-filter already did the matching)
//      passes)
//
// Both modes then derive run_code_quality / run_doc_sanity / run_build_example as
// unions per data-model.md. No third-party deps: runnable under bare `node --test`.

// Ordered highest → lowest precedence. Order is load-bearing: first match wins.
export const GROUP_ORDER = ['workflows', 'code', 'example_content', 'repo_docs', 'ignored'];

// Globs per group, mirroring .github/filters.yml EXACTLY. filters.yml drives the
// live paths-filter run; this table drives the offline path-mode classifier and
// its tests. Keep the two in lockstep.
export const GROUP_GLOBS = {
  workflows: ['.github/workflows/**'],
  code: [
    'src/**',
    'example/src/**',
    'example/*.ts',
    'example/*.mjs',
    'example/*.js',
    'example/*.json',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig*.json',
    'vitest.config.*',
  ],
  example_content: ['example/docs/**', 'example/public/**'],
  repo_docs: ['docs/**', 'agents/**', '*.md'],
  ignored: ['research/**', '**/*.excalidraw'],
};

// Minimal, dependency-free glob → RegExp. Supports the subset used above:
//   **/  → zero or more leading path segments
//   **   → anything, including '/'
//   *    → anything except '/'
//   ?    → one char except '/'
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++; // consume second '*'
        if (glob[i + 1] === '/') {
          i++; // consume the '/'
          re += '(?:[^/]+/)*';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

const COMPILED = Object.fromEntries(
  GROUP_ORDER.map((g) => [g, GROUP_GLOBS[g].map(globToRegExp)]),
);

// Classify a single path to its highest-precedence group, or null if it matches
// no group (behaviourally identical to paths-filter lighting up no filter — the
// path contributes to no lane).
export function classifyPath(path) {
  const p = String(path).replace(/^\.\//, '').replace(/^\/+/, '');
  for (const group of GROUP_ORDER) {
    if (COMPILED[group].some((re) => re.test(p))) return group;
  }
  return null;
}

function presentGroupsFromInput(input) {
  const present = new Set();
  if (Array.isArray(input)) {
    for (const path of input) {
      const g = classifyPath(path);
      if (g) present.add(g);
    }
  } else if (input && Array.isArray(input.paths)) {
    for (const path of input.paths) {
      const g = classifyPath(path);
      if (g) present.add(g);
    }
  } else if (input && typeof input === 'object') {
    for (const group of GROUP_ORDER) {
      if (isTrue(input[group])) present.add(group);
    }
  } else {
    throw new TypeError('deriveChangeGroups: expected a path array or a group-boolean object');
  }
  return present;
}

function isTrue(v) {
  return v === true || v === 'true';
}

// Core pure function. Returns the group booleans, the derived run_* signals, and
// the single first-match `primary` group (or null when nothing CI-relevant changed).
export function deriveChangeGroups(input) {
  const present = presentGroupsFromInput(input);

  const workflows = present.has('workflows');
  const code = present.has('code');
  const example_content = present.has('example_content');
  const repo_docs = present.has('repo_docs');
  const ignored = present.has('ignored');

  const run_code_quality = code || workflows;
  const run_doc_sanity = code || example_content || repo_docs || workflows;
  const run_build_example = code || example_content || workflows;

  const primary = GROUP_ORDER.find((g) => present.has(g)) ?? null;

  return {
    workflows,
    code,
    example_content,
    repo_docs,
    ignored,
    run_code_quality,
    run_doc_sanity,
    run_build_example,
    primary,
  };
}

// Render as GitHub Actions `name=value` output lines (booleans as 'true'/'false').
export function formatOutputs(result) {
  const keys = [
    'workflows',
    'code',
    'example_content',
    'repo_docs',
    'ignored',
    'run_code_quality',
    'run_doc_sanity',
    'run_build_example',
  ];
  return keys.map((k) => `${k}=${result[k] === true ? 'true' : 'false'}`).join('\n');
}

// CLI: read the paths-filter booleans from FILTER_* env vars and emit job outputs.
// Used by the detect-changes job. Import path (via URL comparison) keeps this
// inert when the module is imported by the test.
function isMain() {
  try {
    return import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const input = {
    workflows: process.env.FILTER_WORKFLOWS,
    code: process.env.FILTER_CODE,
    example_content: process.env.FILTER_EXAMPLE_CONTENT,
    repo_docs: process.env.FILTER_REPO_DOCS,
    ignored: process.env.FILTER_IGNORED,
  };
  const result = deriveChangeGroups(input);
  const lines = formatOutputs(result);
  process.stdout.write(lines + '\n');
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, lines + '\n');
  }
}

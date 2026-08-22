// Table-driven proof of the change-surface classifier: first-match precedence
// (spec.md §"Change-surface map") and the run_* derivations (data-model.md).
// Runnable offline: `node --test .github/scripts/`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, deriveChangeGroups } from './derive-change-groups.mjs';

// ---- Per-file first-match precedence (overlap cases are the point) ----------
const CLASSIFY_CASES = [
  // A workflow file that is ALSO markdown must resolve to workflows, never repo_docs.
  ['.github/workflows/ci.yml', 'workflows'],
  ['.github/workflows/nightly.md', 'workflows'],
  // example build config is code, NOT example_content.
  ['example/astro.config.mjs', 'code'],
  ['example/tsconfig.json', 'code'],
  ['example/src/pages/index.astro', 'code'],
  ['src/scripts/check-links.mjs', 'code'],
  ['package.json', 'code'],
  ['pnpm-lock.yaml', 'code'],
  ['pnpm-workspace.yaml', 'code'],
  ['tsconfig.base.json', 'code'],
  ['vitest.config.ts', 'code'],
  // deployed example content.
  ['example/docs/adr/0001.md', 'example_content'],
  ['example/public/logo.svg', 'example_content'],
  // non-deployed repo docs (root markdown + docs/agents trees).
  ['docs/architecture/ci-cd-pipeline.md', 'repo_docs'],
  ['README.md', 'repo_docs'],
  ['agents/persona.md', 'repo_docs'],
  // ignored.
  ['research/spike.md', 'ignored'],
  ['notes/diagram.excalidraw', 'ignored'],
  ['sketch.excalidraw', 'ignored'],
  ['whatever/nested/sketch.excalidraw', 'ignored'],
  // unmatched → null (contributes to no lane; mirrors paths-filter).
  ['LICENSE', null],
];

test('classifyPath resolves each path to its first-match primary group', () => {
  for (const [path, expected] of CLASSIFY_CASES) {
    assert.equal(classifyPath(path), expected, `path ${path}`);
  }
});

// First-match precedence is binding: repo_docs (`docs/**`) is listed ABOVE ignored
// (`**/*.excalidraw`) in the change-surface map, so an excalidraw file that lives
// under docs/ resolves to repo_docs. The ignored `**/*.excalidraw` only catches
// excalidraw files outside the higher-precedence trees (root, research/, etc.).
test('excalidraw under docs/ resolves to repo_docs (docs/** outranks ignored)', () => {
  assert.equal(classifyPath('docs/whiteboard.excalidraw'), 'repo_docs');
});
test('excalidraw outside precedence trees resolves to ignored', () => {
  assert.equal(classifyPath('assets/board.excalidraw'), 'ignored');
});

// ---- run_* derivation from a set of changed paths --------------------------
const DERIVE_CASES = [
  {
    name: 'doc-only (repo_docs) → doc-sanity only',
    paths: ['docs/architecture/ci-cd-pipeline.md', 'README.md'],
    expect: { run_code_quality: false, run_doc_sanity: true, run_build_example: false, primary: 'repo_docs' },
    groups: { workflows: false, code: false, example_content: false, repo_docs: true, ignored: false },
  },
  {
    name: 'code-only → code-quality + doc-sanity + build-example',
    paths: ['src/scripts/check-links.mjs'],
    expect: { run_code_quality: true, run_doc_sanity: true, run_build_example: true, primary: 'code' },
    groups: { workflows: false, code: true, example_content: false, repo_docs: false, ignored: false },
  },
  {
    name: 'example_content → doc-sanity + build-example (no code-quality)',
    paths: ['example/docs/adr/0001.md'],
    expect: { run_code_quality: false, run_doc_sanity: true, run_build_example: true, primary: 'example_content' },
    groups: { workflows: false, code: false, example_content: true, repo_docs: false, ignored: false },
  },
  {
    name: 'workflows → everything',
    paths: ['.github/workflows/ci.yml'],
    expect: { run_code_quality: true, run_doc_sanity: true, run_build_example: true, primary: 'workflows' },
    groups: { workflows: true, code: false, example_content: false, repo_docs: false, ignored: false },
  },
  {
    name: 'ignored-only → no lanes (detect+ci-ok still run live)',
    paths: ['research/spike.md', 'notes/board.excalidraw'],
    expect: { run_code_quality: false, run_doc_sanity: false, run_build_example: false, primary: 'ignored' },
    groups: { workflows: false, code: false, example_content: false, repo_docs: false, ignored: true },
  },
  {
    name: 'unmatched-only → no lanes, no primary',
    paths: ['LICENSE'],
    expect: { run_code_quality: false, run_doc_sanity: false, run_build_example: false, primary: null },
    groups: { workflows: false, code: false, example_content: false, repo_docs: false, ignored: false },
  },
  {
    name: 'multi-group union (code + repo_docs) — both booleans true, unions hold',
    paths: ['src/x.ts', 'docs/y.md'],
    expect: { run_code_quality: true, run_doc_sanity: true, run_build_example: true, primary: 'code' },
    groups: { workflows: false, code: true, example_content: false, repo_docs: true, ignored: false },
  },
  {
    name: 'multi-group union (example_content + repo_docs)',
    paths: ['example/docs/a.md', 'docs/b.md'],
    expect: { run_code_quality: false, run_doc_sanity: true, run_build_example: true, primary: 'example_content' },
    groups: { workflows: false, code: false, example_content: true, repo_docs: true, ignored: false },
  },
  {
    name: 'real change alongside ignored still triggers lanes',
    paths: ['research/spike.md', 'src/x.ts'],
    expect: { run_code_quality: true, run_doc_sanity: true, run_build_example: true, primary: 'code' },
    groups: { workflows: false, code: true, example_content: false, repo_docs: false, ignored: true },
  },
];

test('deriveChangeGroups (path mode) derives run_* and group booleans', () => {
  for (const c of DERIVE_CASES) {
    const r = deriveChangeGroups(c.paths);
    for (const [k, v] of Object.entries(c.expect)) {
      assert.equal(r[k], v, `${c.name} :: ${k}`);
    }
    for (const [k, v] of Object.entries(c.groups)) {
      assert.equal(r[k], v, `${c.name} :: group ${k}`);
    }
  }
});

// ---- Boolean-input mode (what the live job feeds from paths-filter) ---------
test('deriveChangeGroups (boolean mode) matches path mode', () => {
  for (const c of DERIVE_CASES) {
    const r = deriveChangeGroups(c.groups);
    for (const [k, v] of Object.entries(c.expect)) {
      assert.equal(r[k], v, `${c.name} (bool) :: ${k}`);
    }
  }
});

test('boolean mode accepts string "true"/"false" (Actions output shape)', () => {
  const r = deriveChangeGroups({
    workflows: 'false',
    code: 'true',
    example_content: 'false',
    repo_docs: 'false',
    ignored: 'false',
  });
  assert.equal(r.run_code_quality, true);
  assert.equal(r.run_build_example, true);
  assert.equal(r.run_doc_sanity, true);
  assert.equal(r.primary, 'code');
});

test('workflows overlap: a .md workflow file forces all lanes, not doc-sanity-only', () => {
  const r = deriveChangeGroups(['.github/workflows/deploy.md']);
  assert.equal(r.workflows, true);
  assert.equal(r.repo_docs, false);
  assert.equal(r.run_code_quality, true);
  assert.equal(r.run_build_example, true);
});

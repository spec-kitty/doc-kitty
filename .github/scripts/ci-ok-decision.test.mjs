// Table-driven proof of the ci-ok gate decision (contracts/ci-ok.contract.md).
// The non-fakeability requirement: an `always() + exit 0` implementation MUST
// fail the one-failure / detect-changes-failure rows below.
// Runnable offline: `node --test .github/scripts/`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCiOk, REQUIRED_LANES } from './ci-ok-decision.mjs';

// Every case spells out ALL FIVE lanes. A lane omitted from the input is an
// `undefined` result, which the helper fails closed on — so a new required lane
// (a11y, issue #7) cannot be added without the table acknowledging it.
const CASES = [
  {
    name: 'all lanes pass → GREEN',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'success', plantuml_allowlist: 'success' },
    ok: true,
  },
  {
    name: 'one lane failure → RED',
    in: { detect_changes: 'success', code_quality: 'failure', doc_sanity: 'success', build_example: 'success', a11y: 'success', plantuml_allowlist: 'success' },
    ok: false,
  },
  {
    name: 'one lane cancelled → RED',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'cancelled', build_example: 'success', a11y: 'success', plantuml_allowlist: 'success' },
    ok: false,
  },
  {
    name: 'all five lanes skipped, detect=success → GREEN (ignored-only mergeable)',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' },
    ok: true,
  },
  {
    name: 'mixed pass + skip → GREEN (doc-only real-world case)',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'success', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'success' },
    ok: true,
  },
  {
    name: 'detect-changes failure → RED (no all-skip false green)',
    in: { detect_changes: 'failure', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' },
    ok: false,
  },
  {
    name: 'detect-changes skipped → RED',
    in: { detect_changes: 'skipped', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' },
    ok: false,
  },
  {
    name: 'detect-changes cancelled → RED',
    in: { detect_changes: 'cancelled', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' },
    ok: false,
  },
  {
    name: 'build-example failure with others skipped → RED',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'failure', a11y: 'skipped', plantuml_allowlist: 'skipped' },
    ok: false,
  },
  {
    name: 'plantuml-allowlist skipped by path (docs-only PR), others passing → GREEN, like build-example',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'success', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' },
    ok: true,
  },
  {
    name: 'plantuml-allowlist failure with others skipped → RED, like build-example',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'failure' },
    ok: false,
  },
  {
    name: 'unexpected lane result value → RED (fail closed)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'weird', build_example: 'success', a11y: 'success', plantuml_allowlist: 'success' },
    ok: false,
  },
  // --- a11y lane (issue #7): same skip-semantics as the other three. ----------
  {
    name: 'a11y failure with all others passing → RED (the fold is real)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'failure', plantuml_allowlist: 'success' },
    ok: false,
  },
  {
    name: 'a11y cancelled with all others passing → RED',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'cancelled', plantuml_allowlist: 'success' },
    ok: false,
  },
  {
    name: 'a11y skipped with all others passing → GREEN (skip = pass, like every lane)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'skipped', plantuml_allowlist: 'success' },
    ok: true,
  },
  {
    name: 'a11y unexpected result → RED (fail closed)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'weird', plantuml_allowlist: 'success' },
    ok: false,
  },
  {
    name: 'a11y result missing entirely → RED (a dropped input cannot silently pass)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', plantuml_allowlist: 'success' },
    ok: false,
  },
];

test('evaluateCiOk decides the gate per the ci-ok truth table', () => {
  for (const c of CASES) {
    const { ok, reasons } = evaluateCiOk(c.in);
    assert.equal(ok, c.ok, `${c.name} — reasons: ${reasons.join('; ')}`);
    if (!c.ok) assert.ok(reasons.length > 0, `${c.name} — RED must carry a reason`);
    if (c.ok) assert.equal(reasons.length, 0, `${c.name} — GREEN must carry no reason`);
  }
});

// The helper is the SINGLE source of truth for "which lanes are required"
// (issue #7): ci.yml no longer carries a parallel inline gate, so the required
// set must be inspectable from here.
test('REQUIRED_LANES names every gated lane, a11y and plantuml-allowlist included', () => {
  assert.deepEqual([...REQUIRED_LANES].sort(), [
    'a11y',
    'build-example',
    'code-quality',
    'doc-sanity',
    'plantuml-allowlist',
  ]);
});

test('a RED verdict names the offending lane', () => {
  const { ok, reasons } = evaluateCiOk({
    detect_changes: 'success',
    code_quality: 'success',
    doc_sanity: 'success',
    build_example: 'success',
    a11y: 'failure',
  });
  assert.equal(ok, false);
  assert.ok(
    reasons.some((r) => r.includes('a11y')),
    `expected an a11y reason, got: ${reasons.join('; ')}`,
  );
});

// ---- pr:pause-ci (ADR-0072) -------------------------------------------------
// A paused PR skips every lane, so it would otherwise read as an all-skip GREEN.
// The pause must turn ci-ok RED, never green, so a paused PR cannot merge.
test('paused → RED even when every lane skipped, and the reason names the label', () => {
  const allSkipped = { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' };
  const { ok, reasons } = evaluateCiOk({ ...allSkipped, paused: 'true' });
  assert.equal(ok, false);
  assert.match(reasons.join('\n'), /pr:pause-ci/);
});

test('not paused ("false" or absent) → the usual decision', () => {
  const allSkipped = { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped', plantuml_allowlist: 'skipped' };
  assert.equal(evaluateCiOk({ ...allSkipped, paused: 'false' }).ok, true);
  assert.equal(evaluateCiOk(allSkipped).ok, true);
});

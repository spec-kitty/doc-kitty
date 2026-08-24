// Table-driven proof of the ci-ok gate decision (contracts/ci-ok.contract.md).
// The non-fakeability requirement: an `always() + exit 0` implementation MUST
// fail the one-failure / detect-changes-failure rows below.
// Runnable offline: `node --test .github/scripts/`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCiOk, REQUIRED_LANES } from './ci-ok-decision.mjs';

// Every case spells out ALL FOUR lanes. A lane omitted from the input is an
// `undefined` result, which the helper fails closed on — so a new required lane
// (a11y, issue #7) cannot be added without the table acknowledging it.
const CASES = [
  {
    name: 'all lanes pass → GREEN',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'success' },
    ok: true,
  },
  {
    name: 'one lane failure → RED',
    in: { detect_changes: 'success', code_quality: 'failure', doc_sanity: 'success', build_example: 'success', a11y: 'success' },
    ok: false,
  },
  {
    name: 'one lane cancelled → RED',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'cancelled', build_example: 'success', a11y: 'success' },
    ok: false,
  },
  {
    name: 'all four lanes skipped, detect=success → GREEN (ignored-only mergeable)',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped' },
    ok: true,
  },
  {
    name: 'mixed pass + skip → GREEN (doc-only real-world case)',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'success', build_example: 'skipped', a11y: 'skipped' },
    ok: true,
  },
  {
    name: 'detect-changes failure → RED (no all-skip false green)',
    in: { detect_changes: 'failure', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped' },
    ok: false,
  },
  {
    name: 'detect-changes skipped → RED',
    in: { detect_changes: 'skipped', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped' },
    ok: false,
  },
  {
    name: 'detect-changes cancelled → RED',
    in: { detect_changes: 'cancelled', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped', a11y: 'skipped' },
    ok: false,
  },
  {
    name: 'build-example failure with others skipped → RED',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'failure', a11y: 'skipped' },
    ok: false,
  },
  {
    name: 'unexpected lane result value → RED (fail closed)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'weird', build_example: 'success', a11y: 'success' },
    ok: false,
  },
  // --- a11y lane (issue #7): same skip-semantics as the other three. ----------
  {
    name: 'a11y failure with all others passing → RED (the fold is real)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'failure' },
    ok: false,
  },
  {
    name: 'a11y cancelled with all others passing → RED',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'cancelled' },
    ok: false,
  },
  {
    name: 'a11y skipped with all others passing → GREEN (skip = pass, like every lane)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'skipped' },
    ok: true,
  },
  {
    name: 'a11y unexpected result → RED (fail closed)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success', a11y: 'weird' },
    ok: false,
  },
  {
    name: 'a11y result missing entirely → RED (a dropped input cannot silently pass)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success' },
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
test('REQUIRED_LANES names every gated lane, a11y included', () => {
  assert.deepEqual([...REQUIRED_LANES].sort(), [
    'a11y',
    'build-example',
    'code-quality',
    'doc-sanity',
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

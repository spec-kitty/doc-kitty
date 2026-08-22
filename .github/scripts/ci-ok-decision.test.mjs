// Table-driven proof of the ci-ok gate decision (contracts/ci-ok.contract.md).
// The non-fakeability requirement: an `always() + exit 0` implementation MUST
// fail the one-failure / detect-changes-failure rows below.
// Runnable offline: `node --test .github/scripts/`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCiOk } from './ci-ok-decision.mjs';

const CASES = [
  {
    name: 'all lanes pass → GREEN',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'success', build_example: 'success' },
    ok: true,
  },
  {
    name: 'one lane failure → RED',
    in: { detect_changes: 'success', code_quality: 'failure', doc_sanity: 'success', build_example: 'success' },
    ok: false,
  },
  {
    name: 'one lane cancelled → RED',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'cancelled', build_example: 'success' },
    ok: false,
  },
  {
    name: 'all three lanes skipped, detect=success → GREEN (ignored-only mergeable)',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped' },
    ok: true,
  },
  {
    name: 'mixed pass + skip → GREEN (doc-only real-world case)',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'success', build_example: 'skipped' },
    ok: true,
  },
  {
    name: 'detect-changes failure → RED (no all-skip false green)',
    in: { detect_changes: 'failure', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped' },
    ok: false,
  },
  {
    name: 'detect-changes skipped → RED',
    in: { detect_changes: 'skipped', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped' },
    ok: false,
  },
  {
    name: 'detect-changes cancelled → RED',
    in: { detect_changes: 'cancelled', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'skipped' },
    ok: false,
  },
  {
    name: 'build-example failure with others skipped → RED',
    in: { detect_changes: 'success', code_quality: 'skipped', doc_sanity: 'skipped', build_example: 'failure' },
    ok: false,
  },
  {
    name: 'unexpected lane result value → RED (fail closed)',
    in: { detect_changes: 'success', code_quality: 'success', doc_sanity: 'weird', build_example: 'success' },
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

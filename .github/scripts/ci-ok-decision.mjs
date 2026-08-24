// ci-ok gate decision — the single highest-risk line in the mission.
//
// Contract (contracts/ci-ok.contract.md, data-model.md §"ci-ok evaluation"):
//   GREEN iff detect-changes.result == 'success'
//           AND none of the REQUIRED_LANES has result 'failure' or 'cancelled'
//           (a 'skipped' lane is a PASS).
//   RED otherwise — INCLUDING a detect-changes result that is not 'success'
//   (failure / cancelled / skipped). This is what defeats the classic
//   `always() + exit 0` false-green: an all-skip or detect-changes failure must
//   still turn the gate red.
//
// Pure + dependency-free so `node --test` proves it offline and the workflow can
// exit non-zero on a red decision without reimplementing the logic in YAML.

// A lane result that blocks the gate.
const BLOCKING = new Set(['failure', 'cancelled']);
// A lane result that passes the gate (explicit allow-list; anything else blocks).
const LANE_OK = new Set(['success', 'skipped']);

// The SINGLE source of truth for "which lanes are required" (issue #7). ci.yml
// has no parallel inline gate: every lane it wants enforced is listed here and
// fed in as a `*_RESULT` env var. Adding a lane means adding it here AND
// threading its result in — a dropped input reads as `undefined` and fails
// closed below, so the gate cannot silently stop enforcing a lane.
export const REQUIRED_LANES = Object.freeze([
  'code-quality',
  'doc-sanity',
  'build-example',
  'a11y',
]);

/**
 * @param {{detect_changes:string, code_quality:string, doc_sanity:string, build_example:string, a11y:string}} results
 *   Each value is a GitHub Actions job result: success | failure | cancelled | skipped.
 * @returns {{ok:boolean, reasons:string[]}} ok=true → gate GREEN.
 */
export function evaluateCiOk(results) {
  const reasons = [];

  const detect = results.detect_changes;
  if (detect !== 'success') {
    reasons.push(`detect-changes must be success but was '${detect}'`);
  }

  // Lanes are read straight off REQUIRED_LANES so the list above is the ONLY
  // place a lane is declared: `doc-sanity` reads `results.doc_sanity`.
  for (const lane of REQUIRED_LANES) {
    const result = results[lane.replaceAll('-', '_')];
    if (BLOCKING.has(result)) {
      reasons.push(`lane ${lane} is blocking with result '${result}'`);
    } else if (!LANE_OK.has(result)) {
      // Unknown/unexpected result value → fail closed.
      reasons.push(`lane ${lane} has unexpected result '${result}'`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

function isMain() {
  try {
    return import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const results = {
    detect_changes: process.env.DETECT_CHANGES_RESULT,
    code_quality: process.env.CODE_QUALITY_RESULT,
    doc_sanity: process.env.DOC_SANITY_RESULT,
    build_example: process.env.BUILD_EXAMPLE_RESULT,
    a11y: process.env.A11Y_RESULT,
  };
  const { ok, reasons } = evaluateCiOk(results);
  if (ok) {
    process.stdout.write('ci-ok: GREEN — all applicable lanes passed (skips allowed).\n');
    process.exit(0);
  }
  process.stdout.write('ci-ok: RED\n');
  for (const r of reasons) process.stdout.write(`  - ${r}\n`);
  process.exit(1);
}

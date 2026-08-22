// ci-ok gate decision — the single highest-risk line in the mission.
//
// Contract (contracts/ci-ok.contract.md, data-model.md §"ci-ok evaluation"):
//   GREEN iff detect-changes.result == 'success'
//           AND none of the three lanes has result 'failure' or 'cancelled'
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

/**
 * @param {{detect_changes:string, code_quality:string, doc_sanity:string, build_example:string}} results
 *   Each value is a GitHub Actions job result: success | failure | cancelled | skipped.
 * @returns {{ok:boolean, reasons:string[]}} ok=true → gate GREEN.
 */
export function evaluateCiOk(results) {
  const reasons = [];

  const detect = results.detect_changes;
  if (detect !== 'success') {
    reasons.push(`detect-changes must be success but was '${detect}'`);
  }

  const lanes = {
    'code-quality': results.code_quality,
    'doc-sanity': results.doc_sanity,
    'build-example': results.build_example,
  };
  for (const [lane, result] of Object.entries(lanes)) {
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

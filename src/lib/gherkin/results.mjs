/**
 * Cucumber RESULTS (ADR-0052): read the report a site's CI wrote, and tie each
 * result to a scenario the site renders from a `.feature` file.
 *
 * Two formats, told apart by the first character of the report:
 *
 *  - `{` — Cucumber Messages (NDJSON), protocol 15 to 34. One envelope per line;
 *    unknown envelopes and fields are ignored, missing defaults are filled
 *    (protocol <= 15 omits them and writes `seconds` as a string), and
 *    `willBeRetried` is read from `testCaseFinished` and, for protocol < 17,
 *    from `testStepFinished.testStepResult`.
 *  - `[` — legacy Cucumber JSON: the cucumber-js, cucumber-jvm (official
 *    converter), godog and behave dialects (research page §Two report formats).
 *
 * Both are reduced to one shape: per reported FILE, a list of entries
 * `{ line, names, status, retried }`, where `line` is the scenario's line, or
 * the example row's line for one row of an outline. That line is the only key
 * both sides can compute: runners give AST nodes random UUIDs, so ids are used
 * only for joins INSIDE one report.
 *
 * THE STATUS of one test case is the most severe step result, hooks included,
 * of its FINAL attempt (`willBeRetried` false, else the highest `attempt`), in
 * Cucumber's own order `UNKNOWN < PASSED < SKIPPED < PENDING < UNDEFINED <
 * AMBIGUOUS < FAILED` (`@cucumber/query`, the HTML report and
 * `getWorstTestStepResult` agree). `UNKNOWN`, an attempt that never finished
 * without failing, and a pickle with no test case are all "not run".
 *
 * WHAT IS KEPT. Only enum values, lines, scenario names (to check a report
 * against the file), the run's date and a validated hex commit id. Messages,
 * stack traces, attachments, step-definition locations and environment details
 * are never read into the result, so nothing else can reach a page
 * (ADR-0052 decision 8).
 *
 * A STALE REPORT is never matched by line (ADR-0052 decision 4): a Messages
 * report carries each file's text (`source.data`), which must equal the file
 * the site renders; a JSON report carries none, so every entry's line must be a
 * scenario (or outline row) line of the file, with the same name.
 *
 * PURITY CONTRACT: imports only `node:path` (POSIX helpers) and `node:url`
 * (`fileURLToPath`), plus the import-free `./text.mjs`. No filesystem: the
 * caller reads the report (`results-load.mjs`) and the feature file.
 *
 * @module gherkin/results
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GHERKIN_LOG_PREFIX } from './text.mjs';

/** @typedef {import('./view.mjs').FeatureView} FeatureView */
/** @typedef {import('./view.mjs').SectionView} SectionView */

/**
 * The statuses a reader sees. `not-run` covers Cucumber's `UNKNOWN`, a scenario
 * with no attempt, and one the report does not mention while it reports its file.
 *
 * @typedef {'passed' | 'failed' | 'ambiguous' | 'undefined' | 'pending' | 'skipped' | 'not-run'} ResultStatus
 */

/**
 * Severity, lowest first: Cucumber's ordinal with `UNKNOWN` as `not-run`.
 *
 * @type {readonly ResultStatus[]}
 */
export const STATUS_ORDER = Object.freeze(['not-run', 'passed', 'skipped', 'pending', 'undefined', 'ambiguous', 'failed']);

/**
 * The word a page shows for each status (ADR-0052 decision 6).
 *
 * @type {Readonly<Record<ResultStatus, string>>}
 */
export const STATUS_LABELS = Object.freeze({
  passed: 'Passed',
  failed: 'Failed',
  ambiguous: 'Ambiguous',
  undefined: 'Undefined',
  pending: 'Pending',
  skipped: 'Skipped',
  'not-run': 'Not run',
});

/** The label of a passed test case whose earlier attempt did not pass. */
export const RETRIED_LABEL = 'Passed on retry';

/** The header of the column an Examples table gains for its rows' results. */
export const RESULT_COLUMN = 'Result';

/** The largest report read: 64 MiB (attachments make real reports large). */
export const MAX_REPORT_BYTES = 64 * 1024 * 1024;

/**
 * One result, keyed by the line it belongs to.
 *
 * @typedef {object} ResultEntry
 * @property {number} line The scenario's line, or the example row's line.
 * @property {string[]} names The names the report gives it (the pickle name,
 *   placeholders filled in, and the scenario's own name when known).
 * @property {ResultStatus} status
 * @property {boolean} retried An earlier attempt exists (Messages only).
 * @property {string[]} [steps] The step texts the run executed, in order,
 *   placeholders filled in (hooks left out): checked against the file when the
 *   report does not carry its text (decision 4).
 * @property {boolean} [ran] The test case was executed. A pickle with no test
 *   case (filtered out by `--tags`) is `not-run` without having run, and never
 *   replaces an entry of the same line that did run.
 */

/**
 * The results of one reported `.feature` file.
 *
 * @typedef {object} ReportFile
 * @property {string} uri As written in the report.
 * @property {string} path Normalised POSIX path (relative, or absolute).
 * @property {boolean} absolute
 * @property {boolean} tailOnly A `classpath:` URI: only a tail match can place it.
 * @property {string | null} source The file text the run used (Messages), or `null`.
 * @property {ResultEntry[]} entries In report order (a later entry wins).
 */

/**
 * @typedef {object} RunInfo
 * @property {string} [date] ISO 8601 instant the run finished (or started).
 * @property {string} [revision] The commit, lower-case hex, when the report
 *   names one that looks like a git id.
 */

/**
 * @typedef {object} ResultReport
 * @property {'messages' | 'json'} format
 * @property {ReportFile[]} files
 * @property {RunInfo} run
 * @property {number} steps Step results read.
 * @property {boolean} allSkipped Every step result read is `skipped` (a dry run).
 */

/**
 * @param {readonly ResultStatus[]} statuses
 * @returns {ResultStatus} The most severe; `not-run` for none.
 */
export function worstStatus(statuses) {
  let worst = 0;
  for (const s of statuses) worst = Math.max(worst, STATUS_ORDER.indexOf(s));
  return STATUS_ORDER[worst];
}

/**
 * A Messages `TestStepResultStatus` or a JSON status word → a {@link ResultStatus}.
 * Unknown words (behave's `untested`, `executing`; a future value) are "not run".
 *
 * @param {unknown} value
 * @returns {ResultStatus}
 */
export function statusOf(value) {
  const word = typeof value === 'string' ? value.toLowerCase() : '';
  switch (word) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'error':
    case 'hook_error':
      return 'failed';
    case 'ambiguous':
      return 'ambiguous';
    case 'undefined':
    case 'untested_undefined':
      return 'undefined';
    case 'pending':
    case 'pending_warn':
    case 'untested_pending':
      return 'pending';
    case 'skipped':
      return 'skipped';
    default:
      return 'not-run';
  }
}

/**
 * Normalise a report URI (research page §URIs): `file://` URLs decoded,
 * `file:` and `classpath:` prefixes dropped, `\` turned into `/`, `.` and `..`
 * resolved, a leading `./` removed.
 *
 * @param {string} uri
 * @returns {{ path: string, absolute: boolean, tailOnly: boolean }}
 */
export function normalizeUri(uri) {
  let value = uri.trim();
  let tailOnly = false;
  if (/^file:\/\//i.test(value)) {
    try {
      value = fileURLToPath(value);
    } catch {
      const rest = value.replace(/^file:\/\/[^/]*/i, '');
      try {
        value = decodeURIComponent(rest);
      } catch {
        value = rest; // not percent-decodable: kept as written
      }
    }
  } else if (/^file:/i.test(value)) {
    value = value.slice('file:'.length);
  } else if (/^classpath:/i.test(value)) {
    value = value.slice('classpath:'.length);
    tailOnly = true;
  }
  value = value.replace(/\\/g, '/');
  const drive = /^[A-Za-z]:\//.test(value);
  const absolute = !tailOnly && (value.startsWith('/') || drive);
  let normal = path.posix.normalize(value);
  if (tailOnly) normal = normal.replace(/^\/+/, '');
  if (normal.startsWith('./')) normal = normal.slice(2);
  return { path: normal, absolute, tailOnly };
}

/**
 * Text as compared for staleness: BOM dropped, line endings normalised.
 *
 * @param {string} text
 */
function comparable(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Milliseconds of a Messages `Timestamp` (`seconds` may be a string, protocol <= 15).
 *
 * @param {unknown} ts
 * @returns {number | undefined}
 */
function timestampMs(ts) {
  if (!isObject(ts)) return undefined;
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  if (!Number.isFinite(seconds) || !Number.isFinite(nanos)) return undefined;
  return seconds * 1000 + Math.floor(nanos / 1e6);
}

/**
 * @param {number | undefined} ms
 * @returns {string | undefined}
 */
function isoOf(ms) {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * A commit id worth showing: 7 to 64 hex digits, lower-cased; anything else is dropped.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
function revisionOf(value) {
  return typeof value === 'string' && /^[0-9a-f]{7,64}$/i.test(value) ? value.toLowerCase() : undefined;
}

/**
 * A positive integer line, or `undefined`.
 *
 * @param {unknown} value
 */
function lineOf(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Collects entries per URI, in first-seen order.
 */
function fileCollector() {
  /** @type {Map<string, ReportFile>} */
  const byUri = new Map();
  return {
    /**
     * @param {string} uri
     * @returns {ReportFile}
     */
    file(uri) {
      let file = byUri.get(uri);
      if (!file) {
        file = { uri, ...normalizeUri(uri), source: null, entries: [] };
        byUri.set(uri, file);
      }
      return file;
    },
    files: () => [...byUri.values()],
  };
}

/**
 * Parse a Cucumber Messages (NDJSON) report.
 *
 * @param {string} text
 * @param {string} display The report's path in messages.
 * @returns {ResultReport}
 */
function parseMessages(text, display) {
  const files = fileCollector();
  /** AST node id → its line and name; rows also carry their scenario's id. */
  const ast = new Map();
  /** @type {Map<string, { uri: string, astNodeIds: string[], line?: number, name: string, steps: string[] }>} */
  const pickles = new Map();
  /** @type {Map<string, string>} test case id → pickle id */
  const testCases = new Map();
  /** @type {Map<string, { testCaseId: string, attempt: number, statuses: ResultStatus[], finished: boolean, willBeRetried: boolean }>} */
  const attempts = new Map();
  /** @type {RunInfo} */
  const run = {};
  let started;
  let finished;
  let steps = 0;
  let skippedSteps = 0;

  /** @param {any} scenario */
  const indexScenario = (scenario) => {
    if (!isObject(scenario) || typeof scenario.id !== 'string') return;
    const name = typeof scenario.name === 'string' ? scenario.name.trim() : '';
    ast.set(scenario.id, { line: lineOf(scenario.location?.line), name });
    for (const examples of Array.isArray(scenario.examples) ? scenario.examples : []) {
      for (const row of Array.isArray(examples?.tableBody) ? examples.tableBody : []) {
        if (isObject(row) && typeof row.id === 'string') {
          ast.set(row.id, { line: lineOf(row.location?.line), name, scenarioId: scenario.id });
        }
      }
    }
  };
  /** @param {any} children */
  const indexChildren = (children) => {
    for (const child of Array.isArray(children) ? children : []) {
      if (!isObject(child)) continue;
      indexScenario(child.scenario);
      if (isObject(child.rule)) indexChildren(child.rule.children);
    }
  };

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].replace(/\r$/, '');
    if (raw.trim() === '') continue;
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} ${display}:${i + 1} is not a Cucumber Messages envelope (${/** @type {Error} */ (error).message})`,
      );
    }
    if (!isObject(envelope)) {
      throw new Error(`${GHERKIN_LOG_PREFIX} ${display}:${i + 1} is not a Cucumber Messages envelope (not an object)`);
    }

    if (isObject(envelope.meta)) {
      run.revision = revisionOf(envelope.meta.ci?.git?.revision) ?? run.revision;
    } else if (isObject(envelope.source)) {
      const { uri, data } = envelope.source;
      if (typeof uri === 'string' && typeof data === 'string') files.file(uri).source = data;
    } else if (isObject(envelope.gherkinDocument)) {
      indexChildren(envelope.gherkinDocument.feature?.children);
    } else if (isObject(envelope.pickle)) {
      const p = envelope.pickle;
      if (typeof p.id === 'string' && typeof p.uri === 'string') {
        pickles.set(p.id, {
          uri: p.uri,
          astNodeIds: Array.isArray(p.astNodeIds) ? p.astNodeIds.filter((id) => typeof id === 'string') : [],
          line: lineOf(p.location?.line),
          name: typeof p.name === 'string' ? p.name.trim() : '',
          steps: Array.isArray(p.steps) ? p.steps.map((st) => (typeof st?.text === 'string' ? st.text : '')) : [],
        });
      }
    } else if (isObject(envelope.testCase)) {
      const tc = envelope.testCase;
      if (typeof tc.id === 'string' && typeof tc.pickleId === 'string') testCases.set(tc.id, tc.pickleId);
    } else if (isObject(envelope.testCaseStarted)) {
      const s = envelope.testCaseStarted;
      if (typeof s.id === 'string' && typeof s.testCaseId === 'string') {
        attempts.set(s.id, {
          testCaseId: s.testCaseId,
          attempt: Number(s.attempt ?? 0) || 0,
          statuses: [],
          finished: false,
          willBeRetried: false,
        });
      }
    } else if (isObject(envelope.testStepFinished)) {
      const f = envelope.testStepFinished;
      const attempt = typeof f.testCaseStartedId === 'string' ? attempts.get(f.testCaseStartedId) : undefined;
      if (attempt) {
        const status = statusOf(f.testStepResult?.status);
        attempt.statuses.push(status);
        steps += 1;
        if (status === 'skipped') skippedSteps += 1;
        // Protocol < 17 kept the retry flag on the step result.
        if (f.testStepResult?.willBeRetried === true) attempt.willBeRetried = true;
      }
    } else if (isObject(envelope.testCaseFinished)) {
      const f = envelope.testCaseFinished;
      const attempt = typeof f.testCaseStartedId === 'string' ? attempts.get(f.testCaseStartedId) : undefined;
      if (attempt) {
        attempt.finished = true;
        if (f.willBeRetried === true) attempt.willBeRetried = true;
      }
    } else if (isObject(envelope.testRunStarted)) {
      started = timestampMs(envelope.testRunStarted.timestamp) ?? started;
    } else if (isObject(envelope.testRunFinished)) {
      finished = timestampMs(envelope.testRunFinished.timestamp) ?? finished;
    }
  }
  run.date = isoOf(finished ?? started);
  if (run.date === undefined) delete run.date;
  if (run.revision === undefined) delete run.revision;

  /** @type {Map<string, Array<{ testCaseId: string, attempt: number, statuses: ResultStatus[], finished: boolean, willBeRetried: boolean }>>} */
  const attemptsByCase = new Map();
  for (const a of attempts.values()) {
    let list = attemptsByCase.get(a.testCaseId);
    if (!list) attemptsByCase.set(a.testCaseId, (list = []));
    list.push(a);
  }
  /** @type {Map<string, string>} pickle id → its LAST test case (a concatenated report wins last) */
  const caseOfPickle = new Map();
  for (const [caseId, pickleId] of testCases) caseOfPickle.set(pickleId, caseId);

  for (const [pickleId, pickle] of pickles) {
    const scenario = ast.get(pickle.astNodeIds[0]);
    const row = pickle.astNodeIds.length > 1 ? ast.get(pickle.astNodeIds[pickle.astNodeIds.length - 1]) : undefined;
    const line = row?.line ?? scenario?.line ?? pickle.line;
    if (line === undefined) continue;
    const names = [...new Set([pickle.name, scenario?.name ?? ''].filter(Boolean))];

    const caseId = caseOfPickle.get(pickleId);
    const tries = (caseId ? attemptsByCase.get(caseId) : undefined) ?? [];
    let status = /** @type {ResultStatus} */ ('not-run');
    let retried = false;
    if (tries.length > 0) {
      const done = tries.filter((t) => t.finished && !t.willBeRetried);
      const pool = done.length > 0 ? done : tries;
      const final = pool.reduce((a, b) => (b.attempt >= a.attempt ? b : a));
      status = worstStatus(final.statuses);
      // A run that stopped mid-attempt says nothing about the steps it never reached.
      if (!final.finished && status !== 'failed') status = 'not-run';
      retried = tries.some((t) => t !== final);
    }
    files.file(pickle.uri).entries.push({ line, names, status, retried, steps: pickle.steps, ran: tries.length > 0 });
  }

  return {
    format: 'messages',
    files: files.files(),
    run,
    steps,
    allSkipped: steps > 0 && skippedSteps === steps,
  };
}

/**
 * Split a behave `location` (`features/x.feature:12`) into path and line.
 *
 * @param {unknown} location
 * @returns {{ uri?: string, line?: number }}
 */
function splitLocation(location) {
  if (typeof location !== 'string') return {};
  const m = /^(.*):(\d+)$/.exec(location);
  return m ? { uri: m[1], line: lineOf(m[2]) } : { uri: location };
}

/**
 * The step results of one JSON element: its steps, the JVM scenario hooks
 * (`before`/`after` on the element) and the JVM step hooks (`before`/`after` on
 * each step, BeforeStep/AfterStep), all of which count towards the result.
 *
 * @param {Record<string, any>} element
 * @returns {ResultStatus[]}
 */
function elementStatuses(element) {
  /** @type {ResultStatus[]} */
  const out = [];
  /** @param {unknown} list */
  const collect = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!isObject(item)) continue;
      collect(item.before);
      if (isObject(item.result)) out.push(statusOf(item.result.status));
      collect(item.after);
    }
  };
  collect(element.before);
  collect(element.steps);
  collect(element.after);
  return out;
}

/**
 * The step texts of one JSON element, in order, without hooks (cucumber-js
 * writes a hook as a `hidden` step with no name; the JVM keeps them apart).
 *
 * @param {Record<string, any>} element
 * @returns {string[]}
 */
function elementStepTexts(element) {
  if (!Array.isArray(element.steps)) return [];
  return element.steps
    .filter((st) => isObject(st) && st.hidden !== true && typeof st.name === 'string')
    .map((st) => st.name);
}

/**
 * behave names an outline row `<outline name> -- @<table>.<row> <examples name>`
 * (its default `scenario_outline_annotation_schema`): the outline's own name is
 * what precedes ` -- @`.
 *
 * @param {string} name
 */
function behaveOutlineName(name) {
  const m = /^(.*?) -- @\d+\.\d+(?: .*)?$/.exec(name);
  return m ? m[1].trim() : name;
}

/**
 * Parse a legacy Cucumber JSON report.
 *
 * @param {string} text
 * @param {string} display
 * @returns {ResultReport}
 */
function parseJson(text, display) {
  let features;
  try {
    features = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} ${display} is not a Cucumber JSON report (${/** @type {Error} */ (error).message})`,
    );
  }
  if (!Array.isArray(features)) {
    throw new Error(`${GHERKIN_LOG_PREFIX} ${display} is not a Cucumber JSON report (expected an array of features)`);
  }
  const files = fileCollector();
  let steps = 0;
  let skippedSteps = 0;
  let latest;
  features.forEach((feature, index) => {
    if (!isObject(feature)) {
      throw new Error(`${GHERKIN_LOG_PREFIX} ${display} feature #${index + 1} is not an object`);
    }
    const uri = typeof feature.uri === 'string' ? feature.uri : splitLocation(feature.location).uri;
    if (typeof uri !== 'string' || uri === '') return;
    const file = files.file(uri);
    /** @type {ResultStatus[]} */
    let background = [];
    /** @type {string[]} */
    let backgroundSteps = [];
    for (const element of Array.isArray(feature.elements) ? feature.elements : []) {
      if (!isObject(element)) continue;
      const statuses = elementStatuses(element);
      steps += statuses.length;
      skippedSteps += statuses.filter((s) => s === 'skipped').length;
      // The JVM shape writes the background as its own element before every
      // scenario: its result and steps belong to the scenario that follows.
      if (element.type === 'background') {
        background = statuses;
        backgroundSteps = elementStepTexts(element);
        continue;
      }
      if (element.type !== undefined && element.type !== 'scenario') continue;
      const line = lineOf(element.line) ?? splitLocation(element.location).line;
      const all = [...background, ...statuses];
      const stepTexts = [...backgroundSteps, ...elementStepTexts(element)];
      background = [];
      backgroundSteps = [];
      if (line === undefined) continue;
      const own = all.length > 0 ? worstStatus(all) : statusOf(element.status);
      const name = typeof element.name === 'string' ? element.name.trim() : '';
      const names = [...new Set([name, behaveOutlineName(name)].filter(Boolean))];
      file.entries.push({ line, names, status: own, retried: false, steps: stepTexts, ran: true });
      const at = typeof element.start_timestamp === 'string' ? Date.parse(element.start_timestamp) : NaN;
      if (Number.isFinite(at) && (latest === undefined || at > latest)) latest = at;
    }
  });
  /** @type {RunInfo} */
  const run = {};
  const date = isoOf(latest);
  if (date) run.date = date;
  return { format: 'json', files: files.files(), run, steps, allSkipped: steps > 0 && skippedSteps === steps };
}

/**
 * Parse a Cucumber report (Messages NDJSON or legacy JSON). Throws one
 * `[dk-gherkin] <display>[:<line>] …` Error for a report that cannot be read.
 *
 * @param {string} text The report, decoded as UTF-8.
 * @param {{ display: string }} options `display` names the report in messages.
 * @returns {ResultReport}
 */
export function parseReport(text, { display }) {
  const body = text.replace(/^﻿/, '');
  const first = body.trimStart()[0];
  if (first === '[') return parseJson(body, display);
  if (first === '{') return parseMessages(body, display);
  throw new Error(
    `${GHERKIN_LOG_PREFIX} ${display} is not a Cucumber report: expected Cucumber Messages (NDJSON) or a Cucumber JSON array` +
      (first === undefined ? ' (the file is empty)' : ''),
  );
}

/**
 * @typedef {object} ReportIndexOptions
 * @property {string} root Project-root-relative POSIX directory Cucumber ran
 *   in: relative report URIs resolve against it (`gherkin.results.root`).
 * @property {string} projectRoot Absolute project root (the site root).
 */

/**
 * @typedef {{ file: ReportFile } | { ambiguous: string[] } | null} ReportLookup
 */

/**
 * An index that finds a rendered file's results in a report.
 *
 * - A RELATIVE report URI is resolved against `root`, giving a project-root
 *   relative key, compared exactly.
 * - An ABSOLUTE one inside `projectRoot` is made relative to it, and compared
 *   exactly.
 * - Any other absolute one (another machine's CI path) and a `classpath:` one
 *   can only be placed by its TAIL: it matches a file when it ends with the
 *   file's path relative to `root` (or to the project root), and only when
 *   exactly one report file does. A reported file placed by its tail serves the
 *   FIRST rendered file that claims it; another rendered file whose path is also
 *   its tail (`features/a.feature` and `apps/web/features/a.feature`) gets
 *   `ambiguous`, so one report file never gives its results to two files.
 *
 * @param {ResultReport} report
 * @param {ReportIndexOptions} options
 */
export function reportIndex(report, { root, projectRoot }) {
  const base = path.posix.normalize(root || '.');
  const projectPosix = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  // A POSIX-absolute anchor for the project (a drive path gets a leading `/`), so
  // `root` may climb out and back in: with `root: '..'` the URI
  // `site/features/a.feature` of the project `/repo/site` is `features/a.feature`.
  const anchor = projectPosix.startsWith('/') ? projectPosix : `/${projectPosix}`;
  /** Tail-placed report files → the rendered file that claimed each. */
  const claims = new Map();
  /** @type {Map<string, ReportFile>} */
  const exact = new Map();
  /** @type {ReportFile[]} */
  const tails = [];
  /** @param {string} key @param {ReportFile} file */
  const add = (key, file) => {
    const prior = exact.get(key);
    // The same file under two URIs (a concatenated report): keep both runs' entries, later last.
    exact.set(key, prior ? { ...prior, source: file.source ?? prior.source, entries: [...prior.entries, ...file.entries] } : file);
  };
  for (const file of report.files) {
    if (file.tailOnly) {
      tails.push(file);
    } else if (!file.absolute) {
      add(path.posix.relative(anchor, path.posix.resolve(anchor, base, file.path)) || '.', file);
    } else if (file.path === projectPosix || file.path.startsWith(`${projectPosix}/`)) {
      add(path.posix.relative(projectPosix, file.path), file);
    } else {
      tails.push(file);
    }
  }

  return {
    /**
     * @param {string} relPath The rendered file, project-root relative, POSIX.
     * @returns {ReportLookup}
     */
    lookup(relPath) {
      const key = path.posix.normalize(relPath);
      const hit = exact.get(key);
      if (hit) return { file: hit };
      const fromRoot = path.posix.relative(base, key);
      const wanted = [...new Set([fromRoot, key].filter((p) => p && !p.startsWith('../')))];
      const matches = tails.filter((f) => wanted.some((w) => f.path === w || f.path.endsWith(`/${w}`)));
      if (matches.length > 1) return { ambiguous: matches.map((f) => f.uri) };
      if (matches.length === 0) return null;
      const [match] = matches;
      const claimed = claims.get(match);
      if (claimed !== undefined && claimed !== key) return { ambiguous: [match.uri] };
      claims.set(match, key);
      return { file: match };
    },
  };
}

/**
 * A scenario's (or row's) outcome as shown.
 *
 * @typedef {object} Outcome
 * @property {ResultStatus} status
 * @property {boolean} [retried] Passed, after an earlier attempt that did not.
 * @property {Partial<Record<ResultStatus, number>>} [counts] An outline's rows by status.
 */

/**
 * @typedef {object} FeatureResults
 * @property {'current'} state
 * @property {Map<number, Outcome>} scenarios By scenario line (outlines: the aggregate).
 * @property {Map<number, Outcome>} rows By example-row line.
 * @property {Partial<Record<ResultStatus, number>>} counts Per test case
 *   (each outline row counts once), as Cucumber's own summary counts.
 * @property {RunInfo} run
 */

/**
 * @typedef {object} StaleResults
 * @property {'stale'} state
 * @property {RunInfo} run
 */

/**
 * The outline name with `<placeholder>`s filled from one Examples row, as the
 * pickle compiler fills a pickle's name.
 *
 * @param {string} name
 * @param {readonly string[]} header
 * @param {readonly string[]} row
 */
function expandName(name, header, row) {
  let out = name;
  header.forEach((h, i) => {
    out = out.split(`<${h}>`).join(row[i] ?? '');
  });
  return out;
}

/**
 * What a result on each line of a file may be: for every scenario line and
 * outline-row line, the names the run may give it and the step texts it may
 * have run (its own steps, or the Feature's and Rule's Background steps then
 * its own; placeholders filled in from the row, as the pickle compiler does).
 *
 * @param {FeatureView} view The WHOLE file's view.
 * @returns {Map<number, { names: string[], steps: string[][] }>}
 */
function resultTargets(view) {
  /** @type {Map<number, { names: string[], steps: string[][] }>} */
  const targets = new Map();
  /** @param {readonly SectionView[]} sections */
  const backgroundOf = (sections) => sections.filter((c) => c.kind === 'background').flatMap((c) => c.steps.map((st) => st.text));
  /** @param {SectionView} s @param {string[]} background */
  const add = (s, background) => {
    /** @param {(text: string) => string} fill */
    const variants = (fill) => {
      const own = s.steps.map((st) => fill(st.text).trim());
      return [own, [...background.map((t) => fill(t).trim()), ...own]];
    };
    targets.set(s.line, { names: [s.name], steps: variants((t) => t) });
    for (const ex of s.examples) {
      const [header = [], ...body] = ex.rows;
      ex.rowLines.forEach((line, i) => {
        const row = body[i] ?? [];
        const fill = (/** @type {string} */ t) => expandName(t, header, row);
        targets.set(line, { names: [s.name, fill(s.name)], steps: variants(fill) });
      });
    }
  };
  const top = /** @type {SectionView[]} */ (view.children.filter((c) => c.kind !== 'rule'));
  const featureBackground = backgroundOf(top);
  for (const child of view.children) {
    if (child.kind === 'scenario') add(child, featureBackground);
    if (child.kind === 'rule') {
      const ruleBackground = [...featureBackground, ...backgroundOf(child.children)];
      for (const rc of child.children) if (rc.kind === 'scenario') add(rc, ruleBackground);
    }
  }
  return targets;
}

/**
 * Every scenario section of a view, Rules flattened, in document order.
 *
 * @param {FeatureView} view
 * @returns {SectionView[]}
 */
export function viewScenarios(view) {
  /** @type {SectionView[]} */
  const out = [];
  for (const child of view.children) {
    if (child.kind === 'rule') {
      for (const rc of child.children) if (rc.kind === 'scenario') out.push(rc);
    } else if (child.kind === 'scenario') {
      out.push(child);
    }
  }
  return out;
}

/**
 * The outcome of every scenario and row a view shows, from one reported file;
 * or `stale` when the report was made from a different version of that file
 * (ADR-0052 decision 4):
 *
 * - the report carries the file's text (Messages `source.data`): it must equal
 *   `text`, BOM and line endings aside;
 * - it does not (JSON, or a Messages report without `source`): every entry's
 *   line must be a scenario line, or an outline row line, of the WHOLE file;
 *   one of the entry's names must be that scenario's name (for a row, with its
 *   placeholders filled in from the row); and the steps it ran must be that
 *   scenario's steps, with or without the Background steps before them, the
 *   row's values filled in (`resultTargets`).
 *
 * @param {ReportFile} file The report's entry for the rendered file.
 * @param {{ text: string, view: FeatureView, file?: FeatureView, run: RunInfo }} rendered
 *   `text` is the whole file the site renders; `view` what it shows (a
 *   selection's view holds only the chosen scenarios); `file` the whole file's
 *   view, which staleness is checked against (default `view`).
 * @returns {FeatureResults | StaleResults}
 */
export function featureResults(file, { text, view, file: whole = view, run }) {
  if (file.source !== null && comparable(file.source) !== comparable(text)) return { state: 'stale', run };
  if (file.source === null) {
    const targets = resultTargets(whole);
    for (const entry of file.entries) {
      const target = targets.get(entry.line);
      if (!target || !entry.names.some((n) => target.names.includes(n))) return { state: 'stale', run };
      // The steps it ran must be this scenario's (Background steps first or
      // not, as runners differ), with the row's values filled in: a reordered or
      // edited Examples row, or edited step text, is a different scenario.
      if (entry.steps && entry.steps.length > 0) {
        const ran = JSON.stringify(entry.steps.map((t) => t.trim()));
        if (!target.steps.some((variant) => JSON.stringify(variant) === ran)) return { state: 'stale', run };
      }
    }
  }

  /** @type {Map<number, ResultEntry>} */
  const byLine = new Map();
  for (const entry of file.entries) {
    // Later wins, except that a pickle a later run filtered out (no test case)
    // never hides the result of a run that executed it.
    const prior = byLine.get(entry.line);
    if (prior && prior.ran !== false && entry.ran === false) continue;
    byLine.set(entry.line, entry);
  }

  /** @param {number} line @returns {Outcome} */
  const one = (line) => {
    const entry = byLine.get(line);
    if (!entry) return { status: 'not-run' };
    return entry.retried && entry.status === 'passed' ? { status: 'passed', retried: true } : { status: entry.status };
  };

  /** @type {Map<number, Outcome>} */
  const scenarios = new Map();
  /** @type {Map<number, Outcome>} */
  const rows = new Map();
  /** @type {Partial<Record<ResultStatus, number>>} */
  const counts = {};
  /** @param {Partial<Record<ResultStatus, number>>} into @param {ResultStatus} status */
  const tally = (into, status) => {
    into[status] = (into[status] ?? 0) + 1;
  };
  for (const s of viewScenarios(view)) {
    if (!s.outline) {
      const outcome = one(s.line);
      scenarios.set(s.line, outcome);
      tally(counts, outcome.status);
      continue;
    }
    /** @type {Partial<Record<ResultStatus, number>>} */
    const own = {};
    /** @type {ResultStatus[]} */
    const statuses = [];
    for (const ex of s.examples) {
      for (const line of ex.rowLines) {
        const outcome = one(line);
        rows.set(line, outcome);
        statuses.push(outcome.status);
        tally(own, outcome.status);
        tally(counts, outcome.status);
      }
    }
    scenarios.set(s.line, { status: worstStatus(statuses), counts: own });
  }
  return { state: 'current', scenarios, rows, counts, run };
}

/**
 * Counts as text, most severe first: `1 failed, 3 passed`.
 *
 * @param {Partial<Record<ResultStatus, number>>} counts
 * @returns {string}
 */
export function countsText(counts) {
  return [...STATUS_ORDER]
    .reverse()
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => `${counts[s]} ${STATUS_LABELS[s].toLowerCase()}`)
    .join(', ');
}

/**
 * The label shown for one outcome (`Passed on retry` for a flaky pass).
 *
 * @param {Outcome} outcome
 */
export function outcomeLabel(outcome) {
  return outcome.retried ? RETRIED_LABEL : STATUS_LABELS[outcome.status];
}

/**
 * The provenance shown after the feature summary (`as of 2026-10-14 · commit
 * 3f1c2a9`): the run's instant (`date`, for a `datetime`), its day, and the
 * commit shortened to 7 digits. Each is absent when the report does not name it.
 *
 * @param {RunInfo} run
 * @returns {{ date?: string, day?: string, revision?: string }}
 */
export function provenance(run) {
  return {
    ...(run.date ? { date: run.date, day: run.date.slice(0, 10) } : {}),
    ...(run.revision ? { revision: run.revision.slice(0, 7) } : {}),
  };
}

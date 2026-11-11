/**
 * The no-plantuml.com guard (#13 C-001), shared by `assert-build-artifacts.mjs`,
 * the `dockitty-plantuml-guard` bin (`plantuml-guard-bin.mjs`, #314) and their
 * tests. `checkPlantumlSources` scans every `.ts`/`.mjs`/`.js`
 * file under the toolkit's `lib/` tree, so it does not care which file defines
 * `DEFAULT_PLANTUML_SERVER_URL`, and returns a failure message instead of exiting.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// A plantuml.com *URL*, matched only in URL position (a `//host` authority or a
// `plantuml.com/plantuml` path), so prose that names "plantuml.com" never matches.
export const PLANTUML_COM_URL_RE = /(?:https?:)?\/\/[a-z0-9.-]*plantuml\.com|plantuml\.com\/plantuml/i;
const DEFAULT_DEFINITION_RE = /\bDEFAULT_PLANTUML_SERVER_URL\s*=\s*['"]([^'"]+)['"]/;

const SELF_HOSTED_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[?::1\]?|0\.0\.0\.0|[a-z0-9-]+)(?::\d+)?\//i;

function sourceFilesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFilesUnder(abs));
    else if (/\.(?:ts|mjs|js)$/.test(entry.name)) out.push(abs);
  }
  return out;
}

/**
 * @param {string} libDir the toolkit's `src/lib` directory
 * @returns {{ ok: true, defaultServer: string, files: number } | { ok: false, message: string }}
 */
export function checkPlantumlSources(libDir) {
  const files = sourceFilesUnder(libDir);
  let defaultServer = null;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = path.relative(libDir, file).split(path.sep).join('/');
    if (PLANTUML_COM_URL_RE.test(text)) {
      return { ok: false, message: `no-plantuml.com: lib/${rel} contains a plantuml.com URL — the PlantUML build stage must resolve only a self-hosted server (#13 C-001)` };
    }
    const def = DEFAULT_DEFINITION_RE.exec(text);
    if (def) defaultServer = def[1];
  }
  if (defaultServer === null) {
    return { ok: false, message: `no-plantuml.com: could not find a DEFAULT_PLANTUML_SERVER_URL definition under ${libDir} — the self-hosted default is unverifiable (#13 C-001)` };
  }
  if (/plantuml\.com/i.test(defaultServer)) {
    return { ok: false, message: `no-plantuml.com: DEFAULT_PLANTUML_SERVER_URL is "${defaultServer}" — it must be a self-hosted server, never plantuml.com (#13 C-001)` };
  }
  if (!SELF_HOSTED_RE.test(defaultServer)) {
    return { ok: false, message: `no-plantuml.com: DEFAULT_PLANTUML_SERVER_URL "${defaultServer}" is not a recognisably self-hosted http(s) endpoint (#13 C-001)` };
  }
  return { ok: true, defaultServer, files: files.length };
}

/**
 * The server a build will send PlantUML diagrams to: `DK_PLANTUML_SERVER_URL`
 * when set, else the toolkit default. A plantuml.com URL fails (#314).
 * @param {string | undefined} envValue the raw `DK_PLANTUML_SERVER_URL`
 * @param {string | undefined} defaultServer the toolkit default, when known
 * @returns {{ ok: true, url: string, source: string } | { ok: false, message: string }}
 */
export function checkPlantumlServerUrl(envValue, defaultServer) {
  const fromEnv = (envValue ?? '').trim();
  const url = fromEnv !== '' ? fromEnv : defaultServer;
  const source = fromEnv !== '' ? 'DK_PLANTUML_SERVER_URL' : 'toolkit default';
  if (url === undefined) return { ok: false, message: 'no-plantuml.com: no PlantUML server could be resolved' };
  if (/plantuml\.com/i.test(url)) {
    return { ok: false, message: `no-plantuml.com: the build would render PlantUML at "${url}" (${source}); point DK_PLANTUML_SERVER_URL at a self-hosted server (#13 C-001)` };
  }
  return { ok: true, url, source };
}

/**
 * A site's config source, read as text: it must name no plantuml.com URL (#314).
 * @param {string} text the config file's contents
 * @param {string} label the path to name in the message
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function checkSiteConfigSource(text, label) {
  const match = PLANTUML_COM_URL_RE.exec(text);
  if (match === null) return { ok: true };
  const line = text.slice(0, match.index).split('\n').length;
  return { ok: false, message: `no-plantuml.com: ${label}:${line} names a plantuml.com URL (${match[0]}); the site must use a self-hosted PlantUML server (#13 C-001)` };
}

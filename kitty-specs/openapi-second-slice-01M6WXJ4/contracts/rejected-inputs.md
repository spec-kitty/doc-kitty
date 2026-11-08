# Contract: rejected-input matrix (FR-022, NFR-003)

Every row fails the build with a message starting `[dk-openapi] <spec ref>:` where `<spec ref>` is `specs[i] "<label>"` or `archive "<glob>"`, then the cause. No renderer stack trace.

| Case | Stage | Cause text contains |
|---|---|---|
| Unknown `openapi`/`swagger` version | materialise | `not OpenAPI 3.0, 3.1 or Swagger 2.0` |
| Unparsable file | materialise | `cannot parse` |
| Missing file | materialise | `cannot read` |
| `$ref` escaping the folder | materialise | `escapes` + ref |
| `$ref` non-file scheme | materialise | `scheme` + ref |
| Unresolvable `$ref` | materialise | `cannot resolve` + ref |
| External `$ref` cycle | materialise | `cycle` + chain `a.yaml -> b.yaml -> a.yaml` |
| `http` URL | static | `https` |
| Remote without sha256 | static | `sha256 is required` |
| sha256 mismatch | materialise | `sha256 mismatch` + expected and actual |
| More than 5 redirects | materialise | `redirects` |
| Offline, no valid cache | materialise | `offline` + cache path |
| Archive zero matches | materialise | `no files match` |
| Label pattern invalid / no group | static | `labelPattern` |
| Empty derived label | materialise | `empty label` + file |
| Duplicate label | materialise | `duplicate label` + both sources |
| `$ref` absolute, `file://` or `http(s)` | materialise | `ref` + scheme |
| `$ref` via symlink outside, encoded separators | materialise | `escapes` |
| Ref count or depth over bound | materialise | `ref limit` |
| Archive glob absolute or with `..` | static | `archive glob` |
| Archive over 200 matches / match outside siteRoot | materialise | `archive` |
| File or response over 10 MB | materialise | `10 MB` |
| Fetch over 30 s | materialise | `timeout` |
| YAML aliases over 100 | materialise | `alias` |
| URL with userinfo | static | `userinfo` |

Query strings in URLs are redacted (`?…`) in every message.

## Row ownership

| WP | Rows |
|---|---|
| WP02 | unknown version, unparsable, missing file, http URL, remote without sha256, labelPattern, userinfo, archive glob static, size, alias |
| WP08 | zero matches, empty label, duplicate label, over 200 / outside siteRoot |
| WP09 | all `$ref` rows (escape, scheme, unresolvable, cycle, absolute/file/http, symlink, limits) |
| WP10 | sha256 mismatch, redirects, offline no cache, timeout |

# Data model / CLI surface: Gate config hardening

## Evaluated site config (read-only)
- Source: the `astro.config.{mjs,ts,js,…}` in the resolved site root, or the file `--astro-config` names.
- Fields read: `vite.envDir` (string, false or undefined) and `vite.envFile` (false or undefined).
- `envFile === false` makes the env source "no files". A relative `envDir` resolves against the site root.

## Gate flags
| Gate | Flag | Meaning |
|---|---|---|
| `assert-build-artifacts` | `--env-dir <dir\|false>` | Skip evaluation and use this env source. |
| `assert-build-artifacts` | `--astro-config <file>` | Evaluate this config instead of the site root's. |
| `assert-build-artifacts` | `--index-path <dist-relative>` | The agent-API index location (default `api/index.json`). One leading `/` is stripped; `..` or an absolute path → exit 2. |
| `check-redirect-coverage` | `--env-dir`, `--astro-config` | As above. `--docs` together with a conflicting `--site-root` → exit 2. |

## Exit codes
- 0: pass. 1: a gate finding. 2: a usage or evaluation error, which covers a config that fails or times out, a bad `--index-path`, and conflicting roots.

## Base derivation (#172)
`base = new URL(index._links.self.href).pathname` with the trailing `/<index-path>` removed. If `self` is not an absolute URL, or does not end in `/<index-path>`, the gate fails, and the message suggests dropping a base prefix from the flag.

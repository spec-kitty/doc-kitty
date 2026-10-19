# Contract: a11y server environment

`tests/a11y/serve-dist.mjs` serves one built dist under the site base `/doc-kitty/`
for the Playwright lane. Each Playwright `webServer` entry starts one instance.

## Inputs

| Variable | Values | Default | Meaning |
| --- | --- | --- | --- |
| `DK_A11Y_DIST` | path | `example/dist` | The dist to serve, relative to the repository root |
| `DK_A11Y_EXPECT_DRAFTS` | `on`, `off` | `on` | The draft mode this dist must have been built with |
| `A11Y_PORT` | integer | `4321` | The port to listen on |

## Behaviour

1. Resolve `DK_A11Y_DIST`. If the directory or its `index.html` is missing, exit 1
   and name the path.
2. Read the draft sentinel, which is the same check the server runs today.
3. If the sentinel shows drafts and `DK_A11Y_EXPECT_DRAFTS=off`, or shows none and
   `DK_A11Y_EXPECT_DRAFTS=on`, exit 1. The message names the dist, the expected
   mode and the found mode, plus the build command that makes the right dist.
4. Otherwise, listen on `A11Y_PORT`.

An unknown value of `DK_A11Y_EXPECT_DRAFTS` exits 1. The server never falls back to a
warning.

## Projects

| Playwright project | Dist | Expected drafts | Port |
| --- | --- | --- | --- |
| `light`, `dark` | `example/dist` | `on` | `A11Y_PORT` |
| `published-light`, `published-dark` | `example/dist-nodrafts` | `off` | `A11Y_PORT + 1` |

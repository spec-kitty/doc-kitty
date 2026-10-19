# Data model: Layout guards and decisions

This mission adds no runtime data. It adds three small build-time and test-time
shapes.

## Header fixture stamp

File: `src/tests/fixtures/header-theme/stock-header.meta.json`. The schema is in
[contracts/stock-header-stamp.schema.json](./contracts/stock-header-stamp.schema.json).

| Field | Type | Meaning |
| --- | --- | --- |
| `starlight` | string, exact semver | Starlight version the fixture was captured with |
| `astro` | string, exact semver | Astro version the fixture was captured with |
| `compressHTML` | boolean | The `compressHTML` setting the build ran with |
| `carrier` | `"disabled"` | The fixture came from a build without the `Header` carrier |
| `capturedFrom` | string | The page whose header block was taken, `example/dist/index.html` |

**Invariants**

- Every field must equal what is installed and configured now, or the fast test
  fails. Its message names the differing field and the command
  `pnpm fixture:stock-header`.
- The capture script writes the fixture and the stamp together. Neither is edited by
  hand.

## Machine-surface manifest

An exported constant in `src/tests/draft-publication-build.test.ts`: a list of globs
relative to a dist root.

| Glob | Covers |
| --- | --- |
| `sitemap*.xml` | sitemap index and pages |
| `rss.xml` | the feed |
| `llms*.txt` | the agent index |
| `api/**/*.json` | the agent API, including `api/pages/*` |
| `okf/**` | the OKF export |
| `pagefind/**` | the search index |

**Invariants**

- Each glob matches at least one file in each dist, or the check fails, so a renamed
  surface cannot drop out silently.
- Drafts-off vs drafts-off repeat: every matched file is byte-identical.
- Drafts-on vs drafts-off: every matched file is byte-identical except the named
  draft pages' `api/pages/<draft>.json`, which exist only in drafts-on.

## A11y server environment

Contract in [contracts/a11y-server-env.md](./contracts/a11y-server-env.md).

| Variable | Values | Default |
| --- | --- | --- |
| `DK_A11Y_DIST` | path to a built dist | `example/dist` |
| `DK_A11Y_EXPECT_DRAFTS` | `on` or `off` | `on` |
| `A11Y_PORT` | port number | `4321` |

**State rule**: the server reads the dist's draft sentinel at start. If the sentinel
disagrees with `DK_A11Y_EXPECT_DRAFTS`, in either direction, the server exits
non-zero before listening.

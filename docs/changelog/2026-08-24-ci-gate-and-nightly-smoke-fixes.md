---
title: CI gate single-sourced and nightly smoke repaired
description: The a11y lane folded into the ci-ok decision helper, plus six fixes to the nightly smoke and the published site's links and favicon.
doc_status: active
updated: 2026-08-24
type: Changelog
kind: Changelog
tags: [ci, nightly, accessibility, links]
related:
  - architecture/ci-cd-pipeline
  - architecture/theming
---

# 2026-08-24 — CI gate single-sourced, nightly smoke repaired

A maintenance pass on the two red pipelines. The `ci-ok` gate had drifted into two
sources of truth, and `Nightly smoke` had been failing since M2 — for four
independent reasons, two of which were real defects on the published site.

## The `ci-ok` gate is now one decision

`ci-ok` gated its first three lanes through `.github/scripts/ci-ok-decision.mjs`
but gated the M2 `a11y` lane through a separate inline step in `ci.yml`. A reader
of the helper — the apparent authority — would not have seen `a11y` as required.

`ci-ok-decision.mjs` now exports `REQUIRED_LANES` and reads every lane off it, so
the helper is the only place a required lane is declared, and the inline step is
gone. A lane whose result is not threaded in reads as `undefined` and **fails the
gate closed**, so the split cannot silently reopen. The three original lanes
behave exactly as before.

## The nightly smoke ran, but never checked anything

- **No link was ever checked.** `lychee.toml` carried `exclude_mail`, a key
  removed in lychee 0.16. lychee rejects unknown config fields, so the run aborted
  before its first request. The key is now `include_mail = false`.
- **The theme favicon 404'd.** Starlight's `favicon` option is a *served path*,
  not a module specifier — its value goes verbatim into `<link rel="icon">`. The
  Spec Kitty brand declares its mark as a package asset so a rebrand needs no
  consumer wiring, and that specifier was being emitted as a URL. The toolkit now
  resolves it and emits the file at one stable path, keeping the theme
  self-contained. Lighthouse counted the 404 as a console error, which is what
  failed the nightly's `errors-in-console` assertion every night.
- **Site-root links dropped the base.** The `rss.xml` and `llms.txt` discovery
  links in `<head>`, and the artifact and section links on the example index, were
  root-absolute, so all eleven 404'd on a site published under a `base`. They are
  base-aware now.
- **The deployed site advertised a placeholder host.** The example shipped
  `site: https://OWNER.github.io`, so its canonical URL, sitemap and repo link all
  pointed nowhere. This example *is* the deployed docsite, so those carry real
  values; the adopter note explains what to change in a fork.

## The nightly could not record its own progress

Two reporting jobs run without a checkout, and both assumed one:

- `update-marker` advanced the durable `refs/smoke/last-run` marker with
  `git push`, which needs a local repository. It failed every run, so the marker
  stayed missing and each nightly re-smoked a deployment it had already seen — the
  deploy-change short-circuit never engaged. It now writes the ref through the API.
- `report-failure` created its tracking label with `gh label create` and no
  `--repo`, so `gh` had no remote to infer the repository from. The label was never
  created and the subsequent `gh issue create --label` failed, taking the job down
  — which is why the failures never reached a tracking issue.

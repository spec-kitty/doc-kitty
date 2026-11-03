---
affected_files: []
cycle_number: 1
mission_slug: plantuml-external-opt-in-01M6F052
reproduction_command:
reviewed_at: '2026-11-02T23:32:54Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP10
---

# WP10 review feedback (cycle 1)

Facts in the guide, the ADR and the fragment check out against `src/scripts/assert-plantuml-no-remote-include.mjs`, `plantuml-mode-check.mjs`, `lib/plantuml-external.mjs`, `lib/config.ts` and `ci.yml`. The quoted messages match: the unset FAIL line, the verdict line, the trailing-slash example, lowercase `internet`, empty-item and trailing-`;` handling, `-D` system properties failing closed, `--astro-config` needing deps, and the env-blank-is-unset rule. The recommended SANDBOX blocks are byte-unchanged, `docs/adr/README.md` and `CHANGELOG.md` are untouched, and 0074 is free on origin/main and in open PRs. Tests (11/11), eslint, validate:docs/links/changelog/adr-ids and markdownlint pass. These issues still need fixing:

**Issue 1 (blocking): vacuous positive control.** `src/tests/plantuml-opt-in-docs.test.ts`, test "positive control: the equality check notices a changed block". It checks `'image: x'.replace(...)` on a literal string, so it would pass even if the guide/lane extraction or comparison were broken. Done looks like: pull the extraction (lane block from ci.yml, guide block from the subsection) into a helper. The control then mutates the real guide block (for example, drop the `options: --add-host …` line or change the digest) and asserts that the result is `not.toBe(laneBlock)`, using the same helper and fixture as the equality test.

**Issue 2 (blocking, FR-008): internet mode has no service block.** `docs/guides/consumer-setup.md`, "##### Internet mode". FR-008 asks for "the service block for allowlist mode … and for internet mode". The section only says "run the service with `PLANTUML_SECURITY_PROFILE: INTERNET`". An operator can't tell whether to keep `PLANTUML_ALLOWLIST_URL`, the canary entry or `--add-host`. Done looks like: a short YAML and/or `docker run` block for internet mode, plus one sentence on what to drop from the allowlist block. Add a substring assertion for it (for example, the guide subsection contains `PLANTUML_SECURITY_PROFILE: INTERNET` or `=INTERNET`).

**Issue 3: `updated:` not bumped.** `docs/architecture/ci-cd-pipeline.md:5` still reads `updated: 2026-08-21T00:00:00Z`. T053 step 2 says to bump it.

**Issue 4: wrong issue references in the ADR.** `docs/adr/0074-plantuml-external-include-opt-in.md` Context says "Two consuming sites (#6100 and #6916)". Those are `spec-kitty/spec-kitty#6100` and `#6916` (spec.md:43). On GitHub, bare `#6100` autolinks to the doc-kitty repo, and they are issues, not sites. Done looks like: "the consumer need in spec-kitty/spec-kitty#6100 and #6916", or full links.

**Issue 5 (nit, on a line you edited): incomplete `ci-ok` needs list.** `docs/architecture/ci-cd-pipeline.md` says "`ci-ok` `needs: [code-quality, doc-sanity, build-example, plantuml-allowlist]`". `ci.yml:462` is `[detect-changes, code-quality, doc-sanity, build-example, a11y, plantuml-allowlist]`. Make the edited line match ci.yml, or say "among others".

**Issue 6 (nit, guide accuracy): the build notice and "warn on every run".**
- "The build prints … the full verify command, so you can copy it." `config.ts:533` prints a template with `<path> <url> <host> <container>` placeholders. Say it prints the command with placeholders to fill in.
- Internet mode says "Both the build and the check warn on every run". The check prints its internet warning only on a pass (`finish()`, `verdict.ok`); on failure it prints FAIL lines. "on every passing run", or "warn", is accurate.

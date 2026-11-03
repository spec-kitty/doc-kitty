---
affected_files: []
cycle_number: 1
mission_slug: plantuml-external-opt-in-01M6F052
reproduction_command:
reviewed_at: '2026-11-02T22:47:05Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP06
---

# WP06 review, cycle 1: changes requested (one security fail-open)

Everything else checks out: tests 94/94 green (plantuml-mode-check, plantuml-include-guard, golden), eslint clean, no child_process, the WP12 line pointers (L300/304/374/383/433/474/481/489/493/508/516/520/522/526) are real, the contract substrings and the 3x3 table hold, compareAllowlist is raw (case, trailing slash, :80 and leading space all differ), and empty items stay out of extra/missing.

**Issue 1 (blocking): `systemPropertyConfig` misses the system property PlantUML actually reads for the profile.**
- Where: `src/scripts/plantuml-mode-check.mjs:79` (`SYSTEM_PROPERTY_RE`).
- What is wrong: the pinned image (`plantuml-1.2026.9.jar` in `plantuml/plantuml-server@sha256:065c66ad…`) reads the profile with `SecurityUtils.getenv("PLANTUML_SECURITY_PROFILE")`, and `getenv(name)` returns `System.getProperty(name)` first when it is not empty (checked with `javap -c` on `SecurityUtils.getenv` and `SecurityProfile.init`). So the overriding property is `-DPLANTUML_SECURITY_PROFILE=…`, with underscores and upper case. The regex only matches `plantuml.security.profile`, `plantuml.allowlist.url` or `-D\s*plantuml\.` (a dot after `plantuml`), so it does not match. I checked that the JVM in the image picks it up: `JAVA_TOOL_OPTIONS=-DPLANTUML_SECURITY_PROFILE=INTERNET` gives `System.getProperty("PLANTUML_SECURITY_PROFILE") == "INTERNET"`.
- Concrete false PASS: `checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', JAVA_TOOL_OPTIONS: '-DPLANTUML_SECURITY_PROFILE=INTERNET' })` returns `{ ok: true }` (I reproduced it in node). The service really runs INTERNET, and an INTERNET service refuses the private canary (F1), so the unset behavioural check passes too. The unset profile rule (decision 01M6F4XFDPJ6XFBYM5HM65G1AM) exists to catch exactly this case. In declared modes, the same blind spot makes the configuration half read the wrong profile.
- What done looks like: `systemPropertyConfig` is true for any of the five option variables that mention `PLANTUML_SECURITY_PROFILE` or `plantuml.allowlist.url` in any case and with `.` or `_` as separators. For example, add `plantuml[._]security[._]profile`, `plantuml[._]allowlist[._]url` and `-D\s*["']?plantuml[._]` (with `i`) to the regex. Add test rows for `-DPLANTUML_SECURITY_PROFILE=INTERNET` in `JAVA_TOOL_OPTIONS`: one for `systemPropertyConfig`, one for `checkUnsetProfile` (fails with `configured through Java system properties` even with SANDBOX), and one through `checkDeclaredMode` (allowlist). Keep a positive control where an unrelated `-Dfoo=bar` passes.

**Hardening (recommended, not blocking):**
- `SecurityUtils.getenv("plantuml.allowlist.url")` also reads an environment variable literally named `plantuml.allowlist.url` before it reads `PLANTUML_ALLOWLIST_URL`. The pinned image's `/entrypoint.sh` runs under dash, which drops such names, so this is not reachable on the pinned image. With an exec-form entrypoint it would win over the value the check compares, and a "matching" `PLANTUML_ALLOWLIST_URL` would pass while the real allowlist holds extra entries. To close it cheaply, fail closed (system-properties message, or `could not read the service configuration`) on any env key matching `/^plantuml\./i`.
- `hit(paths.allowed|denied)` at L468 uses `startsWith`, so with fixture names that are prefixes of each other (e.g. `a.puml` and `a.puml2`, possible through WP11's extraFixtures), one fixture's fetch counts for the other. Match the path exactly, or the path followed by `?`.

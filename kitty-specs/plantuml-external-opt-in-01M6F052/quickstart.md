# Quickstart: allow one remote include source (allowlist mode)

The operator flow the guide subsection "Allowing external includes" will teach (FR-008). Values follow [contracts/opt-in-setting.md](./contracts/opt-in-setting.md) and [contracts/include-check-cli.md](./contracts/include-check-cli.md).

Bundled includes such as `!include <C4/C4_Container>` already render in sandbox mode. You need this only for includes fetched by URL.

## 1. Declare the entry

In `astro.config.mjs`:

```js
docKitty({
  // ...
  diagrams: true,
  plantumlAllowExternal: ['https://styles.example.org/plantuml/'],
});
```

Or, for one environment only (it wins over the site configuration):

```sh
export DK_PLANTUML_ALLOW_EXTERNAL='https://styles.example.org/plantuml/'
```

End every entry with `/`, leave out `@` (PlantUML never matches an entry containing it), and write the service's entries exactly as declared: the include check compares them as raw strings. PlantUML matches entries as raw string prefixes, so `https://styles.example.org` would also allow `https://styles.example.org.evil.com`.

## 2. Run the service in allowlist mode

The service needs your entries plus the canary entry, which the include check uses where it runs.

GitHub Actions (the same block the toolkit's `plantuml-allowlist` CI lane runs, with your entry in place of the CI one):

```yaml
services:
  plantuml:
    image: plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618
    ports:
      - 8091:8080
    options: --add-host dk-canary:host-gateway
    env:
      PLANTUML_SECURITY_PROFILE: ALLOWLIST
      PLANTUML_ALLOWLIST_URL: "https://styles.example.org/plantuml/;http://dk-canary:18091/dk-canary/allowed/"
```

Anywhere else:

```sh
docker run -d --name plantuml -p 127.0.0.1:8091:8080 \
  --add-host dk-canary:host-gateway \
  -e PLANTUML_SECURITY_PROFILE=ALLOWLIST \
  -e 'PLANTUML_ALLOWLIST_URL=https://styles.example.org/plantuml/;http://dk-canary:18091/dk-canary/allowed/' \
  plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618
```

## 3. Verify the service

After `pnpm install`:

```sh
pnpm exec dockitty-assert-plantuml-no-remote-include \
  --astro-config astro.config.mjs \
  --server http://localhost:8091/svg/ \
  --canary-host dk-canary --canary-port 18091 \
  --service-container plantuml
```

Expected:

```
assert-plantuml-no-remote-include: declared: allowlist (from site configuration): https://styles.example.org/plantuml/
...
assert-plantuml-no-remote-include: OK — declared allowlist matches the service: ...
```

The check fetches the canary's allowed path, proves the denied path is reachable and refused, and reads the service's `PLANTUML_ALLOWLIST_URL` to confirm it equals your entries plus the canary entry. It never requests your entries.

Without `--astro-config` the check reads only `DK_PLANTUML_ALLOW_EXTERNAL`; a value set only in `astro.config.mjs` is then not seen, and the check runs and passes as unset. Always pass `--astro-config`. Without `--service-container` allowlist mode fails, because the check cannot prove the refusal or the entries.

**Your service must be inspectable with `docker inspect`.** A service on Kubernetes, a plain jar, or a remote server cannot pass allowlist or internet mode; the check has no way to read its configuration. An operator-asserted allowlist is a planned follow-up.

The last stdout line before `OK` is the verdict: `verdict: declared allowlist, observed allowlist`.

To check what will be verified without touching the service: add `--print-declared`.

## 4. Build

```sh
DK_DIAGRAM_BUILD_RENDER=build DK_PLANTUML_SERVER_URL=http://localhost:8091/svg/ pnpm astro build
```

The build prints `[dk-plantuml] declared PlantUML allowlist mode (from site configuration): https://styles.example.org/plantuml/. The build cannot see the service; verify it with: dockitty-assert-plantuml-no-remote-include --astro-config astro.config.mjs ...`, the full command from step 3. A diagram that includes a URL outside the entry is refused by the service and fails the build, as today.

## 5. Turn it off

Remove `plantumlAllowExternal` (and unset `DK_PLANTUML_ALLOW_EXTERNAL`), and return the service to `PLANTUML_SECURITY_PROFILE: SANDBOX` with no allowlist variable. There is no environment off-switch: setting `DK_PLANTUML_ALLOW_EXTERNAL=""` means unset, so the site's allowlist still applies. Remove the site option.

If you remove the setting but leave the service open, run the check with `--service-container`: with the opt-in unset it then requires `PLANTUML_SECURITY_PROFILE=SANDBOX` and fails otherwise (`opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is …`). This is a behaviour change: a service named by `--service-container` whose profile is not `SANDBOX` used to pass. Without `--service-container`, a service in allowlist mode with the canary entry is caught only when you run with `--canary-host dk-canary --canary-port 18091` (with a random port the canary is never on its allowlist), and a real internet-mode service is not caught at all (it refuses the private canary).

## Internet mode

Set `plantumlAllowExternal: 'internet'` (or `DK_PLANTUML_ALLOW_EXTERNAL=internet`, lowercase only) and `PLANTUML_SECURITY_PROFILE: INTERNET`. Verify with the same command as step 3, `--service-container` included: the check reads the container's `PLANTUML_SECURITY_PROFILE` and requires `INTERNET`. A real internet-mode service refuses the check's private canary, so the canary lines it prints are information only, and a service the check cannot inspect cannot pass internet mode either. The build and the check both warn on every run: the service may fetch any URL, including internal networks and cloud metadata endpoints. Allowlist and internet modes also relax PlantUML's local-file reads.

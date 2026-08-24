# Quickstart — authoring audience, related & citations

How an author uses what M3 ships. (Implementation-facing; the normative contract is
`docs/context/convention.md` + `metadata-model.md`, updated by FR-021.)

## Say who a page is for

```yaml
audience:
  - profile: contributor            # → context/audience/contributor.md
    guidance_text: How a toolkit contributor should read this page.
```

Renders a "Who is this for" block. If `context/audience/contributor.md` exists the
name links to it; if not, the humanized slug renders as text and the build prints a
warning (it does not fail).

## Point to related pages

```yaml
related:
  - architecture/overview           # bare slug → shows the target's own title/kind/description
  - ref: guides/deployment
    note: how CI deploys this       # object → note overrides the target description
```

Renders resolved cards named by the target's title. A `deprecated`/`superseded`
target shows a stale-target status marker. A ref that resolves to no page **fails the
build**.

## Cite sources

Inline (one-off):

```yaml
external_references:
  - url: https://example.com/post
    title: A one-off source
```

From the catalog (cited by many pages) — add the record once:

```yaml
# docs/_meta/bibliography.yaml
- id: divio-2017
  title: The documentation system
  authors: [Daniele Procida]
  url: https://documentation.divio.com
  issued: 2017
```

then cite it:

```yaml
external_references:
  - type: biblio                    # catalog type: biblio → bibliography, tool → tools
    id: divio-2017
```

An `{ type, id }` whose id is not in the catalog (or an unknown catalog `type`)
**fails the build**. Agents can dereference the catalog at `/api/bibliography.json`.

## Author a persona

```yaml
# context/audience/contributor.md
---
title: The Contributor
doc_status: active
type: Context
kind: Persona
role: A developer extending the toolkit.
goals:
  - Ship a feature without breaking the contract.
responsibilities:
  - Keep ci-ok green.
---
```

Personas live under `context/audience/`; the `role`/`goals`/`responsibilities` fields
are required for `kind: Persona` and render in the passport. The Audiences hub
(`context/audience/README.md`, `kind: Hub`) lists them.

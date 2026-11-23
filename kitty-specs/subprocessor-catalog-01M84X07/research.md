# Research: Sub-processor catalog

Mission `subprocessor-catalog-01M84X07` (issue #403). Each entry records a
decision, the reason for it, and the alternatives considered.

## R-01 — Where an invalid catalog fails

- **Decision**: at `astro:config:setup`, in a new file-gated integration. It
  produces one aggregate error that lists every problem.
- **Rationale**: The error comes before any page renders. The integration
  already knows whether the file exists, so the same place decides route
  injection. This follows the gherkin integration (`src/lib/integrations/gherkin.ts`).
- **Alternatives**:
  - Validate lazily in the route. Rejected: the error comes late, and a missing route looks like a failed one.
  - Use the content collection schema (zod). Rejected: the catalog is not a docs page, and the gate must run without Astro.
- **Decider**: operator (DM `01M8545YJX3DY4G3DEYX81G49Y`).

## R-02 — Sharing validation between the gate and the build

- **Decision**: put the checks in a pure core (`subprocessors-core.mjs`) that
  takes its reference data as arguments: known bibliography ids, known tool ids,
  and the measures index.
- **Rationale**: `validate-catalog.mjs` re-implements citation resolution because
  the TS resolver pulls in Astro. The measures core, by contrast, is bare-Node and
  shared. Injecting the reference data keeps one verdict for sub-processor
  records, whichever loader supplied the ids. `measures-parity.test.ts` is the
  model for the parity test.
- **Alternatives**: duplicate the checks in the gate, as citations do. Rejected
  because of NFR-002.

## R-03 — ISO 3166-1 alpha-2 codes

- **Decision**: embed a frozen constant of the officially assigned alpha-2 codes
  (249 entries, as published by the ISO 3166 Maintenance Agency) in
  `subprocessors-iso3166.mjs`, with a header naming the source and the review date.
- **Rationale**: No new dependency (DIRECTIVE_051), and the result is
  deterministic. The list changes rarely, and a change is a reviewed one-line edit.
- **Alternatives**:
  - `i18n-iso-countries`. Rejected: a new dependency for one lookup.
  - `Intl.DisplayNames`. Rejected: it accepts unassigned codes and varies with the ICU build.
- **Open**: user-assigned codes (`XA`–`XZ`, `AA`, `QM`–`QZ`, `ZZ`) are rejected. ⚖
  Counsel may want `EU` (exceptionally reserved). It is not accepted in v1, and the
  guide says so.

## R-04 — Byte-stable RSS

- **Decision**:
  - Each item's `pubDate` is its change date at 00:00:00 UTC.
  - The channel carries no `lastBuildDate`, or one derived from the latest change date.
  - Items are sorted by date descending, then by id, then by kind.
  - Each item's `guid` is `<feed-url>#<id>-<kind>-<date>` with `isPermaLink="false"`.
- **Rationale**: NFR-001. RSS readers sort on `pubDate`, and a future `pubDate`
  is valid XML. ⚖ How readers display future items is a notice question for
  counsel, not a format question.
- **Alternatives**: Atom. Rejected because the site's existing feed is RSS and the
  issue names "feeds"; the feed format can follow later.

## R-05 — Discovery through the agent index

- **Decision**: add `subprocessors: '/api/subprocessors.json'` and
  `subprocessorFeed: '/subprocessors.xml'` to `SURFACE_ROUTES`. The agent index
  adds `_links.subprocessors` and `_links.subprocessorFeed` when they are served.
- **Rationale**: Served-surface detection is the single source of truth for
  `_links` (`served-surfaces.ts`). The links are optional and additive, so the
  index contract major stays `"3"`.
- **Alternatives**: always emit the links. Rejected: that would point at a 404 when there is no file.

## R-06 — Unknown fields

- **Decision**: an unknown key on a record is an error.
- **Rationale**: a typo such as `untill` would otherwise silently drop a removal.
  The catalog is small and hand-edited.
- **Alternatives**: warn, as for open vocabularies (ADR-0031). Rejected because
  the records are closed, like citations.

## R-07 — Date handling

- **Decision**: `since` and `until` must be `YYYY-MM-DD` calendar dates. A YAML
  date scalar is normalised to that string, never to a `Date` carrying the local
  time zone. `until >= since`.
- **Rationale**: Byte stability, and no time-zone drift between machines.
- **Alternatives**: full timestamps. Rejected: changes are announced by day.

# Research: Export section-index page bodies

## OKF §8 and prose in index.md

- **Source:** the OKF SPEC.md (GoogleCloudPlatform/knowledge-catalog, `okf/SPEC.md`, linked from ADR-0059:154).
- **What it says:** §8 says the body of a reserved file uses sections, each grouping concepts under a heading. Every example is headings plus entry lists. §11 rule 1 says reserved files follow the §8 structure.
- **Assessment:** the spec does not explicitly allow or forbid prose.
- **Decision (operator, DM 01M5S3K92JHE9P6B427E8WH4VC):** keep `index.md` strictly §8. Write the README body as a sibling concept page instead.

## Sibling path

- **Decision:** `<id>.md`, for example `guides/README.md`. It is unique because no other node can have that id. It follows a configured `indexBasename`, and it is not a reserved OKF filename.
- **Rejected:** a fixed `overview.md`, because it can collide with a real page.

## Persona reachability

`exportOkfBundle` exports `page` and `persona` nodes, and `isIndexId` is id-only, so a persona README takes the index branch.

# Charter fixtures (documentation-charter WP05)

Committed, inspectable docs roots that the WP05 consumption tests exercise the
Documentation Charter against. See `../CHARTER-EVIDENCE.md` for the full proof.

- **`adopter/`** — a real consumer's single `_meta/charter.yaml` that forbids a
  vocabulary term (`Feature`), adds a new lifecycle status (`reviewed`), and relaxes
  a non-floor required field (`description`). Four pages exercise each axis plus the
  immovable `title` floor. Driven by `../charter-governance.test.ts` (T024) as a
  differential against a canonical, no-charter baseline. `_meta/vocabulary.yaml`
  mirrors the charter's forbidden term because the standalone gate's forbidden-term
  failure currently reads that legacy file (documented follow-up in CHARTER-EVIDENCE.md).

- **`legacy-clean/`** — a legacy-only root (a `_meta/sections.yaml`, **no**
  `charter.yaml`): the NFR-002 non-regression baseline (governance resolves to the
  canonical shipped defaults) and the "no Spec Kitty on PATH" clean-run root. Driven
  by `../charter-cleanroom.test.ts` (T025/T026).

These roots are NOT built by the clean-room orchestrator (`run-consumption-test.mjs`
builds only `../consumer-fixture/`); they are read directly by the two Vitest suites.

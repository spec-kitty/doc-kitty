# Data model

- **BreakageRecord** — category (markdown | starlight | compiler | loader | hooks | diagrams | pagefind | gates), symptom (what fails), file, cause, known_fix, ticket (#119/#143/#144/#145/#146), env_drift (bool).
- **PluginProof** — plugin name, evidence (selector or string in built HTML), page, result (ran | lost).
- **GateBaseline** — gate, file, reason for change.
- **ScenariosApi** — `version` (bumped), `generated_by` (kept), `generated_from` (removed in 0.4.0). See contracts/.
- **GeneratorStamp** — current OKF actor form only after 0.4.0; legacy form → validation error with regenerate instruction.

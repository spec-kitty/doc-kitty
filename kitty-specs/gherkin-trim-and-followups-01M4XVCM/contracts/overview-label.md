# Contract: Overview label (FR-009, FR-010)

- **UI string key**: `dockitty.sidebar.indexLabel`. The English default is `Overview`, injected by DocKitty's Starlight plugin `doc-kitty:i18n` (hook `i18n:setup`, `injectTranslations`).
- **Option**: `defineDocKittyIntegrations({ sidebar: { indexLabel: string } })`. A blank value or a value that is not a string throws `[dk-config] sidebar.indexLabel must be a non-empty string`. An unknown key under `sidebar` throws an error that names the key.
- **Resolution, per page**: `sidebar.indexLabel` → `locals.t('dockitty.sidebar.indexLabel')` for the page's locale → Starlight's default-locale fallback → `Overview`.
- **Where it applies**: the index entry of a nested group whose label repeats the group label (#112 rule, unchanged). The "another entry already has this label" check compares against the **resolved** label.
- **Prev/next**: show the page's own title, as in 0.3.0. The label never appears in pagination.
- **With neither set**: the output is byte-identical to 0.3.0 (NFR-006).
- **With a consumer `sidebar` (Starlight config)**: shaping is skipped as today, so the label does not apply.

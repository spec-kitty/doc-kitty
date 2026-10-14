import { INDEX_ENTRY_LABEL } from './route-shaping.js';

/** Starlight UI-string key for the index label, and its English default. */
const SIDEBAR_UI_STRINGS = { 'dockitty.sidebar.indexLabel': INDEX_ENTRY_LABEL } as const;

/**
 * The Starlight plugin that ships the toolkit's UI strings (#161): `en` carries
 * the default; a locale without the key falls back to `en` (Starlight's rule).
 */
export const DOC_KITTY_I18N_PLUGIN = {
  name: 'doc-kitty:i18n',
  hooks: {
    // Starlight's plugin schema requires `config:setup` (or the legacy `setup`) to be present.
    'config:setup'() {},
    'i18n:setup'({ injectTranslations }: { injectTranslations: (t: Record<string, Record<string, string>>) => void }) {
      injectTranslations({ en: { ...SIDEBAR_UI_STRINGS } });
    },
  },
};

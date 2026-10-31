/**
 * The opt-in GitHub-alert integration (#250, ADR-0068). Registered only when
 * `defineDocKittyIntegrations({ githubAlerts: true })`; imports only leaf
 * modules, never `../config`.
 */
import type { AstroIntegration } from 'astro';
import githubAlerts from '../remark/github-alerts.js';

/**
 * Adds the `githubAlerts` remark pass. It sits in the integrations array before
 * Starlight (after the glossary and the Gherkin fence stage), and `updateConfig`
 * appends, so the pass runs before Starlight's `remarkAsides`, which turns the
 * directives it emits into native asides. Running after the glossary passes
 * means the glossary sees the same blockquote the re-derive sees.
 */
export const githubAlertsIntegration: AstroIntegration = {
  name: 'doc-kitty:github-alerts',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      updateConfig({ markdown: { remarkPlugins: [githubAlerts] } });
    },
  },
};

// @ts-check
/*
 * Fixture site for plantuml-resolution-parity.test.ts (NFR-003). It calls the REAL
 * defineDocKittyIntegrations, so the build side of the parity test runs production
 * code; `indexBasename: ['PARITY']` is the proof (read back as `names`).
 *
 * `DK_PARITY_SITE_VALUE` is a TEST-ONLY knob that sets the `plantumlAllowExternal` option:
 *   absent    -> the key is omitted
 *   undefined -> the key is present with the value `undefined`
 *   otherwise -> JSON.parse of the knob is the option value
 */
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '../../../lib/config.ts';

const knob = process.env.DK_PARITY_SITE_VALUE ?? 'absent';
/** @type {Record<string, unknown>} */
const siteOption = {};
if (knob === 'undefined') siteOption.plantumlAllowExternal = undefined;
else if (knob !== 'absent') siteOption.plantumlAllowExternal = JSON.parse(knob);

export default defineConfig({
  integrations: defineDocKittyIntegrations({
    title: 'Parity fixture',
    indexBasename: ['PARITY'],
    ...siteOption,
  }),
});

import base from './playwright.config';
export default {
  ...base,
  projects: base.projects!.map((p) => ({ ...p, use: { ...p.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } } })),
};

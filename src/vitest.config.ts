import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the framework-agnostic units are tested here; Astro-coupled route
    // wiring is covered by the example site's build in CI.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

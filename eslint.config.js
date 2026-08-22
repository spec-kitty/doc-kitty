// Flat ESLint config for the toolkit sources. Deliberately boring: the ESLint
// and typescript-eslint "recommended" presets, scoped to the TypeScript under
// `src/`. Build output and generated dirs are ignored.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.astro/**',
      '**/*.d.ts',
    ],
  },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
);

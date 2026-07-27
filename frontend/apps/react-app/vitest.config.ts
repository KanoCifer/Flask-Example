import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { baseVitestConfig } from '@readinglist/config/vitest.config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  ...baseVitestConfig(),
  test: {
    ...baseVitestConfig().test,
    setupFiles: ['./src/test/setup.ts'],
  },
});

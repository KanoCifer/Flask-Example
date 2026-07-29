import { defineConfig } from 'vitest/config';
import { baseVitestConfig } from '@readinglist/config/vitest.config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  ...baseVitestConfig(),
  test: {
    ...baseVitestConfig().test,
  },
});

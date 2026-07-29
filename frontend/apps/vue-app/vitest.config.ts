import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { baseVitestConfig } from '@readinglist/config/vitest.config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    tsconfigPaths: true,
  },
  ...baseVitestConfig(),
  test: {
    ...baseVitestConfig().test,
    setupFiles: ['./src/test/setup.ts'],
  },
});

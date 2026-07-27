/**
 * 共享 vitest 配置 — 两端通用的 test 选项。
 *
 * 路径解析由 vite-tsconfig-paths 插件从 tsconfig.json 读取，
 * 不需要在此重复配置 alias。
 */
export function baseVitestConfig() {
  return {
    test: {
      environment: 'happy-dom',
      include: ['src/**/__tests__/**/*.test.ts'] as string[],
    },
  };
}

/**
 * @readinglist/config — 跨前端共享的构建/测试/格式化配置。
 *
 * 子路径导出：
 * - `@readinglist/config/vitest-setup` — 公共测试 setup
 * - `@readinglist/config/vitest.config` — 基础 vitest 配置工厂
 * - `@readinglist/config/vite-shared` — 共享 vite 片段（proxy/build）
 * - `@readinglist/config/tsconfig.base` — 共享 tsconfig compilerOptions
 */
export { baseVitestConfig } from './vitest.config.js';
export {
  proxyConfig,
  sharedBuildConfig,
  createServerConfig,
} from './vite-shared.js';

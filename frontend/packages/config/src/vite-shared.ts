/**
 * 共享 vite 配置片段 — 两端通用的 proxy、build base。
 *
 * 各 app 的 vite.config.ts 应 import 这些片段并组合自身框架相关配置。
 * 注意：onwarn 不在此共享，因为 Vite 8 / Rolldown 的日志类型与 Vite 内置
 * 类型不兼容，直接内联在各 app 中即可（仅 5 行）。
 *
 * @example
 * import { sharedBuildConfig, createServerConfig } from '@readinglist/config/vite-shared';
 */

/** 开发服务器代理配置：v1/v2 → Python 后端，v3 → Go 后端 */
export const proxyConfig = {
  '/v1': {
    target: 'http://localhost:5555',
    changeOrigin: true,
  },
  '/v2': {
    target: 'http://localhost:5555',
    changeOrigin: true,
  },
  '/v3': {
    target: 'http://localhost:5556',
    changeOrigin: true,
    ws: true,
  },
} as const;

/** 共享 build 基础配置（minify、cssMinify、sourcemap、chunkSizeWarningLimit） */
export const sharedBuildConfig = {
  minify: 'oxc',
  cssMinify: true,
  sourcemap: false,
  cssCodeSplit:true,
  // chunk 超过此大小时发出警告（twikoo 评论组件近 1MB，适度放宽）
  chunkSizeWarningLimit: 1200,
} as const;

export function createServerConfig(
  port: number
): { port: number; proxy: Record<string, object> } {
  const proxy: Record<string, object> = {...proxyConfig};
  return { port, proxy };
}

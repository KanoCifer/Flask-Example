import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import tsconfigPaths from 'vite-tsconfig-paths';
import {
  sharedBuildConfig,
  createServerConfig,
} from '@readinglist/config/vite-shared';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    vue(),
    vueDevTools({
      launchEditor: 'zed',
    }),
    tailwindcss(),
  ],
  build: {
    ...sharedBuildConfig,
    terserOptions: {
      compress: {
        drop_console: true, // 删除 console
        drop_debugger: true,
      },
    },
    // 只在非 SSG 构建时使用 manualChunks
    rollupOptions: process.env.SSG_BUILD
      ? {}
      : {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;

              // ✅ 评论组件（最大，~1MB）— 独立拆出，仅文章页按需加载
              if (id.includes('twikoo')) {
                return 'twikoo';
              }

              // ✅ 图表
              if (id.includes('echarts')) {
                return 'echarts';
              }

              // ✅ 富文本
              if (id.includes('@tiptap')) {
                return 'tiptap';
              }

              // ✅ 代码高亮
              if (id.includes('highlight.js')) {
                return 'syntax-highlight';
              }

              // ✅ 动画
              if (id.includes('lottie-web')) {
                return 'lottie';
              }

              // ✅ 动效库
              if (id.includes('motion-v') || id.includes('framer-motion')) {
                return 'motion';
              }

              // ✅ Vue 生态（注意顺序！）
              if (id.includes('vue-router')) return 'router';
              if (id.includes('pinia')) return 'store';
              if (id.includes('node_modules/vue/')) return 'vue';

              // ✅ 工具库
              if (id.includes('axios')) return 'axios';
              if (id.includes('dayjs')) return 'dayjs';
            },
          },
          // 忽略 lottie-web 的 eval 警告（第三方库问题，无法修复）
          onwarn(warning, warn) {
            if (
              warning.code === 'EVAL' &&
              warning.id?.includes('node_modules/lottie-web')
            ) {
              return;
            }
            warn(warning);
          },
        },
  },
  optimizeDeps: {
    include: ['vue3-lottie'],
  },
  server: createServerConfig(5173),
});

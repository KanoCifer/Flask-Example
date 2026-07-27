import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import reactScan from '@react-scan/vite-plugin-react-scan';
import { reactClickToComponent } from 'vite-plugin-react-click-to-component';
import { defineConfig } from 'vite';
import {
  sharedBuildConfig,
  createServerConfig,
} from '@readinglist/config/vite-shared';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react(), tailwindcss(), reactClickToComponent(), reactScan()],
  build: {
    ...sharedBuildConfig,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // ✅ 评论组件（最大，~1MB）— 独立拆出，仅文章页按需加载
          if (id.includes('twikoo')) {
            return 'twikoo';
          }

          // ✅ 图表（体积大，单独打包）
          if (id.includes('echarts') || id.includes('echarts-for-react')) {
            return 'echarts';
          }

          // ✅ 代码高亮
          if (id.includes('highlight.js')) {
            return 'syntax-highlight';
          }

          // ✅ 动画
          if (id.includes('lottie-web')) {
            return 'lottie';
          }
          if (id.includes('lottie-react')) {
            return 'lottie';
          }

          // ✅ React 生态
          if (id.includes('react-router')) return 'router';
          if (
            id.includes('zustand') ||
            id.includes('redux') ||
            id.includes('jotai')
          )
            return 'state';
          if (id.includes('node_modules/react/')) return 'react';
          if (id.includes('node_modules/react-dom/')) return 'react-dom';

          // ✅ Markdown
          if (id.includes('marked') || id.includes('markdown-it')) {
            return 'markdown';
          }

          // ✅ 工具库
          if (
            id.includes('axios') ||
            id.includes('ky') ||
            id.includes('ofetch')
          )
            return 'http';
          if (
            id.includes('dayjs') ||
            id.includes('date-fns') ||
            id.includes('moment')
          )
            return 'date';
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
  server: createServerConfig(5174),
});

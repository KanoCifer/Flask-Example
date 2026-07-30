import { createHead } from '@vueuse/head';
import 'highlight.js/styles/atom-one-dark.css';
import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { isColorScheme } from '@readinglist/utils';
import './styles/base.css'; // Tailwind v4 入口
import './styles/backgrounds.css'; // 背景渐变
import './styles/base.scss'; // font-face sass
import './styles/route-transitions.css'; // 路由过渡动画 keyframes
import './styles/squircle.css';
import './styles/icon-crossfade.css';
// echarts 是模块顶层 use([...]) 注册副作用,必须在首次 echarts.init() 前执行;
// 这里 eager import 确保注册在 entry chunk 里执行(其他路由 chunk 不再重复触发)。
// 注意:此处新增 ~700KB echarts 体积在 entry chunk,可接受的代价是注册副作用集中。
import './lib/echarts';
import './lib/dayjs';
import { initVisitorWebSocket } from './lib';
import router from './router';

// Apply persisted color scheme before mount to avoid flash of wrong colors
if (typeof document !== 'undefined') {
  const saved = localStorage.getItem('color-scheme');
  const scheme = isColorScheme(saved) ? saved : 'paper';
  if (!isColorScheme(saved)) {
    localStorage.setItem('color-scheme', scheme);
  }
  document.documentElement.setAttribute('data-color-scheme', scheme);
}

const app = createApp(App);
const pinia = createPinia();
const head = createHead();

setActivePinia(pinia);

app.use(pinia);
app.use(router);
app.use(head);

if (typeof window !== 'undefined') {
  initVisitorWebSocket(pinia);
}

app.mount('#app');

import { createHead } from '@vueuse/head';
import 'highlight.js/styles/atom-one-dark.css';
import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { isColorScheme } from '@/stores';
import './styles/base.css'; // Tailwind v4 入口
import './styles/backgrounds.css'; // 背景渐变
import './styles/base.scss'; // font-face sass
import './styles/route-transitions.css'; // 路由过渡动画 keyframes
import './styles/squircle.css';
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

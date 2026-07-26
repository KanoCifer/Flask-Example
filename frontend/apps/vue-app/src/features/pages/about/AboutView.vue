<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue';
import { motion } from 'motion-v';
import { SPRING } from '@/constants';
import { useTypewriter } from '@/composables';
import { IconExternalLink } from '@/components';

const AboutIMG = '/images/about-thumb.webp';

// Greeting typewriter
const greeting = useTypewriter();
const GREETING_TEXT = '你好；)';
const GREETING_SPEED = 1; // 1 char/frame ≈ 60 chars/sec

// Bio typewriter — each line types sequentially
const bioLines = [
  { hook: useTypewriter(), text: '我是 Kuroome。', class: 'font-bold' },
  {
    hook: useTypewriter(),
    text: '技术栈包括 Go、Python、React、TaskIQ、FastAPI、PostgreSQL、Vue3、Redis、MongoDB 等。',
  },
  {
    hook: useTypewriter(),
    text: '技术方向包含 Web 开发、前后端等。',
  },
  {
    hook: useTypewriter(),
    text: '我的兴趣爱好广泛，涵盖编程、阅读、钓鱼等多个领域。',
  },
  {
    hook: useTypewriter(),
    text: '这个网站主要用来记录我的学习、阅读、生活点滴，希望你能喜欢！',
  },
];

const activeLineIdx = ref(-1);
const BIO_SPEED = 1; // 1 char/frame ≈ 60 chars/sec

const allBioDone = computed(
  () => bioLines.length > 0 && bioLines.every((l) => l.hook.isDone.value),
);

// 社交网络卡片组 —— 顺序按"阅读优先 → 视频娱乐"：
// 微信读书 → 小红书 → Bilibili → 抖音
// URL 与 handle 均为占位，待真实数据替换
// logo 全部引用 public/brand/ 下的真实品牌 logo
const socialLinks = [
  {
    name: '微信读书',
    handle: '@喂鱼佬一枚🐟',
    description: '我的微信读书',
    url: 'https://weread.qq.com/',
    accent: 'oklch(0.62 0.16 145)',
    logo: '/brand/weread.webp',
  },
  {
    name: '小红书',
    handle: '@北冥真的没有🐟',
    description: '我的xhs',
    url: 'https://www.xiaohongshu.com/user/profile/604d80c5000000000100973d',
    accent: 'oklch(0.62 0.2 25)',
    logo: '/brand/xiaohongshu.webp',
  },
  {
    name: 'Bilibili',
    handle: '@Kano_Cifer',
    description: '我的日常',
    url: 'https://space.bilibili.com/52697386',
    accent: 'oklch(0.66 0.16 235)',
    logo: '/brand/bilibili.webp',
  },
  {
    name: '抖音',
    handle: '@Kuroome5508',
    description: '我的抖音',
    url: 'https://www.douyin.com',
    accent: 'oklch(0.35 0.02 280)',
    logo: '/brand/douyin.webp',
  },
] as const;

function typeNextLine(idx: number) {
  if (idx >= bioLines.length) return;
  activeLineIdx.value = idx;
  bioLines[idx].hook.start(bioLines[idx].text, BIO_SPEED, () =>
    setTimeout(() => typeNextLine(idx + 1), 300),
  );
}

onMounted(() => {
  nextTick();
  greeting.start(GREETING_TEXT, GREETING_SPEED, () =>
    setTimeout(() => typeNextLine(0), 500),
  );
});
</script>

<template>
  <div
    class="about-page bg-page flex min-h-screen flex-col items-center justify-center px-6 py-20"
  >
    <!-- Hero: greeting + avatar -->
    <div
      class="hero-section animate-message-pop flex flex-col items-center gap-6"
    >
      <motion.div
        :initial="{ scale: 0, opacity: 0 }"
        :animate="{ scale: 1, opacity: 1 }"
        :transition="SPRING"
        class="avatar-wrapper relative"
      >
        <div class="avatar-glow"></div>
        <img
          :src="AboutIMG"
          alt="Kuroome"
          class="avatar-img relative h-28 w-28 rounded-full border-[3px] border-white object-cover shadow-xl md:h-36 md:w-36"
        />
      </motion.div>

      <div class="greeting-wrapper">
        <span class="greeting-text">{{ greeting.text.value }}</span>
        <span v-if="!greeting.isDone.value" class="cursor-blink"></span>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider my-10 w-xs"></div>

    <!-- Bio lines -->
    <div class="bio-section flex flex-col items-center gap-1 text-center">
      <div v-for="(line, i) in bioLines" :key="i" class="bio-line-wrapper">
        <span :class="line.class" class="bio-text">{{
          line.hook.text.value
        }}</span>
        <span
          v-if="activeLineIdx === i && !line.hook.isDone.value"
          class="cursor-blink"
        ></span>
      </div>
    </div>

    <!-- Social links -->
    <motion.div
      :initial="{ opacity: 0, y: 12 }"
      :animate="allBioDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }"
      :transition="{ duration: 0.6 }"
      class="social-section mt-10 flex items-center gap-5"
    >
      <span class="text-muted text-sm font-medium tracking-wide">联系方式</span>
      <div class="bg-border h-4 w-px"></div>
      <a
        href="https://github.com/KanoCifer"
        target="_blank"
        class="social-link text-muted hover:text-ink"
        title="GitHub"
      >
        <svg
          class="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clip-rule="evenodd"
          />
        </svg>
      </a>
      <a
        href="mailto:kano3255@outlook.com"
        class="social-link text-muted hover:text-ink"
        title="Email"
      >
        <svg
          class="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
          />
        </svg>
      </a>
    </motion.div>

    <!-- Social cards: 微信读书 / 小红书 / B站 / 抖音 -->
    <motion.div
      :initial="{ opacity: 0, y: 12 }"
      :animate="allBioDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }"
      :transition="{ duration: 0.6, delay: 0.15 }"
      class="social-cards mt-12 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <a
        v-for="link in socialLinks"
        :key="link.name"
        :href="link.url"
        target="_blank"
        rel="noopener"
        class="social-card group"
        :style="{ '--card-accent': link.accent }"
        :aria-label="`在 ${link.name} 上访问 Kuroome`"
      >
        <span class="social-card__hairline" aria-hidden="true"></span>
        <div class="social-card__row">
          <span class="social-card__logo" aria-hidden="true">
            <img
              :src="link.logo"
              :alt="`${link.name} logo`"
              class="social-card__logo-img"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span class="social-card__head">
            <span class="social-card__name">{{ link.name }}</span>
            <span class="social-card__handle">{{ link.handle }}</span>
          </span>
          <IconExternalLink class="social-card__arrow" aria-hidden="true" />
        </div>
        <p class="social-card__desc">{{ link.description }}</p>
      </a>
    </motion.div>
  </div>
</template>

<style scoped>
.greeting-text {
  font-size: clamp(3rem, 10vw, 6rem);
  line-height: 1;
  letter-spacing: 0.08em;
  color: var(--color-ink);
}

.bio-text {
  font-size: 1.05rem;
  line-height: 1.8;
  color: var(--color-muted);
}

.bio-line-wrapper {
  display: inline;
}

.greeting-wrapper {
  display: flex;
  align-items: baseline;
  justify-content: center;
  min-height: 1.2em;
}

.cursor-blink {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background-color: var(--color-accent);
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.divider {
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-border) 30%,
    var(--color-border) 70%,
    transparent
  );
}

.avatar-glow {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-muted));
  opacity: 0.25;
  filter: blur(14px);
  transition: opacity 0.5s ease;
}

.avatar-wrapper:hover .avatar-glow {
  opacity: 0.45;
}

.social-link {
  transition:
    transform 0.2s ease,
    color 0.2s ease;
}

.social-link:hover {
  transform: scale(1.15);
}

/* ============================================================
   Social cards —— 微信读书 / 小红书 / B站 / 抖音
   - 顶部 1.5px 平台色 hairline(<=5% 表面)
   - lifted paper shadow + inset 白边高光(继承 Polaroid 词汇)
   - hover: translateY(-2px) + 阴影加深 + 箭头右移
   - prefers-reduced-motion: 关闭位移,保留阴影
   ============================================================ */
.social-cards {
  --card-accent: var(--accent);
}

.social-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.125rem 1.125rem 1rem;
  background-color: var(--color-page);
  color: var(--color-ink);
  border-radius: 0.875rem; /* rounded-xl —— DESIGN.md */
  text-decoration: none;
  outline: none;
  box-shadow:
    0 1px 1px color-mix(in oklch, var(--ink) 6%, transparent),
    0 6px 14px color-mix(in oklch, var(--ink) 10%, transparent),
    0 18px 32px color-mix(in oklch, var(--ink) 8%),
    inset 0 1px 0 0 color-mix(in oklch, var(--page) 70%, transparent);
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, box-shadow;
}

.social-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 2px 2px color-mix(in oklch, var(--ink) 8%, transparent),
    0 12px 24px color-mix(in oklch, var(--ink) 18%, transparent),
    0 28px 48px color-mix(in oklch, var(--ink) 14%),
    inset 0 1px 0 0 color-mix(in oklch, var(--page) 70%, transparent);
}

.social-card:focus-visible {
  box-shadow:
    0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent),
    0 6px 14px color-mix(in oklch, var(--ink) 10%, transparent),
    0 18px 32px color-mix(in oklch, var(--ink) 8%),
    inset 0 1px 0 0 color-mix(in oklch, var(--page) 70%, transparent);
}

.social-card__hairline {
  position: absolute;
  top: 0;
  left: 0.875rem;
  right: 0.875rem;
  height: 1.5px;
  background: var(--card-accent, var(--accent));
  opacity: 0.85;
  pointer-events: none;
}

.social-card__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.social-card__logo {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.625rem; /* rounded-lg —— DESIGN.md */
  overflow: hidden;
  background: transparent;
}

.social-card__logo-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.social-card__head {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1 1 auto;
  min-width: 0;
}

.social-card__name {
  font-family: ui-serif, Georgia, 'Times New Roman', serif;
  font-size: 0.9375rem;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--color-ink);
  line-height: 1.25;
}

.social-card__handle {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: var(--color-muted);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.social-card__desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.social-card__arrow {
  flex: none;
  width: 0.95rem;
  height: 0.95rem;
  color: var(--color-muted);
  opacity: 0.5;
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease,
    color 0.2s ease;
}

.social-card:hover .social-card__arrow,
.social-card:focus-visible .social-card__arrow {
  transform: translate(2px, -2px);
  opacity: 1;
  color: var(--color-ink);
}

@media (prefers-reduced-motion: reduce) {
  .social-card,
  .social-card__arrow {
    transition: box-shadow 0.2s ease;
  }
  .social-card:hover,
  .social-card:focus-visible {
    transform: none;
  }
  .social-card:hover .social-card__arrow,
  .social-card:focus-visible .social-card__arrow {
    transform: none;
  }
}
</style>

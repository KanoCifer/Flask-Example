<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue';
import type { VNode } from 'vue';
import { IconExternalLink } from '@/components';
import { useHead } from '@unhead/vue';

useHead({ title: '隐私政策 · kanocifer' });

// ---------- 目录数据 ----------
interface TocItem {
  id: string;
  label: string;
  number: string;
}

const toc: TocItem[] = [
  { id: 'collect', label: '信息收集与使用', number: '01' },
  { id: 'share', label: '信息的分享和披露', number: '02' },
  { id: 'third-party', label: '第三方服务与数据流向', number: '03' },
  { id: 'third-site', label: '第三方网站', number: '04' },
  { id: 'retention', label: '数据保留与销毁', number: '05' },
  { id: 'rights', label: '你的权利', number: '06' },
  { id: 'security', label: '安全性', number: '07' },
  { id: 'automation', label: '自动化处理', number: '08' },
  { id: 'minor', label: '未成年人', number: '09' },
  { id: 'aux', label: '附属协议', number: '10' },
  { id: 'change', label: '隐私政策的变更', number: '11' },
  { id: 'contact', label: '联系本站', number: '12' },
];

const activeId = ref<string>('collect');

// ---------- 滚动监听：当前 section ----------
let observer: IntersectionObserver | null = null;
const initObserver = () => {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) activeId.value = visible[0].target.id;
    },
    { rootMargin: '-15% 0px -65% 0px', threshold: 0 },
  );
  toc.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer!.observe(el);
  });
};

// ---------- 阅读进度 ----------
const scrollProgress = ref(0);
const onScroll = () => {
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  scrollProgress.value = max > 0 ? Math.min(1, h.scrollTop / max) : 0;
};

onMounted(() => {
  requestAnimationFrame(initObserver);
  window.addEventListener('scroll', onScroll, { passive: true });
});
onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('scroll', onScroll);
});

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 96;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  activeId.value = id;
};

const totalSections = computed(() => toc.length);

// ============================================================
// Local functional components —— 用 h() 渲染函数避免拆 .vue 子文件
// ============================================================

const SectionHeader = (props: { number: string; title: string }) =>
  h('header', { class: 'flex items-baseline gap-4' }, [
    h(
      'span',
      {
        class: 'text-muted font-mono text-[11px] tracking-[0.2em] tabular-nums',
      },
      `§ ${props.number}`,
    ),
    h(
      'h2',
      {
        class:
          'text-ink font-serif text-2xl font-semibold tracking-tight sm:text-3xl',
      },
      props.title,
    ),
  ]);

const SubHeader = (props: { title: string; desc?: string }) =>
  h('div', { class: 'mt-10' }, [
    h('h3', { class: 'text-ink text-base font-semibold' }, props.title),
    props.desc
      ? h(
          'p',
          { class: 'text-muted mt-1.5 text-sm leading-relaxed' },
          props.desc,
        )
      : null,
  ]);

const DataRow = (
  props: { label: string },
  { slots }: { slots: { default?: () => VNode[] } },
) =>
  h('li', { class: 'flex items-baseline gap-3' }, [
    h(
      'span',
      {
        class:
          'text-ink/80 w-[5.5rem] shrink-0 font-mono text-[11px] tracking-wider uppercase',
      },
      props.label,
    ),
    h('span', { class: 'flex-1' }, slots.default ? slots.default() : []),
  ]);

const SecurityItem = (props: { tag: string; desc: string }) =>
  h('div', {}, [
    h(
      'dt',
      {
        class: 'text-ink/90 font-mono text-[10px] tracking-[0.2em] uppercase',
      },
      props.tag,
    ),
    h('dd', { class: 'text-muted mt-1.5 text-sm leading-relaxed' }, props.desc),
  ]);

const ServiceRow = (props: {
  name: string;
  tag: string;
  triggered: string;
  sends: string;
  lands: string;
}) =>
  h(
    'li',
    {
      class: 'bg-surface/25 /60 rounded-2xl border p-4 sm:p-5',
    },
    [
      h('div', { class: 'flex flex-wrap items-center gap-2' }, [
        h('h4', { class: 'text-ink font-medium' }, props.name),
        h(
          'span',
          {
            class:
              'bg-page text-muted rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide',
          },
          props.tag,
        ),
      ]),
      h(
        'dl',
        {
          class:
            'mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[6.5rem_1fr]',
        },
        [
          h(
            'dt',
            {
              class:
                'text-ink/80 font-mono text-[10px] tracking-[0.2em] uppercase sm:pt-0.5',
            },
            '触发',
          ),
          h('dd', { class: 'text-muted leading-relaxed' }, props.triggered),
          h(
            'dt',
            {
              class:
                'text-ink/80 font-mono text-[10px] tracking-[0.2em] uppercase sm:pt-0.5',
            },
            '带走',
          ),
          h('dd', { class: 'text-muted leading-relaxed' }, props.sends),
          h(
            'dt',
            {
              class:
                'text-ink/80 font-mono text-[10px] tracking-[0.2em] uppercase sm:pt-0.5',
            },
            '留在',
          ),
          h('dd', { class: 'text-muted leading-relaxed' }, props.lands),
        ],
      ),
    ],
  );

const RetentionRow = (props: { what: string; until: string }) =>
  h(
    'div',
    {
      class:
        'grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:px-5',
    },
    [
      h(
        'dt',
        {
          class: 'text-ink/90 font-mono text-[11px] tracking-[0.04em]',
        },
        props.what,
      ),
      h('dd', { class: 'text-muted leading-relaxed' }, props.until),
    ],
  );

const RightItem = (props: { title: string; desc: string }) =>
  h('li', { class: 'flex items-baseline gap-3' }, [
    h(
      'span',
      {
        class:
          'text-ink/80 w-[5.5rem] shrink-0 font-mono text-[11px] tracking-wider uppercase',
      },
      props.title,
    ),
    h('span', { class: 'text-muted flex-1 leading-relaxed' }, props.desc),
  ]);

const ContactCard = (props: { label: string; value: string; href: string }) =>
  h(
    'a',
    {
      href: props.href,
      target: props.href.startsWith('http') ? '_blank' : undefined,
      rel: props.href.startsWith('http') ? 'noopener noreferrer' : undefined,
      class:
        'bg-page /60 hover:border-accent/40 group flex items-center justify-between rounded-2xl border p-4 transition-colors sm:p-5',
    },
    [
      h('div', {}, [
        h(
          'p',
          {
            class:
              'text-muted font-mono text-[10px] tracking-[0.2em] uppercase',
          },
          props.label,
        ),
        h('p', { class: 'text-ink mt-1.5 text-sm font-medium' }, props.value),
      ]),
      h(IconExternalLink, {
        class:
          'text-muted group-hover:text-ink h-4 w-4 shrink-0 transition-colors',
      }),
    ],
  );
</script>

<template>
  <div class="privacy-page bg-page min-h-dvh pb-24">
    <!-- 顶部阅读进度条 -->
    <div
      class="bg-border sticky top-0 right-0 left-0 z-40 h-[2px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="bg-accent h-full transition-[width] duration-150 ease-out"
        :style="{ width: `${scrollProgress * 100}%` }"
      ></div>
    </div>

    <!-- ====================== Hero ====================== -->
    <section
      class="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-10 sm:pt-24 sm:pb-14"
      aria-labelledby="privacy-title"
    >
      <!-- Eyebrow -->
      <div
        class="text-muted mb-5 flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase"
      >
        <span class="bg-accent/60 inline-block h-px w-6"></span>
        <span class="font-mono">kanocifer · legal</span>
        <span class="bg-accent/60 inline-block h-px w-6"></span>
      </div>

      <!-- Title -->
      <h1
        id="privacy-title"
        class="text-ink max-w-3xl text-center font-serif text-5xl font-medium tracking-tight text-balance sm:text-6xl md:text-7xl"
      >
        <span
          v-for="(ch, i) in '隐私政策'.split('')"
          :key="i"
          class="title-word inline-block"
          :style="{ animationDelay: `${i * 80}ms` }"
          >{{ ch }}</span
        >
      </h1>

      <!-- Subtitle -->
      <p
        class="text-muted mt-6 max-w-xl text-center text-base leading-relaxed sm:text-lg"
      >
        这是一份关于本站如何收集、使用与保护你信息的说明。
      </p>

      <!-- Meta strip -->
      <div
        class="text-muted mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs"
      >
        <span class="inline-flex items-center gap-1.5">
          <span
            class="bg-accent/70 inline-block h-1.5 w-1.5 rounded-full"
            aria-hidden="true"
          ></span>
          <span class="font-mono tabular-nums">更新 · 2026.06.21</span>
        </span>
        <span aria-hidden="true" class="bg-border h-3 w-px"></span>
        <span class="font-mono tabular-nums">生效 · 2026.05.16</span>
        <span aria-hidden="true" class="bg-border h-3 w-px"></span>
        <span class="font-mono tabular-nums"
          >{{ totalSections }} 个章节 · 约 8 分钟</span
        >
        <span aria-hidden="true" class="bg-border h-3 w-px"></span>
        <span class="font-mono tabular-nums">v 1.1</span>
      </div>
    </section>

    <!-- ====================== Body: 2-col layout ====================== -->
    <div
      class="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 lg:grid-cols-[1fr_220px] lg:gap-16"
    >
      <!-- ============= Article ============= -->
      <article
        class="text-ink max-w-2xl text-[15.5px] leading-[1.85] sm:text-base"
      >
        <!-- ----- 引言 ----- -->
        <p
          class="text-muted first-letter:text-ink first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-3xl first-letter:leading-none"
        >
          欢迎来到
          <strong class="text-ink font-semibold">Kuroome's Blog</strong>
          （以下简称"本站"）。本站非常重视你的隐私与个人信息保护。你在使用网站时，
          我们仅会收集提供服务所必需的最少信息 ——
          通过这一页向你说明收集什么、为什么收集，以及你可以如何掌控它。
        </p>

        <!-- =============================================
             Section 01 · 信息收集与使用
             ============================================= -->
        <section id="collect" class="scroll-mt-28 pt-16">
          <SectionHeader number="01" title="信息收集与使用" />

          <SubHeader
            title="在你访问本站时"
            desc="以下信息由访问链路上的服务自动产生，本站本身不在前端持久化存储它们。"
          />
          <ul class="text-muted mt-4 space-y-2.5">
            <DataRow label="网络标识"
              >浏览器 UA、IP 地址等用于识别一次访问的最小标识</DataRow
            >
            <DataRow label="设备信息"
              >设备型号、操作系统版本等用于兼容性判断</DataRow
            >
            <DataRow label="访问过程"
              >操作路径、停留时长、加载性能等用于改进体验</DataRow
            >
          </ul>

          <SubHeader
            title="在你注册账户或发表评论时"
            desc="仅在你主动提交时收集；任何字段都可以留空，留空等同于不提供。"
          />
          <ul class="text-muted mt-4 space-y-2.5">
            <DataRow label="邮箱"
              >用于账户注册、密码重置与回复通知（不会公开展示）</DataRow
            >
            <DataRow label="用户名">作为你的公开显示身份</DataRow>
            <DataRow label="头像">通过 Gravatar 基于邮箱自动获取</DataRow>
            <DataRow label="网址"
              >如果你选择填写，会绑定到头像的点击跳转</DataRow
            >
            <DataRow label="IP 地址"
              >用于反垃圾与恶意用户识别（不会公开展示）</DataRow
            >
            <DataRow label="浏览器代理"
              >用于在评论中展示系统与浏览器版本，便于排查问题</DataRow
            >
          </ul>

          <SubHeader
            title="Cookies 与本地存储"
            desc="为提供登录、主题切换、偏好记忆等必要能力，本站会在你的浏览器中写入少量持久化数据。"
          />
          <div class="bg-surface/40 /70 mt-5 rounded-2xl border p-5 sm:p-6">
            <p class="text-ink/90">
              本站不会使用任何跨站跟踪 Cookie。
              所有写入都用于本站自身功能：身份认证、深色 / 浅色模式、用户偏好。
            </p>
            <p class="text-muted mt-3 text-sm leading-relaxed">
              你可以随时在浏览器设置中清除本站的 Cookie 与 LocalStorage。
              清除后只需重新登录，不影响其它功能。
            </p>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
              class="text-ink mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              在 Chrome 中管理 Cookie
              <IconExternalLink class="h-3.5 w-3.5" />
            </a>
          </div>
        </section>

        <!-- =============================================
             Section 02 · 信息的分享和披露
             ============================================= -->
        <section id="share" class="scroll-mt-28 pt-16">
          <SectionHeader number="02" title="信息的分享和披露" />
          <p class="text-muted mt-5">
            本站不会出售、交易或出租你的个人身份信息给任何外部公司或个人，除非：
          </p>
          <ul class="text-muted mt-4 space-y-2.5">
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>得到你本人的明确同意</span>
            </li>
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>依据法律法规、政府主管部门的强制性要求</span>
            </li>
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>为维护本站的合法权益、财产或安全</span>
            </li>
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>在紧急情况下为保护你或他人的生命安全</span>
            </li>
          </ul>
        </section>

        <!-- =============================================
             Section 03 · 第三方服务与数据流向
             ============================================= -->
        <section id="third-party" class="scroll-mt-28 pt-16">
          <SectionHeader number="03" title="第三方服务与数据流向" />
          <p class="text-muted mt-5">本节列明本站真实接入的所有外部服务。</p>

          <ul class="mt-7 space-y-3">
            <ServiceRow
              name="Twikoo（自托管）"
              tag="评论"
              triggered="你在博客文章或友链页提交评论时"
              sends="昵称、邮箱、网址、评论正文、UA、IP"
              lands="本站自己的服务器（api.kanocifer.chat/twikoo）。评论数据不出本站"
            />
            <ServiceRow
              name="阿里百灵 LLM"
              tag="AI 摘要 · 天气分析"
              triggered="你点击「生成摘要」或在钓鱼页触发 AI 天气分析时"
              sends="待摘要的整篇文章正文 / 钓鱼指标的实时天气数据 + 你的提问上下文"
              lands="api.tbox.cn（中国大陆 · 阿里云）。本站不会把账号信息、邮箱或 IP 一并发送"
            />
            <ServiceRow
              name="Bing 搜索（WebSearchTools）"
              tag="AI 联网检索"
              triggered="AI 在生成摘要或天气分析时按需触发"
              sends="AI 提取出的关键词"
              lands="Bing 搜索。返回的网页片段进入 LLM 上下文，不直接关联到你的账号"
            />
            <ServiceRow
              name="微信读书 WeRead"
              tag="书架导入"
              triggered="你在「微信读书」页粘贴 cookie/APIkey 并点击导入时"
              sends="你提供的Key（用于模拟登录拉取书架、划线、书评）"
              lands="本站服务器加密存储；导完后可用「清除 WeRead 数据」按钮一键删除"
            />
            <ServiceRow
              name="Gravatar"
              tag="头像"
              triggered="你填写邮箱后，评论 / 个人主页渲染头像时"
              sends="邮箱经 MD5 哈希后的字符串"
              lands="Gravatar 公共接口（cn.gravatar.com）"
            />
            <ServiceRow
              name="GitHub OAuth"
              tag="第三方登录"
              triggered="你主动点击「使用 GitHub 登录」时"
              sends="OAuth 授权码 → 本站换取公开资料字段（昵称、头像、邮箱）"
              lands="本站服务器；不申请也不存储你的仓库、关注、Star 等权限"
            />
            <ServiceRow
              name="HarmonyOS Sans 字体"
              tag="本地字体"
              triggered="你在「设置 → 外观 → 字体」切换到 HarmonyOS Sans 时"
              sends="无网络请求 —— 字体文件预加载在本站 index.html，从本站自己域名下提供"
              lands="你的浏览器本地缓存。默认走系统字体栈，不加载任何外部字体"
            />
          </ul>

          <p class="text-muted mt-7 text-sm leading-relaxed">
            媒体资源（背景图、文章内图片、你上传的图片）一律由本站
            <code
              class="bg-surface rounded px-1.5 py-0.5 font-mono text-[0.85em]"
              >/api/v1/media/*</code
            >
            自托管分发，不接入任何第三方 CDN。
          </p>
        </section>

        <!-- =============================================
             Section 04 · 第三方网站
             ============================================= -->
        <section id="third-site" class="scroll-mt-28 pt-16">
          <SectionHeader number="04" title="第三方网站" />
          <p class="text-muted mt-5">
            本站文章中可能包含指向其它网站的链接，例如技术文档、引用来源或朋友站点。
            点击这些链接离开本站后，本站的隐私政策不再适用 ——
            请阅读目标网站自己的隐私政策。
          </p>
        </section>

        <!-- =============================================
             Section 05 · 数据保留与销毁
             ============================================= -->
        <section id="retention" class="scroll-mt-28 pt-16">
          <SectionHeader number="05" title="数据保留与销毁" />
          <p class="text-muted mt-5">
            不同数据有不同的保留期。下面按字段给出最长期限；除非法律要求更久，否则不会超出。
          </p>

          <div
            class="bg-surface/30 /60 mt-6 overflow-hidden rounded-2xl border"
          >
            <dl class="divide-border/60 divide-y text-sm">
              <RetentionRow
                what="账号与登录信息"
                until="账号存续期间；注销后 30 天内软删除，30 天后从主库硬删除"
              />
              <RetentionRow
                what="评论与 Twikoo 数据"
                until="评论公开保留；你申请删除后 7 天内同步清除 Twikoo 自托管后端"
              />
              <RetentionRow
                what="微信读书 WeRead"
                until="每次导入任务结束即可在「设置 → 微信读书」一键清除；最长保留 90 天，到期自动销毁"
              />
              <RetentionRow
                what="AI 摘要 / 对话历史"
                until="Redis 短期缓存 7 天；分析请求不留存可识别到你的版本"
              />
              <RetentionRow
                what="访问日志（含 IP）"
                until="原始日志保留 30 天用于安全审计，之后聚合为不包含 IP 的统计指标"
              />
              <RetentionRow
                what="反滥用黑名单（见 § 10）"
                until="由威胁等级决定，区间为 7 天到 1 年；到期自动失效"
              />
            </dl>
          </div>
        </section>

        <!-- =============================================
             Section 06 · 你的权利
             ============================================= -->
        <section id="rights" class="scroll-mt-28 pt-16">
          <SectionHeader number="06" title="你的权利" />
          <p class="text-muted mt-5">
            你对自己的数据享有以下权利。任一项都可以通过页脚的联系方式发起，我会在
            <strong class="text-ink/90 font-medium">7 个自然日内</strong>
            给出首次回复。
          </p>

          <ul class="text-muted mt-6 space-y-3.5">
            <RightItem
              title="知情与访问"
              desc="你有权了解本站持有你的哪些数据。可以申请一份你的账号信息、评论、文章、设置项的 JSON 导出。"
            />
            <RightItem
              title="更正"
              desc="账号邮箱、用户名、网址等个人字段可以在「设置」中直接修改；评论正文不支持编辑但可以删除后重发。"
            />
            <RightItem
              title="删除与注销"
              desc="可以申请账号注销：注销后 30 天内为软删除状态（可恢复），之后从主库硬删除并通知备份系统同步清除。"
            />
            <RightItem
              title="撤回同意"
              desc="撤回后本站会停止基于该同意的处理，例如撤回 AI 摘要的同意后不再调用 Tbox / Bing；不影响撤回前已经发生的数据流。"
            />
            <RightItem
              title="拒绝自动化决策"
              desc="钓鱼天气页的 AI 建议仅供参考；任何基于此建议的实际行为由你自行决定，本站不据此对你产生法律效应。"
            />
          </ul>
        </section>

        <!-- =============================================
             Section 07 · 安全性
             ============================================= -->
        <section id="security" class="scroll-mt-28 pt-16">
          <SectionHeader number="07" title="安全性" />
          <p class="text-muted mt-5">
            本站采取与本站规模相称的安全措施来保护你提交的信息：
          </p>

          <div class="bg-ink/[0.025] /60 mt-6 rounded-2xl border p-5 sm:p-6">
            <dl class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SecurityItem
                tag="HTTPS"
                desc="全站启用 TLS 加密传输，浏览器与服务端之间的数据不被明文窃听。"
              />
              <SecurityItem
                tag="HASH"
                desc="用户密码以单向哈希存储；任何工程师都无法从数据库反推出明文。"
              />
              <SecurityItem
                tag="JWT"
                desc="登录态使用短时效访问令牌 + 刷新令牌的双令牌机制。"
              />
              <SecurityItem
                tag="隔离"
                desc="数据库、对象存储与后台管理面分别鉴权，前端只能拿到它该看到的数据。"
              />
            </dl>
          </div>
        </section>

        <!-- =============================================
             Section 08 · 自动化处理
             ============================================= -->
        <section id="automation" class="scroll-mt-28 pt-16">
          <SectionHeader number="08" title="自动化处理" />
          <p class="text-muted mt-5">
            本站存在以下自动化处理逻辑，用于辅助阅读与决策；它们
            <strong class="text-ink/90 font-medium"
              >不会单独对你产生法律或经济上的约束</strong
            >：
          </p>
          <ul class="text-muted mt-5 space-y-3">
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>
                <strong class="text-ink/90 font-medium">AI 文章摘要</strong>
                — 把你提交的文章正文发给阿里云 Tbox
                LLM，返回结构化摘要。多轮对话上下文
                <code class="bg-surface rounded px-1 font-mono text-[0.85em]"
                  >num_history_runs=10</code
                >
                一并发送，用于回答的连续性。
              </span>
            </li>
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>
                <strong class="text-ink/90 font-medium">AI 钓鱼天气分析</strong>
                — 把当前地理位置的实时气象数据 + 钓鱼指标历史喂给同一个
                LLM，可选地触发 Bing
                联网检索。返回的内容是建议，不会被用来限制或影响你的实际行为。
              </span>
            </li>
            <li class="flex gap-3">
              <span
                class="bg-ink/60 mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>
                <strong class="text-ink/90 font-medium">反垃圾评论识别</strong>
                — 提交评论时根据
                IP、UA、内容指纹做规则判断，命中黑名单的请求会被自动拦截。
              </span>
            </li>
          </ul>
          <p class="text-muted mt-5 text-sm">
            你随时可以在 AI 摘要面板选择"不使用
            AI"；钓鱼页可以切换到纯规则模型，跳过 LLM 调用。
          </p>
        </section>

        <!-- =============================================
             Section 09 · 未成年人
             ============================================= -->
        <section id="minor" class="scroll-mt-28 pt-16">
          <SectionHeader number="09" title="未成年人" />
          <p class="text-muted mt-5">
            本站是个人作品集与工具，不面向 14 岁以下未成年人设计。
            <strong class="text-ink/90 font-medium">14 岁以下</strong>
            请在监护人同意下使用；如果发现未成年人在未经监护人同意下提交了个人信息，请通过页脚联系方式告知，我会尽快删除。
          </p>
        </section>

        <!-- =============================================
             Section 10 · 附属协议
             ============================================= -->
        <section id="aux" class="scroll-mt-28 pt-16">
          <SectionHeader number="10" title="附属协议" />

          <div
            class="border-warning/30 bg-warning/5 mt-6 rounded-2xl border p-5 sm:p-6"
          >
            <div class="flex items-start gap-3">
              <span
                class="bg-warning/20 text-warning mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path
                    d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  />
                </svg>
              </span>
              <div class="space-y-2">
                <p class="text-ink font-medium">反滥用黑名单</p>
                <p class="text-muted text-sm leading-relaxed">
                  当本站监测到存在恶意访问、恶意请求、攻击行为或恶意评论时，
                  为了防止损害扩大，可能会临时将相关 IP
                  与访问信息加入短期黑名单。
                </p>
                <p class="text-muted text-sm leading-relaxed">
                  该黑名单可能会被公开，并可能共享给其它站点以协助防御，包括但不限于
                  IP 地址、设备指纹、地理位置等。
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- =============================================
             Section 07 · 隐私政策的变更
             ============================================= -->
        <section id="change" class="scroll-mt-28 pt-16">
          <SectionHeader number="11" title="隐私政策的变更" />
          <p class="text-muted mt-5">
            本站保留随时更新或修改本隐私政策的权利。任何修订都会在本页顶部显示最新日期，
            重大变更会通过站内公告告知。在新政策生效后继续使用本站，即视为你接受修订后的内容。
          </p>
          <p class="text-muted mt-3 text-sm">
            旧版本会以日期归档在本站的版本日志中，欢迎回溯查阅。
          </p>
        </section>

        <!-- =============================================
             Section 08 · 联系本站
             ============================================= -->
        <section id="contact" class="scroll-mt-28 pt-16">
          <SectionHeader number="12" title="联系本站" />
          <p class="text-muted mt-5">
            如果你对本政策有任何疑问、建议或投诉，欢迎通过以下任一方式联系。
            我会亲自阅读每一封来信 —— 请尽量描述清楚场景，方便我准确回复。
          </p>

          <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ContactCard
              label="GitHub"
              value="KanoCifer"
              href="https://github.com/KanoCifer"
            />
            <ContactCard
              label="Email"
              value="kano3255@outlook.com"
              href="mailto:kano3255@outlook.com"
            />
          </div>
        </section>

        <!-- ----- 文末落款 ----- -->
        <footer
          class="text-muted /60 mt-20 flex flex-col items-center gap-3 border-t pt-10 text-center"
        >
          <p class="font-serif text-base italic">谢谢你读到最后。</p>
          <p class="font-mono text-[10px] tracking-[0.28em] uppercase">
            end of document · 2026.05.16
          </p>
        </footer>
      </article>

      <!-- ============= Sidebar: TOC (sticky, desktop only) ============= -->
      <aside class="hidden lg:block">
        <nav class="sticky top-16" aria-label="目录">
          <p
            class="text-muted mb-4 font-mono text-[10px] tracking-[0.28em] uppercase"
          >
            目录 · on this page
          </p>
          <ol class="space-y-1.5">
            <li v-for="item in toc" :key="item.id">
              <button
                type="button"
                :class="[
                  'group flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                  activeId === item.id
                    ? 'text-ink'
                    : 'text-muted hover:text-ink',
                ]"
                @click="scrollTo(item.id)"
              >
                <span
                  class="font-mono text-[10px] tabular-nums"
                  :class="activeId === item.id ? 'text-ink' : 'text-muted/60'"
                >
                  {{ item.number }}
                </span>
                <span
                  class="flex-1 border-l-2 pl-3 transition-colors"
                  :class="
                    activeId === item.id
                      ? 'border-accent'
                      : '/60 group-hover:border-ink/40'
                  "
                >
                  {{ item.label }}
                </span>
              </button>
            </li>
          </ol>
        </nav>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* 标题按字 stagger —— 站点内已有 keyframe，复用 */
.title-word {
  opacity: 0;
  transform: translateY(12px);
  animation: title-word-in 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes title-word-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .title-word {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .privacy-page * {
    transition: none !important;
  }
}
</style>

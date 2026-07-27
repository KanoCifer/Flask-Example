<template>
  <BasicDetail title="友情链接" subtitle="与志同道合的朋友交换链接">
    <div class="col-span-full mx-auto w-full max-w-6xl">
      <!-- 每日推荐横幅 -->
      <div
        class="bg-page/30 group relative mb-6 cursor-pointer overflow-hidden rounded-4xl border p-6 shadow-sm transition-all duration-300 hover:shadow-lg sm:p-8"
        @click="$router.push('/websites')"
      >
        <Transition name="pick-switch" mode="out-in">
          <div
            :key="dailyPick?.id"
            class="flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <div
              class="bg-surface flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            >
              <img
                v-if="dailyPick?.icon"
                :src="dailyPick.icon"
                :alt="dailyPick?.name"
                class="h-8 w-8 object-contain"
                @error="handleImageError"
              />
              <IconGlobeOutline v-else class="text-muted h-7 w-7" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="mb-1 flex items-center gap-2">
                <span
                  class="text-muted text-xs font-bold tracking-wide uppercase"
                  >每日推荐</span
                >
                <span
                  class="bg-accent/10 text-ink rounded-full px-2 py-0.5 text-[10px] font-semibold"
                >
                  {{ dailyPick?.category }}
                </span>
              </div>
              <h3 class="text-ink text-lg font-bold">
                {{ dailyPick?.name }}
              </h3>
              <p class="text-muted mt-1 line-clamp-2 text-sm">
                {{ dailyPick?.description }}
              </p>
              <div
                v-if="dailyPick?.tags?.length"
                class="mt-3 flex flex-wrap gap-2"
              >
                <TagPill
                  v-for="tag in dailyPick.tags.slice(0, 4)"
                  :key="tag"
                  compact
                >
                  {{ tag }}
                </TagPill>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-3 sm:flex-col sm:gap-4">
              <Button size="sm" @click.stop="$router.push('/websites')">
                <IconExternalLink class="h-3.5 w-3.5" />
                <span class="hidden sm:inline">看更多</span>
              </Button>
              <Button size="sm" variant="ghost" @click.stop="refreshDailyPick">
                <IconRefresh class="h-3.5 w-3.5" />
                <span class="hidden sm:inline">换一个</span>
              </Button>
            </div>
          </div>
        </Transition>
        <IconExternalLink
          class="text-muted absolute top-4 right-4 h-5 w-5 shrink-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
        />
      </div>

      <!-- 非对称布局：左 2/3 + 右 1/3 -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- ======== 左列：本站信息 + 友链大卡片 ======== -->
        <div class="space-y-6 lg:col-span-2">
          <!-- 本站信息面板 -->
          <div
            class="border-accent/20 bg-accent/5 ring-accent/10 overflow-hidden rounded-4xl border p-8 ring-1"
          >
            <div class="mb-6 flex items-start gap-5">
              <div
                class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
              >
                <img
                  :src="selfInfo.icon"
                  :alt="selfInfo.name"
                  class="h-16 w-16 rounded-full object-cover"
                  @error="handleImageError"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-3">
                  <h3 class="text-ink text-2xl font-bold">
                    {{ selfInfo.name }}
                  </h3>
                  <span
                    class="bg-accent/15 text-ink inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  >
                    本站
                  </span>
                </div>
                <p class="text-muted mt-2 leading-relaxed">
                  {{ selfInfo.description }}
                </p>
              </div>

              <!-- 一键复制 -->
              <button
                class="group bg-accent text-contrast hover:bg-accent/90 flex shrink-0 cursor-pointer items-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow-md active:scale-95"
                @click="copySelfInfo"
              >
                <IconCopy class="h-4 w-4" />
                <span
                  class="max-w-0 min-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-500 ease-out group-hover:max-w-50 group-hover:opacity-100"
                  >复制</span
                >
              </button>
            </div>

            <!-- 信息行 -->
            <div class="bg-page/60 space-y-2 rounded-xl p-4">
              <div class="flex items-center gap-3 text-sm">
                <span class="text-muted w-16 shrink-0 font-medium">URL</span>
                <code class="text-ink truncate">{{ selfInfo.url }}</code>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="text-muted w-16 shrink-0 font-medium"
                  >Favicon</span
                >
                <code class="text-ink truncate">{{ selfInfo.icon }}</code>
              </div>
              <div class="flex flex-wrap gap-2 pt-1">
                <TagPill v-for="tag in selfInfo.tags" :key="tag" compact>
                  {{ tag }}
                </TagPill>
              </div>
            </div>
          </div>

          <!-- 友链大卡片 -->
          <motion.a
            v-for="link in links"
            :key="link.id"
            :initial="{ opacity: 0, y: 10 }"
            :whileInView="WHILE_IN_VIEW_FADE_UP"
            :transition="SPRING_REVEAL"
            :whileHover="HOVER_LIFT"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group bg-page/30 hover:bg-accent block cursor-pointer overflow-hidden rounded-4xl border p-8 shadow-sm transition-all duration-300 hover:shadow-xl"
          >
            <div class="flex items-start gap-5">
              <div
                class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full opacity-100 transition-all duration-300 ease-out group-hover:w-0 group-hover:opacity-0"
              >
                <img
                  v-if="link.icon"
                  :src="link.icon"
                  :alt="link.name"
                  class="h-16 w-16 rounded-full object-cover"
                  @error="handleImageError"
                />
                <IconGlobeOutline v-else class="text-muted h-10 w-10" />
              </div>
              <div class="min-w-0 flex-1">
                <h3
                  class="text-ink group-hover:text-ink text-xl font-bold transition-colors duration-300"
                >
                  {{ link.name }}
                </h3>
                <p
                  class="text-muted group-hover:text-ink mt-2.5 leading-relaxed transition-colors duration-300"
                >
                  {{ link.description }}
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <TagPill v-for="tag in link.tags" :key="tag">
                    {{ tag }}
                  </TagPill>
                </div>
              </div>
            </div>

            <!-- 外链箭头 -->
            <div
              class="absolute top-6 right-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              <IconExternalLink class="text-muted h-5 w-5" />
            </div>
          </motion.a>

          <!-- 空状态 -->
          <div
            v-if="links.length === 0"
            class="bg-page/30 flex flex-col items-center justify-center rounded-4xl border py-16"
          >
            <img
              src="/images/animal-badge/fox.png"
              alt="Fox"
              class="mb-4 h-20 w-20"
              loading="lazy"
            />
            <p class="text-muted text-lg">暂无友链</p>
            <p class="text-muted mt-2 text-sm">
              欢迎提交申请，成为第一位友链伙伴
            </p>
          </div>
        </div>

        <!-- ======== 右列：申请须知 + GitHub Issue ======== -->
        <div class="space-y-6 lg:col-span-1">
          <div
            class="bg-page/30 overflow-hidden rounded-4xl border p-8 shadow-sm"
          >
            <!-- Header -->
            <div class="mb-6">
              <h3
                class="text-ink flex items-center gap-2 font-serif text-xl font-bold"
              >
                <IconLinkChain class="text-ink h-5 w-5" />
                申请友链
              </h3>
              <p class="text-muted mt-1.5 text-sm">
                通过 GitHub Issue 提交友链申请，审核通过后将在 48 小时内上线
              </p>
            </div>

            <!-- 接入须知 -->
            <div
              class="border-accent/15 bg-accent/5 mb-6 rounded-2xl border p-5"
            >
              <h4
                class="text-ink mb-3 flex items-center gap-2 text-sm font-bold"
              >
                <IconInfoCircle class="text-ink h-4 w-4" />
                接入须知
              </h4>
              <ul class="text-muted space-y-2 text-sm">
                <li class="flex items-start gap-2">
                  <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
                  <span>网站需符合中国大陆相关法律法规</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
                  <span>网站内容原创、非商业推广</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
                  <span
                    >已在您的网站添加本站友链（<a
                      href="https://kanocifer.chat"
                      target="_blank"
                      class="text-ink underline"
                      >kanocifer.chat</a
                    >）</span
                  >
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
                  <span>网站可正常访问</span>
                </li>
              </ul>
            </div>

            <!-- 申请格式 -->
            <div class="mb-6">
              <h4
                class="text-ink mb-3 flex items-center gap-2 text-sm font-bold"
              >
                <IconDocumentText class="text-ink h-4 w-4" />
                申请格式
              </h4>
              <pre
                class="bg-surface text-muted overflow-x-auto rounded-xl p-4 text-xs leading-relaxed"
              >
- **站点名称**：
- **描述**：
- **URL**：
- **头像**：
- **标签**：</pre>
            </div>

            <!-- CTA -->
            <Button
              size="lg"
              @click="handleHref"
              class="w-full"
              rel="noopener noreferrer"
            >
              <IconExternalLink class="h-4 w-4" />
              前往 GitHub Issue 提交申请
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 评论区 -->
    <div class="col-span-full mx-auto w-full max-w-6xl">
      <TwikooComments path="/friend-links" />
    </div>
  </BasicDetail>
</template>

<script setup lang="ts">
import { BasicDetail, Button, TagPill } from '@/components';
import { useFriendLinks } from '@/features/friend-links/composables';
import { motion } from 'motion-v';
import { SPRING_REVEAL, WHILE_IN_VIEW_FADE_UP, HOVER_LIFT } from '@/constants';
import {
  IconCopy,
  IconDocumentText,
  IconExternalLink,
  IconGlobeOutline,
  IconInfoCircle,
  IconLinkChain,
  IconRefresh,
  TwikooComments,
} from '@/components';

const {
  dailyPick,
  links,
  selfInfo,
  handleImageError,
  refreshDailyPick,
  copySelfInfo,
} = useFriendLinks();

const handleHref = (_e: Event) => {
  const href = 'https://github.com/KanoCifer/kuroome-blog/issues/1';
  window.open(href, '_blank');
};
</script>

<style scoped>
.pick-switch-enter-active,
.pick-switch-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.pick-switch-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.pick-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>

<style>
@import 'twikoo/dist/twikoo.css';

#tcomment {
  font-size: 0.9375rem;
}

#tcomment .el-input__inner,
#tcomment .el-textarea__inner {
  background: var(--card-bg);
  border-color: var(--secondary);
  border-radius: 0.75rem;
  color: var(--ink);
  font-size: 0.9375rem;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
#tcomment .el-input__inner:focus,
#tcomment .el-textarea__inner:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 15%, transparent);
}
#tcomment .el-textarea__inner {
  line-height: 1.7;
  padding: 0.75rem 1rem;
}

#tcomment .el-button {
  border-radius: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  padding: 0.5rem 1.25rem;
}

#tcomment .el-button--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent);
}
#tcomment .el-button--primary:hover {
  opacity: 0.88;
  background: var(--accent);
  border-color: var(--accent);
}
#tcomment .el-button--primary:active {
  opacity: 0.78;
}

#tcomment .el-button--default,
#tcomment
  .el-button:not(.el-button--primary):not(.el-button--danger):not(
    .el-button--text
  ) {
  background: var(--card-bg);
  border-color: var(--secondary);
  color: var(--ink);
}
#tcomment .el-button--default:hover,
#tcomment
  .el-button:not(.el-button--primary):not(.el-button--danger):not(
    .el-button--text
  ):hover {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in oklch, var(--accent) 8%, var(--card-bg));
}

#tcomment .el-button--text {
  color: var(--muted);
  padding: 0.25rem 0.5rem;
}
#tcomment .el-button--text:hover {
  color: var(--accent);
  background: transparent;
}

#tcomment .tk-comment {
  border-bottom: 1px solid var(--secondary);
  padding: 1.25rem 0;
}
#tcomment .tk-comment:last-child {
  border-bottom: none;
}

#tcomment .tk-avatar {
  border-radius: 9999px;
  overflow: hidden;
}

#tcomment .tk-nick {
  color: var(--ink);
  font-weight: 600;
}

#tcomment .tk-time {
  color: var(--muted);
  font-size: 0.8125rem;
}

#tcomment .tk-content {
  color: var(--ink);
  line-height: 1.75;
}

#tcomment .tk-replies {
  border-left: 2px solid var(--secondary);
  margin-left: 1.5rem;
  padding-left: 1rem;
}

#tcomment .el-pager li {
  border-radius: 0.5rem;
  font-weight: 500;
}
#tcomment .el-pager li.active {
  background: var(--accent);
  color: var(--accent);
}

#tcomment .OwO {
  color: var(--ink);
}
#tcomment .OwO .OwO-logo {
  border-radius: 0.5rem;
}

.dark #tcomment .el-input__inner,
.dark #tcomment .el-textarea__inner {
  background: color-mix(in oklch, var(--card-bg) 60%, var(--page));
}
</style>

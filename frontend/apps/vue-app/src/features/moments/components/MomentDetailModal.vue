<template>
  <Modal :open="open" size="lg" @close="emit('update:open', false)">
    <!-- 顶栏：卷序 + 关闭 + admin 操作 -->
    <header
      class="/40 bg-page sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-6 py-4"
    >
      <div class="flex items-center gap-3">
        <span class="text-ink/70 font-serif text-sm italic">
          {{ volumeLabel }}
        </span>
        <span class="text-muted/60">·</span>
        <span class="text-muted font-mono text-[11px] tracking-wide">
          {{ formatDate(moment?.published_at) }}
        </span>
        <span
          v-if="moment?.is_pinned"
          class="text-warning inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase"
        >
          <span aria-hidden="true">·</span>
          <Star class="h-3 w-3" />
          <span>置顶</span>
        </span>
      </div>

      <div class="flex items-center gap-2">
        <!-- 上下条按钮 -->
        <div
          v-if="hasPrev || hasNext"
          class="text-muted flex items-center gap-1 text-[11px]"
        >
          <Button
            variant="ghost"
            size="icon"
            :disabled="!hasPrev"
            class="/40 !h-7 !w-7 border disabled:!opacity-30"
            :aria-label="'上一条'"
            @click="emit('navigate', 'prev')"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :disabled="!hasNext"
            class="/40 !h-7 !w-7 border disabled:!opacity-30"
            :aria-label="'下一条'"
            @click="emit('navigate', 'next')"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- admin 操作 -->
        <template v-if="isAdmin">
          <Button
            variant="default"
            class="!h-7 gap-1 !rounded-full !px-3 !py-1.5 !text-[12px] shadow-sm"
            @click="emit('edit', moment)"
          >
            <Pencil class="h-3.5 w-3.5" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="/40 hover:!text-destructive hover:!border-destructive/40 !h-7 !w-7 border"
            aria-label="删除"
            @click="emit('delete', moment)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </template>

        <Button
          variant="ghost"
          size="icon"
          class="/40 !h-7 !w-7 border"
          aria-label="关闭"
          @click="emit('update:open', false)"
        >
          <X class="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>

    <!-- 主体 -->
    <div
      v-if="moment"
      class="grid max-h-[calc(88vh-64px)] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_220px]"
    >
      <!-- 左：内容 -->
      <div class="contain-[layout_paint_scroll_style] overflow-y-auto px-8 py-8">
        <!-- 心情 -->
        <div
          v-if="moment.mood"
          class="text-muted mb-6 flex items-center gap-2 text-sm"
        >
          <span class="text-2xl" aria-hidden="true">{{ moodEmoji }}</span>
          <span v-if="moodText" class="italic">{{ moodText }}</span>
        </div>

        <!-- 内容（markdown 渲染） -->
        <div
          class="prose prose-lg text-ink max-w-none"
          style="text-wrap: pretty"
          v-html="renderMarkdown(moment.content)"
        ></div>

        <!-- 附件图片网格（点击放大查看） -->
        <div v-if="imageAttachments.length" class="mt-6 grid grid-cols-3 gap-2">
          <Button
            v-for="(att, idx) in imageAttachments"
            :key="att.url"
            variant="ghost"
            class="!bg-surface group relative !aspect-square !h-auto !w-full overflow-hidden !rounded-xl !p-0"
            :aria-label="`查看图片 ${idx + 1}`"
            @click="openLightbox(idx)"
          >
            <img
              :src="att.url"
              alt=""
              class="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          </Button>
        </div>

        <!-- 标签 -->
        <div
          v-if="moment.tags.length"
          class="text-muted mt-8 flex flex-wrap items-center gap-2 text-[12px]"
        >
          <MomentTagChip v-for="tag in moment.tags" :key="tag" :name="tag" />
        </div>

        <!-- 元数据条 -->
        <div
          class="text-muted /40 mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed pt-4 font-mono text-[11px] tracking-wide"
        >
          <span
            >发布于
            {{ formatDate(moment.published_at ?? moment.created_at) }}</span
          >
          <span v-if="moment.source" class="text-muted/60">·</span>
          <span v-if="moment.source">来源 {{ moment.source }}</span>
          <span class="text-muted/60">·</span>
          <span>允许评论 {{ moment.allow_comment ? '是' : '否' }}</span>
        </div>
      </div>

      <!-- 右侧：元数据 sticky -->
      <aside class="bg-surface/30 /40 hidden border-l px-5 py-6 md:block">
        <div
          class="text-muted sticky top-4 font-mono text-[10px] tracking-[0.18em] uppercase"
        >
          META
        </div>
        <dl class="mt-4 space-y-3 text-sm">
          <MetaRow label="卷序" :value="volumeLabel" mono />
          <MetaRow label="心情" :value="moodDisplay" />
          <MetaRow label="标签" :value="moment.tags.join(' · ')" />
          <MetaRow
            v-if="moment.location?.name"
            label="地点"
            :value="moment.location.name"
          />
          <MetaRow label="可见性" :value="visibilityLabel" />
          <MetaRow label="状态" :value="statusLabel" />
        </dl>

        <div
          class="text-muted /40 mt-6 border-t border-dashed pt-4 font-mono text-[10px] tracking-[0.18em] uppercase"
        >
          KEYBOARD
        </div>
        <ul class="text-muted mt-3 space-y-1.5 text-[12px]">
          <li class="flex items-center gap-2">
            <Kbd label="J" /><span>下一条</span>
          </li>
          <li class="flex items-center gap-2">
            <Kbd label="K" /><span>上一条</span>
          </li>
          <li class="flex items-center gap-2">
            <Kbd label="Esc" /><span>关闭</span>
          </li>
        </ul>
      </aside>
    </div>

    <!-- 图片放大查看(内联 lightbox,沿用图片墙看图态) -->
    <Teleport to="body">
      <div
        v-if="lightboxIndex !== null"
        class="fixed inset-0 z-[60] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="bg-ink/80 absolute inset-0 backdrop-blur-sm"
          @click="closeLightbox"
        />

        <!-- 顶部工具条 -->
        <div
          class="text-page absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-5 py-4"
        >
          <span class="font-mono text-sm tabular-nums">
            {{ lightboxIndex + 1 }} / {{ imageAttachments.length }}
          </span>
          <Button
            variant="ghost"
            size="icon"
            class="!text-page hover:!bg-page/20 !h-9 !w-9"
            aria-label="关闭"
            @click="closeLightbox"
          >
            <X class="h-5 w-5" />
          </Button>
        </div>

        <!-- 左切换 -->
        <Button
          v-if="imageAttachments.length > 1"
          variant="ghost"
          size="icon"
          class="!text-page hover:!bg-page/20 !h-11 !w-11"
          aria-label="上一张"
          @click="lightboxPrev"
        >
          <ChevronLeft class="h-6 w-6" />
        </Button>

        <!-- 主图 -->
        <img
          :src="imageAttachments[lightboxIndex]?.url"
          :alt="`附件图片 ${lightboxIndex + 1}`"
          class="relative z-[1] max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />

        <!-- 右切换 -->
        <Button
          v-if="imageAttachments.length > 1"
          variant="ghost"
          size="icon"
          class="!text-page hover:!bg-page/20 !h-11 !w-11"
          aria-label="下一张"
          @click="lightboxNext"
        >
          <ChevronRight class="h-6 w-6" />
        </Button>
      </div>
    </Teleport>
  </Modal>
</template>

<script setup lang="ts">
import { Button } from '@/components';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Star,
  Trash2,
  X,
} from '@lucide/vue';
import { Modal } from '@/components';
import { renderMarkdown } from '@/composables';
import type {
  Moment,
  MomentAttachment,
  MomentStatus,
  MomentVisibility,
} from '@readinglist/types';
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import MomentTagChip from './MomentTagChip.vue';
import { formatDate } from '@/lib';

const props = defineProps<{
  open: boolean;
  moment: Moment | null;
  /** 当前 moment 在列表里的卷序号（从父级传入），用于显示 "卷三" 之类 */
  volumeLabel?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'edit', moment: Moment | null): void;
  (e: 'delete', moment: Moment | null): void;
  (e: 'navigate', direction: 'prev' | 'next'): void;
}>();

const isPureEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);
const moodEmoji = computed(() => {
  const m = props.moment?.mood ?? '';
  return isPureEmoji(m) ? m : '';
});
const moodText = computed(() => {
  const m = props.moment?.mood ?? '';
  return isPureEmoji(m) ? '' : m;
});
const moodDisplay = computed(() => {
  const m = props.moment?.mood;
  if (!m) return '—';
  return isPureEmoji(m) ? m : m;
});

const visibilityLabel = computed(() => {
  const map: Record<MomentVisibility, string> = {
    public: '公开',
    unlisted: '不列出',
    private: '不公开',
  };
  return props.moment ? map[props.moment.visibility] : '—';
});
const statusLabel = computed(() => {
  const map: Record<MomentStatus, string> = {
    published: '已发布',
    draft: '草稿',
    archived: '归档',
  };
  return props.moment ? map[props.moment.status] : '—';
});

// ── 图片附件(详情查看,不引入新组件,inline lightbox) ──
const imageAttachments = computed<MomentAttachment[]>(() =>
  (props.moment?.attachments ?? []).filter((a) => a.type === 'image'),
);
const lightboxIndex = ref<number | null>(null);

// 切换 moment 时复位 lightbox —— 上一个 moment 的索引可能落在新数组范围外。
watch(
  () => props.moment?.id,
  () => {
    lightboxIndex.value = null;
  },
);

function openLightbox(idx: number): void {
  lightboxIndex.value = idx;
}
function closeLightbox(): void {
  lightboxIndex.value = null;
}
function lightboxPrev(): void {
  const n = imageAttachments.value.length;
  if (n === 0 || lightboxIndex.value === null) return;
  lightboxIndex.value =
    lightboxIndex.value <= 0 ? n - 1 : lightboxIndex.value - 1;
}
function lightboxNext(): void {
  const n = imageAttachments.value.length;
  if (n === 0 || lightboxIndex.value === null) return;
  lightboxIndex.value =
    lightboxIndex.value >= n - 1 ? 0 : lightboxIndex.value + 1;
}
function onLightboxKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') lightboxPrev();
  else if (e.key === 'ArrowRight') lightboxNext();
}

// 监听 lightbox 开关,挂载 / 卸载键盘。
watch(lightboxIndex, (idx) => {
  if (idx !== null) {
    window.addEventListener('keydown', onLightboxKey);
  } else {
    window.removeEventListener('keydown', onLightboxKey);
  }
});
onBeforeUnmount(() => window.removeEventListener('keydown', onLightboxKey));

// 内部小组件：元数据行
const MetaRow = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '' },
    mono: { type: Boolean, default: false },
  },
  setup(p) {
    return () =>
      h('div', { class: 'flex flex-col gap-0.5' }, [
        h(
          'dt',
          {
            class:
              'text-muted font-mono text-[10px] tracking-[0.1em] uppercase',
          },
          p.label,
        ),
        h(
          'dd',
          {
            class: [
              'text-ink',
              p.mono ? 'font-mono text-[12px]' : 'font-serif text-[13px]',
            ].join(' '),
          },
          p.value || '—',
        ),
      ]);
  },
});

// 内部小组件：键盘按键（直接函数式组件，避免 defineComponent 类型推断问题）
const Kbd = (props: { label: string }) =>
  h(
    'kbd',
    {
      class:
        'text-ink/80 font-mono text-[10px] px-1.5 py-0.5 bg-page border /40 rounded',
    },
    props.label,
  );
</script>

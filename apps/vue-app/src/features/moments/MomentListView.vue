<template>
  <BasicDetail
    :title="heroTitle"
    :subtitle="heroSubtitle"
    :on-back="() => $router.push('/')"
  >
    <div class="col-span-full container mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <!-- ──────────────────────────────────────────────────────────── -->
      <!--  顶部：tag 过滤 + 管理员「写一句」入口                         -->
      <!-- ──────────────────────────────────────────────────────────── -->
      <div
        v-if="allTags.length || isAdmin"
        class="mb-6 flex flex-wrap items-center gap-3"
      >
        <div
          v-if="allTags.length"
          class="flex flex-wrap items-center gap-2 text-[12px]"
          aria-label="按标签过滤"
        >
          <Button
            type="button"
            :class="[
              '!h-auto !rounded-full !px-3 !py-1 !font-medium',
              activeTag === null
                ? 'bg-accent !text-ink shadow-sm'
                : '!bg-page text-muted hover:!bg-surface /60 !border',
            ]"
            @click="setTag(null)"
          >
            全部
          </Button>
          <Button
            v-for="tag in allTags"
            :key="tag"
            type="button"
            :class="[
              '!h-auto !rounded-full !px-3 !py-1 !font-medium',
              activeTag === tag
                ? 'bg-accent !text-ink shadow-sm'
                : '!bg-page text-muted hover:!bg-surface /60 !border',
            ]"
            @click="setTag(tag)"
          >
            <span class="text-ink/70">#</span>{{ tag }}
          </Button>
        </div>

        <Button
          v-if="isAdmin"
          variant="default"
          size="md"
          class="ml-auto !h-auto gap-1.5 !rounded-md !border !px-4 !py-2 !text-[13px]"
          aria-label="新建碎碎念"
          @click="openEditor(null)"
        >
          <Plus class="h-4 w-4" />
          写一句
        </Button>
      </div>

      <!-- 错误提示 -->
      <div
        v-if="errorMessage"
        class="border-destructive/30 bg-destructive/10 text-destructive mb-6 flex items-center gap-2 rounded-xl border p-4 text-sm"
        role="alert"
      >
        <CircleAlert class="h-5 w-5 shrink-0" />
        <span class="flex-1">{{ errorMessage }}</span>
        <Button
          variant="ghost"
          class="hover:!text-destructive/80 !h-auto !p-0 !text-xs !underline !underline-offset-2"
          @click="reload"
        >
          重试
        </Button>
      </div>

      <!-- 加载骨架 -->
      <div v-if="publicLoading && !publicList.length" class="space-y-4">
        <div
          v-for="i in 4"
          :key="i"
          class="bg-page/60 /40 h-32 animate-pulse rounded-2xl border"
        />
      </div>

      <!-- 列表 -->
      <div v-else-if="publicList.length" class="space-y-5">
        <MomentCard
          v-for="(moment, index) in publicList"
          :key="moment.id"
          :moment="moment"
          :volume-label="formatVolume(moment, index)"
          :is-admin="isAdmin"
          @open="openDetail(moment.id)"
          @edit="openEditor(moment)"
          @delete="confirmDelete(moment)"
        />
      </div>

      <!-- 空状态 -->
      <MomentEmptyState
        v-else
        :title="activeTag ? `还没有 #${activeTag} 的碎碎念` : '还没有碎碎念'"
        description="等到想写一句的时候，再来吧。"
      />

      <!-- 分页 -->
      <nav
        v-if="publicTotal > publicPageSize"
        class="text-muted mt-10 flex items-center justify-between text-xs"
        aria-label="碎碎念分页"
      >
        <Button
          variant="outline"
          :disabled="publicPage <= 1"
          class="/60 !bg-card !h-auto gap-1.5 !rounded-full !border !px-4 !py-2 !font-medium shadow-sm disabled:!opacity-40"
          @click="goPage(publicPage - 1)"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
          上一页
        </Button>

        <span class="font-serif tracking-wider tabular-nums">
          第 {{ publicPage }} / {{ totalPages }} 卷
        </span>

        <Button
          variant="outline"
          :disabled="publicPage >= totalPages"
          class="/60 !bg-card !h-auto gap-1.5 !rounded-full !border !px-4 !py-2 !font-medium shadow-sm disabled:!opacity-40"
          @click="goPage(publicPage + 1)"
        >
          下一页
          <ChevronRight class="h-3.5 w-3.5" />
        </Button>
      </nav>
    </div>

    <!-- 详情 modal -->
    <MomentDetailModal
      :open="detailOpen"
      :moment="activeMoment"
      :volume-label="activeVolumeLabel"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :is-admin="isAdmin"
      @update:open="detailOpen = $event"
      @navigate="navigateDetail"
      @edit="openEditor($event)"
      @delete="confirmDelete"
    />

    <!-- 编辑 / 新建 modal -->
    <MomentEditorModal
      :open="editorOpen"
      :moment="editingMoment"
      :submitting="submitting"
      :last-saved-at="lastSavedAtLabel"
      @update:open="editorOpen = $event"
      @submit="handleEditorSubmit"
    />

    <!-- 删除确认 -->
    <Modal
      :open="deleteConfirmOpen"
      size="sm"
      :mask-closable="!deleting"
      :esc-closable="!deleting"
      @close="onDeleteCancel"
    >
      <div class="px-6 pt-6 pb-5">
        <h2 class="text-ink font-serif text-lg font-medium italic">
          删除这条碎碎念？
        </h2>
        <p class="text-muted mt-2 text-sm leading-relaxed">
          将软删除该条记录（deleted_at 置位），列表中将不再展示。
        </p>
      </div>
      <div class="/40 flex items-center justify-end gap-2 border-t px-6 py-4">
        <Button
          variant="outline"
          :disabled="deleting"
          class="/60 !h-auto !rounded-lg !border !px-4 !py-1.5 !text-[13px] disabled:!opacity-50"
          @click="onDeleteCancel"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          :disabled="deleting"
          class="!h-auto !rounded-lg !px-4 !py-1.5 !text-[13px] !text-white shadow-sm disabled:!opacity-50"
          @click="handleDelete"
        >
          {{ deleting ? '删除中…' : '删除' }}
        </Button>
      </div>
    </Modal>
  </BasicDetail>
</template>

<script setup lang="ts">
import { BasicDetail, Button, Modal } from '@/components';
import { useAuthStore } from '@/features/auth';
import { MomentComposer } from '@/features/moments/composables';
import { useMomentsStore } from '@/features/moments/stores/moments';
import { useNotificationStore } from '@/stores';
import type { Moment, MomentUpdatePayload } from '@/features/moments/types';
import { ChevronLeft, ChevronRight, CircleAlert, Plus } from '@lucide/vue';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MomentCard from './components/MomentCard.vue';
import MomentDetailModal from './components/MomentDetailModal.vue';
import MomentEditorModal from './components/MomentEditorModal.vue';
import MomentEmptyState from './components/MomentEmptyState.vue';

defineOptions({ name: 'MomentListView' });

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const notifier = useNotificationStore();
const store = useMomentsStore();

const {
  publicList,
  publicTotal,
  publicPage,
  publicPageSize,
  publicActiveTag,
  publicLoading,
} = storeToRefs(store);

const isAdmin = computed(() => auth.isAdmin);

const errorMessage = ref<string | null>(null);

// ── Tag 过滤（与 URL ?tag=&page= 双向绑定） ──
const activeTag = computed<string | null>(() => publicActiveTag.value);

const allTags = computed<string[]>(() => {
  const set = new Set<string>();
  for (const m of publicList.value) {
    for (const t of m.tags) set.add(t);
  }
  return [...set].sort();
});

function setTag(tag: string | null) {
  const query = { ...route.query };
  if (tag) {
    query.tag = tag;
    delete query.page;
  } else {
    delete query.tag;
    delete query.page;
  }
  router.replace({ name: 'moments', query });
}

async function load(
  page = publicPage.value,
  tag: string | null = activeTag.value,
) {
  errorMessage.value = null;
  try {
    await store.fetchPublic({
      page,
      page_size: publicPageSize.value,
      tag: tag ?? undefined,
    });
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '加载碎碎念失败';
  }
}

function reload() {
  void load();
}

function goPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  const query: Record<string, string> = {
    ...(route.query as Record<string, string>),
  };
  query.page = String(page);
  router.replace({ name: 'moments', query });
}

// ── 卷序号（中文 1-99） ──
function formatVolume(_moment: unknown, index: number): string {
  const n = index + 1;
  if (n > 99) return `卷 ${n}`;
  const map = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const toZh = (num: number): string => {
    if (num < 10) return map[num];
    if (num < 20) return `十${num === 10 ? '' : map[num - 10]}`;
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${map[tens]}十${ones === 0 ? '' : map[ones]}`;
  };
  return `卷${toZh(n)}`;
}

// ── Hero ──
const heroTitle = '碎碎念';
const heroSubtitle = computed(() => `卷 · ${dayjs().format('YYYY')}`);

// ────────────────────────────────────────────────────────────
// 详情 modal
// ────────────────────────────────────────────────────────────
const detailOpen = ref(false);
const detailId = ref<string | null>(null);

const activeMoment = computed<Moment | null>(
  () => publicList.value.find((m) => m.id === detailId.value) ?? null,
);

const detailIndex = computed(() =>
  detailId.value
    ? publicList.value.findIndex((m) => m.id === detailId.value)
    : -1,
);

const hasPrev = computed(() => detailIndex.value > 0);
const hasNext = computed(
  () =>
    detailIndex.value >= 0 && detailIndex.value < publicList.value.length - 1,
);

const activeVolumeLabel = computed(() => {
  if (detailIndex.value < 0) return '';
  return formatVolume(null, detailIndex.value);
});

function openDetail(id: string) {
  detailId.value = id;
  detailOpen.value = true;
}

function navigateDetail(dir: 'prev' | 'next') {
  const idx = detailIndex.value;
  if (idx < 0) return;
  const nextIdx = dir === 'prev' ? idx - 1 : idx + 1;
  const next = publicList.value[nextIdx];
  if (next) detailId.value = next.id;
}

// ────────────────────────────────────────────────────────────
// 编辑 / 新建 modal
// ────────────────────────────────────────────────────────────
const editorOpen = ref(false);
const editingMoment = ref<Moment | null>(null);
const lastSavedAt = ref<string | null>(null);
const lastSavedAtLabel = computed(() =>
  lastSavedAt.value ? dayjs(lastSavedAt.value).format('HH:mm:ss') : null,
);

const submitting = ref(false);

// 提交编排 —— 视图只关心 disable 按钮，normalize / refresh / navigate 全交给 composer。
const composer = new MomentComposer({
  create: store.create.bind(store),
  update: store.update.bind(store),
  refreshPublicList: (tag) => load(1, tag),
  openDetail: (id) => {
    detailId.value = id;
    detailOpen.value = true;
  },
  notify: (msg) => notifier.success(msg),
  notifyError: (msg) => notifier.error(msg),
});

function openEditor(moment: Moment | null) {
  editingMoment.value = moment;
  editorOpen.value = true;
  // 打开时若已有 modal 里的 detail，关闭它避免叠层
  if (detailOpen.value) detailOpen.value = false;
}

async function handleEditorSubmit(payload: MomentUpdatePayload) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const editing = editingMoment.value;
    const result = await composer.submit(
      editing
        ? { kind: 'update', id: editing.id, payload }
        : { kind: 'create', payload, activeTag: activeTag.value },
    );
    if (result.kind !== 'failed') {
      editorOpen.value = false;
    }
  } finally {
    submitting.value = false;
  }
}

// ────────────────────────────────────────────────────────────
// 删除确认
// ────────────────────────────────────────────────────────────
const deleteConfirmOpen = ref(false);
const deletingMoment = ref<Moment | null>(null);
const deleting = ref(false);

function confirmDelete(moment: Moment | null) {
  if (!moment) return;
  deletingMoment.value = moment;
  deleteConfirmOpen.value = true;
  if (detailOpen.value) detailOpen.value = false;
}

function onDeleteCancel() {
  if (deleting.value) return;
  deleteConfirmOpen.value = false;
  deletingMoment.value = null;
}

async function handleDelete() {
  const m = deletingMoment.value;
  if (!m || deleting.value) return;
  deleting.value = true;
  try {
    await store.remove(m.id);
    notifier.success('已删除');
    deleteConfirmOpen.value = false;
    deletingMoment.value = null;
  } catch (err: unknown) {
    notifier.error(err instanceof Error ? err.message : '删除失败');
  } finally {
    deleting.value = false;
  }
}

// ────────────────────────────────────────────────────────────
// 键盘快捷键：J / K 在 modal 打开时切上一条/下一条；Esc 关闭
// ────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (editorOpen.value || deleteConfirmOpen.value) return;
  if (!detailOpen.value) return;
  if (e.key === 'j' || e.key === 'J') {
    e.preventDefault();
    if (hasNext.value) navigateDetail('next');
  } else if (e.key === 'k' || e.key === 'K') {
    e.preventDefault();
    if (hasPrev.value) navigateDetail('prev');
  } else if (e.key === 'Escape') {
    detailOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  const initialPage = route.query.page ? Number(route.query.page) : 1;
  const initialTag =
    typeof route.query.tag === 'string' && route.query.tag
      ? route.query.tag
      : null;
  void load(initialPage, initialTag);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

watch(
  () => [route.query.page, route.query.tag],
  ([page, tag]) => {
    const nextPage = page ? Number(page) : 1;
    const nextTag = typeof tag === 'string' && tag ? tag : null;
    if (nextPage === publicPage.value && nextTag === activeTag.value) return;
    void load(nextPage, nextTag);
  },
);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(publicTotal.value / publicPageSize.value)),
);
</script>

<script setup lang="ts">
/**
 * SpotFormPanel —— 新增钓点(悬浮圆角卡片,desktop-only)。
 *
 * 取代原 SpotFormModal(居中 UiModal xl 两栏弹窗),对齐 SpotDetailPanel /
 * AnalysisPanel 书房纸卡语系:
 * - 桌面右侧浮动(mx-4 my-6 呼吸边)、rounded-3xl、四层 color-mix 阴影
 * - 无背景模糊;仅 ✕ / Esc / 触发按钮关闭
 * - 内容堆叠:顶交互迷你地图选点 + 下方表单(480px 内放弃两栏)
 *
 * 与 SpotDetailPanel / AnalysisPanel 三者互斥(父组件 useFishingDashboard 保证)。
 *
 * 草稿 / 图片 / 上传 / 校验 全部由 useSpotEditor seam 接管 —— 模板只做单向绑定。
 */
import SpotMiniMap from '@/features/fishing/components/SpotMiniMap.vue';
import { useSpotEditor } from '@/features/fishing/composables';
import type { CreateFishingSpotPayload } from '@readinglist/types';
import {
  FISHING_SPOT_KINDS,
  FISHING_SPOT_KIND_LABELS,
  SPOT_MAX_PICTURES,
} from '@readinglist/types';
import { fishingSpotsGateway } from '@readinglist/api';
import { DEFAULT_MAP_CENTER } from '@/features/fishing/stores/fishingMap';
import { UploadDropzone, UploadProgress } from '@/features/upload/components';
import {
  ImagePlus,
  ImageOff,
  Loader2,
  MapPin,
  RefreshCw,
  Star,
  X,
} from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { SlideFadeTransitionX, Button as UiButton } from '@/components';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** 地图初始聚焦位置(默认用户定位 / 默认中心) */
    initialCenter?: [number, number];
  }>(),
  { initialCenter: () => DEFAULT_MAP_CENTER },
);

const emit = defineEmits<{
  (e: 'close'): void;
  /** 创建成功,回传新钓点名称(后端 create 不返回实体,父组件按名称匹配刷新 + 打开详情) */
  (e: 'created', name: string): void;
}>();

/*
 * 卡片阴影 —— 三层向右 ambient + 顶部 inset 纸面反光。
 * 与 SpotDetailPanel / SettingsModal 共用同一套书房阴影语系。
 */
const CARD_SHADOW = [
  '0 -1px 1px color-mix(in oklch, var(--ink) 6%, transparent)',
  '0 -8px 18px color-mix(in oklch, var(--ink) 8%, transparent)',
  '0 -24px 40px color-mix(in oklch, var(--ink) 5%, transparent)',
  'inset 0 1px 0 0 oklch(from var(--page) l c h / 0.6)',
].join(', ');

// ── 草稿 seam(create 模式):负责 draft / pictures / pendingError / 上传 / 校验 / 提交流 ──
const editor = useSpotEditor({
  mode: 'create',
  initialLocation: props.initialCenter,
});
// 解构到 setup 顶层,模板里直接写 draft.xxx / pictures(自动解包),不再 editor.xxx.value
const {
  draft,
  pictures,
  pendingError,
  isUploading,
  progress,
  previewUrl,
  isDragging,
  fileInputRef,
  kindTouched,
  canAddMore,
  canSubmit: editorCanSubmit,
  triggerFileInput,
  handleFileSelect,
  handleDrop,
  handleDropzoneSelect,
  removePicture,
  clearPreview,
  retryUpload,
  buildPayload,
  resetAfterSubmit,
} = editor;

const submitting = ref(false);
const error = ref('');
// fileInputRef 是 template ref,仅在 <input ref="fileInputRef"> 用到 —— 解构后 TS 看不到引用,显式 void 一下避免 TS6133
void fileInputRef;

const kinds = FISHING_SPOT_KINDS;

const canSubmit = computed(() => editorCanSubmit.value && !submitting.value);

/** radiogroup 键处理 —— 与 ARIA radiogroup pattern 一致: ← / → / ↑ / ↓ 切换选中。 */
function onKindKeydown(event: KeyboardEvent): void {
  const k = event.key;
  if (
    k !== 'ArrowLeft' &&
    k !== 'ArrowRight' &&
    k !== 'ArrowUp' &&
    k !== 'ArrowDown'
  ) {
    return;
  }
  event.preventDefault();
  const idx = draft.value.kind === null ? 0 : kinds.indexOf(draft.value.kind);
  const dir = k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1;
  const nextIdx = (idx + dir + kinds.length) % kinds.length;
  draft.value.kind = kinds[nextIdx]!;
  kindTouched.value = true;
}

function onPickerChange(event: Event): void {
  handleFileSelect(event);
  // 重置 input value,使再次选择同一文件能触发 change
  (event.target as HTMLInputElement).value = '';
}

async function handleSubmit(): Promise<void> {
  if (!editorCanSubmit.value) {
    // canSubmit 为 false 时若 kind 仍未选,标记 touched 触发红边错误态
    if (draft.value.kind === null) kindTouched.value = true;
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const payload = buildPayload() as CreateFishingSpotPayload;
    await fishingSpotsGateway.create(payload);
    emit('created', payload.name);
    emit('close');
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : '创建钓点失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

// ── 无障碍:focus trap + Esc + restore focus ──
const panelRef = ref<HTMLElement | null>(null);
let triggerEl: HTMLElement | null = null;
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !panelRef.value) return;
  const nodes = panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE);
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// 打开时:重置草稿(沿用 seam 暴露的 resetAfterSubmit — create 分支全清)。
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetAfterSubmit();
      error.value = '';
    }
  },
);

// 焦点 trap + restore
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      triggerEl = (document.activeElement as HTMLElement) ?? null;
      await nextTick();
      const first = panelRef.value?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    } else {
      triggerEl?.focus();
      triggerEl = null;
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <!--
      新增钓点 —— 悬浮圆角卡片(对齐 SpotDetailPanel / AnalysisPanel)。
      · 桌面右侧浮动,rounded-3xl 书房纸卡
      · 四层 color-mix 阴影,无背景模糊,仅 ✕ / Esc 关闭
    -->

    <SlideFadeTransitionX>
      <aside
        v-if="open"
        ref="panelRef"
        class="bg-page /60 fixed top-6 right-6 bottom-6 z-50 flex w-full max-w-[480px] flex-col overflow-hidden rounded-3xl border"
        :style="CARD_SHADOW"
        role="dialog"
        aria-modal="true"
        aria-label="新增钓点"
        @keydown="trapFocus"
        @keydown.esc="emit('close')"
      >
        <!-- 顶栏 -->
        <header class="flex items-start justify-between gap-3 px-6 pt-6 pb-5">
          <div class="min-w-0">
            <h2 class="text-ink font-serif text-2xl leading-snug">新增钓点</h2>
            <p class="text-muted mt-0.5 text-xs">
              在地图上选择位置，填写钓点信息
            </p>
          </div>
          <button
            type="button"
            class="text-muted hover:bg-surface hover:text-ink inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
            aria-label="关闭"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </header>

        <!-- 错误提示 -->
        <div
          v-if="error"
          class="border-destructive/30 bg-destructive/10 text-destructive mx-6 mt-4 rounded-lg border px-3 py-2 text-sm"
          role="alert"
        >
          {{ error }}
        </div>

        <!-- 可滚动主体 -->
        <div
          class="flex-1 space-y-5 overflow-y-auto px-6 py-5 contain-[layout_paint_scroll_style]"
        >
          <!-- 交互迷你地图选点 -->
          <div class="space-y-3">
            <div class="text-muted flex items-center gap-1.5">
              <MapPin class="h-3.5 w-3.5" />
              <span class="text-xs">点击地图选择钓点位置</span>
            </div>
            <SpotMiniMap
              :center="initialCenter"
              :position="draft.coordinate ?? undefined"
              interactive
              @update:position="draft.coordinate = $event"
            />
            <div
              class="bg-surface flex items-center justify-between rounded-xl px-4 py-2.5"
            >
              <span class="text-muted text-xs">坐标</span>
              <span
                class="text-ink font-mono text-xs tabular-nums"
                :class="{ 'text-muted/50': !draft.coordinate }"
              >
                {{
                  draft.coordinate
                    ? `${draft.coordinate[0].toFixed(6)}, ${draft.coordinate[1].toFixed(6)}`
                    : '点击右侧地图选点'
                }}
              </span>
            </div>
          </div>

          <!-- 表单 -->
          <div class="space-y-4">
            <!-- 名称(必填) -->
            <div>
              <label
                class="text-ink mb-1.5 block text-sm font-medium"
                for="spot-form-name"
                >名称</label
              >
              <input
                id="spot-form-name"
                v-model="draft.name"
                type="text"
                placeholder="例如:南沙天后宫矶钓位"
                class="bg-surface text-ink placeholder:text-muted/60 focus:ring-accent/30 w-full rounded-xl border-0 px-4 py-3 text-sm focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- 描述 -->
            <div>
              <label
                class="text-ink mb-1.5 block text-sm font-medium"
                for="spot-form-desc"
                >描述</label
              >
              <textarea
                id="spot-form-desc"
                v-model="draft.description"
                rows="3"
                placeholder="水情、目标鱼、最佳出钓时段..."
                class="bg-surface text-ink placeholder:text-muted/60 focus:ring-accent/30 w-full resize-none rounded-xl border-0 px-4 py-3 text-sm leading-relaxed focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- 类型(必填) -->
            <div>
              <span
                id="spot-form-kind-label"
                class="text-ink mb-1.5 block text-sm font-medium"
                >类型</span
              >
              <div
                :class="[
                  'flex gap-2 rounded-2xl p-1',
                  kindTouched && draft.kind === null
                    ? 'ring-2 ring-[color:var(--destructive)]/40 ring-offset-1 ring-offset-[var(--page)]'
                    : '',
                ]"
                role="radiogroup"
                aria-labelledby="spot-form-kind-label"
                :aria-invalid="
                  kindTouched && draft.kind === null ? 'true' : 'false'
                "
                :aria-describedby="
                  kindTouched && draft.kind === null
                    ? 'spot-form-kind-error'
                    : undefined
                "
                @keydown="onKindKeydown"
              >
                <button
                  v-for="k in kinds"
                  :key="k"
                  type="button"
                  role="radio"
                  :aria-checked="draft.kind === k"
                  :aria-label="FISHING_SPOT_KIND_LABELS[k]"
                  :tabindex="
                    draft.kind === k || (draft.kind === null && k === kinds[0])
                      ? 0
                      : -1
                  "
                  class="bg-surface text-ink hover:border-accent/60 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  :class="
                    draft.kind === k
                      ? 'bg-accent text-ink border-accent font-medium'
                      : 'border-border'
                  "
                  @click="
                    () => {
                      draft.kind = k;
                      kindTouched = true;
                    }
                  "
                  @focus="kindTouched = true"
                >
                  {{ FISHING_SPOT_KIND_LABELS[k] }}
                </button>
              </div>
              <p
                v-if="kindTouched && draft.kind === null"
                id="spot-form-kind-error"
                class="text-destructive mt-1.5 text-xs"
                role="alert"
              >
                请选择钓点类型
              </p>
            </div>

            <!-- 标签 -->
            <div>
              <label
                class="text-ink mb-1.5 block text-sm font-medium"
                for="spot-form-tags"
                >标签</label
              >
              <input
                id="spot-form-tags"
                v-model="draft.tags"
                type="text"
                placeholder="矶钓, 海鲈, 夜钓(逗号分隔)"
                class="bg-surface text-ink placeholder:text-muted/60 focus:ring-accent/30 w-full rounded-xl border-0 px-4 py-3 text-sm focus:ring-2 focus:outline-none"
              />
              <p class="text-muted mt-1 text-xs">多个标签以逗号分隔</p>
            </div>

            <!-- 评分 -->
            <div>
              <span class="text-ink mb-1.5 block text-sm font-medium"
                >评分</span
              >
              <div class="flex items-center gap-1">
                <button
                  v-for="i in 5"
                  :key="i"
                  type="button"
                  class="p-0.5"
                  :aria-label="`${i} 星`"
                  @click="draft.rating = i"
                >
                  <Star
                    class="h-5 w-5 transition-colors"
                    :class="
                      i <= draft.rating
                        ? 'fill-warning text-warning'
                        : 'text-muted/30'
                    "
                  />
                </button>
                <span
                  v-if="draft.rating > 0"
                  class="text-muted ml-2 text-xs tabular-nums"
                >
                  {{ draft.rating.toFixed(1) }}
                </span>
              </div>
            </div>

            <!-- 图片(上传:3 列缩略图网格 + 末尾 + 瓦片,最多 9 张) -->
            <div>
              <span class="text-ink mb-1.5 block text-sm font-medium"
                >图片</span
              >

              <!-- 隐藏 file input:由 + 瓦片 click() 触发(空态改用 UploadDropzone 自管 input) -->
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onPickerChange"
              />

              <!-- 空态:通用 UploadDropzone -->
              <UploadDropzone
                v-if="pictures.length === 0 && !previewUrl"
                accept="image/*"
                :disabled="isUploading"
                prompt="点击或拖拽图片到此处"
                :hint="`最多 ${SPOT_MAX_PICTURES} 张,单张 ≤5MB`"
                @select="handleDropzoneSelect"
              />

              <!-- 非空态:3 列缩略图网格 -->
              <div v-else class="grid grid-cols-3 gap-2">
                <!-- 已上传图片 -->
                <div
                  v-for="p in pictures"
                  :key="p.id"
                  class="group bg-surface relative aspect-square overflow-hidden rounded-xl"
                >
                  <img :src="p.url" alt="" class="h-full w-full object-cover" />
                  <button
                    type="button"
                    class="bg-page/80 text-ink hover:bg-page absolute top-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100"
                    aria-label="移除图片"
                    @click="removePicture(p)"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </div>

                <!-- 上传中 / 失败瓦片 -->
                <div
                  v-if="previewUrl"
                  class="bg-surface relative aspect-square overflow-hidden rounded-xl"
                  :class="pendingError ? '' : 'opacity-60'"
                  aria-busy="true"
                >
                  <img
                    :src="previewUrl"
                    alt=""
                    class="h-full w-full object-cover"
                  />

                  <!-- 上传中:中央暗罩 + 底部进度条 -->
                  <template v-if="!pendingError">
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <Loader2 class="h-5 w-5 animate-spin text-white" />
                    </div>
                    <UploadProgress
                      :progress="progress"
                      height="h-1"
                      class="absolute right-2 bottom-2 left-2"
                    />
                  </template>

                  <!-- 失败:错误态 -->
                  <div
                    v-else
                    class="border-destructive bg-page/95 absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-center backdrop-blur-md"
                    role="alert"
                  >
                    <ImageOff class="text-destructive h-5 w-5" />
                    <p
                      class="text-destructive text-xs leading-tight font-medium"
                    >
                      {{ pendingError }}
                    </p>
                    <div class="flex gap-1.5">
                      <button
                        type="button"
                        class="bg-accent text-ink hover:bg-accent/90 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                        @click="retryUpload"
                      >
                        <RefreshCw class="h-3 w-3" />
                        重试
                      </button>
                      <button
                        type="button"
                        class="bg-surface text-ink hover:bg-surface/70 rounded-md px-2 py-1 text-xs font-medium"
                        @click="clearPreview"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                </div>

                <!-- + 瓦片 -->
                <button
                  v-if="canAddMore && !previewUrl"
                  type="button"
                  class="bg-surface hover:bg-surface/70 group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-colors"
                  :class="{ 'border-ink': isDragging }"
                  :aria-label="'添加图片'"
                  :title="`还可上传 ${SPOT_MAX_PICTURES - pictures.length} 张`"
                  @click="triggerFileInput"
                  @dragover.prevent
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                >
                  <div
                    class="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <ImagePlus
                      class="text-muted group-hover:text-ink h-5 w-5 transition-colors"
                      :stroke-width="1.5"
                    />
                    <span class="text-muted mt-1 text-xs">添加</span>
                  </div>
                </button>
              </div>

              <p class="text-muted mt-1.5 text-xs tabular-nums">
                {{ pictures.length }} / {{ SPOT_MAX_PICTURES }}
              </p>
            </div>
          </div>
        </div>

        <!-- 底栏 -->
        <footer
          class="border-border flex items-center justify-end gap-2 border-t px-6 py-2"
        >
          <button
            type="button"
            class="text-muted hover:bg-surface rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            :disabled="submitting"
            @click="emit('close')"
          >
            取消
          </button>
          <UiButton size="md" :disabled="!canSubmit" @click="handleSubmit">
            <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" />
            {{ submitting ? '创建中...' : '添加钓点' }}
          </UiButton>
        </footer>
      </aside>
    </SlideFadeTransitionX>
  </Teleport>
</template>

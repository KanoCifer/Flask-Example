<template>
  <Teleport to="body">
    <motion.div
      v-if="image"
      :initial="{ opacity: 0, backdropFilter: 'blur(0px)' }"
      :animate="{ opacity: 1, backdropFilter: 'blur(8px)' }"
      :transition="FADE"
      class="fixed inset-0 bg-black/45"
    >
    </motion.div>
  </Teleport>
  <Teleport to="body">
    <ModalFadeTransition>
      <div
        v-if="image"
        class="fixed inset-0 z-9999 flex items-center justify-center p-4 md:p-8"
        @click.self="$emit('close')"
      >
        <motion.div
          :initial="{ opacity: 0, scale: 0.96, y: 12 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :exit="{ opacity: 0, scale: 0.96, y: 12 }"
          :transition="{ type: 'spring', damping: 26, stiffness: 300 }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdm-title"
          class="bg-page text-muted /60 relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl border shadow-[0_12px_32px_color-mix(in_oklch,var(--ink)_10%,transparent)] md:grid-cols-[1.45fr_1fr]"
        >
          <!-- ============= 左侧：胶片查看 ============= -->
          <section
            class="bg-surface/80 relative flex min-h-0 flex-col gap-4 p-8 pb-6"
            aria-label="胶片查看区"
          >
            <header class="flex items-center justify-between gap-3">
              <span
                class="bg-ink text-page inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10.5px] tracking-[0.2em] uppercase"
                style="font-family: var(--font-mono)"
              >
                <span
                  class="bg-accent inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_0_2px_color-mix(in_oklch,var(--accent)_25%,transparent)]"
                ></span>
                {{ filmLabel }}
              </span>
              <span
                class="text-muted text-[11px] tracking-[0.18em] uppercase"
                style="font-family: var(--font-mono)"
                :aria-label="`当前帧位 ${frameNo} / 36`"
              >
                FRAME
                <b class="text-ink font-semibold">{{ frameNo }}</b> / 36
              </span>
            </header>

            <figure
              class="bg-secondary relative aspect-[4/3] min-h-[320px] flex-1 overflow-hidden rounded-[14px] shadow-[0_14px_36px_color-mix(in_oklch,var(--ink)_18%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--ink)_12%,transparent)]"
              role="img"
              :aria-label="image.description || '胶片照片'"
            >
              <img
                :src="image.url"
                :alt="image.description || ''"
                class="absolute inset-0 h-full w-full object-contain"
              />
              <div
                class="pointer-events-none absolute inset-0"
                aria-hidden="true"
              >
                <span
                  class="absolute top-3 left-3 h-[18px] w-[18px] border-t-[1.5px] border-l-[1.5px] border-[color-mix(in_oklch,var(--page)_85%,transparent)]"
                ></span>
                <span
                  class="absolute top-3 right-3 h-[18px] w-[18px] border-t-[1.5px] border-r-[1.5px] border-[color-mix(in_oklch,var(--page)_85%,transparent)]"
                ></span>
                <span
                  class="absolute bottom-3 left-3 h-[18px] w-[18px] border-b-[1.5px] border-l-[1.5px] border-[color-mix(in_oklch,var(--page)_85%,transparent)]"
                ></span>
                <span
                  class="absolute right-3 bottom-3 h-[18px] w-[18px] border-r-[1.5px] border-b-[1.5px] border-[color-mix(in_oklch,var(--page)_85%,transparent)]"
                ></span>
              </div>
              <div
                class="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply"
                :style="grainStyle"
                aria-hidden="true"
              ></div>
            </figure>

            <footer class="flex items-center justify-between gap-4">
              <dl
                class="text-muted flex items-center gap-2.5 text-[11px] tracking-[0.16em] uppercase"
                style="font-family: var(--font-mono)"
                aria-label="拍摄参数"
              >
                <dt class="sr-only">感光度</dt>
                <dd>{{ iso }}</dd>
                <span
                  class="bg-surface/30 h-1 w-1 rounded-full"
                  aria-hidden="true"
                ></span>
                <dt class="sr-only">快门</dt>
                <dd>{{ exposure }}</dd>
                <span
                  class="bg-surface/30 h-1 w-1 rounded-full"
                  aria-hidden="true"
                ></span>
                <dt class="sr-only">光圈</dt>
                <dd>{{ aperture }}</dd>
                <span
                  class="bg-surface/30 h-1 w-1 rounded-full"
                  aria-hidden="true"
                ></span>
                <dt class="sr-only">焦距</dt>
                <dd>{{ focal }}</dd>
              </dl>
              <div
                class="flex items-center gap-1"
                role="group"
                aria-label="帧导航"
              >
                <button
                  type="button"
                  class="/40 text-ink hover:bg-page inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                  aria-label="上一张"
                  @click="$emit('prev')"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="/40 text-ink hover:bg-page inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                  aria-label="下一张"
                  @click="$emit('next')"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </footer>
          </section>

          <!-- ============= 右侧：元数据 ============= -->
          <section
            class="bg-surface flex min-h-0 flex-col gap-5 p-8 pb-6"
            aria-label="图片信息"
          >
            <header class="flex items-center justify-between">
              <span
                class="text-ink text-[10.5px] tracking-[0.22em] uppercase"
                style="font-family: var(--font-mono)"
              >
                No. {{ frameNo }} / 档案
              </span>
              <button
                type="button"
                class="text-muted hover:text-ink hover:bg-surface inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--ink)_12%,transparent)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                aria-label="关闭详情"
                @click="$emit('close')"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </header>

            <div>
              <h2
                id="pdm-title"
                class="text-ink text-[26px] leading-[1.2] font-semibold tracking-[-0.015em]"
              >
                {{ ex.camera || '未命名' }}
              </h2>
              <div class="text-muted mt-2 flex items-center gap-2 text-[13px]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
                <span>{{ takenAt || formattedDate }}</span>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[color-mix(in_oklch,var(--ink)_10%,transparent)] p-px"
              role="group"
              aria-label="拍摄参数"
            >
              <div class="bg-page p-2.5">
                <div
                  class="text-muted mb-1 text-[10px] tracking-[0.16em] uppercase"
                  style="font-family: var(--font-mono)"
                >
                  机身
                </div>
                <div
                  class="text-ink text-[12.5px] tracking-[0.02em]"
                  style="
                    font-family: var(--font-mono);
                    font-variant-numeric: tabular-nums;
                  "
                >
                  {{ camera }}
                </div>
              </div>
              <div class="bg-page p-2.5">
                <div
                  class="text-muted mb-1 text-[10px] tracking-[0.16em] uppercase"
                  style="font-family: var(--font-mono)"
                >
                  镜头
                </div>
                <div
                  class="text-ink text-[12.5px] tracking-[0.02em]"
                  style="
                    font-family: var(--font-mono);
                    font-variant-numeric: tabular-nums;
                  "
                >
                  {{ lens }}
                </div>
              </div>
              <div class="bg-page p-2.5">
                <div
                  class="text-muted mb-1 text-[10px] tracking-[0.16em] uppercase"
                  style="font-family: var(--font-mono)"
                >
                  光圈
                </div>
                <div
                  class="text-ink text-[12.5px] tracking-[0.02em]"
                  style="
                    font-family: var(--font-mono);
                    font-variant-numeric: tabular-nums;
                  "
                >
                  {{ aperture }}
                </div>
              </div>
              <div class="bg-page p-2.5">
                <div
                  class="text-muted mb-1 text-[10px] tracking-[0.16em] uppercase"
                  style="font-family: var(--font-mono)"
                >
                  地点
                </div>
                <div
                  class="text-ink text-[12.5px] tracking-[0.02em]"
                  style="
                    font-family: var(--font-mono);
                    font-variant-numeric: tabular-nums;
                  "
                >
                  {{ location }}
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span
                  class="text-muted text-[10px] tracking-[0.22em] uppercase"
                  style="font-family: var(--font-mono)"
                >
                  拍摄笔记
                </span>
                <button
                  v-if="editable"
                  type="button"
                  class="text-muted hover:text-ink rounded-md px-1.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                  style="font-family: var(--font-mono)"
                  aria-label="编辑描述"
                  @click="toggleEdit"
                >
                  {{ isEditing ? '完成' : '编辑' }}
                </button>
              </div>

              <textarea
                v-if="editable && isEditing"
                ref="captionEditEl"
                v-model="localDescription"
                rows="4"
                aria-label="编辑拍摄笔记"
                class="bg-page text-ink placeholder:text-muted focus:border-accent focus:ring-accent/20 w-full resize-y rounded-xl border border-[color-mix(in_oklch,var(--ink)_18%,transparent)] px-4 py-3.5 text-[14.5px] leading-[1.55] transition-shadow focus:ring-2 focus:outline-none"
                style="font-family: var(--font-sans)"
                @keydown.esc="toggleEdit"
              ></textarea>

              <p
                v-else
                :class="[
                  'font-family-dongfang min-h-24 rounded-xl border border-dashed px-4 py-3.5 text-[18px] leading-[1.55] whitespace-pre-wrap',
                  isEmpty
                    ? 'text-muted/70 grid place-items-center text-center italic'
                    : 'text-ink/90',
                ]"
                :style="
                  isEmpty
                    ? {
                        background:
                          'color-mix(in oklch, var(--secondary) 35%, transparent)',
                        borderColor:
                          'color-mix(in oklch, var(--ink) 18%, transparent)',
                      }
                    : {
                        fontFamily: 'var(--font-family-dongfang)',
                        background:
                          'color-mix(in oklch, var(--secondary) 55%, transparent)',
                        borderColor:
                          'color-mix(in oklch, var(--ink) 18%, transparent)',
                      }
                "
              >
                {{
                  isEmpty ? '还没有写笔记 · 点编辑开始记录' : image.description
                }}
              </p>
            </div>

            <div class="mt-auto flex items-center gap-2.5 pt-2">
              <button
                type="button"
                class="text-ink/70 hover:text-ink hover:bg-accent inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--ink)_14%,transparent)] bg-transparent px-[18px] py-2.5 text-[13.5px] font-medium tracking-[0.01em] transition-colors hover:border-[color-mix(in_oklch,var(--ink)_30%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                style="min-height: 36px"
                aria-label="复制图片信息"
                @click="onCopy"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 012-2h10" />
                </svg>
                复制
              </button>

              <button
                type="button"
                class="text-ink/60 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--ink)_14%,transparent)] bg-transparent px-[18px] py-2.5 text-[13.5px] font-medium tracking-[0.01em] transition-colors hover:border-[color-mix(in_oklch,oklch(0.55_0.18_25)_40%,transparent)] hover:bg-[color-mix(in_oklch,oklch(0.55_0.18_25)_8%,transparent)] hover:text-[oklch(0.55_0.18_25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                style="min-height: 36px"
                aria-label="删除此图片"
                @click="$emit('delete', image.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"
                  />
                </svg>
                删除
              </button>

              <button
                type="button"
                class="bg-secondary text-page ml-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--ink)] px-[18px] py-2.5 text-[13.5px] font-medium tracking-[0.01em] transition-colors hover:bg-[color-mix(in_oklch,var(--ink)_90%,var(--accent))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                style="min-height: 36px"
                :aria-label="
                  editable && isEditing ? '保存对描述的修改' : '确认'
                "
                @click="onSave"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
                保存修改
              </button>
            </div>
          </section>
        </motion.div>
      </div>
    </ModalFadeTransition>
  </Teleport>
</template>

<script setup lang="ts">
import { motion } from 'motion-v';
import { FADE } from '@/constants';
import { ModalFadeTransition } from '@/components';
import { computed, nextTick, ref, watch } from 'vue';
import type { ExifInfo, Picture } from '@/features/pic/composables';

const props = defineProps<{
  image: Picture | null;
  editable: boolean;
  formattedDate: string;
  frameNo?: number;
  exif?: ExifInfo | null;
}>();

const emit = defineEmits<{
  close: [];
  update: [id: string, description: string];
  delete: [id: string];
  prev: [];
  next: [];
  copy: [image: Picture];
}>();

const localDescription = ref('');
const isEditing = ref(false);
const captionEditEl = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.image,
  (img) => {
    localDescription.value = img?.description ?? '';
    isEditing.value = false;
  },
  { immediate: true },
);

const isEmpty = computed(() => !props.image?.description?.trim());
const ex = computed<ExifInfo>(() => props.exif ?? {});
const camera = computed(() => ex.value.camera || '— —');
const lens = computed(() => ex.value.lens || '— —');
const aperture = computed(() => ex.value.aperture || '—');
const focal = computed(
  () => ex.value.focalLength35 || ex.value.focalLength || '—',
);
const iso = computed(() =>
  ex.value.iso != null ? `ISO ${ex.value.iso}` : 'ISO —',
);
const exposure = computed(() => ex.value.exposure || '—');
// 胶片/机型角标：手机照片无胶片信息时显示相机型号
const filmLabel = computed(() => ex.value.camera || 'Kodak Portra 400 · 35mm');
// GPS 坐标文本：23.07°N, 113.39°E
const location = computed(() => {
  const g = ex.value.gps;
  if (!g) return '— —';
  const fmt = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return `${fmt(g.lat, 'N', 'S')} ${fmt(g.lng, 'E', 'W')}`;
});
// 拍摄时间：EXIF DateTimeOriginal 形如 "2026:03:19 16:37:46"
const takenAt = computed(() => {
  const raw = ex.value.takenAt;
  if (!raw) return '';
  const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/.exec(raw);
  if (!m) return '';
  return `${m[1]}年${m[2]}月${m[3]}日 ${m[4]}:${m[5]}`;
});

// 暗房颗粒纹理：内联 data-URI，不发外网请求
const grainStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
};

async function toggleEdit() {
  isEditing.value = !isEditing.value;
  if (isEditing.value) {
    await nextTick();
    captionEditEl.value?.focus();
  }
}

function onSave() {
  if (!props.image) return;
  if (props.editable && isEditing.value) {
    emit('update', props.image.id, localDescription.value);
    isEditing.value = false;
  } else {
    emit('close');
  }
}

function onCopy() {
  if (!props.image) return;
  emit('copy', props.image);
}
</script>

<style scoped>
/* ============================================================
   PicDetailModal — 胶片查看详情页
   - 颜色：shadcn-vue 主题 token（--page / --ink / --secondary / --secondary / --accent / --muted-text / --card-bg）
   - 字体：base.css 的 3 套（HarmonyOS Sans / 阿里妈妈东方大楷 / Averia Gruesa Libre）
   - 10 主题 × 2 模式自动重染
   ============================================================ */

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  :deep(*),
  :deep(*::before),
  :deep(*::after) {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>

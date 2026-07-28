<script setup lang="ts">
import { CoverUploader } from '@/features/upload/components';

/**
 * MetaRow · 博客元数据行 (摘要 + 封面)
 *
 * 独立一行展开: 父容器 grid-template-rows 在 0fr / 1fr 间过渡,
 * 内层 min-h-0 让内容自然撑开, 编辑区不被推动, 焦点留在 textarea。
 *
 * 数据流:
 *  - summary / cover 由父级 v-model 双向绑定
 *  - 封面上传交给通用 CoverUploader 复合控件(选择 / 上传 / 预览 / 清除 一体),
 *    失败通过 upload-error 事件上抛,由父级决定 toast / 日志处理(保持组件纯粹)。
 */
defineProps<{
  open: boolean;
  summary: string;
  cover: string;
  title: string;
}>();

const emit = defineEmits<{
  'update:summary': [value: string];
  'update:cover': [value: string];
  'upload-error': [message: string];
}>();
</script>

<template>
  <div
    class="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
    :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    :aria-hidden="!open"
  >
    <div class="min-h-0">
      <section
        id="meta-drawer"
        aria-label="文章元数据"
        :class="[
          'bg-surface/60 space-y-5 rounded-2xl p-5 transition-opacity duration-200 ease-out motion-reduce:transition-none',
          open ? 'opacity-100 shadow-md' : 'opacity-0',
        ]"
        :inert="!open || undefined"
      >
        <!-- Summary -->
        <div>
          <label
            for="meta-summary"
            class="text-muted mb-1.5 flex items-baseline justify-between font-serif text-[11px] tracking-wider uppercase italic"
          >
            <span>摘要</span>
            <span
              class="text-muted/60 font-mono text-[10px] tracking-normal normal-case"
            >
              {{ summary.length }} / 200
            </span>
          </label>
          <textarea
            id="meta-summary"
            :value="summary"
            rows="4"
            maxlength="200"
            placeholder="两三行，写给读者的开场白…"
            class="text-ink placeholder:text-muted/60 bg-surface focus:border-ink/40 focus:ring-ink/10 w-full resize-none rounded-lg border px-3 py-2 font-serif text-sm leading-relaxed outline-0 focus:ring-1"
            @input="
              emit(
                'update:summary',
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </div>

        <!-- Cover -->
        <div>
          <label
            class="text-muted mb-1.5 block font-serif text-[11px] tracking-wider uppercase italic"
          >
            封面
          </label>
          <CoverUploader
            class="mx-auto max-w-sm"
            :cover="cover"
            type="blog"
            aspect="16/9"
            :alt="`${title || '文章'} 封面预览`"
            @update:cover="emit('update:cover', $event)"
            @upload-error="emit('upload-error', $event)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

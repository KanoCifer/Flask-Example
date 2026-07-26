<script setup lang="ts">
/**
 * 弹窗本体。
 * - 用原生 <dialog> + showModal() 获得浏览器级焦点陷阱、Esc 关闭、遮罩 inert。
 * - v-bind 外部属性（继承 attrs），保持 shadcn 风格的 class 覆盖点。
 * - aria-labelledby / aria-describedby 指向内部 Title / Description。
 *   Title / Description 自行 inject 'alertDialog.labelledBy' / 'describedBy' 设置 id。
 */
import type { HTMLAttributes } from 'vue';
import {
  computed,
  inject,
  nextTick,
  provide,
  useTemplateRef,
  watch,
} from 'vue';

interface Props {
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();

defineOptions({
  name: 'UiAlertDialogContent',
  inheritAttrs: false,
});

const open = inject<{ value: boolean }>('alertDialog.open', { value: false });
const setOpen = inject<(v: boolean) => void>('alertDialog.setOpen', () => {});

const dialogRef = useTemplateRef<HTMLDialogElement>('dialogRef');
const labelledBy = `alert-dialog-title-${Math.random().toString(36).slice(2, 9)}`;
const describedBy = `alert-dialog-description-${Math.random().toString(36).slice(2, 9)}`;

provide('alertDialog.labelledBy', labelledBy);
provide('alertDialog.describedBy', describedBy);

const isOpen = computed(() => open.value);

watch(
  isOpen,
  async (v) => {
    await nextTick();
    const el = dialogRef.value;
    if (!el) return;
    if (v && !el.open) {
      el.showModal();
    } else if (!v && el.open) {
      el.close();
    }
  },
  { immediate: true },
);

function onClose() {
  if (open.value) setOpen(false);
}

function onClick(e: MouseEvent) {
  if (e.target === dialogRef.value) setOpen(false);
}
</script>

<template>
  <Teleport to="body">
    <dialog
      v-if="isOpen"
      ref="dialogRef"
      data-slot="alert-dialog-content"
      :data-state="isOpen ? 'open' : 'closed'"
      :aria-labelledby="labelledBy"
      :aria-describedby="describedBy"
      class="bg-page data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 backdrop:bg-black/80 sm:max-w-lg"
      :class="props.class"
      @close="onClose"
      @click="onClick"
    >
      <slot />
    </dialog>
  </Teleport>
</template>

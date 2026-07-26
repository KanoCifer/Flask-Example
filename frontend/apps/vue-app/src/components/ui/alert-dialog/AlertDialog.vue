<script setup lang="ts">
/**
 * 受控根组件。
 * 用法：
 *   <AlertDialog v-model:open="x"> ... </AlertDialog>
 *   <AlertDialog :open="x" @update:open="..."> ... </AlertDialog>
 *
 * 子组件（Trigger / Content / Action / Cancel）通过 provide/inject
 * 共享 open + onOpenChange，避免每个调用方都要重新连线。
 */
import { provide, ref, watch } from 'vue';

interface Props {
  open?: boolean;
  defaultOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  open: undefined,
  defaultOpen: false,
});

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const internal = ref(props.defaultOpen);
const isControlled = props.open !== undefined;
const current = ref<boolean>(
  isControlled ? (props.open as boolean) : internal.value,
);

watch(
  () => props.open,
  (v) => {
    if (v !== undefined) current.value = v;
  },
);

function setOpen(v: boolean) {
  if (!isControlled) internal.value = v;
  current.value = v;
  emit('update:open', v);
}

provide('alertDialog.open', current);
provide('alertDialog.setOpen', setOpen);

defineOptions({
  name: 'UiAlertDialog',
});
</script>

<template>
  <slot />
</template>

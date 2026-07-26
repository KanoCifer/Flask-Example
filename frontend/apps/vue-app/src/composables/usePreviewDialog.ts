import { onMounted, onUnmounted, ref } from 'vue';

// 通用图片/媒体全屏预览：只负责显示/关闭，不直接改动业务数据
export function usePreviewDialog() {
  const isOpen = ref<boolean>(false);
  const url = ref<string>('');
  const alt = ref<string>('');

  function open(dialogUrl: string, dialogAlt: string) {
    if (!dialogUrl) {
      return;
    }
    url.value = dialogUrl;
    alt.value = dialogAlt;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
    url.value = '';
    alt.value = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }

  // 支持 Esc 关闭大图弹层；组件卸载时一并清理
  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  return {
    isOpen,
    url,
    alt,
    open,
    close,
  };
}

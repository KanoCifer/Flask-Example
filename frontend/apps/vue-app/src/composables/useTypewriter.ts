import { onUnmounted, ref, type Ref } from 'vue';

export interface UseTypewriterReturn {
  /** 当前已显示的文本（响应式） */
  text: Ref<string>;
  /** 流式模式：追加新文本到缓冲区 */
  push: (chunk: string) => void;
  /** 流式模式：标记流结束，缓冲区放完后停止动画 */
  done: () => void;
  /** 清空缓冲区和已显示文本，重新开始 */
  reset: () => void;
  /** Pull 模式：传入完整文本和速度，自动逐字显示 */
  start: (text: string, speed?: number, onComplete?: () => void) => void;
  /** 当前是否正在打字（任意模式） */
  isTyping: Ref<boolean>;
  /** 当前是否已打完（任意模式） */
  isDone: Ref<boolean>;
}

/**
 * 打字机效果 composable — 支持两种模式：
 *
 * - **Push 模式**（流式）：push(chunk) → done()，用于 SSE 等异步数据流
 * - **Pull 模式**（一次性）：start(text, speed)，用于固定文本动画
 *
 * 用法（流式）：
 *   const { text, push, done } = useTypewriter();
 *   push(chunk);   // 流式到达时
 *   done();        // 流结束时
 *
 * 用法（一次性）：
 *   const { text, start } = useTypewriter();
 *   start('Hello World', 50, () => console.log('done'));
 */
export function useTypewriter(): UseTypewriterReturn {
  const text = ref('');
  const isTyping = ref(false);
  const isDone = ref(false);

  let buffer = '';
  let streamDone = false;
  let animFrame = 0;

  function revealNext() {
    if (buffer.length > 0) {
      text.value += buffer.slice(0, 2);
      buffer = buffer.slice(2);
    }
    if (buffer.length > 0 || !streamDone) {
      animFrame = requestAnimationFrame(revealNext);
    } else {
      animFrame = 0;
      isTyping.value = false;
      isDone.value = true;
    }
  }

  function startAnim() {
    if (!animFrame) {
      isTyping.value = true;
      animFrame = requestAnimationFrame(revealNext);
    }
  }

  // ── Push 模式（流式）──────────────────────────────────

  function push(chunk: string) {
    buffer += chunk;
    startAnim();
  }

  function done() {
    streamDone = true;
  }

  // ── Pull 模式（一次性）────────────────────────────────

  function start(fullText: string, speed = 1, onComplete?: () => void) {
    // 清理上一次
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = 0;
    }
    buffer = fullText;
    streamDone = false;
    text.value = '';
    isTyping.value = true;
    isDone.value = false;

    // pull 模式下 speed 含义是"每帧几个字符"
    const charsPerFrame = speed <= 0 ? 2 : Math.max(1, Math.round(speed / 16));

    const pullReveal = () => {
      if (buffer.length > 0) {
        const n = Math.min(charsPerFrame, buffer.length);
        text.value += buffer.slice(0, n);
        buffer = buffer.slice(n);
      }
      if (buffer.length > 0) {
        animFrame = requestAnimationFrame(pullReveal);
      } else {
        animFrame = 0;
        isTyping.value = false;
        isDone.value = true;
        onComplete?.();
      }
    };

    animFrame = requestAnimationFrame(pullReveal);
  }

  // ── 通用 ──────────────────────────────────────────────

  function reset() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = 0;
    }
    buffer = '';
    streamDone = false;
    text.value = '';
    isTyping.value = false;
    isDone.value = false;
  }

  onUnmounted(() => {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
    }
  });

  return { text, push, done, reset, start, isTyping, isDone };
}

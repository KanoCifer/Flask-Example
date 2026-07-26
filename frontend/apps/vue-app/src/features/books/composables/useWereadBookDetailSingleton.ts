/**
 * 微信读书详情面板 — **模块级单例** 状态。
 *
 * ## 契约
 *
 * 这是 **应用全局共享** 的状态:模块加载时创建一个 `_selectedBook` 和
 * `_isOpen` ref,所有调用 `useWereadBookDetailSingleton()` 的组件
 * (BookShelf 等) 看到的是 **同一份状态**。
 *
 * 函数名后缀 `Singleton` 是显式契约的一部分:
 * - 不要在测试里连续调用两次并期望隔离 — 这是**故意的**全局共享
 * - 不要在多 Vue app 场景下用 — 状态会跨 app 串
 * - 整个应用一次只能有一个 detail panel
 *
 * ## 多 panel 场景怎么办
 *
 * 改用 `provide(key, ref(null))` / `inject(key)` 在父级拥有自己的 ref。
 * 详见 WereadBookDetailPanel 的 props 接口,父级把 ref 的 value 通过
 * :book / :open 传进去即可 — 组件本身已经解耦,不依赖这个 composable。
 *
 * ## 接口
 *
 * - `selectedBook: ComputedRef<WereadUserBook | null>`  只读
 * - `isOpen:       ComputedRef<boolean>`              只读
 * - `selectBook(b)`     打开面板并设置当前书
 * - `close()`           关闭面板(保留 selectedBook 到 exit 动画完成)
 * - `clearAfterClose()` 在 @after-leave 钩子里清空 selectedBook
 */
import { computed, ref } from 'vue';
import type { WereadUserBook } from '@/features/books/api';

const _selectedBook = ref<WereadUserBook | null>(null);
const _isOpen = ref(false);

export function useWereadBookDetailSingleton() {
  const selectedBook = computed(() => _selectedBook.value);
  const isOpen = computed(() => _isOpen.value);

  function selectBook(book: WereadUserBook): void {
    _selectedBook.value = book;
    _isOpen.value = true;
  }

  function close(): void {
    _isOpen.value = false;
    // selectedBook 保留到 exit 动画完成,避免内容突然变化
    // 消费者可在 @after-leave 时调 clearAfterClose,或下一个 selectBook 自动覆盖
  }

  function clearAfterClose(): void {
    _selectedBook.value = null;
  }

  return {
    selectedBook,
    isOpen,
    selectBook,
    close,
    clearAfterClose,
  };
}

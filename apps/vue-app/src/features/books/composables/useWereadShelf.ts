import { wereadGateway, type WereadUserBook } from '@/features/books/api';
import { computed, ref } from 'vue';

/**
 * Encapsulates weread user-shelf data fetching and the sync action.
 *
 * Returns reactive state (`books`, `isLoading`, `errorMessage`, `isSyncing`,
 * `visibleBooks`) and the two actions (`fetchBooks`, `handleSync`).
 *
 * The view is responsible for triggering the initial fetch (typically in
 * `onMounted`) and for any UI-level concerns (search, selection).
 */
export const useWereadShelf = () => {
  const books = ref<WereadUserBook[]>([]);
  const isLoading = ref(true);
  const errorMessage = ref('');
  const isSyncing = ref(false);

  const visibleBooks = computed(() => books.value.filter((b) => !b.secret));

  const fetchBooks = async (): Promise<void> => {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const res = await wereadGateway.getUserShelf();
      if (res.data) {
        books.value = res.data.user_books;
      } else {
        throw new Error(res.message || '获取书架失败');
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      errorMessage.value =
        error?.response?.data?.message || error?.message || '获取书架失败';
    } finally {
      isLoading.value = false;
    }
  };

  const handleSync = async (): Promise<void> => {
    isSyncing.value = true;
    try {
      await wereadGateway.syncMyBooks();
      await fetchBooks();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      errorMessage.value =
        error?.response?.data?.message || error?.message || '同步失败';
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    books,
    isLoading,
    errorMessage,
    isSyncing,
    visibleBooks,
    fetchBooks,
    handleSync,
  };
};

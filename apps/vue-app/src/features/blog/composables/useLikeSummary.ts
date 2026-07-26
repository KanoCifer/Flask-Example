import { socialGateway } from '@/features/blog/api';
import { useNotificationStore } from '@/stores';
import { AxiosError } from 'axios';
import { onMounted, ref, type Ref } from 'vue';

export interface UseLikeSummaryReturn {
  likesCount: Ref<number>;
  like: () => Promise<boolean>;
  isSubmitting: Ref<boolean>;
}

export function useLikeSummary(): UseLikeSummaryReturn {
  const notifier = useNotificationStore();
  const likesCount = ref<number>(0);
  const isSubmitting = ref(false);

  const fetchLikesCount = async () => {
    try {
      const response = await socialGateway.getLikes();
      likesCount.value = response.likes_count || 0;
    } catch (error) {
      console.error('Failed to fetch likes count:', error);
    }
  };

  const like = async (): Promise<boolean> => {
    if (isSubmitting.value) return false;

    isSubmitting.value = true;

    try {
      await socialGateway.likeOnce({ likes_count: 1 });
      likesCount.value += 1;
      return true;
    } catch (error) {
      let errorMsg = '点赞失败，请稍后重试';
      if (error instanceof AxiosError) {
        if (error.response?.status === 429) {
          errorMsg = '🥳今天已经点赞很多次啦，明天再试试吧！';
        }
      }
      notifier.error(errorMsg);
      console.error('Failed to update likes count:', error);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  };

  onMounted(fetchLikesCount);

  return { likesCount, like, isSubmitting };
}

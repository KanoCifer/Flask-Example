import { rssGateway, type SubscriptionItem } from '@/features/rss/api';
import { useNotificationStore } from '@/stores';
import { getSubscriptionTitle } from '@/features/rss/rssUtils';
import { ref } from 'vue';

export const useRssSubscriptions = () => {
  const notifier = useNotificationStore();

  const subscriptions = ref<SubscriptionItem[]>([]);
  const subscriptionsLoading = ref(false);
  const subscriptionsError = ref('');
  const activeSubscriptionId = ref<number | null>(null);

  const fetchSubscriptions = async (): Promise<void> => {
    subscriptionsLoading.value = true;
    subscriptionsError.value = '';

    try {
      const data = await rssGateway.getSubscriptions();
      if (!Array.isArray(data)) {
        throw new Error('订阅列表格式错误');
      }

      subscriptions.value = data;
    } catch (error: unknown) {
      console.error('fetch subscriptions error:', error);
      subscriptionsError.value =
        error instanceof Error ? error.message : '加载订阅失败';
      notifier.error(subscriptionsError.value);
    } finally {
      subscriptionsLoading.value = false;
    }
  };

  const handleRefresh = async (
    subscription: SubscriptionItem,
  ): Promise<void> => {
    try {
      await rssGateway.refreshSubscription(subscription.id);
      notifier.success(`已刷新：${getSubscriptionTitle(subscription)}`);
      await fetchSubscriptions();
    } catch (error: unknown) {
      console.error('refresh subscription error:', error);
      notifier.error(
        `刷新失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  };

  const handleDelete = async (
    subscription: SubscriptionItem,
  ): Promise<boolean> => {
    const confirmed = window.confirm(
      `确定删除订阅「${getSubscriptionTitle(subscription)}」及其相关文章吗？`,
    );
    if (!confirmed) {
      return false;
    }

    try {
      await rssGateway.deleteSubscription(subscription.id);
      notifier.success('订阅删除成功');
      await fetchSubscriptions();
      return true;
    } catch (error: unknown) {
      console.error('delete subscription error:', error);
      notifier.error(
        `删除失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      return false;
    }
  };

  return {
    subscriptions,
    subscriptionsLoading,
    subscriptionsError,
    activeSubscriptionId,
    fetchSubscriptions,
    handleRefresh,
    handleDelete,
  };
};

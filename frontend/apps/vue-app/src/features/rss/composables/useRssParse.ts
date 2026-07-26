import { rssGateway } from '@/features/rss/api';
import { useNotificationStore } from '@/stores';
import { useStorage } from '@vueuse/core';
import { ref } from 'vue';
import { exampleFeeds } from '@/features/rss/rssUtils';

export interface RssMetadata {
  title: string;
  description: string;
  link: string;
  published?: string | null;
}

export interface RssEntry {
  title: string;
  link: string;
  summary: string;
  published: string | null;
  content?: string;
}

interface ParseForm {
  rssUrl: string;
  saveToDb: boolean;
}

export const useRssParse = () => {
  const notifier = useNotificationStore();

  const rssForm = ref<ParseForm>({
    rssUrl: '',
    saveToDb: false,
  });
  const rssHistory = useStorage<string[]>('rssHistory', []);
  const parseMetadata = ref<RssMetadata | null>(null);
  const parseEntries = ref<RssEntry[]>([]);
  const parseLoading = ref(false);

  const parseRss = async (): Promise<boolean> => {
    const rssUrl = rssForm.value.rssUrl.trim();
    if (!rssUrl) {
      notifier.error('请输入 RSS 订阅地址');
      return false;
    }

    parseLoading.value = true;

    if (!rssHistory.value.includes(rssUrl)) {
      rssHistory.value.unshift(rssUrl);
      if (rssHistory.value.length > 3) {
        rssHistory.value.splice(3);
      }
    }

    try {
      const parsedData = await rssGateway.parseRss({
        rss_url: rssUrl,
        save_to_db: rssForm.value.saveToDb,
      });

      parseMetadata.value = {
        title: parsedData.meta.title,
        description: parsedData.meta.description,
        link: parsedData.meta.link,
        published: parsedData.meta.published ?? null,
      };
      parseEntries.value = parsedData.entries.map((entry) => ({
        title: entry.title,
        link: entry.link,
        summary: entry.summary,
        published: entry.published ?? null,
        content: entry.content,
      }));

      notifier.success('RSS 解析成功');
      return rssForm.value.saveToDb;
    } catch (error: unknown) {
      console.error('RSS parse error:', error);
      notifier.error(
        `解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      return false;
    } finally {
      parseLoading.value = false;
    }
  };

  return {
    rssForm,
    rssHistory,
    parseMetadata,
    parseEntries,
    parseLoading,
    exampleFeeds,
    parseRss,
  };
};

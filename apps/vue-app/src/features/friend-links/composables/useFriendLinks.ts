import { onMounted, ref } from 'vue';
import { useNotificationStore } from '@/stores';
import { useImageError } from '@/composables';
import type { Website } from '@/features/websites';
import friendLinksData from '@/features/friend-links/lib/friendlinks.json';
import { websitesData } from '@/data';

export interface FriendLink {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  tags: string[];
}

export interface SelfInfo {
  name: string;
  description: string;
  url: string;
  icon: string;
  tags: string[];
}

export function useFriendLinks() {
  const dailyPick = ref<Website | null>(null);
  const links = ref<FriendLink[]>([]);
  const selfInfo = ref<SelfInfo>({
    name: '',
    description: '',
    url: '',
    icon: '',
    tags: [],
  });

  const { handleImageError } = useImageError();

  const refreshDailyPick = () => {
    if (websitesData.sites.length === 0) return;
    if (websitesData.sites.length === 1) {
      dailyPick.value = websitesData.sites[0] as Website;
      return;
    }
    let idx: number;
    do {
      idx = Math.floor(Math.random() * websitesData.sites.length);
    } while (websitesData.sites[idx].id === dailyPick.value?.id);
    dailyPick.value = websitesData.sites[idx] as Website;
  };

  const copySelfInfo = async () => {
    const md = [
      `- **站点名称**：${selfInfo.value.name}`,
      `- **描述**：${selfInfo.value.description}`,
      `- **URL**：${selfInfo.value.url}`,
      `- **头像**：${selfInfo.value.icon}`,
    ].join('\n');

    const notice = useNotificationStore();
    try {
      await navigator.clipboard.writeText(md);
      notice.success('友链信息已复制到剪贴板');
    } catch {
      notice.error('复制失败，请手动复制');
    }
  };

  onMounted(() => {
    links.value = friendLinksData.links as FriendLink[];
    selfInfo.value = friendLinksData.self as SelfInfo;
    refreshDailyPick();
  });

  return {
    dailyPick,
    links,
    selfInfo,
    handleImageError,
    refreshDailyPick,
    copySelfInfo,
  };
}

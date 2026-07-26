import { apiClient } from '@/api/request';

import type { Changelog } from '@/features/changelog/types';

export const changelogGateway = {
  getChangelogs: async (): Promise<Changelog[]> => {
    const response = await apiClient.get('v2/publicv2/changelogs');
    return response.data.data;
  },
};

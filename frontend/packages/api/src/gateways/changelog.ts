import { apiClient } from '../apiClient';
import type { Changelog } from '@readinglist/types';

// ── 变更日志网关（Vue / React 共享）──

export interface ChangelogGateway {
  getChangelogs(): Promise<Changelog[]>;
}

export const changelogGateway: ChangelogGateway = {
  async getChangelogs(): Promise<Changelog[]> {
    const res = await apiClient.get<{ data: Changelog[] }>(
      'v2/publicv2/changelogs',
    );
    return res.data.data;
  },
};

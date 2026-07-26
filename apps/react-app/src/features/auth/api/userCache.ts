import type { UserInfo } from '@/features/auth/types';

const USER_INFO_KEY = 'cached_user_info';

export const userCache = {
  get(): UserInfo | null {
    try {
      const cached = sessionStorage.getItem(USER_INFO_KEY);
      return cached ? (JSON.parse(cached) as UserInfo) : null;
    } catch {
      return null;
    }
  },

  set(user: UserInfo | null): void {
    if (user) {
      sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      return;
    }

    sessionStorage.removeItem(USER_INFO_KEY);
  },

  clear(): void {
    userCache.set(null);
  },
};

import {
  createAuthGateway,
  tokenService,
  userCache,
  type UserInfo,
} from '@/features/auth';
import { refreshAccessToken } from '@/api/refresh';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { create } from 'zustand';

const authGateway = createAuthGateway();
let isLoggingOut = false;
let hydrationPromise: Promise<void> | null = null;

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  isHydrated: boolean;
  hydrateAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithPasskey: (assertion: unknown) => Promise<void>;
  getPasskeyAuthenticationOptions: () => Promise<PublicKeyCredentialRequestOptionsJSON>;
  loginWithGitHub: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 初始状态
  isAuthenticated: false,
  isHydrated: false,
  user: null,

  // 初始化
  hydrateAuth: async () => {
    // 单例模式：避免并发调用重复请求 /auth/me
    if (hydrationPromise) {
      return hydrationPromise;
    }

    hydrationPromise = (async () => {
      try {
        // 1. 主动刷新 access token（利用 cookie 中的 refresh_token），
        //    避免后续请求因内存中无 token 而先 401 再刷新
        await refreshAccessToken();

        // 2. 先尝试从缓存读取
        const cachedUser = userCache.get();
        if (cachedUser) {
          set({
            isAuthenticated: true,
            user: cachedUser,
            isHydrated: true,
          });
          return;
        }

        // 3. 缓存不存在，从后端获取
        try {
          const userData = await authGateway.fetchUser();
          set({
            isAuthenticated: !!userData,
            user: userData,
            isHydrated: true,
          });
        } catch (err) {
          console.error('获取用户信息失败:', err);
          set({
            isAuthenticated: false,
            user: null,
            isHydrated: true,
          });
        }
      } catch {
        // refresh 失败说明未登录或 cookie 过期，静默处理
        set({
          isAuthenticated: false,
          user: null,
          isHydrated: true,
        });
      }
    })();

    return hydrationPromise;
  },

  login: async (username, password) => {
    const result = await authGateway.login(username, password);
    // 登录成功后更新状态、保存 access token 和 userCache
    if (result.accessToken) {
      tokenService.save(result.accessToken);
    }
    if (result.user) {
      userCache.set(result.user);
    }
    set({
      isAuthenticated: true,
      user: result.user,
    });
  },

  logout: () => {
    if (isLoggingOut) return;
    isLoggingOut = true;
    tokenService.clear();
    userCache.clear();
    authGateway
      .logout()
      .then(() => {
        isLoggingOut = false;
        // 注销成功后更新状态
        set({
          isAuthenticated: false,
          user: null,
        });
      })
      .catch(() => {
        isLoggingOut = false;
      });
  },

  loginWithPasskey: async (assertion: unknown) => {
    const result = await authGateway.loginWithPasskey(assertion);
    // 登录成功后更新状态、保存 access token 和 userCache
    if (result.accessToken) {
      tokenService.save(result.accessToken);
    }
    if (result.user) {
      userCache.set(result.user);
    }
    set({
      isAuthenticated: true,
      user: result.user,
    });
  },

  getPasskeyAuthenticationOptions: async () => {
    return authGateway.getPasskeyAuthenticationOptions();
  },

  loginWithGitHub: () => {
    authGateway.loginWithGitHub();
  },
}));

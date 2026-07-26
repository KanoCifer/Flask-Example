import { createAuthGateway } from '@/features/auth/api/authGateway';
import { registerTokenRefresher } from '@/lib';
import { refreshAccessToken } from '@/features/auth/lib/refresh';
import { tokenService } from '@/api/tokenService';
import { reconnectWs } from '@/lib';
import type { UserInfo } from '@/features/auth/types';
import { userCache } from '@/features/auth/lib/userCache';
import { useNotificationStore } from '@/stores';
import { isAxiosError } from 'axios';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// 定义认证状态管理
export const useAuthStore = defineStore('auth', () => {
  // ---------------------- 状态（State） ----------------------
  const user = ref<UserInfo | null>(null);
  const loading = ref(false);
  const isHydrated = ref(false); // 是否初始化过
  const authGateway = createAuthGateway();
  const notifier = useNotificationStore();
  const accessToken = ref('');
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => !!user.value?.is_admin);

  // ---------------------- 方法（Actions） ----------------------
  //
  //
  // 获取accessToken
  const getAccessToken = () => {
    return tokenService.get();
  };

  // 2. 获取当前登录用户信息
  async function fetchUser(
    options: { silentOnUnauthenticated?: boolean } = {},
  ) {
    loading.value = true;
    try {
      const userData = await authGateway.fetchUser();
      user.value = userData;
      userCache.set(userData); // 缓存到 sessionStorage
      // 启动心跳上报
      reconnectWs();
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const isUnauthenticated = status === 401;
      if (!(options.silentOnUnauthenticated && isUnauthenticated)) {
        notifier.error('登陆过期，请重新登录！');
      }
      user.value = null;
      userCache.clear();
    } finally {
      loading.value = false;
    }
  }

  async function hydrateAuth() {
    if (isHydrated.value) return; // 避免重复初始化

    // 注册 token 刷新回调，供 apiClient 401 拦截器使用
    registerTokenRefresher(refreshAccessToken);

    try {
      // 1. 主动刷新 access token（利用 cookie 中的 refresh_token），
      //    避免后续请求因内存中无 token 而先 401 再刷新
      await refreshAccessToken();

      // 2. 先尝试从缓存读取
      const cachedUser = userCache.get();
      if (cachedUser) {
        user.value = cachedUser;
        isHydrated.value = true;
        // 启动心跳上报
        reconnectWs();
        return;
      }

      // 3. 缓存不存在，从后端获取
      await fetchUser({ silentOnUnauthenticated: true });
      isHydrated.value = true;
    } catch {
      // refresh 失败说明未登录或 cookie 过期，静默处理
      user.value = null;
      userCache.clear();
      isHydrated.value = true;
    }
  }

  async function getPasskeyAuthenticationOptions() {
    return authGateway.getPasskeyAuthenticationOptions();
  }

  // 4. 登录
  async function login(username: string, password: string) {
    loading.value = true;
    try {
      const res = await authGateway.login(username, password);
      // 登录响应中已包含用户信息，直接使用并缓存
      const userData = res.user;
      user.value = userData;
      accessToken.value = res.accessToken;
      tokenService.save(res.accessToken);
      userCache.set(userData);
      // 启动心跳上报
      reconnectWs();

      notifier.success('登录成功，欢迎回来！');
      return res.raw;
    } catch (error) {
      notifier.error('登录失败');
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function loginWithPasskey(assertion: unknown) {
    loading.value = true;

    try {
      const res = await authGateway.loginWithPasskey(assertion);

      const userData = res.user;
      user.value = userData;
      accessToken.value = res.accessToken;
      tokenService.save(res.accessToken);
      userCache.set(userData);

      reconnectWs();

      notifier.success('Passkey 登录成功！欢迎回来！');
      return res.raw;
    } catch (error) {
      notifier.error('Passkey 登录失败');
      throw error;
    } finally {
      loading.value = false;
    }
  }

  const loginWithGitHub = () => {
    authGateway.loginWithGitHub();
  };

  // 5. 登出
  async function logout() {
    loading.value = true;
    try {
      await authGateway.logout(); // 调用后端登出接口
    } catch {
      // console.error("登出失败:", err);
      notifier.error('登出失败');
    } finally {
      user.value = null;
      accessToken.value = '';
      tokenService.clear();
      userCache.clear();

      // 停止心跳上报
      reconnectWs();

      // 注意：不在此处跳转。路由导航是调用方职责，store 不应依赖 router
      //（否则会形成 auth/store ↔ router 循环依赖）。

      notifier.success('已退出登录');
      loading.value = false;
    }
  }

  // 6. 刷新用户信息（更新资料后调用）
  async function refreshUser() {
    await fetchUser(); // 从后端获取最新数据并更新缓存
  }

  // 暴露给组件使用的状态和方法
  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    isHydrated,
    fetchUser,
    hydrateAuth,
    getPasskeyAuthenticationOptions,
    login,
    loginWithPasskey,
    loginWithGitHub,
    logout,
    refreshUser,
    getAccessToken,
  };
});

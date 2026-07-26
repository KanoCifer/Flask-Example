import apiClient, { extractData, type ApiResponse } from '@/api/apiClient';
import type { UserInfo } from '@/features/auth/types';
import { useNotificationStore } from '@/stores/notificationState';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

const notification = useNotificationStore.getState();

interface LoginResponseData {
  id: number;
  username: string;
  is_admin: boolean;
  name?: string;
  email?: string | null;
  gender?: string | null;
  mobile?: string | null;
  photo?: string | null;
  access_token: string;
  refresh_token: string;
  has_passkey: boolean;
  github_bound: boolean;
}

export interface LoginResult {
  user: UserInfo | null;
  accessToken: string;
  refreshToken: string;
  raw: LoginResponseData | undefined;
}

export interface PasskeyLoginResult {
  user: UserInfo | null;
  accessToken: string;
  refreshToken: string;
  raw: LoginResponseData | undefined;
}

export interface AuthGateway {
  fetchUser: () => Promise<UserInfo | null>;
  getPasskeyAuthenticationOptions: () => Promise<PublicKeyCredentialRequestOptionsJSON>;
  login: (username: string, password: string) => Promise<LoginResult>;
  loginWithPasskey: (assertion: unknown) => Promise<PasskeyLoginResult>;
  loginWithGitHub: () => void;
  logout: () => Promise<void>;
}

const buildLoginResult = (data: LoginResponseData): LoginResult => {
  const { access_token, refresh_token, ...userFields } = data;
  return {
    user: userFields as UserInfo,
    accessToken: access_token,
    refreshToken: refresh_token,
    raw: data,
  };
};
const emptyLoginResult = (): LoginResult => {
  return { user: null, accessToken: '', refreshToken: '', raw: undefined };
};

export function createAuthGateway(): AuthGateway {
  return {
    async fetchUser(): Promise<UserInfo | null> {
      const res = await apiClient.get<ApiResponse<UserInfo | null>>('v3/me');
      return res.data.data || null;
    },

    async getPasskeyAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
      const res = await apiClient.get<
        ApiResponse<PublicKeyCredentialRequestOptionsJSON>
      >('v3/passkey/authentication-options');
      return res.data.data;
    },

    async login(username: string, password: string): Promise<LoginResult> {
      const res = await apiClient.post<ApiResponse<LoginResponseData>>(
        'v3/login',
        { username, password },
      );
      if (!res.data.data) {
        notification.error('登录失败，请检查用户名和密码');
        return emptyLoginResult();
      }

      const data = extractData(res);
      if (!data) {
        notification.error('登录失败，请检查用户名和密码');
        return emptyLoginResult();
      }

      notification.success('登录成功');
      return buildLoginResult(data as LoginResponseData);
    },

    async loginWithPasskey(assertion: unknown): Promise<PasskeyLoginResult> {
      const res = await apiClient.post<ApiResponse<LoginResponseData>>(
        'v3/passkey/authenticate',
        {
          assertion: assertion,
        },
      );

      const data = extractData(res);
      if (!data) {
        notification.error('Passkey 登录失败，请重试');
        return emptyLoginResult();
      }

      notification.success('登录成功');
      return buildLoginResult(data as LoginResponseData);
    },

    async logout(): Promise<void> {
      await apiClient.post('/v3/logout');
      notification.success('已退出登录');
    },

    loginWithGitHub(): void {
      window.location.href = '/v3/auth/github';
    },
  };
}

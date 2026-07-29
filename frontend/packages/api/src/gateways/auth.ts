import { apiClient, extractData } from '../apiClient';
import type { ApiResponse } from '../types';
import type { UserInfo } from '@readinglist/types';
import type { AxiosResponse } from 'axios';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

// ------------------------------------------------------------------ #
// Types
// ------------------------------------------------------------------ #

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

function buildLoginResult(data: LoginResponseData): LoginResult {
  const { access_token, refresh_token, ...userFields } = data;
  return {
    user: userFields as UserInfo,
    accessToken: access_token,
    refreshToken: refresh_token,
    raw: data,
  };
}

function emptyLoginResult(): LoginResult {
  return { user: null, accessToken: '', refreshToken: '', raw: undefined };
}

// ------------------------------------------------------------------ //
// Static gateway — registration, profile, passkey management
// ------------------------------------------------------------------ #

export const authGateway = {
  uploadAvatar(formData: FormData): Promise<Record<string, unknown>> {
    return apiClient
      .put<ApiResponse<Record<string, unknown>>>('v3/upload-pic', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(extractData);
  },

  getPasskeyRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return apiClient
      .get<ApiResponse<PublicKeyCredentialCreationOptionsJSON>>(
        'v3/passkey/registration-options',
      )
      .then(extractData);
  },

  registerPasskey(payload: { response: unknown }): Promise<AxiosResponse<unknown>> {
    return apiClient.post('v3/passkey/register', payload);
  },

  deletePasskey(): Promise<AxiosResponse<unknown>> {
    return apiClient.delete('v3/passkey/delete');
  },

  unbindGithub(): Promise<AxiosResponse<unknown>> {
    return apiClient.post('v3/github/unbind');
  },

  updateProfileSettings(payload: {
    name: string;
    username: string;
    gender: string | null;
    email: string | null;
    mobile: string | null;
    password: string | null;
  }): Promise<Record<string, unknown>> {
    return apiClient
      .put<ApiResponse<Record<string, unknown>>>('v1/auth/settings', payload)
      .then(extractData);
  },

  sendRegisterEmailCode(payload: { email: string }): Promise<AxiosResponse<unknown>> {
    return apiClient.post('v1/auth/email/code', payload);
  },

  register(payload: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
    email_code: string;
  }): Promise<AxiosResponse<unknown>> {
    return apiClient.post('v1/auth/register', payload);
  },
};

// ------------------------------------------------------------------ //
// Dynamic gateway — login, logout, passkey auth, user fetch
// ------------------------------------------------------------------ #

export interface AuthGateway {
  fetchUser: () => Promise<UserInfo | null>;
  getPasskeyAuthenticationOptions: () => Promise<PublicKeyCredentialRequestOptionsJSON>;
  login: (username: string, password: string) => Promise<LoginResult>;
  loginWithPasskey: (assertion: unknown) => Promise<PasskeyLoginResult>;
  logout: () => Promise<void>;
  loginWithGitHub: () => void;
}

export function createAuthGateway(): AuthGateway {
  return {
    async fetchUser(): Promise<UserInfo | null> {
      const res = await apiClient.get<ApiResponse<UserInfo | null>>('v3/me');
      return res.data.data || null;
    },

    async getPasskeyAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
      const res = await apiClient.get<ApiResponse<PublicKeyCredentialRequestOptionsJSON>>(
        'v3/passkey/authentication-options',
      );
      return res.data.data;
    },

    async login(username: string, password: string): Promise<LoginResult> {
      const res = await apiClient.post<ApiResponse<LoginResponseData>>('v3/login', {
        username,
        password,
      });
      const data = extractData(res);
      return data ? buildLoginResult(data as LoginResponseData) : emptyLoginResult();
    },

    async loginWithPasskey(assertion: unknown): Promise<PasskeyLoginResult> {
      const res = await apiClient.post<ApiResponse<LoginResponseData>>(
        'v3/passkey/authenticate',
        { assertion },
      );
      const data = extractData(res);
      return data ? buildLoginResult(data as LoginResponseData) : emptyLoginResult();
    },

    async logout(): Promise<void> {
      await apiClient.post('v3/logout');
    },

    loginWithGitHub(): void {
      window.location.href = '/v3/auth/github';
    },
  };
}

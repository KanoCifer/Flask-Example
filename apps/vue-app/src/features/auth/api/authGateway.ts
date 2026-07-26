import { apiClient } from '@/api/request';
import type { UserInfo } from '@/features/auth/types';
import type { AxiosResponse } from 'axios';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

// ------------------------------------------------------------------ #
// Types
// ------------------------------------------------------------------ #

/** Backend API response envelope — every endpoint returns { message, data } */
interface ApiResponse<T> {
  message: string;
  data: T | null;
}

interface Envelope<T> {
  data: T;
}

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
  has_passkey: boolean;
  github_bound: boolean;
}

export interface LoginResult {
  user: UserInfo | null;
  raw: LoginResponseData | undefined;
  accessToken: string;
}

export interface PasskeyLoginResult {
  user: UserInfo | null;
  raw: LoginResponseData | undefined;
  accessToken: string;
}

// ------------------------------------------------------------------ #
// Helpers
// ------------------------------------------------------------------ #

function unwrapEnvelope<T>(res: { data: Envelope<T> }): T | undefined {
  return res.data.data;
}

function buildLoginResult(data: LoginResponseData): LoginResult {
  const { ...userFields } = data;
  return {
    user: userFields as UserInfo,
    raw: data,
    accessToken: data.access_token,
  };
}

function emptyLoginResult(): LoginResult {
  return { user: null, raw: undefined, accessToken: '' };
}

// ------------------------------------------------------------------ #
// Static gateway — registration, profile, passkey management
// ------------------------------------------------------------------ #

export const authGateway = {
  uploadAvatar(
    formData: FormData,
  ): Promise<AxiosResponse<ApiResponse<Record<string, unknown>>>> {
    return apiClient.put('v3/upload-pic', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getPasskeyRegistrationOptions(): Promise<
    AxiosResponse<ApiResponse<PublicKeyCredentialCreationOptionsJSON>>
  > {
    return apiClient.get('v3/passkey/registration-options');
  },

  registerPasskey(payload: {
    response: unknown;
  }): Promise<AxiosResponse<unknown>> {
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
  }): Promise<AxiosResponse<ApiResponse<Record<string, unknown>>>> {
    return apiClient.put('v1/auth/settings', payload);
  },

  sendRegisterEmailCode(payload: {
    email: string;
  }): Promise<AxiosResponse<unknown>> {
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

// ------------------------------------------------------------------ #
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
      const res = await apiClient.get<Envelope<UserInfo | null>>('v3/me');
      return res.data.data || null;
    },

    async getPasskeyAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
      const res = await apiClient.get<
        Envelope<PublicKeyCredentialRequestOptionsJSON>
      >('v3/passkey/authentication-options');
      return res.data.data;
    },

    async login(username: string, password: string): Promise<LoginResult> {
      const res = await apiClient.post<Envelope<LoginResponseData>>(
        'v3/login',
        {
          username,
          password,
        },
      );
      const data = unwrapEnvelope(res);
      return data ? buildLoginResult(data) : emptyLoginResult();
    },

    async loginWithPasskey(assertion: unknown): Promise<PasskeyLoginResult> {
      const res = await apiClient.post<Envelope<LoginResponseData>>(
        'v3/passkey/authenticate',
        { assertion },
      );
      const data = unwrapEnvelope(res);
      return data ? buildLoginResult(data) : emptyLoginResult();
    },

    async logout(): Promise<void> {
      await apiClient.post('v3/logout');
    },

    loginWithGitHub(): void {
      window.location.href = '/v3/auth/github';
    },
  };
}

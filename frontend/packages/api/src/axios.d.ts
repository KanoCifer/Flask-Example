import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    _isRefreshToken?: boolean;
  }
  interface CreateAxiosDefaults<D = unknown> {
    _isRefreshToken?: boolean;
  }
  interface AxiosDefaults<D = unknown> {
    _isRefreshToken?: boolean;
  }
}

import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    _isRefreshToken?: boolean;
  }
  interface CreateAxiosDefaults {
    _isRefreshToken?: boolean;
  }
  interface AxiosDefaults {
    _isRefreshToken?: boolean;
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars -- Axios 原始类型声明要求保留泛型参数 */
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

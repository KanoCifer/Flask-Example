// access-JWT 内存存储（模块级单例）。

let accessToken = '';

export const tokenService = {
  get(): string {
    return accessToken;
  },

  save(token: string): void {
    accessToken = token;
  },

  clear(): void {
    accessToken = '';
  },
};

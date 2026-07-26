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

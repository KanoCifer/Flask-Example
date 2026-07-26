export interface AuthSideEffects {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  navigateToHome: () => Promise<unknown> | unknown;
}

const authSideEffects: AuthSideEffects = {
  notifySuccess: () => undefined,
  notifyError: () => undefined,
  navigateToHome: () => undefined,
};

export function configureAuthSideEffects(
  sideEffects: Partial<AuthSideEffects>,
): void {
  Object.assign(authSideEffects, sideEffects);
}

export function getAuthSideEffects(): AuthSideEffects {
  return authSideEffects;
}

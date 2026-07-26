const VUE_SITE_URL = 'https://kanocifer.chat';

export function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;domain=.kanocifer.chat`;
}

export function switchToVue(): void {
  setCookie('device_force', 'vue', 30);
  window.location.href = VUE_SITE_URL;
}

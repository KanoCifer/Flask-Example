interface TwikooOptions {
  el: string | HTMLElement;
  lang?: string;
  path?: string;
}

export async function useTwikoo(options: TwikooOptions) {
  const twikoo = await import('twikoo');
  twikoo.default.init({
    ...options,
    envId: 'https://api.kanocifer.chat/twikoo',
  });

  return twikoo.default;
}

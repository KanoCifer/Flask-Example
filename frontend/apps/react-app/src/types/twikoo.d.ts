declare module 'twikoo' {
  interface TwikooInitOptions {
    envId: string;
    el: string | HTMLElement;
    path?: string;
    lang?: string;
    region?: string;
  }

  const twikoo: {
    init(options: TwikooInitOptions): Promise<void>;
  };

  export default twikoo;
}

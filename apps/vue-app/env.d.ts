/// <reference types="vite/client" />
/// <reference types="@types/amap-js-api" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}

declare module "twikoo" {
  interface TwikooOptions {
    envId: string;
    el: string | HTMLElement;
    region?: string;
    path?: string;
    lang?: string;
    onCommentLoaded?: () => void;
  }

  export function init(options: TwikooOptions): void;
}

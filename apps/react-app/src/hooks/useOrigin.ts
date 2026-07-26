/**
 * 把后端返回的图片（媒体）URL 统一为当前环境可加载的地址。
 *
 * 与 Vue 端 `frontend/src/composables/shared/useOrigin.ts` 同语义：
 * - 空字符串原样返回；
 * - 已是 `http://` / `https://` 开头的绝对 URL，原样返回（避免重复包装）；
 * - 其余（相对路径或裸路径），仅在 https 环境下用 `https://api.kanocifer.chat` 作为前缀。
 *
 * 注：函数名沿用 `useOrigin` 是为了和 Vue 端语义一致，**不是** React hook。
 */
export function useOrigin(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
    return url;
  }
  return 'https://api.kanocifer.chat' + (url.startsWith('/') ? '' : '/') + url;
}

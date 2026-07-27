// ── markdown.ts ─────────────────────────────────────────────────────────────
// markdown → sanitize 后的 HTML。框架无关，供 dangerouslySetInnerHTML / v-html 使用。
//
// 从 Vue 端 `composables/useMarkdown.ts` 与 React 端 `lib/markdown.ts` 迁入，
// 以 Vue 端为底本（带 sanitizeOpts 参数 + gfm/breaks 默认开启）。

import { Marked } from 'marked';
import dompurify from 'dompurify';
import type { Config as DOMPurifyConfig } from 'dompurify';

// 单一实例 + 实例级配置（不污染 marked 全局单例）。
// gfm / breaks 与 MarkdownEditor 保持一致：GFM 表格/任务列表 + 单换行转 <br>。
const marked = new Marked();
marked.setOptions({ gfm: true, breaks: true });

/** 渲染 markdown → DOMPurify sanitize 后的 HTML 字符串。 */
export function renderMarkdown(
  text: string | null | undefined,
  sanitizeOpts?: DOMPurifyConfig,
): string {
  if (!text) return '';
  const rawHtml = marked.parse(text, { async: false }) as string;
  return dompurify.sanitize(rawHtml, sanitizeOpts ?? {});
}

// ── markdown.ts ─────────────────────────────────────────────────────────────
// markdown → sanitize 后的 HTML。框架无关，供 dangerouslySetInnerHTML / v-html 使用。
//
// 从 Vue 端 `composables/useMarkdown.ts` 与 React 端 `lib/markdown.ts` 迁入，
// 以 Vue 端为底本（带 sanitizeOpts 参数 + gfm/breaks 默认开启）。

import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/common';
import dompurify from 'dompurify';
import type { Config as DOMPurifyConfig } from 'dompurify';

// 单一实例 + 实例级配置（不污染 marked 全局单例）。
// gfm / breaks 与 MarkdownEditor 保持一致：GFM 表格/任务列表 + 单换行转 <br>。
// 代码块用 hljs 在解析阶段上色（hljs language-* class，样式由各端主题 CSS 提供）。
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
);
marked.setOptions({ gfm: true, breaks: true });

/** 渲染 markdown → DOMPurify sanitize 后的 HTML 字符串。 */
export function renderMarkdown(
  text: string | null | undefined,
  sanitizeOpts?: DOMPurifyConfig,
): string {
  if (!text) return '';
  const rawHtml = marked.parse(text) as string;
  return dompurify.sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'], ...sanitizeOpts });
}

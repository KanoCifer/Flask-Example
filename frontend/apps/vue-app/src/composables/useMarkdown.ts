import { Marked } from 'marked';
import dompurify from 'dompurify';
import type { Config as DOMPurifyConfig } from 'dompurify';

// 单一实例 + 实例级配置（不污染 marked 全局单例）。
// gfm / breaks 与 MarkdownEditor 保持一致：GFM 表格/任务列表 + 单换行转 <br>。
const marked = new Marked();
marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(
  text: string | null | undefined,
  sanitizeOpts?: DOMPurifyConfig,
): string {
  if (!text) return '';
  const rawHtml = marked.parse(text, { async: false }) as string;
  return dompurify.sanitize(rawHtml, sanitizeOpts);
}

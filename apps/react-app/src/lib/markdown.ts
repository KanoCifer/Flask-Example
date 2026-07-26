import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const marked = new Marked();

/** 渲染 markdown →  sanitize 后的 HTML，供 dangerouslySetInnerHTML 使用。 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text) as string);
}

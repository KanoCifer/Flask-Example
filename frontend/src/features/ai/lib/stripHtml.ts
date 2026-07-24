/**
 * 去除 HTML 标签，返回纯文本。
 * 与 useAiCompanion 内部 `pureContent` 行为一致：
 * - 移除所有匹配 `<...>` 的标签（包括嵌套、自闭合）
 * - 去除首尾空白
 *
 * 注意：此函数不做 HTML 结构解析，仅做正则剥离。CDATA / HTML entities
 * (如 `&amp;`) 不会被反转义 — 与现有调用方语义一致。
 */
export function stripHtml(content: string): string {
  return content.replaceAll(/<[^>]+>/g, '').trim();
}
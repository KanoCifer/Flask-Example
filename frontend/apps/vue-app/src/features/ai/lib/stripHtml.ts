/**
 * 去除 HTML 标签，返回纯文本。
 * 供 useAiCompanion 内部 `pureContent` 使用。
 *
 * 实现走 DOMParser 而不是正则剥离，原因：
 * - 旧正则 `/<[^>]+>/g` 在注释/属性里出现 `>`（如 `<!-- a > b -->`、
 *   `<p title="a > b">`）时只匹配到首个 `>`，漏出片段 — F13。
 * - DOMParser 是 HTML5 标准解析器，对注释、属性、CDATA、`<script>` /
 *   `<style>` 等 raw-text 元素都正确处理。
 *
 * 与旧实现的语义差异（已在测试中显式记录）：
 * - HTML 实体会被解码（`&amp;` → `&`）：`textContent` 行为如此。
 * - `<script>...</script>` / `<style>...</style>` 的内容不再保留：这两个
 *   元素的内容模型是 raw text，不计入 textContent（这是更安全的行为 —
 *   旧实现会泄露 alert(1) 之类的字符串）。
 * - 元素之间的空白（包括被注释切断的空白）保留。
 */
export function stripHtml(content: string): string {
  if (!content) return '';
  const doc = new DOMParser().parseFromString(content, 'text/html');
  // HTML5 spec: <script> / <style> content is "raw text" — not part of
  // textContent. happy-dom doesn't honor that and leaks the contents; remove
  // the elements explicitly so behavior matches browsers in production.
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  return (doc.body.textContent ?? '').trim();
}

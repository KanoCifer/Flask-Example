// @vitest-environment jsdom
// DOMPurify 依赖浏览器 HTML 解析器丢弃 onerror/<script> 等属性，
// happy-dom 的解析器不会丢弃，因此本文件用 jsdom 验证 sanitize 行为。
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('空输入返回空串', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown('')).toBe('');
  });

  it('GFM 表格 + 单换行转 <br>', () => {
    const html = renderMarkdown('a\nb\n\n| x | y |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<br>');
    expect(html).toContain('<table>');
  });

  it('代码块在解析阶段高亮（hljs language-* class）', () => {
    const html = renderMarkdown('```ts\nconst x: number = 1;\n```');
    // langPrefix: 'hljs language-' → <code class="hljs language-ts">
    expect(html).toContain('class="hljs language-ts"');
    // 高亮后关键字被 span.hljs-keyword 包裹
    expect(html).toContain('<span class="hljs-keyword">const</span>');
  });

  it('未识别语言按 plaintext 处理（无高亮装饰）', () => {
    const html = renderMarkdown('```nosuchlang\nhello world\n```');
    // class 由原 lang 生成；未识别语言不高亮，不产出 hljs-keyword 等装饰
    expect(html).toContain('class="hljs language-nosuchlang"');
    expect(html).not.toContain('hljs-keyword');
  });

  it('行内代码不高亮', () => {
    const html = renderMarkdown('`const x = 1`');
    expect(html).toContain('<code>const x = 1</code>');
    expect(html).not.toContain('hljs-');
  });

  it('sanitize 掉恶意 HTML（行内）', () => {
    const html = renderMarkdown('**bold** <img src=x onerror=alert(1)>');
    expect(html).not.toContain('onerror');
    expect(html).toContain('<strong>bold</strong>');
  });
});

import { describe, it, expect } from 'vitest';
import { stripHtml } from '../stripHtml';

describe('stripHtml', () => {
  it('removes simple HTML tags', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello');
  });

  it('removes nested HTML tags', () => {
    expect(stripHtml('<div><span>a</span><b>b</b></div>')).toBe('ab');
  });

  it('removes self-closing tags', () => {
    expect(stripHtml('hello<br/>world')).toBe('helloworld');
    expect(stripHtml('hello<img src="x"/>world')).toBe('helloworld');
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  <p>hi</p>  ')).toBe('hi');
    expect(stripHtml('\n<p>hi</p>\n')).toBe('hi');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('just plain text')).toBe('just plain text');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns empty string for tag-only input', () => {
    expect(stripHtml('<p></p>')).toBe('');
    expect(stripHtml('<br/>')).toBe('');
  });

  // ── F13: 行为差异（旧正则会漏出的片段，DOMParser 正确剥离） ──

  it('strips HTML comments containing > without leaking fragments', () => {
    // 旧正则: `<!-- a > b -->` → '<!-- a >' 配对，遗留 ' b -->'
    expect(stripHtml('<!-- a > b -->')).toBe('');
    expect(stripHtml('before <!-- x > y --> after')).toBe('before  after');
    expect(stripHtml('<!--<script>-->alert(1)<!--</script>-->')).toBe('alert(1)');
  });

  it('does not leak attribute values containing >', () => {
    expect(stripHtml('<p title="a > b">x</p>')).toBe('x');
  });

  it('removes <script> blocks entirely (content included)', () => {
    // 旧行为保留 alert(1)，新行为按 HTML5 raw-text 模型剥离 — 更安全。
    expect(stripHtml('<script>alert(1)</script>')).toBe('');
    expect(stripHtml('<p>safe</p><script>alert(1)</script><p>ok</p>')).toBe(
      'safeok',
    );
  });

  it('removes <style> blocks entirely (content included)', () => {
    expect(stripHtml('<style>body { color: red }</style>hello')).toBe('hello');
  });

  it('decodes HTML entities (textContent semantics)', () => {
    // 旧行为保留 entity 字面，新行为解码 — 与 textContent 一致。
    expect(stripHtml('a &amp; b')).toBe('a & b');
    expect(stripHtml('&lt;not-a-tag&gt;')).toBe('<not-a-tag>');
    expect(stripHtml('&copy; 2026')).toBe('© 2026');
  });

  it('preserves internal whitespace (no normalization)', () => {
    expect(stripHtml('<p>a</p>  <p>b</p>')).toBe('a  b');
  });

  it('handles malformed / partial HTML gracefully', () => {
    // 未闭合标签：DOMParser 自动闭合。
    expect(stripHtml('<p>open')).toBe('open');
    expect(stripHtml('<div>nested <span>deep')).toBe('nested deep');
  });
});
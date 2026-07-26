import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePreviewDialog } from '@/composables';

describe('usePreviewDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始关闭', () => {
    const { isOpen, url, alt } = usePreviewDialog();
    expect(isOpen.value).toBe(false);
    expect(url.value).toBe('');
    expect(alt.value).toBe('');
  });

  it('open 设置 url 和 alt，并打开', () => {
    const { isOpen, url, alt, open } = usePreviewDialog();
    open('https://example.com/img.png', '示例图');
    expect(isOpen.value).toBe(true);
    expect(url.value).toBe('https://example.com/img.png');
    expect(alt.value).toBe('示例图');
  });

  it('open 空 url 不打开', () => {
    const { isOpen, open } = usePreviewDialog();
    open('', '示例');
    expect(isOpen.value).toBe(false);
  });

  it('close 清空状态并关闭', () => {
    const { isOpen, url, alt, open, close } = usePreviewDialog();
    open('https://example.com/img.png', '示例图');
    close();
    expect(isOpen.value).toBe(false);
    expect(url.value).toBe('');
    expect(alt.value).toBe('');
  });

  it('多次 open 覆盖上一次', () => {
    const { isOpen, url, open } = usePreviewDialog();
    open('https://example.com/a.png', 'A');
    open('https://example.com/b.png', 'B');
    expect(url.value).toBe('https://example.com/b.png');
    expect(isOpen.value).toBe(true);
  });
});

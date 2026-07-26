import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rewriteMediaUrl } from '../useOrigin';

describe('rewriteMediaUrl', () => {
  const API_ORIGIN = window.location.origin;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('空字符串原样返回', () => {
    expect(rewriteMediaUrl('')).toBe('');
  });

  it('相对路径拼上 API_ORIGIN', () => {
    const result = rewriteMediaUrl('/v1/media/abc.png');
    expect(result).toBe(`${API_ORIGIN}/v1/media/abc.png`);
  });

  it('无前导 / 的相对路径也能正确拼接', () => {
    const result = rewriteMediaUrl('media/abc.png');
    expect(result).toBe(`${API_ORIGIN}/media/abc.png`);
  });

  it('已是当前 API 域的 URL 原样返回', () => {
    const url = `${API_ORIGIN}/v1/media/abc.png`;
    expect(rewriteMediaUrl(url)).toBe(url);
  });

  it('其他域名的 URL 替换 origin 但保留 path', () => {
    const result = rewriteMediaUrl('https://old-cdn.com/path/to/img.png?w=100');
    expect(result).toBe(`${API_ORIGIN}/path/to/img.png?w=100`);
  });
});

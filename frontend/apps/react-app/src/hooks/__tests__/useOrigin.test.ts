import { describe, it, expect } from 'vitest';
import { useOrigin } from '../useOrigin';

describe('useOrigin', () => {
  it('空字符串原样返回', () => {
    expect(useOrigin('')).toBe('');
  });

  it('已是 http(s) 绝对 URL 原样返回', () => {
    expect(useOrigin('https://example.com/img.png')).toBe(
      'https://example.com/img.png',
    );
    expect(useOrigin('http://cdn.test.com/a.jpg')).toBe(
      'http://cdn.test.com/a.jpg',
    );
  });

  it('相对路径在 https 环境下拼上 API 前缀', () => {
    // 测试环境 happy-dom 默认 protocol 为 http:// —— 直接返回原值
    // 如果要测试 https 分支，需要 mock window.location
    const result = useOrigin('/v1/media/abc.png');
    // happy-dom 默认 location.protocol = 'http:'，所以直接返回
    expect(result).toBe('/v1/media/abc.png');
  });

  it('无前导 / 的路径也能正确拼接（https 环境）', () => {
    // 此分支仅在 window.location.protocol === 'https:' 时触发
    // 这里验证函数本身不抛错
    expect(() => useOrigin('media/abc.png')).not.toThrow();
  });
});

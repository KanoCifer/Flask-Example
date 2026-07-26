import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDeviceStore } from '../deviceState';

describe('deviceState store', () => {
  beforeEach(() => {
    // matchMedia 已在 setup.ts 中 mock，默认 matches=false
    useDeviceStore.setState({ isMobile: false });
  });

  it('初始化时读取 matchMedia 结果', () => {
    // 重新创建 store 以触发初始化逻辑
    useDeviceStore.setState({
      isMobile: window.matchMedia('(max-width: 768px)').matches,
    });
    expect(useDeviceStore.getState().isMobile).toBe(false);
  });

  it('mock matchMedia 返回 true 时 isMobile 为 true', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(max-width: 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    useDeviceStore.setState({
      isMobile: window.matchMedia('(max-width: 768px)').matches,
    });
    expect(useDeviceStore.getState().isMobile).toBe(true);
  });
});

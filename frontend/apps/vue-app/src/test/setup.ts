/**
 * 全局测试 setup — 在每个测试文件之前运行。
 * 集中 mock 浏览器 API，避免每个测试重复声明。
 */

import { vi } from 'vitest';

declare const global: typeof globalThis;

// --- requestAnimationFrame / cancelAnimationFrame ---
// happy-dom 可能不实现 rAF，手动提供确定性行为
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
  const id = ++rafId;
  rafCallbacks.set(id, cb);
  return id;
});

global.cancelAnimationFrame = vi.fn((id: number): void => {
  rafCallbacks.delete(id);
});

/**
 * 手动推进一帧：取当前所有待执行的 rAF 回调，用给定时间戳调用。
 * 测试里用它替代真实的时间流逝。
 */
export function flushRAF(timestamp = 0): void {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  callbacks.forEach((cb) => cb(timestamp));
}

// --- matchMedia ---
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// --- localStorage ---
// happy-dom 默认不提供 localStorage，用内存模拟
class MockLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
}
if (typeof localStorage === 'undefined') {
  Object.defineProperty(global, 'localStorage', {
    value: new MockLocalStorage(),
    writable: true,
    configurable: true,
  });
}

// --- IntersectionObserver ---
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
global.IntersectionObserver = MockIntersectionObserver;

// --- ResizeObserver ---
class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

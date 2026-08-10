/**
 * usePanelMutex 单测 —— 三面板互斥契约。
 *
 * 覆盖:
 * - openExclusive 后 active.value 正确指向新 key
 * - 开 A 再开 B → A 自动关(互斥自洽)
 * - close(key) 仅在 active 等于该 key 时清零;关闭未打开的 panel 幂等
 * - isOpen 返回 ComputedRef,初始 false / 打开后 true / 关后回到 false
 */
import { describe, it, expect } from 'vitest';
import { usePanelMutex } from '../usePanelMutex';

describe('usePanelMutex', () => {
  it('openExclusive 后 active 指向新 key', () => {
    const mutex = usePanelMutex();
    expect(mutex.active.value).toBeNull();

    mutex.openExclusive('detail');
    expect(mutex.active.value).toBe('detail');
  });

  it('开 A 再开 B → A 自动关(互斥自洽)', () => {
    const mutex = usePanelMutex();
    mutex.openExclusive('detail');
    mutex.openExclusive('form');

    expect(mutex.active.value).toBe('form');
    expect(mutex.isOpen('detail').value).toBe(false);
    expect(mutex.isOpen('form').value).toBe(true);
  });

  it('close(key) 仅当 active 等于该 key 时清零,关闭未打开 panel 幂等', () => {
    const mutex = usePanelMutex();
    mutex.openExclusive('detail');

    // 关闭未打开的 panel —— 应幂等,不影响 active
    mutex.close('form');
    expect(mutex.active.value).toBe('detail');

    // 关闭当前激活的 panel —— 应清零
    mutex.close('detail');
    expect(mutex.active.value).toBeNull();

    // 重复关闭已关闭的 panel —— 仍然幂等
    mutex.close('detail');
    expect(mutex.active.value).toBeNull();
  });

  it('isOpen 跟随 active 变化', () => {
    const mutex = usePanelMutex();
    const detailOpen = mutex.isOpen('detail');
    const formOpen = mutex.isOpen('form');
    const analysisOpen = mutex.isOpen('analysis');

    expect(detailOpen.value).toBe(false);
    expect(formOpen.value).toBe(false);
    expect(analysisOpen.value).toBe(false);

    mutex.openExclusive('detail');
    expect(detailOpen.value).toBe(true);
    expect(formOpen.value).toBe(false);

    mutex.openExclusive('analysis');
    expect(detailOpen.value).toBe(false);
    expect(analysisOpen.value).toBe(true);

    mutex.close('analysis');
    expect(analysisOpen.value).toBe(false);
  });
});

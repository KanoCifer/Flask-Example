import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSequencedTask } from '../useSequencedTask';

/** 简易 sleep，让出微任务队列 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('useSequencedTask', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('begin() 每次返回递增序号', () => {
    const seq = useSequencedTask();
    const a = seq.begin();
    const b = seq.begin();
    expect(b).toBeGreaterThan(a);
  });

  it('isActive() 只对当前序号返回 true', () => {
    const seq = useSequencedTask();
    const first = seq.begin();
    seq.begin();
    expect(seq.isActive(first)).toBe(false);
    expect(seq.isActive(2)).toBe(true);
  });

  it('run() 正常返回结果', async () => {
    const seq = useSequencedTask();
    const r = await seq.run(async () => 42);
    expect(r.outdated).toBe(false);
    expect(r.result).toBe(42);
  });

  it('run() 旧的调用标记为 outdated', async () => {
    const seq = useSequencedTask();

    const slow = seq.run(() => delay(30).then(() => 'slow'));
    const fast = seq.run(() => delay(10).then(() => 'fast'));

    const [resSlow, resFast] = await Promise.all([slow, fast]);

    expect(resFast.outdated).toBe(false);
    expect(resFast.result).toBe('fast');
    expect(resSlow.outdated).toBe(true);
  });

  it('run() 多个并发调用：最后发起的（index 最大）胜出', async () => {
    const seq = useSequencedTask();
    // 先发 slow 后发 fast —— 但「最新调用胜出」只看 begin 顺序
    const delays = [50, 20, 40];

    const results = await Promise.all(
      delays.map((d, i) => seq.run(() => delay(d).then(() => i))),
    );

    // i=2 最后 begin，所以胜出（无论它何时 resolve）
    const winner = results.find((r) => !r.outdated);
    expect(winner).toBeDefined();
    expect(winner!.result).toBe(2);
    expect(results.filter((r) => r.outdated)).toHaveLength(2);
  });

  it('run() fn 抛错时如果已过期返回 outdated，否则抛出', async () => {
    const seq = useSequencedTask();

    // 先启动一个慢任务
    const slow = seq.run(() =>
      delay(30).then(() => {
        throw new Error('boom');
      }),
    );

    // 同时启动一个快任务抢占
    await seq.run(() => delay(5).then(() => 'done'));

    // 慢任务已过期，返回 outdated
    const res = await slow;
    expect(res.outdated).toBe(true);
  });

  it('run() fn 抛错且仍活跃时抛出错误', async () => {
    const seq = useSequencedTask();
    await expect(
      seq.run(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
  });
});

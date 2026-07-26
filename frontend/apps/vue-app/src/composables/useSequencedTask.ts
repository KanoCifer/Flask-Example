/**
 * 「最新调用胜出」的异步竞态守卫。
 *
 * 职责：串行化多次 async 调用，只让最后一次发起的调用的结果落地，
 * 旧调用的 resolve/reject 被静默吞掉（不回写状态、不抛错）。
 *
 * 抽出原因：useFishingRoute 和 fishingMap store 各自手抄了一份
 * `++seq / 比较 / 吞旧` 的不变量；拷贝分散，竞态 bug 没有局部性。
 * 集中到一处，一个接口测竞态。
 *
 * 用法：
 *   const seq = useSequencedTask();
 *   async function plan() {
 *     const mine = seq.begin();
 *     const res = await doWork();
 *     if (seq.isActive(mine)) commitState(res);
 *   }
 *   // 或用 run 包裹，自动吞旧（不回写、不 reject）：
 *   const r = await seq.run(() => doWork());
 *   if (r.outdated) return;       // 已被更新的调用抢占
 *   useResult(r.result);
 */
export interface SequencedResult<T> {
  /** 是否已被更新的调用抢占（true → 结果应丢弃） */
  outdated: boolean;
  /** 调用的返回值（outdated 为 true 时仍可能有值，调用方应自行判断） */
  result?: T;
}

export function useSequencedTask() {
  let seq = 0;

  /** 领取本次调用的序号；返回的 token 用于后续 isActive 判断 */
  function begin(): number {
    return ++seq;
  }

  /** 当前活跃序号是否仍为 token */
  function isActive(token: number): boolean {
    return token === seq;
  }

  /**
   * 包裹一次异步工作：执行 fn，若期间有更新的调用发生则返回 { outdated: true }，
   * 不抛错、不回写。fn 抛出的错误会原样抛给调用方（由其决定如何提示）。
   */
  async function run<T>(fn: () => Promise<T>): Promise<SequencedResult<T>> {
    const mine = begin();
    try {
      const result = await fn();
      if (!isActive(mine)) return { outdated: true };
      return { outdated: false, result };
    } catch (err) {
      if (!isActive(mine)) return { outdated: true };
      throw err;
    }
  }

  return { begin, isActive, run };
}

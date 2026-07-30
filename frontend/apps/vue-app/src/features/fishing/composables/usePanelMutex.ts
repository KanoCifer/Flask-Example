/**
 * usePanelMutex —— 钓鱼仪表盘三面板互斥的命名 seam。
 *
 * 职责:
 * - 维护「同一时刻只能开一个面板」的契约(详情 / 表单 / AI 分析)
 * - 把原本散在 useFishingDashboard 三个 handler 里的 setter 序集中到一处
 * - 通过单一 active 真源让测试从「断言三个 ref」降到「断言一个 ref」
 *
 * 为什么独立:
 * - 互斥契约此前只活在注释里,新增第 4 个面板(笔记?)时要再写第 4 段 setter 序
 * - 抽出后,新增面板 = 在 PanelKey 加字符串字面量 + 模板多挂一个 :open
 * - 与 useFishingMapStore / useNotificationStore 零耦合,纯本地 ref 状态
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';

/** 互斥面板 key —— 新面板在此追加,不要在调用点硬编码字符串 */
export type PanelKey = 'detail' | 'form' | 'analysis';

export interface UsePanelMutexReturn {
  /** 当前激活的 panel key —— 单真源 */
  active: Ref<PanelKey | null>;
  /** 打开指定 panel,自动关闭其它 panel(互斥自洽) */
  openExclusive: (key: PanelKey) => void;
  /**
   * 关闭指定 panel —— 仅当 active 等于该 key 时清零,其它情况幂等。
   * 这样关闭一个未打开的 panel 不会误清当前激活态。
   */
  close: (key: PanelKey) => void;
  /** 给模板用的派生 ComputedRef,直传 :open 即可 */
  isOpen: (key: PanelKey) => ComputedRef<boolean>;
}

export function usePanelMutex(): UsePanelMutexReturn {
  const active = ref<PanelKey | null>(null);

  function openExclusive(key: PanelKey): void {
    active.value = key;
  }

  function close(key: PanelKey): void {
    if (active.value === key) {
      active.value = null;
    }
  }

  function isOpen(key: PanelKey): ComputedRef<boolean> {
    return computed(() => active.value === key);
  }

  return { active, openExclusive, close, isOpen };
}
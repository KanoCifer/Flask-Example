import { v4 } from 'uuid';

// ── 匿名用户 ID ─────────────────────────────────────────────────────────────
//
// 匿名访问 learning 等 owner-keyed 端点时由前端 localStorage 自管 UUID，
// 后端 `/v2/learning/_resolve_learning_owner` 把 `X-Anon-Id` 头映射成
// `anon:<uuid>` 形式的 owner key，保证登录合并（`merge_progress`）能稳定收敛。
//
// 行为对齐 `visitorId.ts`：localStorage 不可用时（Safari 隐私模式 / 配额
// 超限 / SSR）回退到内存桶，保持会话内一致。

const ANON_ID_KEY = 'anon_id';

let memoryFallbackId: string | null = null;

const setAnonId = (id: string): void => {
  try {
    localStorage.setItem(ANON_ID_KEY, id);
  } catch {
    memoryFallbackId = id;
  }
};

const getStoredAnonId = (): string | null => {
  try {
    return localStorage.getItem(ANON_ID_KEY);
  } catch {
    return memoryFallbackId;
  }
};

/** 读取或创建匿名 ID — 永不抛异常。 */
export function getAnonId(): string {
  let id = getStoredAnonId();
  if (id) return id;
  id = v4();
  setAnonId(id);
  return id;
}

// Moment 提交流 —— 协调「编辑 / 新建 → 落库 → 刷列表 → 落 detail」四件事。
// 纯模块，不依赖 Vue / Pinia，可独立单测。
import type {
  Moment,
  MomentCreatePayload,
  MomentUpdatePayload,
} from '@readinglist/types';

/**
 * Composer 对外的窄依赖口（5 个动作 + 2 个通知）。
 * 由调用方实现并注入，便于 mock 与跨视图复用。
 */
export interface MomentComposerPort {
  create(payload: MomentCreatePayload): Promise<Moment>;
  update(id: string, payload: MomentUpdatePayload): Promise<Moment>;
  refreshPublicList(tag: string | null): Promise<void>;
  /** 新建成功后切换到详情 modal。 */
  openDetail(id: string): void;
  notify(message: string): void;
  notifyError(message: string): void;
}

/** 编辑 / 新建分支输入。 */
export type MomentSubmitInput =
  | {
      kind: 'create';
      payload: MomentUpdatePayload;
      /** 当前活跃 tag，刷新列表时透传，null = 全部。 */
      activeTag: string | null;
    }
  | {
      kind: 'update';
      id: string;
      payload: MomentUpdatePayload;
    };

/** 提交结果：新建会携带新 id 用于 detail handoff；编辑只关心成功与否。 */
export type MomentSubmitResult =
  | { kind: 'created'; id: string }
  | { kind: 'updated' }
  | { kind: 'failed'; error: string };

/**
 * 把编辑器的 `MomentUpdatePayload`（所有字段可选）组装成
 * `MomentCreatePayload`（必填字段带默认值）。
 * 暴露为纯函数以便单独单测。
 */
export function buildCreatePayload(
  payload: MomentUpdatePayload,
): MomentCreatePayload {
  return {
    content: payload.content ?? '',
    summary: payload.summary ?? null,
    visibility: payload.visibility ?? 'public',
    status: payload.status ?? 'published',
    mood: payload.mood ?? null,
    tags: payload.tags ?? [],
    attachments: payload.attachments,
    location: payload.location,
    source: payload.source,
    is_pinned: payload.is_pinned ?? false,
    allow_comment: payload.allow_comment ?? true,
    published_at: payload.published_at ?? null,
  };
}

/**
 * MomentComposer —— 提交流编排器。
 *
 * 关键约束：
 * 1. 错误一律经 `port.notifyError` 抛出，再以 `{ kind: 'failed' }` 返回；
 *    调用方不应再 `try/catch` 同一份错误。
 * 2. 刷新列表在成功 toast 之前 —— 若刷新失败，列表应仍保留旧数据，
 *    不向用户撒谎说"发布成功"。
 * 3. 编辑分支不刷新列表（编辑是局部行为），仅落库 + 通知。
 */
export class MomentComposer {
  private readonly port: MomentComposerPort;
  constructor(port: MomentComposerPort) {
    this.port = port;
  }

  async submit(input: MomentSubmitInput): Promise<MomentSubmitResult> {
    try {
      if (input.kind === 'create') {
        const payload = buildCreatePayload(input.payload);
        const created = await this.port.create(payload);
        await this.port.refreshPublicList(input.activeTag);
        this.port.notify('发布成功');
        this.port.openDetail(created.id);
        return { kind: 'created', id: created.id };
      }
      await this.port.update(input.id, input.payload);
      this.port.notify('已保存修改');
      return { kind: 'updated' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存失败';
      this.port.notifyError(message);
      return { kind: 'failed', error: message };
    }
  }
}

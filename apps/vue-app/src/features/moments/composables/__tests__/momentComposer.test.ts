import { describe, it, expect, vi } from 'vitest';
import {
  MomentComposer,
  buildCreatePayload,
  type MomentComposerPort,
} from '../momentComposer';
import type {
  Moment,
  MomentCreatePayload,
  MomentUpdatePayload,
} from '@/features/moments/types';

// ── 测试夹具 ─────────────────────────────────────────────────────────────

function makeMoment(overrides: Partial<Moment> = {}): Moment {
  return {
    id: 'm-1',
    user_id: 1,
    content: 'hello',
    visibility: 'public',
    status: 'published',
    mood: null,
    tags: [],
    attachments: [],
    is_pinned: false,
    allow_comment: true,
    like_count: 0,
    comment_count: 0,
    view_count: 0,
    published_at: null,
    created_at: '2026-07-19T00:00:00Z',
    updated_at: '2026-07-19T00:00:00Z',
    ...overrides,
  };
}

/** 构造一个最小 port mock，所有方法默认 spy。 */
function makePort(overrides: Partial<MomentComposerPort> = {}) {
  const port: MomentComposerPort = {
    create: vi.fn(async () => makeMoment({ id: 'created-id' })),
    update: vi.fn(async (_id: string) => makeMoment({ id: 'm-1' })),
    refreshPublicList: vi.fn(async () => undefined),
    openDetail: vi.fn(),
    notify: vi.fn(),
    notifyError: vi.fn(),
    ...overrides,
  };
  return port;
}

// ── buildCreatePayload ───────────────────────────────────────────────────

describe('buildCreatePayload', () => {
  it('content 缺省回退为空串', () => {
    expect(buildCreatePayload({}).content).toBe('');
  });

  it('所有可空字段默认 null / 安全值', () => {
    const payload = buildCreatePayload({});
    expect(payload).toEqual({
      content: '',
      summary: null,
      visibility: 'public',
      status: 'published',
      mood: null,
      tags: [],
      attachments: undefined,
      location: undefined,
      source: undefined,
      is_pinned: false,
      allow_comment: true,
      published_at: null,
    });
  });

  it('显式字段透传', () => {
    const payload = buildCreatePayload({
      content: '  body  ',
      mood: '🌿',
      tags: ['a', 'b'],
      visibility: 'private',
      status: 'draft',
      is_pinned: true,
      allow_comment: false,
    });
    expect(payload.content).toBe('  body  '); // 不在这里 trim —— modal 已处理
    expect(payload.mood).toBe('🌿');
    expect(payload.tags).toEqual(['a', 'b']);
    expect(payload.visibility).toBe('private');
    expect(payload.status).toBe('draft');
    expect(payload.is_pinned).toBe(true);
    expect(payload.allow_comment).toBe(false);
  });

  it('透传 attachments / location / source（编辑器不展示，modal 需另行保留）', () => {
    const payload = buildCreatePayload({
      attachments: [{ type: 'image', url: 'https://x' }],
      location: { name: 'Tokyo' },
      source: 'web',
      published_at: '2026-07-19T12:00:00Z',
      summary: 'TLDR',
    });
    expect(payload.attachments).toEqual([{ type: 'image', url: 'https://x' }]);
    expect(payload.location).toEqual({ name: 'Tokyo' });
    expect(payload.source).toBe('web');
    expect(payload.published_at).toBe('2026-07-19T12:00:00Z');
    expect(payload.summary).toBe('TLDR');
  });
});

// ── MomentComposer — 新建分支 ────────────────────────────────────────────

describe('MomentComposer.submit — create branch', () => {
  it('normalize → create → refresh → notify → openDetail，顺序固定', async () => {
    const order: string[] = [];
    const port = makePort({
      create: vi.fn(async () => {
        order.push('create');
        return makeMoment({ id: 'new-id' });
      }),
      refreshPublicList: vi.fn(async () => {
        order.push('refresh');
      }),
      notify: vi.fn((msg: string) => {
        order.push(`notify:${msg}`);
      }),
      openDetail: vi.fn((id: string) => {
        order.push(`open:${id}`);
      }),
    });
    const composer = new MomentComposer(port);

    const result = await composer.submit({
      kind: 'create',
      payload: { content: 'hi' },
      activeTag: 'meadow',
    });

    expect(order).toEqual([
      'create',
      'refresh',
      'notify:发布成功',
      'open:new-id',
    ]);
    expect(result).toEqual({ kind: 'created', id: 'new-id' });
  });

  it('refresh 失败时仍走 notifyError，不假装成功', async () => {
    const port = makePort({
      create: vi.fn(async () => makeMoment({ id: 'new-id' })),
      refreshPublicList: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    const composer = new MomentComposer(port);

    const result = await composer.submit({
      kind: 'create',
      payload: { content: 'hi' },
      activeTag: null,
    });

    expect(port.notify).not.toHaveBeenCalled();
    expect(port.openDetail).not.toHaveBeenCalled();
    expect(port.notifyError).toHaveBeenCalledWith('network down');
    expect(result).toEqual({ kind: 'failed', error: 'network down' });
  });

  it('create 抛错时，refresh / openDetail / success 均被跳过', async () => {
    const port = makePort({
      create: vi.fn(async () => {
        throw new Error('403 forbidden');
      }),
    });
    const composer = new MomentComposer(port);

    const result = await composer.submit({
      kind: 'create',
      payload: { content: 'hi' },
      activeTag: null,
    });

    expect(port.refreshPublicList).not.toHaveBeenCalled();
    expect(port.notify).not.toHaveBeenCalled();
    expect(port.openDetail).not.toHaveBeenCalled();
    expect(port.notifyError).toHaveBeenCalledWith('403 forbidden');
    expect(result).toEqual({ kind: 'failed', error: '403 forbidden' });
  });

  it('normalize 默认值传到 port.create', async () => {
    const port = makePort();
    const composer = new MomentComposer(port);

    await composer.submit({
      kind: 'create',
      payload: {}, // 全部缺失 → 默认值
      activeTag: null,
    });

    expect(port.create).toHaveBeenCalledWith({
      content: '',
      summary: null,
      visibility: 'public',
      status: 'published',
      mood: null,
      tags: [],
      attachments: undefined,
      location: undefined,
      source: undefined,
      is_pinned: false,
      allow_comment: true,
      published_at: null,
    } satisfies MomentCreatePayload);
  });

  it('activeTag 透传到 refreshPublicList', async () => {
    const port = makePort();
    const composer = new MomentComposer(port);

    await composer.submit({
      kind: 'create',
      payload: { content: 'x' },
      activeTag: 'meadow',
    });

    expect(port.refreshPublicList).toHaveBeenCalledWith('meadow');
  });

  it('非 Error 异常走通用兜底文案', async () => {
    const port = makePort({
      create: vi.fn(async () => {
        throw 'plain string';
      }),
    });
    const composer = new MomentComposer(port);

    const result = await composer.submit({
      kind: 'create',
      payload: { content: 'x' },
      activeTag: null,
    });

    expect(port.notifyError).toHaveBeenCalledWith('保存失败');
    expect(result).toEqual({ kind: 'failed', error: '保存失败' });
  });
});

// ── MomentComposer — 编辑分支 ────────────────────────────────────────────

describe('MomentComposer.submit — update branch', () => {
  it('update → notify，不刷新列表、不 openDetail', async () => {
    const port = makePort({
      update: vi.fn(async (id: string) => makeMoment({ id })),
    });
    const composer = new MomentComposer(port);

    const result = await composer.submit({
      kind: 'update',
      id: 'm-42',
      payload: { content: 'edit' },
    });

    expect(port.update).toHaveBeenCalledWith('m-42', { content: 'edit' });
    expect(port.refreshPublicList).not.toHaveBeenCalled();
    expect(port.openDetail).not.toHaveBeenCalled();
    expect(port.notify).toHaveBeenCalledWith('已保存修改');
    expect(result).toEqual({ kind: 'updated' });
  });

  it('update 抛错走 notifyError', async () => {
    const port = makePort({
      update: vi.fn(async () => {
        throw new Error('500 server');
      }),
    });
    const composer = new MomentComposer(port);

    const result = await composer.submit({
      kind: 'update',
      id: 'm-42',
      payload: { content: 'edit' },
    });

    expect(port.notifyError).toHaveBeenCalledWith('500 server');
    expect(result).toEqual({ kind: 'failed', error: '500 server' });
  });

  it('编辑分支不做 normalize —— payload 原样透传', async () => {
    const port = makePort();
    const composer = new MomentComposer(port);

    const partial: MomentUpdatePayload = { mood: '🌙' }; // 其它字段都缺
    await composer.submit({
      kind: 'update',
      id: 'm-1',
      payload: partial,
    });

    expect(port.update).toHaveBeenCalledWith('m-1', partial);
  });
});

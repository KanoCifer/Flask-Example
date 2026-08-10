/**
 * useSpotEditor 单测 —— 双模式 seam 的纯函数逻辑。
 *
 * 覆盖范围(7 条断言):
 * - A: create 模式默认 draft 全空 + canSubmit=false + isDirty=false
 * - B: edit 模式 + initial → draft 字段从 SpotDetail 派生 + pictures 长度对得上
 * - C: create 模式下 kind 选择前后 canSubmit 的翻转(配合 kindTouched 仅作标记)
 * - D: pictures 上限 9:达到 canAddMore=false,移除后 canAddMore=true
 * - E: buildPayload() 在两种模式下的 schema(create 含 location/description/tags/rating/kind/images;edit 不含 location 不含 id)
 * - F: removePicture 后 pictures 缩短且不含被移除项
 * - G: edit 模式下 draft 变更后 isDirty=true,resetFrom 后 isDirty=false
 *
 * 不覆盖:
 * - handleFile / retryUpload 的真实 upload 上传链 —— plan 标注为后续覆盖,本次只测纯函数逻辑
 *   (draft / pictures / canSubmit / canAddMore / isDirty / buildPayload)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';

// 拦截 useUpload,避免真实网络请求;只暴露固定 shape,测试聚焦 seam 纯逻辑。
vi.mock('@/features/upload/composables', () => {
  const isUploading = ref(false);
  const progress = ref(0);
  const upload = vi.fn(async (file: File) => `mock://${file.name}`);
  return {
    useUpload: () => ({ upload, isUploading, progress }),
  };
});

import { useSpotEditor } from '../useSpotEditor';
import type { SpotDetail, SpotPicture } from '@readinglist/types';

const baseSpot: SpotDetail = {
  id: 'spot-1',
  name: '千岛湖',
  description: '湖钓好去处',
  kind: 'lake',
  tags: ['自然', '大水面'],
  rating: 4,
  images: ['https://x.com/a.jpg', 'https://x.com/b.jpg'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
};

describe('useSpotEditor', () => {
  beforeEach(() => {
    // 重置 mock 计数,避免跨测试串扰
    vi.clearAllMocks();
  });

  it('A · create 模式默认 draft 全空 + canSubmit=false + isDirty=false', () => {
    const editor = useSpotEditor({ mode: 'create' });

    expect(editor.draft.value).toEqual({
      name: '',
      description: '',
      tags: '',
      rating: 0,
      kind: null,
      coordinate: null,
    });
    expect(editor.canSubmit.value).toBe(false);
    expect(editor.isDirty.value).toBe(false);
    expect(editor.pictures.value).toEqual([]);
    expect(editor.isEditing.value).toBe(false);
  });

  it('B · edit 模式从 initial 派生 draft 与 pictures', () => {
    const editor = useSpotEditor({ mode: 'edit', initial: baseSpot });

    expect(editor.draft.value.name).toBe('千岛湖');
    expect(editor.draft.value.description).toBe('湖钓好去处');
    expect(editor.draft.value.tags).toBe('自然, 大水面');
    expect(editor.draft.value.rating).toBe(4);
    expect(editor.draft.value.kind).toBe('lake');
    expect(editor.draft.value.coordinate).toBeNull();
    expect(editor.pictures.value).toHaveLength(2);
    expect(editor.pictures.value[0]?.url).toBe('https://x.com/a.jpg');
    expect(editor.isEditing.value).toBe(false);
  });

  it('C · create 模式下 kind 选择翻转 canSubmit', () => {
    const editor = useSpotEditor({
      mode: 'create',
      initialLocation: [120.1, 30.2],
    });
    editor.draft.value.name = '新钓点';

    // kind=null → canSubmit=false
    expect(editor.draft.value.kind).toBeNull();
    expect(editor.canSubmit.value).toBe(false);

    // 选中 kind → canSubmit=true(coordinate 已由 initialLocation 注入)
    editor.draft.value.kind = 'river';
    expect(editor.canSubmit.value).toBe(true);

    // 把 coordinate 清掉 → canSubmit 重新变 false
    editor.draft.value.coordinate = null;
    expect(editor.canSubmit.value).toBe(false);
  });

  it('D · pictures 推入 9 张后 canAddMore=false,移除一张后 canAddMore=true', () => {
    const editor = useSpotEditor({ mode: 'edit', initial: baseSpot });
    expect(editor.canAddMore.value).toBe(true);

    // 直接塞 9 张 picture(view-model 字段齐备)
    const nine: SpotPicture[] = Array.from({ length: 9 }, (_, i) => ({
      id: `p-${i}`,
      uploadedAt: '',
      url: `https://x.com/${i}.jpg`,
      description: '',
    }));
    editor.pictures.value = nine;
    expect(editor.canAddMore.value).toBe(false);

    // 移除一张 → canAddMore=true
    const removed = nine[0]!;
    editor.removePicture(removed);
    expect(editor.canAddMore.value).toBe(true);
    expect(editor.pictures.value).toHaveLength(8);
    expect(
      editor.pictures.value.find((p) => p.id === removed.id),
    ).toBeUndefined();
  });

  it('E · buildPayload() 在两种模式下 schema 正确', () => {
    // create 模式
    const createEditor = useSpotEditor({ mode: 'create' });
    createEditor.draft.value.name = '新钓点';
    createEditor.draft.value.description = '测试';
    createEditor.draft.value.tags = '自然, 试钓';
    createEditor.draft.value.rating = 5;
    createEditor.draft.value.kind = 'lake';
    createEditor.draft.value.coordinate = [120.1, 30.2];
    createEditor.pictures.value = [
      { id: 'p1', uploadedAt: '', url: 'https://x.com/1.jpg', description: '' },
    ];

    const createPayload = createEditor.buildPayload();
    expect(createPayload).toMatchObject({
      name: '新钓点',
      description: '测试',
      tags: ['自然', '试钓'],
      rating: 5,
      kind: 'lake',
      location: [120.1, 30.2],
      images: ['https://x.com/1.jpg'],
    });
    // 不应有 id 字段(由后端生成)
    expect('id' in (createPayload as Record<string, unknown>)).toBe(false);

    // edit 模式
    const editEditor = useSpotEditor({ mode: 'edit', initial: baseSpot });
    editEditor.startEdit();
    editEditor.draft.value.name = '千岛湖(改名)';
    editEditor.draft.value.tags = '自然, 大水面, 交通便利';
    editEditor.pictures.value = [
      ...editEditor.pictures.value,
      {
        id: 'new',
        uploadedAt: '',
        url: 'https://x.com/c.jpg',
        description: '',
      },
    ];

    const editPayload = editEditor.buildPayload();
    expect(editPayload).toMatchObject({
      name: '千岛湖(改名)',
      description: '湖钓好去处',
      tags: ['自然', '大水面', '交通便利'],
      rating: 4,
      kind: 'lake',
      images: [
        'https://x.com/a.jpg',
        'https://x.com/b.jpg',
        'https://x.com/c.jpg',
      ],
    });
    // edit payload 不应有 location(由其它 seam 维持)与 id
    expect('location' in (editPayload as Record<string, unknown>)).toBe(false);
    expect('id' in (editPayload as Record<string, unknown>)).toBe(false);
  });

  it('F · removePicture 后 pictures 缩短,被移除项不存在', () => {
    const editor = useSpotEditor({ mode: 'edit', initial: baseSpot });
    expect(editor.pictures.value).toHaveLength(2);

    const target = editor.pictures.value[0]!;
    editor.removePicture(target);

    expect(editor.pictures.value).toHaveLength(1);
    expect(
      editor.pictures.value.find((p) => p.id === target.id),
    ).toBeUndefined();
    // 保留的另一张 url 正确
    expect(editor.pictures.value[0]?.url).toBe('https://x.com/b.jpg');
  });

  it('G · edit 模式下 draft 变更后 isDirty=true,resetFrom 后 isDirty=false', () => {
    const editor = useSpotEditor({ mode: 'edit', initial: baseSpot });
    expect(editor.isDirty.value).toBe(false);

    // 改 name
    editor.draft.value.name = '改名后';
    expect(editor.isDirty.value).toBe(true);

    // 改回 initial.name → isDirty 重新回 false
    editor.draft.value.name = baseSpot.name;
    expect(editor.isDirty.value).toBe(false);

    // 改 rating
    editor.draft.value.rating = 5;
    expect(editor.isDirty.value).toBe(true);

    // 外部刷新:resetFrom 传入更新后的 initial → isDirty 回 false
    editor.resetFrom({ ...baseSpot, rating: 5 });
    expect(editor.isDirty.value).toBe(false);
  });
});

// 让 @vue/runtime-core 引用生效(避免 TS 抱怨 nextTick 未使用类型仅命名空间级别)
void nextTick;

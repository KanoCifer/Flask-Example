/**
 * PicDetailModal 单测 —— 照片墙管理员编辑能力。
 *
 * 覆盖:
 * - editable=true 时渲染「编辑」按钮
 * - 点击「编辑」→ 展示描述 textarea + datetime-local + EXIF 输入组
 * - 点击「保存」→ emit `update` 携带 { description, uploadedAt, exif }
 * - editable=false 时不渲染「编辑 / 保存」按钮
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { GalleryImage } from '@readinglist/api';
import PicDetailModal from '../PicDetailModal.vue';

function makeImage(overrides: Partial<GalleryImage> = {}): GalleryImage {
  return {
    id: 'img-1',
    url: 'https://example.com/1.jpg',
    description: '测试描述',
    uploadedAt: '2024-06-01T12:30:00+00:00',
    exif: { camera: 'Sony', iso: 100 },
    ...overrides,
  };
}

function mountModal(image: GalleryImage, editable: boolean) {
  return mount(PicDetailModal, {
    props: {
      image,
      editable,
      formattedDate: '2024年06月01日 12:30',
    },
    global: {
      stubs: {
        // Teleport 内容内联渲染，便于断言 footer 结构
        Teleport: { template: '<div><slot /></div>' },
        // motion.img 动画组件无需真实渲染
        motion: { template: '<img />' },
      },
    },
  });
}

describe('PicDetailModal', () => {
  beforeEach(() => {
    // 无全局 mock 需要清理；保留钩子与项目约定一致
  });

  it('editable=true 时渲染「编辑」按钮', () => {
    const wrapper = mountModal(makeImage(), true);
    expect(wrapper.find('button[aria-label="编辑图片信息"]').exists()).toBe(
      true,
    );
  });

  it('点击「编辑」后展示描述 + 上传时间 + EXIF 输入组', async () => {
    const wrapper = mountModal(makeImage(), true);
    await wrapper.find('button[aria-label="编辑图片信息"]').trigger('click');
    await nextTick();

    expect(wrapper.find('textarea[aria-label="编辑拍摄笔记"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(true);
    // EXIF 只渲染当前已有的键（camera / iso）
    expect(wrapper.find('input[aria-label="相机"]').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="ISO"]').exists()).toBe(true);
    // 不存在的键不渲染
    expect(wrapper.find('input[aria-label="镜头"]').exists()).toBe(false);
    // GPS 两个 number input 常驻
    expect(wrapper.find('input[aria-label="纬度"]').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="经度"]').exists()).toBe(true);
  });

  it('点击「保存」emit update 携带 { description, uploadedAt, exif }', async () => {
    const wrapper = mountModal(makeImage(), true);
    await wrapper.find('button[aria-label="编辑图片信息"]').trigger('click');
    await nextTick();

    await wrapper
      .find('textarea[aria-label="编辑拍摄笔记"]')
      .setValue('新的描述');
    await wrapper
      .find('button[aria-label="保存对图片信息的修改"]')
      .trigger('click');

    const updateEvents = wrapper.emitted('update');
    expect(updateEvents).toHaveLength(1);
    const [id, partial] = updateEvents![0] as [
      string,
      {
        description: string;
        uploadedAt: string | null;
        exif: Record<string, string> | null;
      },
    ];
    expect(id).toBe('img-1');
    expect(partial.description).toBe('新的描述');
    expect(partial.uploadedAt).toBeTruthy();
    expect(new Date(partial.uploadedAt!).toString()).not.toBe('Invalid Date');
    expect(partial.exif).toMatchObject({ camera: 'Sony', iso: '100' });
  });

  it('editable=false 时不渲染「编辑」「保存」按钮', () => {
    const wrapper = mountModal(makeImage(), false);
    expect(wrapper.find('button[aria-label="编辑图片信息"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('button[aria-label="保存对图片信息的修改"]').exists(),
    ).toBe(false);
  });

  it('切换 image 时表单状态重置', async () => {
    const wrapper = mountModal(makeImage(), true);
    await wrapper.find('button[aria-label="编辑图片信息"]').trigger('click');
    await nextTick();
    await wrapper
      .find('textarea[aria-label="编辑拍摄笔记"]')
      .setValue('临时输入');

    await wrapper.setProps({
      image: makeImage({ id: 'img-2', description: '第二张' }),
    });
    await nextTick();

    const textarea = wrapper.find<HTMLTextAreaElement>(
      'textarea[aria-label="编辑拍摄笔记"]',
    );
    // 编辑态已退出，textarea 不再渲染；只读展示第二张的描述
    expect(textarea.exists()).toBe(false);
    expect(wrapper.text()).toContain('第二张');
  });
});

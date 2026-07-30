/**
 * FishingSidebar 单测 —— 任务 284 后的事件契约。
 *
 * 覆盖:
 * - chip 切换(全部 / kind chip)→ 触发 changeFilter,传 Set | null(空集)
 * - 列表项点击 → 触发 select,传 MapMarker
 * - 「添加钓点」按钮 → 触发 addSpot
 * - 「定位」按钮 → 触发 locate
 * - 切换到具体 kind → 列表 visibleSpots 按 kind 过滤(派生数据)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { MapMarker } from '@readinglist/types';
import FishingSidebar from '../FishingSidebar.vue';

function makeMarker(
  id: string,
  position: [number, number],
  kind: MapMarker['kind'],
  name: string,
): MapMarker {
  return {
    position,
    kind,
    extraData: {
      id,
      name,
      description: 'desc',
      kind: kind ?? 'lake',
      tags: [],
      rating: 0,
      images: [],
      created_at: '2026-07-30T00:00:00Z',
      updated_at: '2026-07-30T00:00:00Z',
    },
  };
}

const spots: MapMarker[] = [
  makeMarker('1', [113.4, 23.0], 'lake', '东湖'),
  makeMarker('2', [113.5, 23.1], 'river', '长江'),
  makeMarker('3', [113.6, 23.2], 'reservoir', '三峡水库'),
  makeMarker('4', [113.7, 23.3], 'lake', '千岛湖'),
];

describe('FishingSidebar', () => {
  beforeEach(() => {
    /* 每个用例独立 mount,无需 reset */
  });

  it('渲染时默认全部可见,「全部」chip 处于 pressed 态', () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    const allChip = wrapper.find('[aria-pressed="true"]');
    // 默认 selectedKinds 为空集 → 全部 chip 应当 pressed
    expect(allChip.exists()).toBe(true);
    expect(allChip.text()).toBe('全部');
    // 4 个 spot 全部渲染为 listbox option
    const options = wrapper.findAll('[role="option"]');
    expect(options).toHaveLength(4);
  });

  it('点击 kind chip → 触发 changeFilter,传 Set 含该 kind', async () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    // 找到「湖泊」chip(对应 kind=lake)
    // chip 文本含 count 数字「湖泊 2」,用 includes 匹配更稳
    const chips = wrapper.findAll('button.rounded-full');
    const lakeChip = chips.find((c) => c.text().includes('湖泊'));
    expect(lakeChip).toBeDefined();
    await lakeChip!.trigger('click');

    const events = wrapper.emitted('changeFilter');
    expect(events).toBeTruthy();
    const lastSet = events![events!.length - 1][0] as Set<string>;
    expect(lastSet).toBeInstanceOf(Set);
    expect(lastSet.has('lake')).toBe(true);
    expect(lastSet.size).toBe(1);
  });

  it('点击「全部」chip → 触发 changeFilter,传空 Set(语义上等价 null/全部)', async () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    // 先激活一个 chip
    const chips = wrapper.findAll('button.rounded-full');
    const lakeChip = chips.find((c) => c.text().includes('湖泊'));
    await lakeChip!.trigger('click');
    // 再点「全部」("全部" chip 文本只有「全部」二字,无 count)
    const allChip = chips.find((c) => c.text().trim() === '全部');
    await allChip!.trigger('click');

    const events = wrapper.emitted('changeFilter');
    expect(events).toBeTruthy();
    const lastSet = events![events!.length - 1][0] as Set<string>;
    expect(lastSet).toBeInstanceOf(Set);
    expect(lastSet.size).toBe(0);
  });

  it('列表项点击 → 触发 select,传 MapMarker', async () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    const options = wrapper.findAll('[role="option"]');
    expect(options).toHaveLength(4);
    // 点击第一个 option 内的 button
    const button = options[0].find('button');
    await button.trigger('click');

    const events = wrapper.emitted('select');
    expect(events).toBeTruthy();
    const lastSpot = events![events!.length - 1][0] as MapMarker;
    // Vue 把 props 转为 reactive proxy —— 用 deep equal 比较
    expect(lastSpot.extraData?.id).toBe(spots[0].extraData?.id);
    expect(lastSpot.kind).toBe(spots[0].kind);
    expect(lastSpot.position).toEqual(spots[0].position);
  });

  it('点击「添加钓点」按钮 → 触发 addSpot', async () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    const addBtn = wrapper.find('button[aria-label="添加钓点"]');
    expect(addBtn.exists()).toBe(true);
    await addBtn.trigger('click');

    const events = wrapper.emitted('addSpot');
    expect(events).toBeTruthy();
    expect(events!.length).toBe(1);
  });

  it('点击「定位」按钮 → 触发 locate', async () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    const locateBtn = wrapper.find('button[aria-label="定位到当前位置"]');
    expect(locateBtn.exists()).toBe(true);
    await locateBtn.trigger('click');

    const events = wrapper.emitted('locate');
    expect(events).toBeTruthy();
    expect(events!.length).toBe(1);
  });

  it('按 kind 过滤后列表项数量变化(派生数据,不发事件时也正确)', async () => {
    const wrapper = mount(FishingSidebar, {
      props: { spots, selectedId: null },
    });
    // 默认全部
    expect(wrapper.findAll('[role="option"]')).toHaveLength(4);
    // 切到 lake
    const chips = wrapper.findAll('button.rounded-full');
    const lakeChip = chips.find((c) => c.text().includes('湖泊'));
    await lakeChip!.trigger('click');
    await nextTick();
    // 4 个中 2 个 lake
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
  });
});

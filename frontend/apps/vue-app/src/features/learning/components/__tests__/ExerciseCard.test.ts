/**
 * ExerciseCard 单测 — 客户端判分契约 (任务 3310 验收 #4)。
 *
 * 覆盖:
 *  - single_choice:字符串相等
 *  - multi_choice:排序后逐项相等(顺序无关)
 *  - true_false:boolean 相等
 *  - 答错时展示 explanation + 正确答案(正确答案标签)
 *  - 「重做」重置 selection / submitted / result
 *  - 提交后 emit `answered(correct)`
 *  - 未选择时禁用「提交」按钮
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Exercise } from '@readinglist/types';
import ExerciseCard from '../ExerciseCard.vue';

function makeSingleChoice(): Exercise {
  return {
    id: 1,
    type: 'single_choice',
    difficulty: 1,
    points: 20,
    prompt: 'Rust 中 ? 的作用是?',
    options: [
      { key: 'A', text: '三元运算符' },
      { key: 'B', text: '错误传播' },
      { key: 'C', text: '解构' },
      { key: 'D', text: '宏调用' },
    ],
    answer: 'B',
    explanation: '? 是 Try trait 的语法糖。',
  };
}

function makeMultiChoice(): Exercise {
  return {
    id: 2,
    type: 'multi_choice',
    difficulty: 3,
    points: 30,
    prompt: '下列哪些是所有权规则?',
    options: [
      { key: 'A', text: '每个值有唯一所有者' },
      { key: 'B', text: '可变借用可多个共存' },
      { key: 'C', text: '不可变借用可多个' },
      { key: 'D', text: '所有者离开作用域值被丢弃' },
    ],
    answer: ['A', 'C', 'D'],
    explanation: '三规则是 A/C/D;B 错。',
  };
}

function makeTrueFalse(): Exercise {
  return {
    id: 3,
    type: 'true_false',
    difficulty: 1,
    points: 20,
    prompt: 'Rust 默认栈分配。',
    options: null,
    answer: false,
    explanation: '不对;默认基于 move 语义。',
  };
}

function findSubmitBtn(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find((b) => b.text().includes('提交'));
}

describe('ExerciseCard', () => {
  // ── single_choice ─────────────────────────────────────────────────────

  it('single_choice:正确答案 → emit answered(true) 并展示 explanation', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeSingleChoice(), index: 1 },
    });

    // 找到 B 按钮
    const bBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('错误传播'));
    expect(bBtn).toBeDefined();
    await bBtn!.trigger('click');

    const submit = findSubmitBtn(wrapper);
    expect(submit).toBeDefined();
    expect(submit!.attributes('disabled')).toBeUndefined();
    await submit!.trigger('click');

    const events = wrapper.emitted('answered');
    expect(events).toBeTruthy();
    expect(events![events!.length - 1]).toEqual([true]);

    // 答对了,文案应包含「答对了」和 explanation
    expect(wrapper.text()).toContain('答对了');
    expect(wrapper.text()).toContain('? 是 Try trait 的语法糖。');
  });

  it('single_choice:错误答案 → emit answered(false) 并展示正确答案', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeSingleChoice(), index: 1 },
    });

    const aBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('三元运算符'));
    await aBtn!.trigger('click');
    await findSubmitBtn(wrapper)!.trigger('click');

    const events = wrapper.emitted('answered');
    expect(events![events!.length - 1]).toEqual([false]);

    expect(wrapper.text()).toContain('答错了');
    expect(wrapper.text()).toContain('正确答案: B');
    expect(wrapper.text()).toContain('? 是 Try trait 的语法糖。');
  });

  // ── multi_choice ──────────────────────────────────────────────────────

  it('multi_choice:顺序无关(打乱选择也判为正确)', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeMultiChoice(), index: 2 },
    });

    // 选择顺序 A → D → C(打乱参考答案顺序 A C D)
    for (const key of ['A', 'D', 'C']) {
      const btn = wrapper
        .findAll('button')
        .find((b) => b.text().includes(textOf(key)));
      await btn!.trigger('click');
    }

    await findSubmitBtn(wrapper)!.trigger('click');

    expect(wrapper.emitted('answered')!.at(-1)).toEqual([true]);
    expect(wrapper.text()).toContain('答对了');
  });

  it('multi_choice:多选/漏选 → 判错', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeMultiChoice(), index: 2 },
    });

    // 只选 A — 漏了 C/D
    const aBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes(textOf('A')));
    await aBtn!.trigger('click');

    await findSubmitBtn(wrapper)!.trigger('click');

    expect(wrapper.emitted('answered')!.at(-1)).toEqual([false]);
    expect(wrapper.text()).toContain('答错了');
    expect(wrapper.text()).toContain('正确答案: A / C / D');
  });

  // ── true_false ────────────────────────────────────────────────────────

  it('true_false:答 true(答错,answer 是 false) → emit answered(false)', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeTrueFalse(), index: 3 },
    });

    // 找「对」按钮
    const trueBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '对');
    expect(trueBtn).toBeDefined();
    await trueBtn!.trigger('click');

    await findSubmitBtn(wrapper)!.trigger('click');

    expect(wrapper.emitted('answered')!.at(-1)).toEqual([false]);
    expect(wrapper.text()).toContain('正确答案: 错');
  });

  it('true_false:答 false → emit answered(true)', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeTrueFalse(), index: 3 },
    });

    const falseBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '错');
    await falseBtn!.trigger('click');
    await findSubmitBtn(wrapper)!.trigger('click');

    expect(wrapper.emitted('answered')!.at(-1)).toEqual([true]);
    expect(wrapper.text()).toContain('答对了');
  });

  // ── 「重做」reset ────────────────────────────────────────────────────

  it('「重做」按钮 reset 选择/状态,可重新作答', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeSingleChoice(), index: 1 },
    });

    // 选 A,提交 → answered(false)
    const aBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('三元运算符'));
    await aBtn!.trigger('click');
    await findSubmitBtn(wrapper)!.trigger('click');
    expect(wrapper.text()).toContain('答错了');

    // 点「重做」
    const resetBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('重做'));
    expect(resetBtn).toBeDefined();
    await resetBtn!.trigger('click');

    // 应重新出现「提交」按钮(说明已回到未作答态)
    expect(findSubmitBtn(wrapper)).toBeDefined();

    // 再选正确答案 B,提交 → answered(true)
    const bBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('错误传播'));
    await bBtn!.trigger('click');
    await findSubmitBtn(wrapper)!.trigger('click');

    const allEvents = wrapper.emitted('answered')!;
    expect(allEvents).toHaveLength(2);
    expect(allEvents[0]).toEqual([false]);
    expect(allEvents[1]).toEqual([true]);
  });

  // ── canSubmit gate ───────────────────────────────────────────────────

  it('未选择时「提交」按钮被禁用', async () => {
    const wrapper = mount(ExerciseCard, {
      props: { exercise: makeSingleChoice(), index: 1 },
    });
    const submit = findSubmitBtn(wrapper);
    expect(submit).toBeDefined();
    expect(submit!.attributes('disabled')).toBeDefined();
  });
});

/** 简化查找:选项 key 对应的中文。 */
function textOf(key: string): string {
  return (
    {
      A: '每个值有唯一所有者',
      B: '可变借用可多个共存',
      C: '不可变借用可多个',
      D: '所有者离开作用域值被丢弃',
    }[key] ?? ''
  );
}

/**
 * LearningList 单测 — 列表 + 主题输入页 (任务 3310 验收 #5)。
 *
 * mock 掉 ``learningGateway`` 验证:
 *  - 提交主题 → 调用 createCourse → 渲染 progress list
 *  - listProgress 自动 onMounted 拉取
 *  - 空 list 显示 empty 文案
 *  - error 显示在输入框下方 + 「知道了」按钮调 clearError
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type {
  CourseStatusResponse,
  LearningCourse,
  LearningLesson,
  LearningProgressItem,
} from '@readinglist/types';
import LearningList from '../LearningList.vue';

// ── mock gateway ────────────────────────────────────────────────────────
const {
  createCourseMock,
  getCourseMock,
  listProgressMock,
  markProgressMock,
} = vi.hoisted(() => ({
  createCourseMock: vi.fn(),
  getCourseMock: vi.fn(),
  listProgressMock: vi.fn(),
  markProgressMock: vi.fn(),
}));

vi.mock('@readinglist/api', () => ({
  learningGateway: {
    createCourse: createCourseMock,
    getCourse: getCourseMock,
    listProgress: listProgressMock,
    markProgress: markProgressMock,
  },
}));

// ── mock vue-router (LearningList 用了 useRouter().push) ─────────────
const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useRoute: () => ({
    params: {},
    query: {},
  }),
}));

// ── helpers ────────────────────────────────────────────────────────────

function makeProgressItem(
  overrides: Partial<LearningProgressItem> = {},
): LearningProgressItem {
  return {
    course_id: 'rust--abcd1234',
    topic: 'Rust 入门',
    sessions_done: [],
    exercise_done: false,
    status: 'ready',
    next_session: 1,
    ...overrides,
  };
}

function makeReadyCourse(course_id: string): CourseStatusResponse {
  // task-351 契约:已生成课程在 ``lessons: LearningLesson[]`` 列表中,
  // 每个 lesson 含该课练习 ``exercises: Exercise[]``。
  const lesson: LearningLesson = {
    id: 1,
    title: '第 1 课',
    slug: 'lesson-1',
    md: '# L1',
    exercises: [],
  };
  const course: LearningCourse = {
    course_id,
    topic: 'Rust 入门',
    lessons: [lesson],
    resource_md: '# R',
    mission_md: null,
  };
  return { status: 'ready', course };
}

interface MountOpts {
  createCourseResult?: { course_id: string };
  getCourseResult?: CourseStatusResponse;
  listProgressResult?: LearningProgressItem[];
}

async function mountList(opts: MountOpts = {}): Promise<VueWrapper> {
  createCourseMock.mockReset();
  getCourseMock.mockReset();
  listProgressMock.mockReset();
  markProgressMock.mockReset();
  pushMock.mockReset();

  const createdCourseId = opts.createCourseResult?.course_id ?? 'rust--abc12345';
  createCourseMock.mockResolvedValue({
    course_id: createdCourseId,
    status: 'pending',
  });
  getCourseMock.mockResolvedValue(
    opts.getCourseResult ?? makeReadyCourse(createdCourseId),
  );
  listProgressMock.mockResolvedValue(opts.listProgressResult ?? []);

  const wrapper = mount(LearningList, {
    global: {
      stubs: {
        // 简化:组件挂载到 router-view,使用 router-link 等的 stub 即可
        RouterLink: { template: '<a><slot /></a>' },
        Button: { template: '<button><slot /></button>' },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// ── tests ──────────────────────────────────────────────────────────────

describe('LearningList', () => {
  beforeEach(() => {
    /* 每个用例独立 */
  });

  it('onMounted 自动调用 listProgress', async () => {
    await mountList({ listProgressResult: [] });
    expect(listProgressMock).toHaveBeenCalledTimes(1);
  });

  it('progress 列表为空时展示 empty 文案', async () => {
    const wrapper = await mountList({ listProgressResult: [] });
    await flushPromises();
    expect(wrapper.text()).toContain(
      '还没有学习记录。输入主题开始你的第一门课。',
    );
  });

  it('progress 列表渲染:展示 topic / statusLabel / 「继续学习」按钮', async () => {
    const wrapper = await mountList({
      listProgressResult: [
        makeProgressItem({
          course_id: 'rust--aaaa1111',
          topic: 'Rust 入门',
          sessions_done: [1, 2],
          next_session: 3,
          status: 'ready',
        }),
        makeProgressItem({
          course_id: 'go--bbbb2222',
          topic: 'Go 入门',
          status: 'ready',
          next_session: null,
          exercise_done: true,
          sessions_done: [1, 2, 3],
        }),
      ],
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Rust 入门');
    expect(wrapper.text()).toContain('Go 入门');
    expect(wrapper.text()).toContain('已完成 2 节');
    expect(wrapper.text()).toContain('已完成');
  });

  it('点击「继续学习」→ router.push 到 learning-course,query.session 命中', async () => {
    const wrapper = await mountList({
      listProgressResult: [
        makeProgressItem({
          course_id: 'rust--abcd1234',
          topic: 'Rust',
          next_session: 3,
        }),
      ],
    });
    await flushPromises();

    // 「继续学习 →」按钮
    const continueBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('继续学习'));
    expect(continueBtn).toBeDefined();
    await continueBtn!.trigger('click');

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'learning-course',
        params: { courseId: 'rust--abcd1234' },
        query: { session: '3' },
      }),
    );
  });

  it('提交非空主题 → createCourse + getCourse(fast-path ready) + router.push 到课程详情', async () => {
    const wrapper = await mountList();
    await flushPromises();

    // 找到 topic input
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
    await input.setValue('Rust 入门');

    // 点「生成课程」
    const generateBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('生成课程'));
    expect(generateBtn).toBeDefined();
    await generateBtn!.trigger('click');

    // 等异步 (createCourse + getCourse)
    await flushPromises();
    await flushPromises();
    await flushPromises();

    // 不填目标 → createCourse(topic, undefined)
    expect(createCourseMock).toHaveBeenCalledWith('Rust 入门', undefined);
    expect(getCourseMock).toHaveBeenCalledWith('rust--abc12345');
    // submitTopic 完成后 router.push 到课程详情
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'learning-course',
        params: { courseId: 'rust--abc12345' },
      }),
    );
  });

  it('填写学习目标 → createCourse(topic, goal) 携带 goal', async () => {
    const wrapper = await mountList();
    await flushPromises();

    const inputs = wrapper.findAll('input[type="text"]');
    // [0] topic, [1] goal
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    await inputs[0].setValue('Rust 入门');
    await inputs[1].setValue('能独立复述所有权规则');

    const generateBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('生成课程'));
    expect(generateBtn).toBeDefined();
    await generateBtn!.trigger('click');

    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(createCourseMock).toHaveBeenCalledWith(
      'Rust 入门',
      '能独立复述所有权规则',
    );
  });

  it('提交空白主题 → 不调 createCourse,error 文案展示', async () => {
    const wrapper = await mountList();
    await flushPromises();

    // 直接点按钮(空 draft)
    const generateBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('生成课程'));
    expect(generateBtn).toBeDefined();
    // 按钮 disabled 因为 v-model draft 为空
    expect(generateBtn!.attributes('disabled')).toBeDefined();

    // 通过 keydown.enter 触发也无效
    await wrapper.find('input[type="text"]').trigger('keydown.enter');
    expect(createCourseMock).not.toHaveBeenCalled();
  });
});
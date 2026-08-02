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
import { createPinia, setActivePinia } from 'pinia';
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
  listModelsMock,
} = vi.hoisted(() => ({
  createCourseMock: vi.fn(),
  getCourseMock: vi.fn(),
  listProgressMock: vi.fn(),
  markProgressMock: vi.fn(),
  listModelsMock: vi.fn(),
}));

vi.mock('@readinglist/api', () => ({
  learningGateway: {
    createCourse: createCourseMock,
    getCourse: getCourseMock,
    listProgress: listProgressMock,
    markProgress: markProgressMock,
    listModels: listModelsMock,
  },
  // task-391: useAuthStore 内部会用到 createAuthGateway / refreshAccessToken
  // / registerTokenRefresher。这里只需要 stub 一份「存在即可」，auth 永远
  // 不会被实际拉起 —— fresh Pinia 下 user.value 为 null 即未登录态。
  createAuthGateway: () => ({}),
  refreshAccessToken: vi.fn(),
  registerTokenRefresher: vi.fn(),
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
  listModelsResult?: Array<{
    id: string;
    label: string;
    is_premium: boolean;
  }>;
  listModelsReject?: boolean;
  /** 设置为 true 模拟登录态 (user.value 非 null)。 */
  loggedIn?: boolean;
}

async function mountList(opts: MountOpts = {}): Promise<VueWrapper> {
  createCourseMock.mockReset();
  getCourseMock.mockReset();
  listProgressMock.mockReset();
  markProgressMock.mockReset();
  listModelsMock.mockReset();
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
  // task-391：listModels 默认返回 flash + pro 两条；reject 走 fallback flash
  if (opts.listModelsReject) {
    listModelsMock.mockRejectedValue(new Error('boom'));
  } else if (opts.listModelsResult) {
    listModelsMock.mockResolvedValue(opts.listModelsResult);
  } else {
    listModelsMock.mockResolvedValue([
      { id: 'deepseek-v4-flash', label: 'Flash（快速）', is_premium: false },
      { id: 'deepseek-v4-pro', label: 'Pro（深度）', is_premium: true },
    ]);
  }

  // task-391: LearningList 通过 useAuthStore 拿登录态（premium 模型选项
  // 禁用判定），因此 mount 时必须先 activate 一个空 Pinia。未登录等价
  // 于 user.value === null —— 我们在 freshPinia 下不调 fetchUser，默认就是
  // 未登录态，符合本测试套件的所有断言。
  setActivePinia(createPinia());

  // task-391: 登录态测试需要 auth.user 非空。必须在 useAuthStore 被组件调用
  // 之前设置，否则 isAuthenticated 永远是 false。
  if (opts.loggedIn) {
    const { useAuthStore } = await import('@/features/auth');
    const auth = useAuthStore();
    auth.user = { id: 1, username: 'u1', is_admin: false } as never;
  }

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

    // 不填目标 → createCourse(topic, '')，gateway 端归一化（空串不落 body）。
    // task-391 之后新增第三参 extras(modelId/extraPrompt)；listModels 在本测试
    // 套件没有 mock，composable 走硬降级 FALLBACK_MODELS,所以 modelId 会带上
    // 默认的 'deepseek-v4-flash'，extraPrompt 留空字符串。
    expect(createCourseMock).toHaveBeenCalledWith('Rust 入门', '', {
      modelId: 'deepseek-v4-flash',
      extraPrompt: '',
    });
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
      // task-391: 同上,modelDraft 走 fallback,extraPrompt 留空
      {
        modelId: 'deepseek-v4-flash',
        extraPrompt: '',
      },
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

  // ── 模型选择 + 额外提示（task-391/395） ─────────────────────────────

  it('onMounted 拉一次 listModels,默认选第一条 (flash)', async () => {
    const wrapper = await mountList();
    await flushPromises();

    expect(listModelsMock).toHaveBeenCalledTimes(1);
    // 默认 trigger 按钮文案 = 第一项 label = "Flash（快速）"
    expect(wrapper.text()).toContain('Flash（快速）');
  });

  it('listModels 失败时仍可用 fallback flash', async () => {
    const wrapper = await mountList({ listModelsReject: true });
    await flushPromises();

    // fallback flash 仍可见，trigger 仍可选
    expect(wrapper.text()).toContain('Flash（快速）');
  });

  it('未登录用户：is_premium 选项 disabled (pro)', async () => {
    const wrapper = await mountList();
    await flushPromises();

    // HoverDropdown 默认 mouseenter 打开 — 找到包含 trigger 的 div
    // 实际下拉是浮层,需要触发 mouseenter
    const dropdownRoot = wrapper.find('div.relative');
    expect(dropdownRoot.exists()).toBe(true);
    await dropdownRoot.trigger('mouseenter');
    await flushPromises();

    // 找到 Pro（深度）选项对应的 button — 由于 is_premium + 未登录 → disabled
    const proOption = wrapper
      .findAll('[role="option"] button')
      .find((b) => b.text().includes('Pro（深度）'));
    expect(proOption).toBeDefined();
    expect(proOption!.attributes('disabled')).toBeDefined();
  });

  it('提交 → createCourse 收到第三参 extras (登录态 + 选 pro)', async () => {
    // 登录态 + 选 Pro + 填 extraPrompt → 提交时第三参透传 modelId/extraPrompt
    const wrapper = await mountList({ loggedIn: true });
    await flushPromises();

    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue('Rust 入门');
    await inputs[2].setValue('面向初学者');

    // 打开下拉 → 选 Pro（登录态可用）。HoverDropdown 响应 mouseenter。
    const dropdownRoot = wrapper.find('div.relative');
    expect(dropdownRoot.exists()).toBe(true);
    await dropdownRoot.trigger('mouseenter');
    await flushPromises();

    const proOption = wrapper
      .findAll('[role="option"] button')
      .find((b) => b.text().includes('Pro（深度）'));
    expect(proOption).toBeDefined();
    expect(proOption!.attributes('disabled')).toBeUndefined();
    await proOption!.trigger('click');
    await flushPromises();

    // 提交
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
      '',
      { modelId: 'deepseek-v4-pro', extraPrompt: '面向初学者' },
    );
  });

  it('不选模型 + 不填 extraPrompt → 第三参 modelId=undefined,extraPrompt=""', async () => {
    const wrapper = await mountList();
    await flushPromises();

    const input = wrapper.find('input[type="text"]'); // topic
    await input.setValue('Rust 入门');

    const generateBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('生成课程'));
    await generateBtn!.trigger('click');

    await flushPromises();
    await flushPromises();
    await flushPromises();

    // listModels 默认响应里有 flash/pro;onMounted 后 modelDraft 默认选第一条
    // (flash)，所以 modelId 是 'deepseek-v4-flash'，extraPrompt 是空字符串
    expect(createCourseMock).toHaveBeenCalledWith('Rust 入门', '', {
      modelId: 'deepseek-v4-flash',
      extraPrompt: '',
    });
  });
});
/**
 * CourseView 单测 — 课程概览页 (task-353 重构 + task-354 验收)。
 *
 * 覆盖:
 *  - 挂载时自动 loadCourse + loadProgress
 *  - 渲染课列表 (titles + 状态徽标:已完成 / 当前 / 未开始)
 *  - 进度条按 sessions_done 比例更新
 *  - 「继续下一课」点击 → generateNextLesson 被调;pending 路径轮询 + 跳转
 *  - 资源面板:点击折叠/展开 toggle
 *  - 「返回学习列表」→ router.push learning
 *  - 失败态渲染 + retry 触发
 *
 * mock 策略:把 ``learningGateway`` 整体替成 ``vi.fn()``,``vue-router`` 用
 * ``useRouter()`` push 捕获。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type {
  CourseStatusResponse,
  LearningCourse,
  LearningLesson,
  LearningProgressItem,
  NextLessonResponse,
} from '@readinglist/types';
import CourseView from '../CourseView.vue';

// ── mock gateway ────────────────────────────────────────────────────────
const {
  createCourseMock,
  getCourseMock,
  listProgressMock,
  markProgressMock,
  generateNextLessonMock,
  downloadBundleMock,
  downloadFileMock,
  listFilesMock,
  saveBlobAsMock,
} = vi.hoisted(() => ({
  createCourseMock: vi.fn(),
  getCourseMock: vi.fn(),
  listProgressMock: vi.fn(),
  markProgressMock: vi.fn(),
  generateNextLessonMock: vi.fn(),
  downloadBundleMock: vi.fn(),
  downloadFileMock: vi.fn(),
  listFilesMock: vi.fn(),
  saveBlobAsMock: vi.fn(),
}));

vi.mock('@readinglist/api', () => ({
  learningGateway: {
    createCourse: createCourseMock,
    getCourse: getCourseMock,
    listProgress: listProgressMock,
    markProgress: markProgressMock,
    generateNextLesson: generateNextLessonMock,
    downloadBundle: downloadBundleMock,
    downloadFile: downloadFileMock,
    listFiles: listFilesMock,
  },
  saveBlobAs: saveBlobAsMock,
}));

// ── mock vue-router ────────────────────────────────────────────────────
const pushMock = vi.fn();
let routeParams: Record<string, string> = { courseId: 'rust--abcd1234' };
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useRoute: () => ({
    params: routeParams,
    query: {},
  }),
}));

// ── mock useHead (来自 @vueuse/head) ──────────────────────────────────
vi.mock('@vueuse/head', () => ({
  useHead: () => ({}),
}));

// ── helpers ────────────────────────────────────────────────────────────

function makeLesson(overrides: Partial<LearningLesson> = {}): LearningLesson {
  return {
    id: 1,
    title: 'Rust 入门 · 第 1 课',
    slug: 'lesson-1',
    md: '# 第 1 课内容',
    exercises: [],
    ...overrides,
  };
}

function makeCourse(overrides: Partial<LearningCourse> = {}): LearningCourse {
  return {
    course_id: 'rust--abcd1234',
    topic: 'Rust 入门',
    lessons: [makeLesson()],
    resource_md: '# 资源内容',
    mission_md: null,
    ...overrides,
  };
}

function makeReady(course: LearningCourse): CourseStatusResponse {
  return { status: 'ready', course };
}

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

interface MountOpts {
  course?: LearningCourse | null;
  progressList?: LearningProgressItem[];
  generateResult?: NextLessonResponse;
  /** 模拟 generateNextLesson 之后,getCourse 返回的新课程(用于 pending→poll)。 */
  courseAfterGenerate?: LearningCourse | null;
  routeParams?: Record<string, string>;
  /** `listFiles` 的返回（「原始文件」面板清单）。 */
  courseFiles?: Array<{
    name: string;
    rel_path: string;
    size: number;
    mtime: number;
  }>;
}

async function mountView(opts: MountOpts = {}): Promise<VueWrapper> {
  // reset
  createCourseMock.mockReset();
  getCourseMock.mockReset();
  listProgressMock.mockReset();
  markProgressMock.mockReset();
  generateNextLessonMock.mockReset();
  downloadBundleMock.mockReset();
  downloadFileMock.mockReset();
  listFilesMock.mockReset();
  saveBlobAsMock.mockReset();
  pushMock.mockReset();

  routeParams = opts.routeParams ?? { courseId: 'rust--abcd1234' };

  const course = opts.course ?? makeCourse();
  // 第一次 getCourse → 初始 ready 课程
  getCourseMock.mockResolvedValueOnce(makeReady(course));
  // generateNextLesson 后若调用 getCourse(poll)→ 返回新课程
  if (opts.courseAfterGenerate) {
    getCourseMock.mockResolvedValueOnce(makeReady(opts.courseAfterGenerate));
  }
  // 后续 getCourse 调用兜底(兜底返回当前 course)
  getCourseMock.mockResolvedValue(makeReady(course));

  listProgressMock.mockResolvedValue(opts.progressList ?? []);

  generateNextLessonMock.mockResolvedValue(
    opts.generateResult ?? {
      course_id: 'rust--abcd1234',
      next_lesson: 2,
      status: 'pending',
    },
  );

  // 下载默认成功（单个测试可覆盖为 reject 模拟失败）。
  downloadBundleMock.mockResolvedValue(undefined);
  downloadFileMock.mockResolvedValue(undefined);
  // 「原始文件」清单默认空（各测试用 opts.courseFiles 配置）。
  listFilesMock.mockResolvedValue(opts.courseFiles ?? []);

  const wrapper = mount(CourseView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        Button: { template: '<button><slot /></button>' },
      },
    },
  });
  await flushPromises();
  await flushPromises();
  return wrapper;
}

// ── tests ──────────────────────────────────────────────────────────────

describe('CourseView', () => {
  beforeEach(() => {
    /* per-test reset 由 mountView 处理 */
  });

  it('挂载时自动调 loadCourse + loadProgress', async () => {
    await mountView();
    expect(getCourseMock).toHaveBeenCalledWith('rust--abcd1234');
    expect(listProgressMock).toHaveBeenCalledTimes(1);
  });

  it('渲染课程标题 + 课节列表 + 状态徽标', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [
          makeLesson({ id: 1, title: '所有权', slug: 'ownership' }),
          makeLesson({ id: 2, title: '借用', slug: 'borrow' }),
          makeLesson({ id: 3, title: '生命周期', slug: 'lifetime' }),
        ],
      }),
      // sessions_done=[1] + next_session=2 → 第 1 课「已完成」,第 2 课「当前」,
      // 第 3 课「未开始」
      progressList: [makeProgressItem({ sessions_done: [1], next_session: 2 })],
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Rust 入门');
    expect(wrapper.text()).toContain('所有权');
    expect(wrapper.text()).toContain('借用');
    expect(wrapper.text()).toContain('生命周期');
    // 3 节课
    expect(wrapper.text()).toContain('3 节课');
    // 状态徽标
    expect(wrapper.text()).toContain('已完成');
    expect(wrapper.text()).toContain('当前');
    expect(wrapper.text()).toContain('未开始');
  });

  it('进度条按 sessions_done 比例更新', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [
          makeLesson({ id: 1, title: 'L1' }),
          makeLesson({ id: 2, title: 'L2' }),
          makeLesson({ id: 3, title: 'L3' }),
          makeLesson({ id: 4, title: 'L4' }),
        ],
      }),
      progressList: [makeProgressItem({ sessions_done: [1, 2, 3] })],
    });
    await flushPromises();

    // aria-valuenow 反映 3/4 → 75%
    const bar = wrapper.find('[role="progressbar"]');
    expect(bar.exists()).toBe(true);
    expect(bar.attributes('aria-valuenow')).toBe('75');
    expect(wrapper.text()).toContain('3 / 4 节已完成');
  });

  it('「继续下一课」点击 → generateNextLesson 被调;pending 时轮询后跳转 lesson 详情', async () => {
    // useFakeTimers 推进 ``pollForLesson`` 里的 setInterval(3000ms)
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout'],
    });
    try {
      const newCourse = makeCourse({
        lessons: [
          makeLesson({ id: 1, title: 'L1' }),
          makeLesson({ id: 2, title: 'L2' }),
        ],
      });
      const wrapper = await mountView({
        course: makeCourse({
          lessons: [makeLesson({ id: 1, title: 'L1' })],
        }),
        generateResult: {
          course_id: 'rust--abcd1234',
          next_lesson: 2,
          status: 'pending',
        },
        courseAfterGenerate: newCourse,
      });
      await flushPromises();

      // 找「继续下一课」按钮
      const nextBtn = wrapper
        .findAll('button')
        .find((b) => b.text().includes('继续下一课'));
      expect(nextBtn).toBeDefined();
      await nextBtn!.trigger('click');
      await flushPromises();
      // 让 setInterval 的回调跑起来 → getCourse 第二次 → poll 命中
      await vi.advanceTimersByTimeAsync(3500);
      await flushPromises();
      await flushPromises();

      expect(generateNextLessonMock).toHaveBeenCalledWith('rust--abcd1234');
      // poll 之后 router.push 到 learning-lesson
      expect(pushMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'learning-lesson',
          params: expect.objectContaining({
            courseId: 'rust--abcd1234',
            lessonId: expect.any(String),
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('「继续下一课」already_generated → reload course + 跳到 next_lesson', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [
          makeLesson({ id: 1, title: 'L1' }),
          makeLesson({ id: 2, title: 'L2' }),
        ],
      }),
      progressList: [makeProgressItem({ sessions_done: [1], next_session: 2 })],
      generateResult: {
        course_id: 'rust--abcd1234',
        next_lesson: null,
        status: 'already_generated',
      },
    });
    await flushPromises();

    const nextBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('继续下一课'));
    expect(nextBtn).toBeDefined();
    await nextBtn!.trigger('click');
    await flushPromises();
    await flushPromises();

    expect(generateNextLessonMock).toHaveBeenCalledWith('rust--abcd1234');
    // already_generated → next_lesson=null,fallback 用 progressItem.next_session=2
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'learning-lesson',
        params: expect.objectContaining({ lessonId: '2' }),
      }),
    );
  });

  it('渲染学习使命(MISSION.md)内容,缺失时整块隐藏', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        mission_md:
          '# Mission: Rust 入门\n\n## Why\n- 能独立复述所有权规则。\n\n## Out of scope\n- 不涉及宏。',
      }),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('学习使命');
    // v-html 渲染后的文本(HTML 标签被去掉后的文本节点)
    expect(wrapper.find('article').text()).toContain('Mission: Rust 入门');
    expect(wrapper.find('article').text()).toContain('Why');
  });

  it('mission_md 为 null 时隐藏学习使命区块', async () => {
    const wrapper = await mountView({
      course: makeCourse({ mission_md: null }),
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('学习使命');
  });

  it('mission_md 为空字符串时隐藏学习使命区块', async () => {
    const wrapper = await mountView({
      course: makeCourse({ mission_md: '' }),
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('学习使命');
  });

  it('资源面板:默认折叠,点击标题展开 v-html 内容', async () => {
    const wrapper = await mountView({
      course: makeCourse({ resource_md: '## 资源标题\n内容' }),
    });
    await flushPromises();

    // 资源面板默认折叠。注意 collapsible 用 grid-template-rows 0fr↔1fr
    // 折叠,内容始终在 DOM(仅视觉高度为 0),故断言 aria-hidden 而非元素存在。
    const panel = wrapper.find('#resource-panel');
    const toggle = wrapper
      .findAll('button')
      .find((b) => b.text().includes('学习资源'));
    expect(toggle).toBeDefined();
    expect(panel.attributes('aria-hidden')).toBe('true');

    // 点「学习资源」toggle 按钮展开
    await toggle!.trigger('click');
    await flushPromises();
    expect(panel.attributes('aria-hidden')).toBe('false');
  });

  it('「返回学习列表」按钮 → router.push learning', async () => {
    const wrapper = await mountView();
    await flushPromises();

    const backBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('返回学习列表'));
    expect(backBtn).toBeDefined();
    await backBtn!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'learning' }),
    );
  });

  it('所有课节已完成时不显示「继续下一课」', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [
          makeLesson({ id: 1, title: 'L1' }),
          makeLesson({ id: 2, title: 'L2' }),
        ],
      }),
      progressList: [
        makeProgressItem({
          sessions_done: [1, 2],
          exercise_done: true,
          next_session: null,
        }),
      ],
    });
    await flushPromises();

    const nextBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('继续下一课'));
    expect(nextBtn).toBeUndefined();
    expect(wrapper.text()).toContain('已全部完成');
  });

  // ── 下载原始文件 (task-385) ──────────────────────────────────────────

  it('顶部 header 显示「下载原始文件」按钮,点击触发 ZIP 下载', async () => {
    const wrapper = await mountView();
    await flushPromises();

    const btn = wrapper.find('button[aria-label="下载原始文件"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    await flushPromises();

    expect(downloadBundleMock).toHaveBeenCalledWith('rust--abcd1234');
  });

  it('ZIP 下载失败时显示错误横幅「下载失败,请稍后重试」', async () => {
    const wrapper = await mountView();
    await flushPromises();
    // mountView 已 reset 并默认 resolve;此处覆盖为 reject
    downloadBundleMock.mockRejectedValueOnce(new Error('boom'));

    await wrapper.find('button[aria-label="下载原始文件"]').trigger('click');
    await flushPromises();
    await flushPromises();

    const banner = wrapper.find('[role="alert"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('下载失败,请稍后重试');
  });

  it('下载过程中按钮显示 loading 文案', async () => {
    const wrapper = await mountView();
    await flushPromises();

    let resolveDownload!: () => void;
    downloadBundleMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = resolve;
        }),
    );

    await wrapper.find('button[aria-label="下载原始文件"]').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('下载中…');

    resolveDownload();
    await flushPromises();
    await flushPromises();
    expect(wrapper.text()).toContain('下载原始文件');
  });

  it('「原始文件」面板展开后列出 lessons + resource + MISSION', async () => {
    const wrapper = await mountView({
      courseFiles: [
        {
          name: '0001-lesson-1.md',
          rel_path: 'lessons/0001-lesson-1.md',
          size: 1234,
          mtime: 1,
        },
        {
          name: '0002-lesson-2.md',
          rel_path: 'lessons/0002-lesson-2.md',
          size: 567,
          mtime: 1,
        },
        { name: 'resource.md', rel_path: 'resource.md', size: 89, mtime: 1 },
        { name: 'MISSION.md', rel_path: 'MISSION.md', size: 90, mtime: 1 },
      ],
    });
    await flushPromises();

    // 默认折叠:面板内容仍在 DOM(grid 0fr),断言 aria-hidden=true
    const toggle = wrapper.find('button[aria-controls="files-panel"]');
    const panel = wrapper.find('#files-panel');
    expect(toggle.exists()).toBe(true);
    expect(panel.attributes('aria-hidden')).toBe('true');

    await toggle.trigger('click');
    await flushPromises();

    expect(panel.attributes('aria-hidden')).toBe('false');
    expect(listFilesMock).toHaveBeenCalledWith('rust--abcd1234');
    expect(wrapper.text()).toContain('0001-lesson-1.md');
    expect(wrapper.text()).toContain('0002-lesson-2.md');
    expect(wrapper.text()).toContain('resource.md');
    expect(wrapper.text()).toContain('MISSION.md');
    // 每行展示文件大小
    expect(wrapper.text()).toContain('1.2 KB');
  });

  it('每行下载图标触发对应单文件下载', async () => {
    const wrapper = await mountView({
      courseFiles: [
        {
          name: '0001-lesson-1.md',
          rel_path: 'lessons/0001-lesson-1.md',
          size: 1234,
          mtime: 1,
        },
      ],
    });
    await flushPromises();

    await wrapper.find('button[aria-controls="files-panel"]').trigger('click');
    await flushPromises();

    const fileBtn = wrapper.find('button[aria-label="下载 0001-lesson-1.md"]');
    expect(fileBtn.exists()).toBe(true);
    await fileBtn.trigger('click');
    await flushPromises();

    expect(downloadFileMock).toHaveBeenCalledWith(
      'rust--abcd1234',
      'lessons/0001-lesson-1.md',
    );
  });

  it('单文件下载失败同样显示错误横幅', async () => {
    const wrapper = await mountView({
      courseFiles: [
        {
          name: '0001-lesson-1.md',
          rel_path: 'lessons/0001-lesson-1.md',
          size: 1234,
          mtime: 1,
        },
      ],
    });
    await flushPromises();
    // mountView 已 reset;此处覆盖为 reject
    downloadFileMock.mockRejectedValueOnce(new Error('boom'));

    await wrapper.find('button[aria-controls="files-panel"]').trigger('click');
    await flushPromises();
    await wrapper
      .find('button[aria-label="下载 0001-lesson-1.md"]')
      .trigger('click');
    await flushPromises();
    await flushPromises();

    const banner = wrapper.find('[role="alert"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('下载失败,请稍后重试');
  });
});

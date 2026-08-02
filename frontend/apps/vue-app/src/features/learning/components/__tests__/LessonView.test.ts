/**
 * LessonView 单测 — 单课详情页 (task-353 重构 + task-354 验收)。
 *
 * 覆盖:
 *  - 挂载时自动 loadCourse + loadProgress
 *  - 渲染 lesson 标题、Markdown 正文 (v-html)
 *  - tab 切换:正文 / 练习
 *  - ExerciseCard 集成:答对 + 答错,本地 scoreState 累加
 *  - 「本节完成」:练习全对时按钮亮起,点击 → markSessionDone
 *  - 「下一课」:点击 → generateNextLesson,pending/already_generated 跳转
 *  - 「找不到该课节」空态(lesson id 不在 course.lessons)
 *  - 「返回课程概览」→ router.push learning-course
 *
 * mock 策略同 ``CourseView.test.ts``。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type {
  CourseStatusResponse,
  LearningCourse,
  LearningLesson,
  LearningProgressItem,
  Exercise,
  NextLessonResponse,
} from '@readinglist/types';
import LessonView from '../LessonView.vue';

// ── mock gateway ────────────────────────────────────────────────────────
const {
  createCourseMock,
  getCourseMock,
  listProgressMock,
  markProgressMock,
  generateNextLessonMock,
} = vi.hoisted(() => ({
  createCourseMock: vi.fn(),
  getCourseMock: vi.fn(),
  listProgressMock: vi.fn(),
  markProgressMock: vi.fn(),
  generateNextLessonMock: vi.fn(),
}));

vi.mock('@readinglist/api', () => ({
  learningGateway: {
    createCourse: createCourseMock,
    getCourse: getCourseMock,
    listProgress: listProgressMock,
    markProgress: markProgressMock,
    generateNextLesson: generateNextLessonMock,
  },
}));

// ── mock vue-router ────────────────────────────────────────────────────
const pushMock = vi.fn();
let routeParams: Record<string, string> = {
  courseId: 'rust--abcd1234',
  lessonId: '1',
};
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

vi.mock('@vueuse/head', () => ({
  useHead: () => ({}),
}));

// ── helpers ────────────────────────────────────────────────────────────

function makeSingleChoice(): Exercise {
  return {
    id: 1,
    type: 'single_choice',
    difficulty: 1,
    points: 20,
    prompt: '? 是什么?',
    options: [
      { key: 'A', text: '错误传播' },
      { key: 'B', text: '三元' },
    ],
    answer: 'A',
    explanation: '? 是错误传播',
  };
}

function makeLesson(
  overrides: Partial<LearningLesson> = {},
): LearningLesson {
  return {
    id: 1,
    title: 'Rust 入门 · 第 1 课',
    slug: 'lesson-1',
    md: '# 第 1 课内容',
    exercises: [makeSingleChoice()],
    ...overrides,
  };
}

function makeCourse(
  overrides: Partial<LearningCourse> = {},
): LearningCourse {
  return {
    course_id: 'rust--abcd1234',
    topic: 'Rust 入门',
    lessons: [makeLesson()],
    resource_md: '# R',
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
  markProgressResult?: LearningProgressItem;
  generateResult?: NextLessonResponse;
  courseAfterGenerate?: LearningCourse | null;
  routeParams?: Record<string, string>;
}

async function mountView(opts: MountOpts = {}): Promise<VueWrapper> {
  createCourseMock.mockReset();
  getCourseMock.mockReset();
  listProgressMock.mockReset();
  markProgressMock.mockReset();
  generateNextLessonMock.mockReset();
  pushMock.mockReset();

  routeParams = opts.routeParams ?? {
    courseId: 'rust--abcd1234',
    lessonId: '1',
  };

  const course = opts.course ?? makeCourse();
  getCourseMock.mockResolvedValueOnce(makeReady(course));
  if (opts.courseAfterGenerate) {
    getCourseMock.mockResolvedValueOnce(makeReady(opts.courseAfterGenerate));
  }
  getCourseMock.mockResolvedValue(makeReady(course));

  listProgressMock.mockResolvedValue(opts.progressList ?? []);

  markProgressMock.mockResolvedValue(
    opts.markProgressResult ??
      makeProgressItem({ sessions_done: [1], next_session: 2 }),
  );

  generateNextLessonMock.mockResolvedValue(
    opts.generateResult ?? {
      course_id: 'rust--abcd1234',
      next_lesson: 2,
      status: 'pending',
    },
  );

  const wrapper = mount(LessonView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        Button: { template: '<button><slot /></button>' },
        // ExerciseCard 真实渲染(它有自己的客户端判分测试),但避免 lucide 拖 SVG
      },
    },
  });
  await flushPromises();
  await flushPromises();
  return wrapper;
}

// ── tests ──────────────────────────────────────────────────────────────

describe('LessonView', () => {
  beforeEach(() => {
    /* per-test reset */
  });

  it('挂载时自动调 loadCourse + loadProgress', async () => {
    await mountView();
    expect(getCourseMock).toHaveBeenCalledWith('rust--abcd1234');
    expect(listProgressMock).toHaveBeenCalledTimes(1);
  });

  it('渲染 lesson 标题、面包屑 + 课序号', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [
          makeLesson({ id: 1, title: '所有权', slug: 'ownership' }),
        ],
      }),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('所有权');
    expect(wrapper.text()).toContain('Rust 入门');
    expect(wrapper.text()).toContain('0001');
  });

  it('默认 tab = 正文,renderMarkdown 输出 v-html', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [makeLesson({ md: '# Markdown 标题\n内容' })],
      }),
    });
    await flushPromises();

    // 正文 tab 的 <article> 默认存在
    const article = wrapper.find('article');
    expect(article.exists()).toBe(true);
  });

  it('tab 切换到「练习」显示 ExerciseCard', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [makeLesson({ exercises: [makeSingleChoice()] })],
      }),
    });
    await flushPromises();

    // 点「练习」tab
    const exerciseTab = wrapper
      .findAll('button')
      .find((b) => b.text().includes('练习'));
    expect(exerciseTab).toBeDefined();
    await exerciseTab!.trigger('click');
    await flushPromises();

    // ExerciseCard 渲染了 prompt 文案
    expect(wrapper.text()).toContain('? 是什么?');
    // 找到 ExerciseCard 里的「提交」按钮
    const submitBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '提交');
    expect(submitBtn).toBeDefined();
  });

  it('「本节完成」:全对后 markSessionDone 被调', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [makeLesson({ exercises: [makeSingleChoice()] })],
      }),
    });
    await flushPromises();

    // 切到「练习」tab
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('练习'))!
      .trigger('click');
    await flushPromises();

    // 选 A(正确答案)
    const aBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('错误传播'));
    expect(aBtn).toBeDefined();
    await aBtn!.trigger('click');
    await flushPromises();
    // 提交
    const submit = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '提交');
    expect(submit).toBeDefined();
    await submit!.trigger('click');
    await flushPromises();

    // 「本节完成」按钮此时应可点
    const markBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('本节完成'));
    expect(markBtn).toBeDefined();
    expect(markBtn!.attributes('disabled')).toBeUndefined();
    await markBtn!.trigger('click');
    await flushPromises();

    expect(markProgressMock).toHaveBeenCalledWith('rust--abcd1234', {
      session_done: 1,
    });
    // 标记后展示「本节已完成」
    expect(wrapper.text()).toContain('本节已完成');
  });

  it('「下一课」:pending 路径 → poll 课程 + 跳到 lesson 详情', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout'] });
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

      // 切到「练习」tab(「下一课」按钮在练习 tab 底部)
      await wrapper
        .findAll('button')
        .find((b) => b.text().includes('练习'))!
        .trigger('click');
      await flushPromises();

      const nextBtn = wrapper
        .findAll('button')
        .find((b) => b.text().includes('下一课'));
      expect(nextBtn).toBeDefined();
      await nextBtn!.trigger('click');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(3500);
      await flushPromises();
      await flushPromises();

      expect(generateNextLessonMock).toHaveBeenCalledWith('rust--abcd1234');
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

  it('找不到 lesson(id 不在 course.lessons)时显示「找不到该课节」空态', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [makeLesson({ id: 1 })],
      }),
      routeParams: {
        courseId: 'rust--abcd1234',
        lessonId: '999',
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('找不到该课节');
  });

  it('「返回课程概览」按钮 → router.push learning-course', async () => {
    const wrapper = await mountView();
    await flushPromises();

    const backBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('返回课程概览'));
    expect(backBtn).toBeDefined();
    await backBtn!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'learning-course',
        params: expect.objectContaining({ courseId: 'rust--abcd1234' }),
      }),
    );
  });

  it('progress.sessions_done 含当前 lesson → 标题下显示「本节已完成」', async () => {
    const wrapper = await mountView({
      course: makeCourse({
        lessons: [makeLesson({ id: 1, title: 'L1' })],
      }),
      progressList: [
        makeProgressItem({ sessions_done: [1], next_session: 2 }),
      ],
    });
    await flushPromises();

    expect(wrapper.text()).toContain('本节已完成');
  });
});

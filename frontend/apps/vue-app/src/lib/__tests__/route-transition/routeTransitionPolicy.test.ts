import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TRANSITION_NAME,
  TRANSITION_NAMES,
  PAGE_SLIDE_BACKWARD,
  PAGE_SLIDE_FORWARD,
  classifyBlogPath,
  isRouteTransitionName,
  resolvePageSlideDirection,
  resolveTransitionName,
} from '../../route-transition';

// ── TRANSITION_NAMES ─────────────────────────────────────────────────────

describe('TRANSITION_NAMES', () => {
  it('包含所有已注册的动画名', () => {
    expect(TRANSITION_NAMES.size).toBe(3);
    expect(TRANSITION_NAMES.has('fade')).toBe(true);
    expect(TRANSITION_NAMES.has('slide-up')).toBe(true);
    expect(TRANSITION_NAMES.has('page-side-by-side')).toBe(true);
  });
});

// ── isRouteTransitionName ────────────────────────────────────────────────

describe('isRouteTransitionName', () => {
  it.each(['fade', 'slide-up', 'page-side-by-side'] as const)(
    '接受合法值 %s',
    (name) => {
      expect(isRouteTransitionName(name)).toBe(true);
    },
  );

  it.each([undefined, null, '', 'none', 'SLIDE-UP', 0, {}, []])(
    '拒绝非法值 %p',
    (value) => {
      expect(isRouteTransitionName(value)).toBe(false);
    },
  );
});

// ── resolveTransitionName ────────────────────────────────────────────────

describe('resolveTransitionName', () => {
  it('缺失 meta → 使用默认 slide-up', () => {
    expect(resolveTransitionName(undefined)).toBe(DEFAULT_TRANSITION_NAME);
  });

  it.each(['fade', 'slide-up', 'page-side-by-side'] as const)(
    '合法值 %s → 返回自身',
    (name) => {
      expect(resolveTransitionName(name)).toBe(name);
    },
  );

  it.each(['', 'none', 'SLIDE-UP', 0, null, {}])(
    '未知 / 非字符串值 %p → 降级到默认',
    (value) => {
      expect(resolveTransitionName(value)).toBe(DEFAULT_TRANSITION_NAME);
    },
  );
});

// ── classifyBlogPath ─────────────────────────────────────────────────────

describe('classifyBlogPath', () => {
  it.each(['/blog', '/blog/category/tech', '/blog/category/life'])(
    '列表路径 %s → list',
    (path) => {
      expect(classifyBlogPath(path)).toBe('list');
    },
  );

  it.each(['/blog/my-first-post'])('详情路径 %s → detail', (path) => {
    expect(classifyBlogPath(path)).toBe('detail');
  });

  it.each(['/blog/new', '/blog/my-first-post/edit'])(
    '编辑器路径 %s → editor',
    (path) => {
      expect(classifyBlogPath(path)).toBe('editor');
    },
  );

  it.each([
    '/',
    '/about',
    '/blog', // 已在 list 分组 —— 此处确认不属于 other
    '/blog/',
    '/blog/category',
  ])('无关路径 %s → other', (path) => {
    if (path === '/blog') {
      expect(classifyBlogPath(path)).toBe('list');
      return;
    }
    expect(classifyBlogPath(path)).toBe('other');
  });

  it.each(['/blog?page=2', '/blog/category/tech#anchor'])(
    '剥掉 query / hash 后正确分类 %s',
    (path) => {
      expect(classifyBlogPath(path)).toBe('list');
    },
  );
});

// ── resolvePageSlideDirection ────────────────────────────────────────────

describe('resolvePageSlideDirection', () => {
  it('首屏（无来源）→ 正向', () => {
    expect(resolvePageSlideDirection(null, '/blog/first-post')).toBe(
      PAGE_SLIDE_FORWARD,
    );
    expect(resolvePageSlideDirection(undefined, '/blog')).toBe(
      PAGE_SLIDE_FORWARD,
    );
  });

  it('列表 → 详情 → 正向（进入从右）', () => {
    expect(
      resolvePageSlideDirection('/blog', '/blog/my-first-post'),
    ).toBe(PAGE_SLIDE_FORWARD);
    expect(
      resolvePageSlideDirection(
        '/blog/category/tech',
        '/blog/my-first-post',
      ),
    ).toBe(PAGE_SLIDE_FORWARD);
  });

  it('列表 → 新建编辑器 → 正向', () => {
    expect(resolvePageSlideDirection('/blog', '/blog/new')).toBe(
      PAGE_SLIDE_FORWARD,
    );
  });

  it('详情 → 列表 → 反向（进入从左）', () => {
    expect(
      resolvePageSlideDirection('/blog/my-first-post', '/blog'),
    ).toBe(PAGE_SLIDE_BACKWARD);
    expect(
      resolvePageSlideDirection(
        '/blog/my-first-post',
        '/blog/category/tech',
      ),
    ).toBe(PAGE_SLIDE_BACKWARD);
  });

  it('详情 → 编辑（同名文章编辑） → 正向（同方向保持）', () => {
    expect(
      resolvePageSlideDirection(
        '/blog/my-first-post',
        '/blog/my-first-post/edit',
      ),
    ).toBe(PAGE_SLIDE_FORWARD);
  });

  it('编辑 → 详情 → 反向', () => {
    expect(
      resolvePageSlideDirection(
        '/blog/my-first-post/edit',
        '/blog/my-first-post',
      ),
    ).toBe(PAGE_SLIDE_BACKWARD);
  });

  it('无关路径 → 兜底正向', () => {
    expect(resolvePageSlideDirection('/about', '/blog')).toBe(
      PAGE_SLIDE_FORWARD,
    );
  });
});
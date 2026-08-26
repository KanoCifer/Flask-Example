import { useAuthStore } from '@/features/auth';
import { reportVisitorData } from '@/lib';
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
} from 'vue-router';

declare global {
  interface Window {
    visitorReportTimer?: ReturnType<typeof setTimeout>;
  }
}
// 根据环境选择 history 类型
const history = import.meta.env.SSR
  ? createMemoryHistory(import.meta.env.BASE_URL)
  : createWebHistory(import.meta.env.BASE_URL);

const router = createRouter({
  history,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }

    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      };
    }

    if (to.path !== from.path) {
      return {
        left: 0,
        top: 0,
      };
    }

    return false;
  },
  routes: [
    {
      path: '/',
      name: 'entry',
      component: () => import('@/features/entry/EntryView.vue'),
      meta: {
        title: "Entry - Kuroome's Blog",
        description: "欢迎来到 Kuroome's Blog，探索个人阅读清单和博客文章",
        keywords: '欢迎,入口,个人博客',
      },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/features/pages/about/AboutView.vue'),
      meta: {
        title: "关于我 - Kuroome's Blog",
        description: "关于 Kuroome's Blog 项目和作者的介绍",
        keywords: '关于,作者,项目介绍',
      },
    },
    {
      path: '/version-log',
      name: 'version-log',
      component: () => import('@/features/changelog/ChangelogView.vue'),
      meta: {
        title: "变更日志 - Kuroome's Blog",
        description: '网站更新历史与变更记录',
        keywords: '变更日志,更新记录,版本历史',
      },
    },
    {
      path: '/websites',
      name: 'websites',
      component: () => import('@/features/websites/WebsitesView.vue'),
      meta: {
        title: "推荐网站 - Kuroome's Blog",
        description: '发现有趣的网站和工具',
        keywords: '网站推荐,工具,资源',
      },
    },
    {
      path: '/friend-links',
      name: 'friend-links',
      component: () => import('@/features/friend-links/FriendLinksView.vue'),
      meta: {
        title: "友情链接 - Kuroome's Blog",
        description: '与志同道合的朋友交换链接',
        keywords: '友情链接,友链,博客链接',
      },
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/features/pages/privacy/PrivacyPolicyView.vue'),
      meta: {
        title: "隐私政策 - Kuroome's Blog",
        description: '了解本站如何收集、使用和保护您的个人信息',
        keywords: '隐私政策,个人信息保护,数据安全',
      },
    },
    {
      path: '/noon',
      name: 'noon',
      component: () => import('@/features/noontool/NomuView.vue'),
      meta: {
        title: 'Nomu — Noon 卖家的商品上架工具',
        description:
          'Nomu 是一款 Chrome 浏览器扩展，从 1688 源页抓取商品，解析、翻译、建图并逐件发布到 Noon UAE 与 Saudi。无需 API Key、无 OAuth、所有配置保留在本地。',
        keywords: 'Nomu,1688,Noon 上架,Noon UAE,Noon Saudi,浏览器扩展',
      },
    },
    {
      // 布局壳：顶栏 + 浮层常驻，主体由子路由切换。父路由不设 name，
      // 避免被 push 到父路由时主体区域空白。
      path: '/fishing-map',
      component: () => import('@/features/fishing/index.vue'),
      children: [
        {
          path: '',
          name: 'fishing-map',
          component: () => import('@/features/fishing/map/MapView.vue'),
          meta: {
            title: "钓鱼地图 - Kuroome's Blog",
            description: '探索钓鱼地点和钓点信息',
            keywords: '钓鱼,地图,钓点,钓鱼地图',
          },
        },
        {
          path: 'weather',
          name: 'fishing-weather',
          component: () => import('@/features/fishing/weather/WeatherView.vue'),
          meta: {
            title: "天气与渔情 - Kuroome's Blog",
            description: '实时天气、24h 时序预报、潮汐与钓鱼指数全景视图',
            keywords: '天气,渔情,钓鱼指数,潮汐,小时预报',
          },
        },
      ],
    },
    {
      path: '/todos',
      name: 'todo-list',
      component: () => import('@/features/todos/TodoListView.vue'),
      meta: {
        title: "开发任务 - Kuroome's Blog",
        description: '网站开发需求和实现清单',
        keywords: '开发任务,需求清单,实现清单,devtask',
      },
    },
    {
      path: '/learning',
      name: 'learning',
      component: () =>
        import('@/features/learning/components/LearningList.vue'),
      meta: {
        title: "学习 - Kuroome's Blog",
        description: 'AI 课程生成 · 自主练习 · 客户端判分。',
        keywords: '学习,AI课程,练习,学习工作台',
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/learning/course/:courseId',
      name: 'learning-course',
      component: () => import('@/features/learning/components/CourseView.vue'),
      meta: {
        title: "课程详情 - Kuroome's Blog",
        description: '课程讲义、资源与练习。',
        keywords: '课程详情,学习,练习',
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/learning/course/:courseId/lesson/:lessonId',
      name: 'learning-lesson',
      component: () => import('@/features/learning/components/LessonView.vue'),
      meta: {
        title: "单课详情 - Kuroome's Blog",
        description: '单课正文与练习。',
        keywords: '单课,学习,练习',
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/blog',
      name: 'blog-list',
      component: () => import('@/features/blog/BlogListView.vue'),
      meta: {
        title: "博客列表 - Kuroome's Blog",
        description: '个人博客文章列表，分享技术心得和生活感悟',
        keywords: '博客,文章,技术分享,生活感悟',
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/blog/new',
      name: 'blog-new',
      component: () => import('@/features/blog/BlogEditorView.vue'),
      meta: {
        requiresAuth: true,
        title: "发布文章 - Kuroome's Blog",
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/blog/:id/edit',
      name: 'blog-edit',
      component: () => import('@/features/blog/BlogEditorView.vue'),
      meta: {
        requiresAuth: true,
        title: "编辑文章 - Kuroome's Blog",
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/blog/category/:categoryId',
      name: 'blog-category',
      component: () => import('@/features/blog/BlogListView.vue'),
      meta: {
        title: "博客分类 - Kuroome's Blog",
        description: '按分类浏览博客文章',
        keywords: '博客分类,文章分类',
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/blog/:id',
      name: 'blog-post',
      component: () => import('@/features/blog/BlogPostView.vue'),
      meta: {
        title: "博客文章 - Kuroome's Blog",
        description: '博客文章详情页',
        keywords: '博客文章,文章详情',
        transition: 'page-side-by-side',
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: {
        title: "登录 - Kuroome's Blog",
        description: "登录 Kuroome's Blog",
        keywords: '登录,用户认证,账户管理',
        transition: 'fade',
      },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/RegisterView.vue'),
      meta: {
        title: "注册 - Kuroome's Blog",
        description: "注册 Kuroome's Blog 账户",
        keywords: '注册,用户认证,账户管理',
        transition: 'fade',
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/features/auth/ProfileSettingView.vue'),
      meta: {
        requiresAuth: true,
        title: "个人设置 - Kuroome's Blog",
        description: '管理个人账户信息和偏好设置',
        keywords: '个人设置,账户信息,偏好设置',
        transition: 'fade',
      },
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('@/features/books/ImportBook.vue'),
      meta: {
        requiresAuth: true,
        title: "导入书籍 - Kuroome's Blog",
        description: '从文件导入书籍信息到个人书架',
        keywords: '导入书籍,书籍管理,个人书架',
        transition: 'fade',
      },
    },
    {
      path: '/bookshelf',
      name: 'bookshelf',
      component: () => import('@/features/books/BookShelf.vue'),
      meta: {
        title: "书架 - Kuroome's Blog",
        description: '个人书架，管理你的阅读清单和书籍信息',
        keywords: '书架,阅读清单,书籍管理',
        requiresAuth: true,
        transition: 'fade',
      },
    },
    {
      path: '/bookshelf/stats',
      name: 'bookshelf-stats',
      component: () => import('@/features/books/BookStats.vue'),
      meta: {
        title: "阅读统计 - Kuroome's Blog",
        description: '微信读书阅读统计数据与趋势分析',
        keywords: '阅读统计,阅读数据,微信读书',
        requiresAuth: true,
        transition: 'fade',
      },
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/features/analytics/AnalyticsView.vue'),
      meta: {
        requiresAuth: true,
        title: '网站数据分析',
        description: '查看网站访问数据和用户行为分析',
        keywords: '网站分析,数据分析,用户行为',
        transition: 'fade',
      },
    },
    {
      path: '/subscription',
      name: 'subscription',
      component: () => import('@/features/subscription/SubscriptionView.vue'),
      meta: {
        requiresAuth: true,
        title: "订阅管理 - Kuroome's Blog",
        description: '管理数字订阅、账单周期和通知渠道',
        keywords: '订阅管理,账单提醒,订阅通知',
        transition: 'fade',
      },
    },
    {
      path: '/device-tracker',
      name: 'device-tracker',
      component: () => import('@/features/device/DeviceTracker.vue'),
      meta: {
        requiresAuth: true,
        title: "设备管理 - Kuroome's Blog",
        description: '管理电子设备资产与价格',
        keywords: '设备管理,资产追踪',
        transition: 'fade',
      },
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: () => import('@/features/pic/PicGallery.vue'),
      meta: {
        title: "照片墙 - Kuroome's Blog",
        description: '展示精选图片的画廊，支持拖拽浏览',
        keywords: '照片墙,精选图片,拖拽浏览',
        transition: 'fade',
      },
    },
    {
      path: '/rss',
      name: 'rss',
      component: () => import('@/features/rss/RssSubscriptionsView.vue'),
      meta: {
        title: "RSS 工作台 - Kuroome's Blog",
        requiresAuth: true,
      },
    },
    {
      path: '/rss/parse',
      name: 'rss-parse',
      redirect: () => ({
        name: 'rss',
        hash: '#rss-parse',
      }),
      meta: {
        title: "RSS 工作台 - Kuroome's Blog",
      },
    },
    {
      path: '/rss/articles',
      name: 'rss-articles',
      redirect: (to) => ({
        name: 'rss',
        query: to.query,
        hash: '#rss-articles',
      }),
      meta: {
        title: "RSS 工作台 - Kuroome's Blog",
      },
    },
    {
      path: '/rss/articles/:id',
      name: 'rss-article',
      component: () => import('@/features/rss/RssArticleView.vue'),
      meta: {
        title: "RSS 阅读 - Kuroome's Blog",
        requiresAuth: true,
      },
    },
    {
      path: '/write',
      name: 'blog-write',
      component: () => import('@/features/blog/BlogEditorView.vue'),
      meta: {
        requiresAuth: true,
        title: "写文章 - Kuroome's Blog",
        description: '支持富文本和 Markdown 双模式的博客编辑器',
        keywords: '写文章,博客编辑器,markdown,富文本',
      },
    },
    {
      path: '/moments',
      name: 'moments',
      component: () => import('@/features/moments/MomentListView.vue'),
      meta: {
        title: "碎碎念 - Kuroome's Blog",
        description: '日常的只言片语，汇成一卷散装活页。',
        keywords: '碎碎念,moments,日常,随笔',
      },
    },
    {
      path: '/color',
      name: 'color-showcase',
      component: () => import('@/features/color/ColorShowcaseView.vue'),
      meta: {
        title: "配色工坊 - Kuroome's Blog",
        description:
          '展示并切换博客的 4 套配色方案（paper / sage / mist / blush），所有色值源自 packages/brand/themes。',
        keywords: '配色,主题,color,scheme,paper,sage,mist,blush',
      },
    },
    {
      path: '/toolbox/image-toolbox',
      name: 'image-toolbox',
      component: () => import('@/features/toolbox/ImageToolboxView.vue'),
      meta: {
        title: "图片工具箱 - Kuroome's Blog",
        description: '本地图片压缩与格式转换工具',
        keywords: '图片工具,图片压缩,格式转换,webp,jpeg,png',
      },
    },
    {
      path: '/status',
      name: 'status',
      component: () => import('@/features/status/StatusView.vue'),
      meta: {
        title: "服务状态 - Kuroome's Blog",
        description: '查看 Kuroome Blog 各项服务的实时运行状况',
        keywords: '服务状态,系统状态,运行状况',
      },
    },
    {
      // 通配符匹配所有未定义的路径
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/features/pages/not-found/NotFound.vue'),
    },
  ],
});

// 全局路由守卫：每次路由跳转前都会执行
router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.isHydrated) {
    await auth.hydrateAuth();
  }

  // 已登录用户访问 /login 或 /register：直接跳走，避免看到登录/注册表单
  if (auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    const redirect = (to.query.redirect as string) || '/';
    return { path: redirect };
  }

  const needsAuth = to.matched.some(
    (route) => route.meta?.requiresAuth === true,
  );

  if (needsAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

// 路由跳转后：标题/描述/关键词已由各页面 useHead 接管
// 路径变化时复位滚动位置（避免从其他页滚到 /blog 或 /blog 返回时仍停在原位导致空白），
// 仅 query / hash 变化（如分页、锚点）保持原滚动位置
router.afterEach((to, from) => {
  if (to.path !== from.path && typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  // 防抖：避免短时间内多次跳转重复上报
  // 声明 window.visitorReportTimer 以消除 TS 报错
  clearTimeout(window.visitorReportTimer);
  window.visitorReportTimer = setTimeout(() => {
    reportVisitorData();
  }, 500);
});

// 导出 router 实例
export default router;

import { BasicLayout } from '@/layouts';
import { Suspense } from 'react';
import { createBrowserRouter, redirect } from 'react-router-dom';
import { useAuthStore } from '@/features/auth';
import {
  About,
  BlogList,
  BlogPost,
  MomentList,
  BookShelf,
  BookStats,
  Changelog,
  FishingMap,
  FriendLinks,
  Home,
  Login,
  NotFound,
  PicGallery,
  ProfileSetting,
  PrivacyPolicy,
  Register,
  RssArticle,
  RssWorkspace,
  TodoList,
  Website,
} from './lazy';

// 认证守卫 loader
async function authLoader() {
  const store = useAuthStore.getState();

  if (!store.isHydrated) {
    await store.hydrateAuth();
  }

  if (!store.user) {
    return redirect('/login?redirect=' + window.location.pathname);
  }
  return null;
}

// 已登录用户守卫 loader：用于 /login 和 /register
// 已登录状态下访问这两个路由会被重定向到首页或 ?redirect= 指定路径
async function guestOnlyLoader({ request }: { request: Request }) {
  const store = useAuthStore.getState();

  if (!store.isHydrated) {
    await store.hydrateAuth();
  }

  if (store.isAuthenticated) {
    const url = new URL(request.url);
    const redirectTarget = url.searchParams.get('redirect') || '/';
    return redirect(redirectTarget);
  }
  return null;
}

export const router = createBrowserRouter([
  {
    element: (
      <Suspense>
        <BasicLayout />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: <Home />,
      },

      {
        path: '/login',
        element: <Login />,
        loader: guestOnlyLoader,
      },
      {
        path: '/register',
        element: <Register />,
        loader: guestOnlyLoader,
      },
      {
        path: '/settings',
        element: <ProfileSetting />,
        loader: authLoader,
      },
      {
        path: '/fishing-map',
        element: <FishingMap />,
      },
      {
        path: '/gallery',
        element: <PicGallery />,
      },
      {
        path: '/version-log',
        element: <Changelog />,
      },
      {
        path: '/about',
        element: <About />,
      },
      {
        path: '/privacy',
        element: <PrivacyPolicy />,
      },
      {
        path: '/websites',
        element: <Website />,
      },
      {
        path: '/friend-links',
        element: <FriendLinks />,
      },
      {
        path: '/blog',
        element: <BlogList />,
      },
      {
        path: '/blog/:postId',
        element: <BlogPost />,
      },
      {
        path: '/moments',
        element: <MomentList />,
      },
      {
        path: '/rss',
        element: <RssWorkspace />,
        loader: authLoader,
      },
      {
        path: '/rss/articles/:articleId',
        element: <RssArticle />,
        loader: authLoader,
      },
      {
        path: '/todos',
        element: <TodoList />,
      },
      {
        path: '/bookshelf',
        element: <BookShelf />,
        loader: authLoader,
      },
      {
        path: '/bookshelf/stats',
        element: <BookStats />,
        loader: authLoader,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

import { lazy } from 'react';

export const Home = lazy(() => import('../features/home/routes'));
export const Login = lazy(() => import('../features/auth/routes'));
export const Register = lazy(() => import('../features/auth/routes-register'));
export const ProfileSetting = lazy(
  () => import('../features/auth/routes-profile'),
);
export const FishingMap = lazy(() => import('../features/fishing/routes'));
export const NotFound = lazy(() => import('../features/pages/routes-notfound'));
export const About = lazy(() => import('../features/pages/routes-about'));
export const Changelog = lazy(
  () => import('../features/pages/routes-changelog'),
);
export const Website = lazy(() => import('../features/pages/routes-website'));
export const BlogList = lazy(() => import('../features/blog/routes'));
export const BlogPost = lazy(() => import('../features/blog/routes-post'));
export const MomentList = lazy(() => import('../features/moments/routes'));
export const RssWorkspace = lazy(() => import('../features/rss/routes'));
export const RssArticle = lazy(() => import('../features/rss/routes-article'));
export const TodoList = lazy(() => import('../features/todo/routes'));
export const PicGallery = lazy(() => import('../features/pic/routes'));
export const PrivacyPolicy = lazy(
  () => import('../features/pages/routes-privacy'),
);
export const FriendLinks = lazy(
  () => import('../features/pages/routes-friendlinks'),
);
export const BookShelf = lazy(() => import('../features/books/routes'));
export const BookStats = lazy(() => import('../features/books/routes-stats'));

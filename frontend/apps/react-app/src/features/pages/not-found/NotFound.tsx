import { useNavigate } from 'react-router-dom';
import { useLottie } from 'lottie-react';
import animationData from '@/assets/404.json';

export default function NotFound() {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const options = {
    animationData: animationData,
    loop: true,
    autoplay: true,
  };

  const style = {
    width: 320,
    height: 320,
    borderRadius: '2rem',
  };

  const { View } = useLottie(options, style);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-secondary/70 mx-auto max-w-md rounded-4xl p-8 text-center backdrop-blur-sm">
        <div className="relative mx-auto h-32 w-32">
          <div className="bg-accent/10 absolute inset-0 animate-pulse rounded-full"></div>
          <div className="relative flex h-full items-center justify-center">
            <span className="text-ink text-6xl font-extrabold tracking-tight">
              404
            </span>
          </div>
        </div>

        <h1 className="text-ink mt-8 font-serif text-3xl font-bold sm:text-4xl">
          页面未找到
        </h1>

        <p className="text-muted mt-4 text-lg">
          抱歉，您访问的页面不存在或已被移动。
        </p>

        <div className="text-muted mt-6 space-y-2 text-sm">
          <p>• 网址可能拼写错误</p>
          <p>• 页面可能已被删除</p>
          <p>• 链接可能已过期</p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bg-accent text-ink hover:bg-accent/90 focus:ring-ring inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-all hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              ></path>
            </svg>
            返回首页
          </button>

          <button
            type="button"
            onClick={goBack}
            className="bg-page text-muted ring-border hover:bg-surface focus:ring-ring inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium ring-1 transition-all ring-inset focus:ring-2 focus:outline-none"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
            上一页
          </button>
        </div>
      </div>

      <div className="text-muted mt-16 flex gap-2">
        <div className="h-1 w-1 animate-bounce rounded-full bg-current"></div>
        <div
          className="h-1 w-1 animate-bounce rounded-full bg-current"
          style={{ animationDelay: '0.1s' }}
        ></div>
        <div
          className="h-1 w-1 animate-bounce rounded-full bg-current"
          style={{ animationDelay: '0.2s' }}
        ></div>
      </div>
      <div className="mt-8">{View}</div>
    </div>
  );
}

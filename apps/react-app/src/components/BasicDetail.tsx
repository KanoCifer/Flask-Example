import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface BasicDetailProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function BackButton() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}

export default function BasicDetail({
  title,
  subtitle,
  children,
}: BasicDetailProps) {
  const navigate = useNavigate();

  const [y, setY] = useState(() => window.scrollY);

  useEffect(() => {
    const handleScroll = () => {
      setY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  // 标题的 parallax 效果
  const titleStyle = useMemo(() => {
    return {
      transform: `translateY(${y * 0.3}px)`,
    };
  }, [y]);

  return (
    <>
      {/* Title */}
      <div
        style={titleStyle}
        className="relative -z-5 mx-0 mt-60 flex flex-col items-center justify-center bg-transparent max-sm:mt-30"
      >
        <div>
          <h1 className="text-ink max-w-6xl text-center font-serif text-7xl max-sm:text-3xl">
            {title}
          </h1>
          {/* <!-- Info --> */}
          <div className="text-muted mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
            <span className="bg-secondary text-muted inline-block rounded-full px-2 py-0.5 text-xs font-medium">
              {subtitle}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-24 w-full">
        <div className="bg-secondary absolute left-1/2 -z-5 h-full w-full -translate-x-1/2 rounded-t-[40px]"></div>
        <div className="mx-auto max-w-6xl">
          <div className="mx-8 grid grid-cols-1 gap-6 pt-24 max-sm:mx-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* <!-- Content slots --> */}
            {children}
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-accent text-ink hover:bg-accent/90 mb-30 inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-3 font-medium transition-all duration-300 hover:shadow-lg"
          >
            <BackButton />
            返回上一页
          </button>
        </div>
      </div>
    </>
  );
}

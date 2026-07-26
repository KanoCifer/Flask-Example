import { socialGateway } from '@/features/home/api/socialGateway';
import animationData from '@/assets/Success Micro Interaction.json';
import { useNotificationStore } from '@/stores/notificationState';
import dayjs from 'dayjs';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useLottie } from 'lottie-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { SPRING, EASE } from '@/constants/springs';
import { switchToVue } from '@/lib/deviceSwitch';

function LikeAnimation() {
  const style = {
    width: 36,
    height: 36,
  };

  const { View, playSegments, goToAndPlay } = useLottie(
    {
      animationData: animationData,
      loop: false,
      autoplay: false,
    },
    style,
  );

  useEffect(() => {
    const t = setTimeout(() => {
      playSegments([0, 90], true);
    }, 16);
    return () => clearTimeout(t);
  }, [playSegments]);

  const handleClick = () => {
    goToAndPlay(0, true);
  };

  return (
    <div onClick={handleClick} className="cursor-pointer">
      {View}
    </div>
  );
}

// Hero 子元素的错峰入场变体
const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
      ease: EASE.outQuint,
    },
  },
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...SPRING.reveal, ease: EASE.outQuint },
  },
};

export function BentoHero() {
  const [likesCount, setLikesCount] = useState<number>(0);
  const notifySuccess = useNotificationStore((state) => state.success);
  const notifyError = useNotificationStore((state) => state.error);
  const navigate = useNavigate();
  const reduce = usePrefersReducedMotion();

  // 视差：滚动时 hero 内容向上漂移 + 淡出
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 140]);
  const heroOpacity = useTransform(scrollY, [0, 380], [1, 0]);

  useEffect(() => {
    let isMounted = true;
    socialGateway
      .getLikes()
      .then((data) => {
        if (isMounted && typeof data?.likes_count === 'number') {
          setLikesCount(data.likes_count);
        }
      })
      .catch(() => {
        /* ignore errors */
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLike = async () => {
    await socialGateway
      .likeOnce({ likes_count: 1 })
      .then(() => {
        notifySuccess('谢谢你的喜欢！🌹');
        setLikesCount((prev) => prev + 1);
      })
      .catch((err) => {
        if (err.response?.status === 429) {
          notifyError('今天已经点了很多次了哦🌹！');
          return;
        }
        notifyError('Failed to like. Please try again later.');
      });
  };

  const greeting =
    dayjs().hour() < 12
      ? 'Good Morning'
      : dayjs().hour() < 18
        ? 'Good Afternoon'
        : 'Good Evening';

  const isEvening = dayjs().hour() >= 18 || dayjs().hour() < 6;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* 动态渐变背景 — 14s 循环，仅 background-position 动画 */}
      <div
        className={`hero-gradient absolute inset-0 ${reduce ? '' : ''}`}
        style={{ opacity: reduce ? 1 : undefined }}
      />

      {/* Liquid Glass 卡片 — 视差浮动 */}
      <motion.div
        className="liquid-glass-card relative z-10 w-full max-w-sm p-8"
        style={reduce ? undefined : { y: heroY, opacity: heroOpacity }}
        variants={heroContainerVariants}
        initial={reduce ? false : 'hidden'}
        animate="visible"
      >
        {/* 头像 + 问候 */}
        <motion.div
          variants={heroItemVariants}
          className="flex items-center gap-5"
        >
          <div className="relative shrink-0">
            <div className="ring-accent/40 relative h-20 w-20 overflow-hidden rounded-full ring-4">
              <img
                src="/images/about.webp"
                alt="Kuroome"
                loading="eager"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-page/70 text-xs font-medium tracking-wide">
              {greeting}
            </p>
            <h1 className="text-page font-serif text-3xl leading-tight font-extrabold tracking-tight">
              Kuroome
            </h1>
          </div>
        </motion.div>

        {/* 操作按钮 */}
        <motion.div
          variants={heroItemVariants}
          className="mt-6 flex items-center gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="bg-page/15 hover:bg-page/25 text-page flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md"
            onClick={() => navigate('/todos')}
            title="查看任务"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            title="切换到 Vue 版本"
            className="bg-page/15 hover:bg-page/25 text-page flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md"
            onClick={switchToVue}
          >
            <svg viewBox="0 0 256 221" className="h-4 w-4" fill="currentColor">
              <path d="M204.8 0H256L128 220.8 0 0h97.92L128 51.2 157.44 0h47.36Z" />
            </svg>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            title="喜欢这个网站吗？点个赞吧！"
            className="bg-page/15 hover:bg-page/25 text-page relative flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md"
            onClick={handleLike}
          >
            <LikeAnimation />
            <span className="bg-destructive absolute -top-1 -right-1 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white tabular-nums">
              {likesCount}
            </span>
          </motion.button>
        </motion.div>

        {/* 装饰：日月图标 */}
        <motion.div
          variants={heroItemVariants}
          className="absolute top-1/2 right-6 -translate-y-1/2 opacity-20"
        >
          {isEvening ? (
            <svg
              className="text-page h-16 w-16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="text-page h-16 w-16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          )}
        </motion.div>
      </motion.div>

      {/* 滚动提示 — 底部弹跳箭头 */}
      {!reduce && (
        <motion.div
          className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="scroll-hint text-page/60 flex flex-col items-center gap-1">
            <span className="text-xs font-medium tracking-wide">Scroll</span>
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </motion.div>
      )}
    </div>
  );
}

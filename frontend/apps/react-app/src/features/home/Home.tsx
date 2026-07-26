import { useNavVisibility } from '@/layouts';
import { useEffect } from 'react';
import { BentoCalendar } from './components/BentoCalendar';
import { BentoClock } from './components/BentoClock';
import { BentoHero } from './components/BentoHero';
import { BentoMap } from './components/BentoMap';
import { BentoTech } from './components/BentoTech';
import { BentoTodo } from './components/BentoTodo';
import { BentoWeb } from './components/BentoWeb';
import { ScrollReveal } from '@/features/home/components/ScrollReveal';

export default function Home() {
  const { showNav } = useNavVisibility();

  useEffect(() => {
    showNav();
    return () => showNav();
  }, [showNav]);

  return (
    <div className="bg-page relative">
      {/* Hero — 全屏沉浸式，含视差（内部自管 scroll） */}
      <div className="relative min-h-dvh">
        <BentoHero />
      </div>

      {/* 下方 section — 滚动叙事，依次弹簧显现 */}
      <div className="mx-auto flex max-w-md flex-col gap-6 px-[max(1.25rem,env(safe-area-inset-left,1.25rem))] py-8 pr-[max(1.25rem,env(safe-area-inset-right,1.25rem))] pb-[calc(env(safe-area-inset-bottom,0px)+8rem)]">
        {/* 时间条 */}
        <ScrollReveal>
          <BentoClock />
        </ScrollReveal>

        {/* 开发任务 — 主功能区 */}
        <ScrollReveal delay={0.05}>
          <BentoTodo />
        </ScrollReveal>

        {/* Daily Pick — 横向滑动 */}
        <ScrollReveal delay={0.1}>
          <BentoWeb />
        </ScrollReveal>

        {/* 日历 — 可展开 */}
        <ScrollReveal delay={0.15}>
          <BentoCalendar />
        </ScrollReveal>

        {/* 底部：钓点 + 技术栈 */}
        <ScrollReveal delay={0.2} className="flex gap-3">
          <div className="flex-1">
            <BentoMap />
          </div>
          <div className="flex-1">
            <BentoTech />
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

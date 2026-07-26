import { useEffect, useState } from 'react';

import {
  changelogGateway,
  type Changelog,
} from '@/features/pages/changelog/api/changelogGateway';
import { motion } from 'framer-motion';

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    feat: '新功能',
    fix: '修复',
    refactor: '重构',
    style: '样式',
    docs: '文档',
    perf: '性能',
    test: '测试',
    chore: '构建',
  };
  return labels[type] || type;
};

const getTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    feat: '✨',
    fix: '🐛',
    refactor: '♻️',
    style: '🎨',
    docs: '📝',
    perf: '⚡',
    test: '🧪',
    chore: '🔧',
  };
  return icons[type] || '';
};

const getTypeClass = (type: string): string => {
  const classes: Record<string, string> = {
    feat: 'bg-linear-to-r from-success/10 to-success/10 text-success ring-1 ring-success/20',
    fix: 'bg-linear-to-r from-destructive/10 to-destructive/10 text-destructive ring-1 ring-destructive/20',
    refactor:
      'bg-linear-to-r from-purple-100 to-violet-100 text-violet-700 ring-1 ring-violet-200/60 dark:from-purple-900/30 dark:to-violet-900/30 dark:text-violet-300 dark:ring-violet-800/60',
    style:
      'bg-linear-to-r from-pink-100 to-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200/60 dark:from-pink-900/30 dark:to-fuchsia-900/30 dark:text-fuchsia-300 dark:ring-fuchsia-800/60',
    docs: 'bg-linear-to-r from-accent/10 to-accent/10 text-ink ring-1 ring-accent/20',
    perf: 'bg-linear-to-r from-warning/10 to-warning/10 text-warning ring-1 ring-warning/20',
    test: 'bg-linear-to-r from-cyan-100 to-teal-100 text-teal-700 ring-1 ring-teal-200/60 dark:from-cyan-900/30 dark:to-teal-900/30 dark:text-teal-300 dark:ring-teal-800/60',
    chore:
      'bg-linear-to-r from-secondary to-secondary text-muted ring-1 ring-border',
  };
  return classes[type] ?? classes.chore;
};

export default function ChangelogView() {
  const [changelog, setChangelog] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    changelogGateway
      .getChangelogs()
      .then(setChangelog)
      .catch(() => setChangelog([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      id="changelogView"
      className="my-12 flex min-h-full w-full flex-col items-center justify-center py-12 max-sm:my-6 max-sm:py-6"
    >
      <div className="w-full max-w-6xl px-4 max-sm:px-3">
        <div className="mb-16 text-center max-sm:mb-10">
          <div className="bg-accent/10 text-ink mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium max-sm:mb-4 max-sm:px-3 max-sm:py-1.5 max-sm:text-xs">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            版本更新记录
          </div>
          <h1 className="text-ink mb-4 text-5xl font-bold tracking-tight max-sm:text-3xl md:text-6xl">
            变更日志
          </h1>
          <p className="text-muted mx-auto max-w-2xl text-lg max-sm:text-base">
            记录网站的每一次成长与进步
          </p>
        </div>

        <div className="relative">
          <div className="absolute top-0 left-1/2 hidden h-full w-0.5 -translate-x-1/2 bg-linear-to-b from-blue-400 via-purple-400 to-pink-400 md:block" />
          <div className="absolute top-0 left-3 hidden h-full w-px bg-linear-to-b from-blue-400 via-purple-400 to-pink-400 max-sm:block" />

          <div className="space-y-12 max-sm:space-y-8">
            {changelog.map((release, index) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  duration: 1,
                  stiffness: 100,
                  damping: 20,
                }}
                viewport={{ once: false, amount: 0.2 }}
                className={`relative flex items-center max-sm:items-start max-sm:pl-8 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                <div className="-mx-8 w-full max-sm:mx-0 md:w-1/2">
                  <div className="group squircle bg-page/80 cursor-pointer border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl max-sm:p-4 md:p-8">
                    <div className="mb-4 flex flex-wrap items-center gap-3 max-sm:gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/25 max-sm:px-3 max-sm:py-1 max-sm:text-xs">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        v{release.version}
                      </span>
                      <span className="text-muted flex items-center gap-1 text-sm max-sm:text-xs">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {release.date}
                      </span>
                    </div>

                    <h2 className="text-ink mb-4 text-2xl font-bold max-sm:text-xl">
                      {release.title}
                    </h2>

                    <ul className="space-y-3 max-sm:space-y-2">
                      {release.changes.map((change, changeIndex) => (
                        <li
                          key={`${release.version}-${changeIndex}`}
                          className="flex items-start gap-3 max-sm:gap-2"
                        >
                          <span
                            className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide uppercase transition-all duration-200 ${getTypeClass(change.type)}`}
                          >
                            {getTypeIcon(change.type) && (
                              <span>{getTypeIcon(change.type)}</span>
                            )}
                            {getTypeLabel(change.type)}
                          </span>
                          <span className="text-muted max-sm:text-sm">
                            {change.content}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="absolute top-1/2 left-1/2 z-10 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 md:block">
                  <div className="absolute inset-0 -m-2 rounded-full bg-blue-500 opacity-30 blur-md transition-all duration-300 group-hover:opacity-50 group-hover:blur-lg" />
                  <div className="bg-page ring-border relative flex h-full w-full items-center justify-center rounded-full ring-4">
                    <div className="h-3 w-3 rounded-full bg-blue-400" />
                  </div>
                </div>

                <div className="absolute top-6 left-0 z-10 h-6 w-6 -translate-x-1/2 max-sm:top-5 max-sm:left-3 md:hidden">
                  <div className="bg-page ring-border relative flex h-full w-full items-center justify-center rounded-full ring-3">
                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                  </div>
                </div>

                <div className="hidden md:block md:w-5/12" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

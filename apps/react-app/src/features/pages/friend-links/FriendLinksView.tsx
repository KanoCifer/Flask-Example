import { TwikooComments } from '@/components';
import { useNotificationStore } from '@/stores/notificationState';
import friendLinksData from '@/data/friendlinks.json';
import websitesData from '@/data/websites.json';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Copy,
  ExternalLink,
  Globe,
  Info,
  Link2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface FriendLink {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  tags: string[];
}

interface Website {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  tags: string[];
}

interface SelfInfo {
  name: string;
  description: string;
  url: string;
  icon: string;
  tags: string[];
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-accent/10 text-ink inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
      {children}
    </span>
  );
}

function DailyPickBanner() {
  const navigate = useNavigate();
  const [pick, setPick] = useState<Website | null>(null);

  const refreshPick = useCallback(() => {
    const sites = websitesData.sites as Website[];
    if (sites.length === 0) return;
    if (sites.length === 1) {
      setPick(sites[0]);
      return;
    }
    let idx: number;
    do {
      idx = Math.floor(Math.random() * sites.length);
    } while (sites[idx].id === pick?.id);
    setPick(sites[idx]);
  }, [pick?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPick();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-page group cursor-pointer overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:p-5"
      onClick={() => navigate('/websites')}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={pick?.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-3.5"
        >
          <div className="bg-surface flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            {pick?.icon ? (
              <img
                src={pick.icon}
                alt={pick.name}
                className="h-7 w-7 object-contain"
                onError={handleImageError}
              />
            ) : (
              <Globe className="text-muted h-6 w-6" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-muted text-[10px] font-bold tracking-wide uppercase">
                每日推荐
              </span>
              <span className="bg-accent/10 text-ink rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {pick?.category}
              </span>
            </div>
            <h3 className="text-ink text-base leading-tight font-bold">
              {pick?.name}
            </h3>
            <p className="text-muted mt-1 line-clamp-2 text-xs leading-relaxed">
              {pick?.description}
            </p>
            {pick?.tags && pick.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pick.tags.slice(0, 3).map((tag) => (
                  <TagPill key={tag}>{tag}</TagPill>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <button
              className="bg-accent text-ink flex h-8 w-8 items-center justify-center rounded-lg transition-transform active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                refreshPick();
              }}
              title="换一个"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              className="bg-surface text-muted flex h-8 w-8 items-center justify-center rounded-lg transition-transform active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/websites');
              }}
              title="看更多"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function SelfInfoCard() {
  const notification = useNotificationStore();
  const self = friendLinksData.self as SelfInfo;

  const copySelfInfo = async () => {
    const md = [
      `- **站点名称**：${self.name}`,
      `- **描述**：${self.description}`,
      `- **URL**：${self.url}`,
      `- **头像**：${self.icon}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(md);
      notification.success('友链信息已复制');
    } catch {
      notification.error('复制失败');
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="border-accent/20 bg-accent/5 overflow-hidden rounded-2xl border p-4"
    >
      <div className="flex items-start gap-3">
        <img
          src={self.icon}
          alt={self.name}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
          onError={handleImageError}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-ink text-base font-bold">{self.name}</h3>
            <span className="bg-accent/15 text-ink rounded-full px-2 py-0.5 text-[10px] font-semibold">
              本站
            </span>
          </div>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            {self.description}
          </p>
        </div>
        <button
          onClick={copySelfInfo}
          className="bg-accent text-ink flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95"
          title="复制友链信息"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-page/60 mt-3 space-y-1.5 rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted w-12 shrink-0">URL</span>
          <code className="text-ink truncate">{self.url}</code>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted w-12 shrink-0">Favicon</span>
          <code className="text-ink truncate">{self.icon}</code>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {self.tags.map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function FriendLinkCard({ link, index }: { link: FriendLink; index: number }) {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <motion.a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{
        type: 'spring',
        duration: 0.5,
        stiffness: 100,
        damping: 20,
        delay: index * 0.06,
      }}
      className="bg-page group hover:border-accent/25 block overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3.5">
        <div className="bg-surface flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {link.icon ? (
            <img
              src={link.icon}
              alt={link.name}
              className="h-12 w-12 rounded-full object-cover"
              onError={handleImageError}
            />
          ) : (
            <Globe className="text-muted h-6 w-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-ink group-hover:text-ink text-base font-bold transition-colors">
            {link.name}
          </h3>
          <p className="text-muted mt-1 line-clamp-2 text-xs leading-relaxed">
            {link.description}
          </p>
          {link.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {link.tags.map((tag) => (
                <TagPill key={tag}>{tag}</TagPill>
              ))}
            </div>
          )}
        </div>
        <ExternalLink className="text-muted mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.a>
  );
}

function ApplyCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-page overflow-hidden rounded-2xl border p-4"
    >
      <h3 className="text-ink mb-3 flex items-center gap-2 text-sm font-bold">
        <Link2 className="text-ink h-4 w-4" />
        申请友链
      </h3>
      <p className="text-muted mb-3 text-xs leading-relaxed">
        通过 GitHub Issue 提交友链申请，审核通过后将在 48 小时内上线
      </p>

      <div className="border-accent/15 bg-accent/5 mb-4 rounded-xl border p-3">
        <h4 className="text-ink mb-2 flex items-center gap-1.5 text-xs font-bold">
          <Info className="text-ink h-3.5 w-3.5" />
          接入须知
        </h4>
        <ul className="text-muted space-y-1.5 text-xs">
          <li className="flex items-start gap-2">
            <span className="text-ink mt-0.5 shrink-0 text-[8px]">●</span>
            <span>网站需符合中国大陆相关法律法规</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ink mt-0.5 shrink-0 text-[8px]">●</span>
            <span>网站内容原创、非商业推广</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ink mt-0.5 shrink-0 text-[8px]">●</span>
            <span>
              已在您的网站添加本站友链（
              <a
                href="https://kanocifer.chat"
                target="_blank"
                className="text-ink underline"
                rel="noreferrer"
              >
                kanocifer.chat
              </a>
              ）
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ink mt-0.5 shrink-0 text-[8px]">●</span>
            <span>网站可正常访问</span>
          </li>
        </ul>
      </div>

      <a
        href="https://github.com/KanoCifer/kuroome-blog/issues/1"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-accent text-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform active:scale-95"
      >
        <ExternalLink className="h-4 w-4" />
        前往 GitHub Issue 提交申请
      </a>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="bg-page flex flex-col items-center justify-center rounded-2xl border py-12">
      <Users className="text-muted mb-3 h-12 w-12" />
      <p className="text-muted text-sm">暂无友链</p>
      <p className="text-muted mt-1 text-xs">
        欢迎提交申请，成为第一位友链伙伴
      </p>
    </div>
  );
}

export default function FriendLinksView() {
  const links = friendLinksData.links as FriendLink[];

  return (
    <div className="bg-page min-h-dvh">
      {/* Header */}
      <div className="bg-surface sticky top-0 z-10 backdrop-blur-md">
        <div className="ml-12 max-w-2xl px-4 py-4">
          <h1 className="text-ink text-2xl font-bold">友情链接</h1>
          <p className="text-muted mt-1 text-sm">与志同道合的朋友交换链接</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-24">
        {/* Daily Pick */}
        <DailyPickBanner />

        {/* Self Info */}
        <SelfInfoCard />

        {/* Friend Links */}
        {links.length === 0 ? (
          <EmptyState />
        ) : (
          links.map((link, index) => (
            <FriendLinkCard key={link.id} link={link} index={index} />
          ))
        )}

        {/* Apply */}
        <ApplyCard />

        {/* Comments */}
        <TwikooComments path="/friend-links" />
      </div>
    </div>
  );
}

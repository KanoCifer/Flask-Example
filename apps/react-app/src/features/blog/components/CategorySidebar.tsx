import { motion } from 'framer-motion';
import type { TagItem } from '@/types';

interface CategorySidebarProps {
  tags: TagItem[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isLoading?: boolean;
}

export function CategorySidebar({
  tags,
  activeTag,
  onSelectTag,
  isLoading = false,
}: CategorySidebarProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-muted text-sm font-semibold">标签</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface h-10 w-full animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-muted text-sm font-semibold tracking-wide uppercase">
        标签
      </h3>
      <div className="flex flex-wrap gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectTag(null)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTag === null
              ? 'bg-accent text-ink'
              : 'bg-surface text-ink hover:bg-surface'
          }`}
        >
          <span>全部</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              activeTag === null ? 'bg-accent/80 text-ink' : 'bg-surface/20'
            }`}
          >
            {tags.reduce((a, b) => a + b.count, 0)}
          </span>
        </motion.button>
        {tags.map((tag) => (
          <motion.button
            key={tag.name}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectTag(tag.name)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTag === tag.name
                ? 'bg-accent text-ink'
                : 'bg-surface text-ink hover:bg-surface'
            }`}
          >
            <span>{tag.name}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTag === tag.name
                  ? 'bg-accent/80 text-ink'
                  : 'bg-surface/20'
              }`}
            >
              {tag.count}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

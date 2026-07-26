import { BasicDetail } from '@/components';
import websitesData from '@/data/websites.json';
import { motion } from 'framer-motion';

interface Website {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  tags: string[];
}

export default function WebsiteView() {
  const websites = websitesData.sites as Website[];

  const websitesView = websites.map((t) => {
    return (
      <motion.a
        key={t.id}
        href={t.url}
        target="_blank"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{
          type: 'spring',
          duration: 1,
          stiffness: 100,
          damping: 20,
        }}
        rel="noopener noreferrer"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="squircle bg-secondary mx-4 p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start gap-4">
          <div className="bg-surface flex h-14 w-14 shrink-0 items-center justify-center rounded-xl">
            <img
              src={t.icon}
              alt={t.name}
              className="h-8 w-8 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-ink group-hover:text-muted truncate text-lg font-bold transition-colors duration-300">
              {t.name}
            </h3>
            <span className="bg-secondary text-muted inline-block rounded-full px-2 py-0.5 text-xs font-medium">
              {t.category}
            </span>
          </div>
        </div>

        <p className="text-muted line-clamp-3 text-sm leading-relaxed">
          {t.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            key={t.id}
            className="bg-secondary text-muted rounded-full px-2 py-1 text-xs"
          >
            {t.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </span>
        </div>

        <div className="absolute top-4 right-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="text-muted h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </motion.a>
    );
  });

  return (
    <BasicDetail title="推荐网站" subtitle="发现有趣的网站和工具">
      {websitesView}
    </BasicDetail>
  );
}

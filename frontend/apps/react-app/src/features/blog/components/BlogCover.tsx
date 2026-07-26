import { useMemo } from 'react';
import { useOrigin } from '@/hooks/useOrigin';

type CoverSize = 'sm' | 'md' | 'lg';

interface BlogCoverProps {
  /** 真实封面 URL；留空时使用占位图 */
  cover?: string | null;
  /** 文章标题（占位时叠在图上） */
  title: string;
  /** picsum 的 seed，稳定来自 post._id */
  seed?: string | number;
  /** 分类名，会作为占位顶部小标 */
  categoryName?: string;
  /** 视觉尺寸：sm 卡内缩略、md 普通卡、lg featured */
  size?: CoverSize;
}

/** 稳定 hash：用作 picsum seed */
function seedHash(raw: string): string {
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return `kanocifer-${Math.abs(h).toString(36)}`;
}

export function BlogCover({
  cover,
  title,
  seed = '',
  categoryName,
  size = 'md',
}: BlogCoverProps) {
  const id = String(seed || title);
  const hash = useMemo(() => seedHash(id), [id]);

  const coverSrc = useOrigin(cover ?? '');

  const [w, h] =
    size === 'lg' ? [600, 800] : size === 'sm' ? [300, 400] : [400, 533];
  const placeholderUrl = `https://picsum.photos/seed/${hash}/${w}/${h}`;

  // 章节序号 No.001 / No.002 ... 稳定来自 seed
  const chapterNum =
    (parseInt(hash.replace(/\D/g, '').slice(0, 4) || '0', 36) % 999) + 1;
  const chapterLabel = `No.${String(chapterNum).padStart(3, '0')}`;

  const titleClass =
    size === 'sm'
      ? 'text-xs line-clamp-2'
      : size === 'lg'
        ? 'text-lg sm:text-xl line-clamp-3'
        : 'text-sm sm:text-[15px] line-clamp-2';

  return (
    <div className="/60 bg-surface relative aspect-[3/4] w-full overflow-hidden rounded-xl border">
      {/* 真实封面 */}
      {coverSrc && (
        <img
          src={coverSrc}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}

      {/* 占位：picsum.photos + 文学手账覆盖层 */}
      {!coverSrc && (
        <>
          <img
            src={placeholderUrl}
            alt={`${title} 封面占位`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          {/* 顶部到底部加深渐变，保证底部文字可读 */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/65"
            aria-hidden="true"
          />
          {/* 顶部条：分类 + 章节标 */}
          <div className="text-ink/95 absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-3.5">
            {categoryName && (
              <span className="bg-accent/85 inline-flex max-w-[60%] items-center rounded-full px-2 py-0.5 font-serif text-[10px] tracking-wide shadow-sm">
                <span className="mr-0.5">#</span>
                <span className="truncate">{categoryName}</span>
              </span>
            )}
            <span className="text-ink/75 ml-auto font-mono text-[10px] tracking-[0.2em] uppercase">
              {chapterLabel}
            </span>
          </div>
          {/* 底部：标题（衬线）+ 装饰小线 + 副标斜体 */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              <div className="bg-accent/70 h-px w-5" />
              <span className="text-ink/80 font-serif text-[10px] tracking-[0.2em] italic">
                cover
              </span>
            </div>
            {title && (
              <h3
                className={`text-ink font-serif leading-tight font-semibold drop-shadow-sm ${titleClass}`}
                style={{ textWrap: 'balance' }}
              >
                {title}
              </h3>
            )}
          </div>
        </>
      )}
    </div>
  );
}

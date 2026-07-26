import { PinIcon } from '@/components';
import type { Moment } from '@/types';
import { motion } from 'framer-motion';
import { EditIcon, IconDel } from './InlineIcons';
import { MomentMeta } from './MomentMeta';
import { MomentTagChip } from './MomentTagChip';

interface MomentCardProps {
  moment: Moment;
  volumeLabel?: string;
  isAdmin?: boolean;
  onOpen?: (id: string) => void;
  onEdit?: (moment: Moment) => void;
  onDelete?: (moment: Moment) => void;
}

export function MomentCard({
  moment,
  volumeLabel,
  isAdmin = false,
  onOpen,
  onEdit,
  onDelete,
}: MomentCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="relative"
    >
      <div
        role="button"
        tabIndex={0}
        className={[
          'group relative block cursor-pointer overflow-hidden rounded-2xl border px-5 py-5 shadow-sm transition-all duration-300 ease-out focus:outline-none',
          'hover:-translate-y-0.5 hover:shadow-md',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
          moment.is_pinned
            ? 'bg-warning/8 border-warning/30'
            : 'bg-page /40 hover:border-accent/25',
        ].join(' ')}
        onClick={() => onOpen?.(moment.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen?.(moment.id);
          }
        }}
      >
        <div
          aria-hidden="true"
          className="border-warning/40 absolute top-3 bottom-3 left-2 border-l border-dashed"
        />

        {moment.is_pinned && (
          <span className="bg-warning/15 text-warning absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase shadow-sm">
            <PinIcon className="h-3 w-3" />
            <span>置顶</span>
          </span>
        )}

        {isAdmin && (
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              className="text-muted hover:text-ink /40 bg-page/95 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
              aria-label={`编辑 ${moment.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(moment);
              }}
            >
              <EditIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="text-muted hover:text-destructive /40 bg-page/95 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
              aria-label={`删除 ${moment.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(moment);
              }}
            >
              <IconDel className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="relative pl-3">
          <MomentMeta moment={moment} volumeLabel={volumeLabel} />
        </div>

        <p
          className="text-ink/85 relative mt-2 line-clamp-3 pl-3 font-serif text-[15px] leading-loose"
          style={{ textWrap: 'pretty' }}
        >
          <span className="moment-drop-cap text-ink/95">
            {moment.content.charAt(0)}
          </span>
          <span>{moment.content.slice(1)}</span>
        </p>

        {moment.tags.length > 0 && (
          <div
            className="text-muted relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-3 text-[11px]"
            onClick={(e) => e.stopPropagation()}
          >
            {moment.tags.map((tag) => (
              <MomentTagChip key={tag} name={tag} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .moment-drop-cap {
          font-family: serif;
          font-size: 2.4em;
          float: left;
          line-height: 0.9;
          margin: 0.05em 0.12em -0.05em 0;
          font-weight: 600;
        }
      `}</style>
    </motion.article>
  );
}

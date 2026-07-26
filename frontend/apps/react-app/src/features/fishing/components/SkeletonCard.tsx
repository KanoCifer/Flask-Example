interface SkeletonCardProps {
  hasChart?: boolean;
  hasBottomRow?: boolean;
}

/**
 * Loading skeleton — Apple HIG "shimmer" feel.
 * Uses the project's `skeleton-pulse` keyframe (1.8s, opacity 0.4↔0.7,
 * gentler than Tailwind's `animate-pulse`). Pieces are `rounded-xl` to
 * match the surrounding inset-grouped rows; chart/grid placeholders stay
 * `rounded-xl`. Tone uses muted-muted so the loading state reads as
 * dimmer, not as decoration.
 */
export function SkeletonCard({
  hasChart = false,
  hasBottomRow = false,
}: SkeletonCardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="bg-surface/15 skeleton-pulse h-3.5 w-24 rounded-md" />
          <div className="bg-surface/10 skeleton-pulse h-2.5 w-16 rounded-md" />
        </div>
        <div className="bg-surface/15 skeleton-pulse h-9 w-9 rounded-full" />
      </div>

      {/* main value */}
      <div className="bg-surface/15 skeleton-pulse h-10 w-20 rounded-xl" />

      {/* grid row */}
      <div className="fm-grouped">
        <div className="bg-border/40 grid grid-cols-3 gap-px">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-page flex flex-col items-center gap-1.5 px-2 py-2.5"
            >
              <div className="bg-surface/10 skeleton-pulse h-2.5 w-8 rounded" />
              <div className="bg-surface/15 skeleton-pulse h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* optional chart */}
      {hasChart && (
        <div className="bg-surface/15 skeleton-pulse h-24 w-full rounded-xl" />
      )}

      {/* optional bottom row */}
      {hasBottomRow && (
        <div className="fm-grouped">
          <div className="bg-border/40 grid grid-cols-2 gap-px">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-page flex flex-col gap-1.5 px-3 py-2.5"
              >
                <div className="bg-surface/10 skeleton-pulse h-2 w-10 rounded" />
                <div className="bg-surface/15 skeleton-pulse h-3.5 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

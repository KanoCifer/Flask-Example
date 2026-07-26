export function BlogLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-page animate-pulse rounded-3xl border p-6 shadow-sm"
        >
          <div className="bg-surface h-7 w-3/4 rounded-lg" />
          <div className="bg-surface mt-3 h-4 w-1/4 rounded" />
          <div className="bg-border/60 my-4 h-1 w-16" />
          <div className="mt-3 space-y-2">
            <div className="bg-surface h-3.5 w-full rounded" />
            <div className="bg-surface h-3.5 w-full rounded" />
            <div className="bg-surface h-3.5 w-5/6 rounded" />
          </div>
          <div className="text-muted/30 mt-4 flex gap-2 text-xs">
            <div className="bg-surface h-3 w-20 rounded" />
            <div className="bg-surface h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

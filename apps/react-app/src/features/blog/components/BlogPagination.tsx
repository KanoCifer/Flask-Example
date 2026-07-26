import type { BlogPagination } from '@/types';

export function BlogPagination({
  pagination,
  currentPage,
  onPageChange,
}: {
  pagination: BlogPagination;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const { page, pages: totalPages } = pagination;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 4) pages.push('...');
      for (
        let i = Math.max(2, page - 2);
        i <= Math.min(totalPages - 1, page + 2);
        i++
      ) {
        pages.push(i);
      }
      if (page < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav aria-label="博客分页">
      <ul className="/80 bg-page/90 mx-auto inline-flex w-full max-w-full items-center justify-center gap-1 rounded-2xl border p-1.5 shadow-sm backdrop-blur-sm sm:w-fit sm:gap-2">
        {/* Previous */}
        <li>
          <button
            disabled={!pagination.has_prev}
            onClick={() => onPageChange(pagination.prev_num || 1)}
            className={`focus-visible:ring-ring inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
              pagination.has_prev
                ? 'text-muted hover:bg-surface hover:text-ink'
                : 'text-muted/50 cursor-not-allowed'
            }`}
          >
            <span aria-hidden="true">&laquo;</span>
            <span className="hidden sm:inline">上一页</span>
          </button>
        </li>

        {/* Page numbers */}
        {getVisiblePages().map((p, i) =>
          typeof p === 'number' ? (
            <li key={i}>
              <button
                onClick={() => onPageChange(p)}
                className={`focus-visible:ring-ring inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  p === currentPage
                    ? 'bg-accent text-ink'
                    : 'text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {p}
              </button>
            </li>
          ) : (
            <li key={i}>
              <span className="text-muted/60 px-1 text-sm">{p}</span>
            </li>
          ),
        )}

        {/* Next */}
        <li>
          <button
            disabled={!pagination.has_next}
            onClick={() =>
              onPageChange(pagination.next_num || pagination.pages)
            }
            className={`focus-visible:ring-ring inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
              pagination.has_next
                ? 'text-muted hover:bg-surface hover:text-ink'
                : 'text-muted/50 cursor-not-allowed'
            }`}
          >
            <span className="hidden sm:inline">下一页</span>
            <span aria-hidden="true">&raquo;</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

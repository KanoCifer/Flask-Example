export function BlogEmptyState({
  hasTag,
  onReset,
}: {
  hasTag: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="bg-page/50 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="text-muted/50 mb-5 h-14 w-14"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"
        />
      </svg>
      <h3 className="text-ink font-serif text-base font-semibold">
        {hasTag ? '此卷尚是空白' : '书页尚待落墨'}
      </h3>
      <p className="text-muted mt-2 max-w-sm font-serif text-sm italic">
        {hasTag
          ? '此卷尚无篇章，待你我来添一笔。'
          : '一切好故事，都从空白的扉页开始。'}
      </p>
      {hasTag && onReset && (
        <button
          type="button"
          className="text-muted hover:bg-surface hover:text-ink mt-5 rounded-lg border px-4 py-2 text-sm font-medium"
          onClick={onReset}
        >
          翻看全卷
        </button>
      )}
    </div>
  );
}

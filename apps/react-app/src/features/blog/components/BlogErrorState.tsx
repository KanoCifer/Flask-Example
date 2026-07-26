export function BlogErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="text-destructive mb-4 h-12 w-12"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <p className="text-destructive text-lg font-medium">加载失败</p>
      <p className="text-muted mt-1 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="bg-destructive/90 hover:bg-destructive mt-4 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
      >
        重试
      </button>
    </div>
  );
}

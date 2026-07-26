import { useTwikoo } from '@/hooks/useTwikoo';
import { useEffect } from 'react';

interface TwikooCommentsProps {
  path?: string;
}

export function TwikooComments({ path }: TwikooCommentsProps) {
  const initTwikoo = useTwikoo();

  useEffect(() => {
    if (path) {
      initTwikoo({ el: '#tcomment', path });
    }
  }, [path, initTwikoo]);

  return (
    <div className="bg-page overflow-hidden rounded-2xl border shadow-sm">
      <div className="flex gap-2 border-b px-8 py-5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-message-circle-check-icon lucide-message-circle-check"
        >
          <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <h3 className="text-ink text-lg font-semibold">评论</h3>
      </div>
      <div className="p-8">
        <div id="tcomment" />
      </div>
    </div>
  );
}

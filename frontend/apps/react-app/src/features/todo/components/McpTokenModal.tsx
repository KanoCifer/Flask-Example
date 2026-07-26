import { useState } from 'react';
import { devTaskService, type DevTaskService } from '@/features/todo/api';
import { TodoModal } from './TodoModal';

const DAY_OPTIONS = [
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: 90, label: '90 天' },
  { days: 365, label: '1 年' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const service: DevTaskService = devTaskService();

interface McpTokenModalProps {
  open: boolean;
  onClose: () => void;
}

export function McpTokenModal({ open, onClose }: McpTokenModalProps) {
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    token: string;
    expires_at: string;
    days: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setResult(null);
    setCopied(false);
    try {
      const r = await service.issueMcpToken(days);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('复制失败，请手动选中复制');
    }
  }

  return (
    <TodoModal open={open} size="md" onClose={onClose}>
      <div className="flex flex-col">
        <header className="flex items-start justify-between gap-3 border-b px-6 pt-5 pb-4">
          <div>
            <h2 className="text-ink text-lg font-semibold">
              签发 MCP 服务 Token
            </h2>
            <p className="text-muted mt-0.5 text-xs">
              生成长期有效的 service-JWT，供 MCP server 调用 devtask 接口。
            </p>
          </div>
          <button
            type="button"
            className="text-muted hover:bg-surface hover:text-ink cursor-pointer rounded-md p-1.5 transition-colors"
            aria-label="关闭"
            onClick={onClose}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <div className="px-6 py-5">
          <div className="mb-5">
            <span className="text-muted mb-2 block text-xs font-medium">
              有效期
            </span>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDays(opt.days)}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    days === opt.days
                      ? 'border-accent/40 bg-accent/10 text-ink'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {loading ? '生成中…' : '生成 Token'}
          </button>

          {error && (
            <p
              className="text-destructive mt-3 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor:
                  'color-mix(in oklch, var(--destructive) 40%, transparent)',
              }}
            >
              {error}
            </p>
          )}

          {result && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted block text-xs font-medium">
                  Token
                </span>
                <span className="text-muted text-[11px]">
                  有效期至 {formatDate(result.expires_at)}（{result.days} 天）
                </span>
              </div>

              <div className="relative">
                <textarea
                  className="bg-surface text-ink block w-full resize-none rounded-lg border px-3 py-2 pr-10 font-mono text-[11px] leading-relaxed outline-none"
                  rows={4}
                  readOnly
                  value={result.token}
                />
                <button
                  type="button"
                  className="text-muted hover:bg-surface hover:text-ink absolute top-2 right-2 cursor-pointer rounded-md p-1.5 transition-colors"
                  title={copied ? '已复制' : '复制'}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <svg
                      className="text-success h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                        strokeWidth={2}
                      />
                      <path
                        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-muted text-[11px] leading-relaxed">
                Token 拥有完整的 devtask
                读写权限。生成后请妥善保管，泄露后请尽快在服务端轮换
                <code className="bg-surface px-1 py-0.5 font-mono text-[10px]">
                  DEV_TASK_SECRET
                </code>
                。
              </p>
            </div>
          )}
        </div>
      </div>
    </TodoModal>
  );
}

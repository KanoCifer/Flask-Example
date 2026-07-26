import { IconGitHub } from '@/components';
import { Key, Trash2 } from 'lucide-react';

interface SecuritySectionProps {
  hasPasskey: boolean;
  addingPasskey: boolean;
  deletingPasskey: boolean;
  passkeyMessage: string;
  passkeyMessageType: 'success' | 'error';
  hasGitHubBound: boolean;
  bindingGitHub: boolean;
  unbindingGitHub: boolean;
  githubMessage: string;
  githubMessageType: 'success' | 'error';
  onAddPasskey: () => void;
  onBindGitHub: () => void;
  onOpenPasskeyDialog: () => void;
  onOpenGithubDialog: () => void;
}

export function SecuritySection({
  hasPasskey,
  addingPasskey,
  deletingPasskey,
  passkeyMessage,
  passkeyMessageType,
  hasGitHubBound,
  bindingGitHub,
  unbindingGitHub,
  githubMessage,
  githubMessageType,
  onAddPasskey,
  onBindGitHub,
  onOpenPasskeyDialog,
  onOpenGithubDialog,
}: SecuritySectionProps) {
  return (
    <>
      {/* Divider */}
      <div className="my-5 flex items-center justify-center text-center">
        <div className="bg-border h-px flex-1"></div>
        <span className="text-muted px-3 text-[11px] font-bold tracking-wider uppercase">
          Security
        </span>
        <div className="bg-border h-px flex-1"></div>
      </div>

      {/* Passkeys */}
      <div className="mb-4">
        {!hasPasskey ? (
          <button
            type="button"
            onClick={onAddPasskey}
            disabled={addingPasskey}
            className="bg-success hover:bg-success/90 flex w-full items-center justify-center space-x-2 rounded-full py-4 text-[15px] font-bold text-white shadow-[0_8px_16px_rgba(5,150,105,0.2)] transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {addingPasskey ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                <span>Adding Passkey...</span>
              </>
            ) : (
              <>
                <Key className="size-5" />
                <span>Add Passkey</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenPasskeyDialog}
            disabled={deletingPasskey}
            className="bg-destructive hover:bg-destructive/90 flex w-full items-center justify-center space-x-2 rounded-full py-4 text-[15px] font-bold text-white shadow-[0_8px_16px_rgba(220,38,38,0.2)] transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {deletingPasskey ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                <span>Deleting Passkey...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-5" />
                <span>Delete Passkey</span>
              </>
            )}
          </button>
        )}
        {passkeyMessage && (
          <div
            className={`mt-3 rounded-2xl p-2 text-center text-[12px] font-medium ${
              passkeyMessageType === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {passkeyMessage}
          </div>
        )}
      </div>

      {/* GitHub */}
      <div className="mb-6">
        {!hasGitHubBound ? (
          <button
            type="button"
            onClick={onBindGitHub}
            disabled={bindingGitHub}
            className="bg-ink text-page hover:bg-ink/90 flex w-full items-center justify-center space-x-2.5 rounded-full py-4 text-[15px] font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {bindingGitHub ? (
              <>
                <span className="border-accent h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
                <span>Binding GitHub...</span>
              </>
            ) : (
              <>
                <IconGitHub />
                <span>Bind GitHub Account</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenGithubDialog}
            disabled={unbindingGitHub}
            className="bg-ink text-page hover:bg-ink/90 flex w-full items-center justify-center space-x-2.5 rounded-full py-4 text-[15px] font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {unbindingGitHub ? (
              <>
                <span className="border-accent h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
                <span>Unbinding GitHub...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-5" />
                <span>Unbind GitHub Account</span>
              </>
            )}
          </button>
        )}
        {githubMessage && (
          <div
            className={`mt-3 rounded-2xl p-2 text-center text-[12px] font-medium ${
              githubMessageType === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {githubMessage}
          </div>
        )}
      </div>
    </>
  );
}

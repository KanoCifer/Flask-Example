interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
}: AlertDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="bg-page/50 absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="/50 bg-page/80 relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-ink text-xl font-bold">{title}</h2>
          <p className="text-muted mt-2 text-sm">{description}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="bg-secondary text-ink hover:bg-surface rounded-full border-0 px-5 py-2.5 text-sm font-medium transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
              destructive
                ? 'bg-destructive hover:bg-destructive/90 text-white'
                : 'bg-accent text-ink hover:bg-accent/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

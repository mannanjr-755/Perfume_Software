export default function Modal({ open, title, children, footer, onClose, size = 'md' }) {
  if (!open) return null;

  const widthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative z-10 flex w-full ${widthClass} max-h-[80vh] flex-col overflow-hidden rounded-xl border divider-border bg-[var(--surface)] shadow-xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b divider-border px-4 py-2.5">
          <h2 className="text-base font-semibold panel-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm panel-muted hover:bg-[var(--surface-soft)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t divider-border px-4 py-2.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

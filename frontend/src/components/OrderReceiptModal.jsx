import { useEffect, useRef } from 'react';
import { FiPrinter, FiX } from 'react-icons/fi';
import { buildReceiptHtml, printReceipt } from '../utils/printOrder.js';

export default function OrderReceiptModal({ order, onClose }) {
  const frameRef = useRef(null);

  useEffect(() => {
    if (!order || !frameRef.current) return;
    const doc = frameRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(buildReceiptHtml(order));
    doc.close();
  }, [order]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border divider-border bg-[var(--surface)] shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b divider-border px-4 py-2.5">
          <h2 className="text-base font-semibold panel-title">Receipt preview</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm panel-muted transition hover:bg-[var(--surface-soft)]"
            aria-label="Close"
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-[#f3f0ff] p-3">
          <iframe
            ref={frameRef}
            title="Order receipt"
            className="h-[62vh] w-full rounded-lg border divider-border bg-white"
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t divider-border px-4 py-2.5">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button type="button" onClick={() => printReceipt(order)} className="btn-primary inline-flex items-center gap-2">
            <FiPrinter size={16} />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

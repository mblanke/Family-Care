// ConfirmDialog.tsx — big modal for destructive actions (never a small toast)
import type { ReactNode } from "react";
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="bg-paper rounded-3xl p-8 max-w-lg w-full flex flex-col gap-6">
        <h2 className="text-huge font-bold">{title}</h2>
        {body && <div className="text-big">{body}</div>}
        <div className="flex gap-touch justify-end">
          <button onClick={onCancel}
            className="min-h-touch px-6 rounded-2xl border-4 text-big font-semibold">Keep</button>
          <button onClick={onConfirm}
            className="min-h-touch px-6 rounded-2xl bg-red-700 text-paper text-big font-semibold">
            {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

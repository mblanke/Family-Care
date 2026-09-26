// ConfirmDialog.tsx — big modal for destructive actions (never a small toast)
import { useId, type ReactNode } from "react";
import { Button } from "./Button";

export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel,
}: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-ink/45 flex items-center justify-center p-6 z-50">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
           className="dialog rounded-[36px] p-8 sm:p-10 max-w-xl w-full flex flex-col gap-6">
        <h2 id={titleId} className="font-display text-huge font-bold m-0">{title}</h2>
        {body && <div className="text-big">{body}</div>}
        <div className="flex gap-touch justify-end flex-wrap">
          <Button variant="secondary" onClick={onCancel} autoFocus>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// PromptDialog.tsx — a big, labelled replacement for window.prompt.
// One or two text fields, helper text, Cancel + Save. Never red: this is not a destructive action.
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { Icon } from "./icons";

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  initial?: string;
  optional?: boolean;
}

export function PromptDialog({
  open, title, helper, fields, confirmLabel = "Save", onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  helper?: string;
  fields: PromptField[];
  confirmLabel?: string;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const baseId = useId();
  const [values, setValues] = useState<Record<string, string>>({});

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map(f => [f.key, f.initial ?? ""])));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const required = fields.filter(f => !f.optional);
  const ready = required.every(f => (values[f.key] ?? "").trim() !== "");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 bg-ink/45 flex items-center justify-center p-6 z-50">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className="dialog rounded-[36px] p-8 sm:p-10 max-w-2xl w-full flex flex-col gap-6">
        <h2 id={titleId} className="font-display text-huge font-bold m-0">{title}</h2>
        {helper && <p className="m-0 text-base text-ink-soft">{helper}</p>}
        {fields.map((f, i) => {
          const id = `${baseId}-${f.key}`;
          return (
            <div key={f.key} className="flex flex-col gap-2">
              <label htmlFor={id} className="text-base font-bold">
                {f.label}{f.optional && <span className="font-normal text-ink-soft"> (optional)</span>}
              </label>
              <input
                id={id}
                type="text"
                className="field rounded-[20px] px-5 min-h-[76px] text-big"
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                autoFocus={i === 0}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          );
        })}
        <div className="flex gap-touch justify-end flex-wrap">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={!ready} icon={<Icon name="check" strokeWidth={3} />}>{confirmLabel}</Button>
        </div>
      </form>
    </div>
  );
}

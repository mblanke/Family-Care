// SegmentedControl.tsx — chrome tray with one metal pill lit. Text labels, never colour-only.
import type { ReactNode } from "react";

export interface Segment<T extends string | number> { id: T; label: ReactNode; }

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "big",
  className = "",
}: {
  options: Segment<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  size?: "base" | "big";
  className?: string;
}) {
  const text = size === "big" ? "text-big min-h-[68px] px-4" : "text-base min-h-[60px] px-5";
  return (
    <div role="group" aria-label={label} className={`chrome rounded-pill p-2 flex gap-2 ${className}`}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-pill font-bold pressable inline-flex items-center justify-center gap-2 whitespace-nowrap ${text}
              ${active ? "btn-primary" : "bg-transparent border-0 shadow-none text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

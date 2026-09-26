// Stepper.tsx — big minus / value / plus. Used for BP entry and grocery quantities.
import { Icon } from "./icons";

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  size = "big",
  showLabel = true,
  downLabel,
  upLabel,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  size?: "base" | "big";
  showLabel?: boolean;
  /** Screen-reader names for the two buttons; default "<label> decrease" / "<label> increase". */
  downLabel?: string;
  upLabel?: string;
}) {
  const btn = size === "big" ? "w-20 h-20 rounded-[22px]" : "w-[68px] h-[68px] rounded-[18px]";
  const num = size === "big" ? "text-[3.25rem] min-w-[6rem]" : "text-big min-w-[3.5rem]";
  const icon = size === "big" ? 32 : 28;
  return (
    <div className="flex flex-col items-center gap-2">
      {showLabel && <span className="text-base font-bold">{label}</span>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className={`chrome pressable inline-flex items-center justify-center ${btn}`}
          aria-label={downLabel ?? `${label} decrease`}
        >
          <Icon name="minus" size={icon} strokeWidth={2.8} />
        </button>
        <span className={`font-display font-bold text-center leading-none ${num}`} aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className={`chrome pressable inline-flex items-center justify-center ${btn}`}
          aria-label={upLabel ?? `${label} increase`}
        >
          <Icon name="plus" size={icon} strokeWidth={2.8} />
        </button>
      </div>
    </div>
  );
}

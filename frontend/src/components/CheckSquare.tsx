// CheckSquare.tsx — 72px check square. Chrome when open, metal green with a check when done.
import { Icon } from "./icons";

export function CheckSquare({
  done,
  itemName,
  onToggle,
}: {
  done: boolean;
  itemName: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={done ? `Mark ${itemName} not done` : `Mark ${itemName} done`}
      className={`w-[72px] h-[72px] shrink-0 rounded-square pressable inline-flex items-center justify-center
                  ${done ? "btn-confirm" : "chrome"}`}
    >
      {done && <Icon name="check" size={36} strokeWidth={3} />}
    </button>
  );
}

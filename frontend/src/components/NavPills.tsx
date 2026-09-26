// NavPills.tsx — chrome tray of section pills, the lit one in brand metal. Icon + label, always.
import { Icon, type IconName } from "./icons";

export interface NavTab<T extends string> { id: T; label: string; icon: IconName; }

export function NavPills<T extends string>({
  tabs,
  value,
  onChange,
  columns = "grid-cols-3 md:grid-cols-6",
  layout = "row",
}: {
  tabs: NavTab<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Tailwind grid classes; phones get 3 columns, wider screens one row. */
  columns?: string;
  /** "row": icon beside label from md up. "stacked": icon above label at every width (fits nine tabs). */
  layout?: "row" | "stacked";
}) {
  const stacked = layout === "stacked";
  return (
    <nav aria-label="Sections" className={`chrome rounded-[26px] ${stacked ? "" : "md:rounded-pill"} p-2 grid gap-2 ${columns}`}>
      {tabs.map(t => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={active ? "page" : undefined}
            className={`min-h-[72px] rounded-[18px] pressable font-bold text-center
              flex items-center justify-center px-2 leading-tight
              ${stacked
                ? "flex-col gap-1 text-[1.05rem] min-h-[84px]"
                : "flex-col md:flex-row gap-1 md:gap-2 md:rounded-pill text-[1.05rem] md:text-base"}
              ${active ? "btn-primary" : "bg-transparent border-0 shadow-none text-ink"}`}
          >
            <Icon name={t.icon} size={26} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

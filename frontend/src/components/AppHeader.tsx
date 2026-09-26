// AppHeader.tsx — glass bar: board name, Larger-text toggle, Sign out.
import { Icon } from "./icons";

export function AppHeader({
  title,
  scale,
  onToggleScale,
  onLogout,
}: {
  title: string;
  scale: "normal" | "large";
  onToggleScale: () => void;
  onLogout: () => void;
}) {
  const large = scale === "large";
  return (
    <header className="glass rounded-card px-5 py-3 flex items-center gap-3 flex-wrap">
      <h1 className="font-display text-title font-bold m-0 flex-1 min-w-0 truncate">{title}</h1>
      <button
        type="button"
        onClick={onToggleScale}
        aria-pressed={large}
        aria-label={large ? "Normal text" : "Larger text"}
        className="chrome pressable rounded-pill min-h-touch px-4 sm:px-5 text-base font-bold inline-flex items-center gap-2"
      >
        <span className="font-display text-[1.6rem] leading-none" aria-hidden="true">Aa</span>
        <span className="hidden sm:inline">{large ? "Normal text" : "Larger text"}</span>
      </button>
      <button
        type="button"
        onClick={onLogout}
        aria-label="Sign out"
        className="chrome pressable rounded-pill min-h-touch px-4 sm:px-5 text-base font-bold inline-flex items-center gap-2"
      >
        <Icon name="logout" size={26} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </header>
  );
}

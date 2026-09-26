// ScreenTitle.tsx — the big Sora heading at the top of each screen, with an optional sub-line and trailing controls.
import type { ReactNode } from "react";

export function ScreenTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end gap-4 flex-wrap px-1">
      <div className="flex items-baseline gap-4 flex-wrap flex-1 min-w-0">
        <h2 className="font-display text-huge font-bold m-0">{children}</h2>
        {sub && <div className="text-base text-ink-soft">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

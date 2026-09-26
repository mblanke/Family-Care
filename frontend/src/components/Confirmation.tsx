// Confirmation.tsx — full-width success banner, icon + text, visible ~6s
import { useEffect } from "react";
import { Icon } from "./icons";
export function Confirmation({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 6000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div role="status" className="btn-confirm fixed top-0 inset-x-0 z-50 text-big font-bold
                                  px-6 py-5 flex items-center gap-3 justify-center rounded-b-card">
      <Icon name="check" size={32} strokeWidth={3} /><span>{message}</span>
    </div>
  );
}

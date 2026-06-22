// Confirmation.tsx — full-width success banner, icon + text, visible ≥6s
import { useEffect } from "react";
export function Confirmation({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 6000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div role="status" className="fixed top-0 inset-x-0 bg-confirm text-paper text-big
                                  font-bold p-5 flex items-center gap-3 justify-center">
      <span aria-hidden="true">✓</span><span>{message}</span>
    </div>
  );
}

// ErrorBanner.tsx — full-width error banner, icon + text, visible ≥8s then auto-dismisses
import { useEffect } from "react";
export function ErrorBanner({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 8000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div role="alert" className="fixed top-0 inset-x-0 bg-red-700 text-paper text-big
                                 font-bold p-5 flex items-center gap-3 justify-center z-50">
      <span aria-hidden="true">⚠️</span><span>{message}</span>
    </div>
  );
}

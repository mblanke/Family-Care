// ErrorBanner.tsx — full-width error banner, icon + text. Stays until dismissed:
// an older reader should never miss it because it vanished.
import { Icon } from "./icons";
export function ErrorBanner({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div role="alert" className="btn-danger fixed top-0 inset-x-0 z-50 text-big font-bold
                                 px-6 py-4 flex items-center gap-4 justify-center flex-wrap rounded-b-card">
      <Icon name="alert" size={32} /><span>{message}</span>
      <button type="button" onClick={onDone}
              className="chrome pressable rounded-pill min-h-[56px] px-5 text-base font-bold ml-2">
        Dismiss
      </button>
    </div>
  );
}

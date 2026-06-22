// Button.tsx — solid, ≥60px, text + icon (never icon-only for primary)
import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Button({ icon, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button {...rest}
      className="min-h-touch min-w-touch px-6 rounded-2xl bg-brand text-paper text-big
                 font-semibold inline-flex items-center gap-3 active:scale-95 disabled:opacity-50">
      {icon}<span>{children}</span>
    </button>
  );
}

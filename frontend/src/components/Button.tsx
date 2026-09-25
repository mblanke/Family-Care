// Button.tsx — solid metal pill, >=64px, text + icon (never icon-only for primary)
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "confirm" | "secondary" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  confirm: "btn-confirm",
  secondary: "chrome",
  danger: "btn-danger",
};

export function Button({
  icon,
  variant = "primary",
  size = "big",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: "base" | "big";
}) {
  const text = size === "big" ? "text-big px-7" : "text-base px-5";
  return (
    <button
      {...rest}
      className={`${VARIANT[variant]} pressable min-h-touch min-w-touch rounded-pill ${text}
                  font-bold inline-flex items-center justify-center gap-3
                  disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {icon}<span>{children}</span>
    </button>
  );
}

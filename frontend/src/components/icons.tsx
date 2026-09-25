// icons.tsx — one small inline stroke-SVG set that replaces emoji across the app.
// 24-unit grid, 2.4 stroke, currentColor. Decorative by default (aria-hidden);
// pass a `label` to make an icon meaningful on its own.
import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "car" | "check" | "plus" | "minus" | "trash" | "phone" | "pin" | "sun" | "list"
  | "cart" | "pill" | "heart" | "person" | "people" | "cake" | "calendar" | "print"
  | "logout" | "back" | "arrow" | "camera" | "note" | "alert" | "repeat" | "home" | "close"
  | "moon" | "clock" | "bed" | "key";

const SHAPES: Record<IconName, ReactNode> = {
  car: <><path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16" /><path d="M3 16h18v3h-2.5a1.5 1.5 0 0 1-3 0h-7a1.5 1.5 0 0 1-3 0H3z" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  cart: <><path d="M3 4h2l2.5 11h11L21 7H6" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  pill: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" /><path d="M8.5 15.5l7-7" /></>,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="3" /><path d="M15.5 14.5a5.5 5.5 0 0 1 6 5.5" /></>,
  cake: <path d="M4 20h16v-7H4zM4 16c2 1.5 4-1.5 6 0s4 1.5 6 0 2-1.5 4 0M12 9v4M12 5v1" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  print: <path d="M7 9V4h10v5M7 18H4v-7h16v7h-3M7 15h10v6H7z" />,
  logout: <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h6M9 16h6" /></>,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  repeat: <path d="M4 10a6 6 0 0 1 6-6h9m0 0l-3-3m3 3l-3 3M20 14a6 6 0 0 1-6 6H5m0 0l3 3m-3-3l3-3" />,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bed: <><path d="M3 18v-8h18v8" /><path d="M3 14h18M6 10V7h5v3" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="M11 11l9-9M16 6l2 2M19 3l2 2" /></>,
};

export function Icon({
  name,
  size = 28,
  label,
  ...rest
}: { name: IconName; size?: number; label?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {SHAPES[name]}
    </svg>
  );
}

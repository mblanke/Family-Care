// Card.tsx — glass section with an optional heading. Replaces the old 4px-outline boxes.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function Card({
  title,
  icon,
  children,
  className = "",
  as: Tag = "section",
}: {
  title?: string;
  icon?: IconName;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={`glass rounded-card p-5 sm:p-6 flex flex-col gap-3 ${className}`}>
      {title && (
        <h3 className="font-display text-base font-bold text-ink-soft flex items-center gap-2 m-0">
          {icon && <Icon name={icon} size={24} />}
          {title}
        </h3>
      )}
      {children}
    </Tag>
  );
}

/** A row inside a card: a soft white well. */
export function Well({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`well rounded-[22px] p-4 flex items-center gap-4 ${className}`}>{children}</div>;
}

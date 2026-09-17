import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "dfa-gradient-card rounded-2xl border border-navy/10 p-5 shadow-[0_1px_2px_rgba(31,43,81,0.06),0_8px_24px_-12px_rgba(31,43,81,0.15)]",
        className
      )}
    >
      {children}
    </div>
  );
}

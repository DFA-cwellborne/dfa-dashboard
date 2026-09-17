import { clsx } from "clsx";
import type { ReactNode } from "react";

const VARIANTS = {
  active: "bg-[#0ca30c]/10 text-[#0ca30c]",
  inactive: "bg-navy/10 text-navy/60",
  pendingLaunch: "bg-gold/20 text-[#a3660f]",
  neutral: "bg-navy/5 text-navy/70",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        VARIANTS[variant]
      )}
    >
      {children}
    </span>
  );
}

export function statusToBadgeVariant(status: string | null): keyof typeof VARIANTS {
  if (status === "active") return "active";
  if (status === "inactive") return "inactive";
  if (status === "pending_launch") return "pendingLaunch";
  return "neutral";
}

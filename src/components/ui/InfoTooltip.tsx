"use client";

import { Info } from "lucide-react";

// Hover/focus-triggered tooltip explaining what a metric is and how it's
// tracked. CSS-only (group-hover), no JS state, so it works the same in a
// static export.
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        tabIndex={0}
        aria-label="What is this metric?"
        className="text-navy/30 hover:text-navy/60 focus:text-navy/60 focus:outline-none"
      >
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
        <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-navy" />
      </span>
    </span>
  );
}

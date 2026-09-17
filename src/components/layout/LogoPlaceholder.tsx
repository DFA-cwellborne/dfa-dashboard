// Placeholder for the DFA logo — navy background, per the brand sheet.
// Drop the real logo file at /public/dfa-logo.svg (or .png) and swap the
// contents of this component for an <Image> pointing at it; nothing else
// needs to change since every header/nav already renders <LogoPlaceholder />.
export function LogoPlaceholder({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/30 bg-navy text-[10px] font-semibold tracking-tight text-white/60"
        title="DFA logo placeholder"
      >
        DFA
      </div>
    );
  }
  return (
    <div
      className="flex h-11 w-full items-center gap-2 rounded-xl border border-dashed border-white/30 bg-navy px-3 text-white/60"
      title="DFA logo placeholder"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold">
        DFA
      </span>
      <span className="text-xs leading-tight">
        Logo placeholder
        <br />
        <span className="text-[10px] text-white/40">drop file in /public</span>
      </span>
    </div>
  );
}

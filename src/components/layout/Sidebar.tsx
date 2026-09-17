import { LogoPlaceholder } from "./LogoPlaceholder";

export function Sidebar() {
  return (
    <aside className="dfa-gradient-navy flex h-full w-64 shrink-0 flex-col gap-6 px-4 py-5 text-white">
      <LogoPlaceholder />

      <div className="mt-auto rounded-xl bg-white/5 p-3 text-xs text-white/50">
        Dream for America
        <br />
        Metrics Dashboard
      </div>
    </aside>
  );
}

// next/image doesn't prepend basePath for this asset under `output: "export"`;
// a plain <img> with a relative (no leading slash) src resolves correctly
// against the page's own URL instead, which works since this is a
// single-route site.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="dfa-logo.svg"
      alt="Dream for America"
      width={compact ? 120 : 180}
      height={compact ? 33 : 49}
    />
  );
}

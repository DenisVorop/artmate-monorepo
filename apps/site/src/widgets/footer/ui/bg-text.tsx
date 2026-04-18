export function BgText() {
  return (
    <div
      className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center justify-center overflow-hidden select-none"
      aria-hidden
    >
      <span
        className="font-heading leading-none font-bold whitespace-nowrap text-white"
        style={{
          fontSize: "clamp(3rem, 16vw, 16rem)",
          opacity: 0.028,
          letterSpacing: "-0.02em",
        }}
      >
        ARTMATE
      </span>
    </div>
  );
}

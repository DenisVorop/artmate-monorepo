import { useId } from "react";

import { cn } from "./class-names";
import { ContestOrnamentShape } from "./contest-ornament";

type GarlandTheme = "new-year" | "halloween" | "birthday";

function GarlandDrawing({ theme }: { theme: GarlandTheme }) {
  if (theme === "new-year")
    return (
      <>
        <path
          d="M0 5 Q60 23 120 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <g transform="translate(30 12) rotate(10)">
          <ellipse cy="10" rx="9" ry="11" className="fill-amber-300/20" />
          <rect
            x="-2.5"
            width="5"
            height="4"
            rx="1"
            className="fill-stone-600"
          />
          <ellipse cy="9" rx="3.5" ry="6" className="fill-amber-400" />
          <path
            d="M-1 6v3"
            stroke="white"
            strokeOpacity=".75"
            strokeLinecap="round"
          />
        </g>
        <g transform="translate(90 12) rotate(-10)">
          <ellipse cy="10" rx="9" ry="11" className="fill-rose-300/15" />
          <rect
            x="-2.5"
            width="5"
            height="4"
            rx="1"
            className="fill-stone-600"
          />
          <ellipse cy="9" rx="3.5" ry="6" className="fill-rose-400" />
          <path
            d="M-1 6v3"
            stroke="white"
            strokeOpacity=".75"
            strokeLinecap="round"
          />
        </g>
      </>
    );
  if (theme === "halloween")
    return (
      <>
        <path
          d="M0 4Q60 18 120 4T240 4M45 11v5M148 9v10"
          fill="none"
          className="stroke-violet-800/65"
          strokeWidth="1.2"
        />
        <g transform="translate(45 15) scale(.45)">
          <ContestOrnamentShape kind="bat" />
        </g>
        <g transform="translate(148 29) rotate(8) scale(.45)">
          <ContestOrnamentShape kind="ghost" />
        </g>
      </>
    );
  return (
    <>
      <path
        d="M0 4Q60 18 120 4T240 4"
        fill="none"
        className="stroke-stone-400/65"
        strokeWidth="1.2"
      />
      <path d="m29 9 17 3-11 19Z" className="fill-rose-200" />
      <path d="m84 11 17-4-4 21Z" className="fill-amber-200" />
      <path d="m149 9 17 3-11 19Z" className="fill-violet-200" />
      <path d="m204 11 17-4-4 21Z" className="fill-orange-200" />
    </>
  );
}

export function ContestGarland({
  theme = "new-year",
}: {
  theme?: GarlandTheme;
}) {
  const patternId = useId();
  const height = theme === "new-year" ? 32 : 48;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-contest-garland={theme}
      className={cn(
        "absolute inset-x-0 top-0 w-full text-stone-500/60",
        theme === "new-year" ? "h-8" : "h-12",
      )}
    >
      <defs>
        <pattern
          id={patternId}
          width={theme === "new-year" ? 120 : 240}
          height={height}
          patternUnits="userSpaceOnUse"
        >
          <GarlandDrawing theme={theme} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${patternId})`} />
    </svg>
  );
}

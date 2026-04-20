import { cn } from "@/shared/lib/utils";

const DECOR_TONE = {
  amber: {
    shade: "fill-amber-100",
    accent: "fill-amber-200",
    stroke: "stroke-amber-200",
    shadow: "drop-shadow-[0_28px_64px_rgba(245,158,11,0.18)]",
  },
  indigo: {
    shade: "fill-indigo-100",
    accent: "fill-indigo-200",
    stroke: "stroke-indigo-200",
    shadow: "drop-shadow-[0_28px_64px_rgba(99,102,241,0.16)]",
  },
  rose: {
    shade: "fill-rose-100",
    accent: "fill-rose-200",
    stroke: "stroke-rose-200",
    shadow: "drop-shadow-[0_28px_64px_rgba(244,63,94,0.16)]",
  },
} as const;

type DecorDotsProps = {
  className?: string;
  tone?: keyof typeof DECOR_TONE;
};

export function DecorDots({ className, tone = "rose" }: DecorDotsProps) {
  const colors = DECOR_TONE[tone];

  return (
    <svg
      className={cn(
        "pointer-events-none absolute h-64 w-80 overflow-visible opacity-70",
        colors.shadow,
        className,
      )}
      viewBox="0 0 320 260"
      aria-hidden
    >
      <path
        className={colors.shade}
        d="M38 130C40 67 103 22 177 28c71 6 121 53 118 115-2 55-55 94-128 91C92 231 36 190 38 130Z"
        fillOpacity="0.42"
      />
      <path
        className={colors.accent}
        d="M78 123c5-45 47-77 102-72 50 4 85 39 82 82-3 39-42 67-92 64-56-3-97-34-92-74Z"
        fillOpacity="0.14"
      />
      <path
        className={colors.stroke}
        d="M55 151c20 44 74 67 135 58 46-7 82-32 99-66"
        fill="none"
        strokeLinecap="round"
        strokeOpacity="0.28"
        strokeWidth="2"
      />
      <path
        className="stroke-white"
        d="M91 82c35-23 87-27 128-9"
        fill="none"
        strokeLinecap="round"
        strokeOpacity="0.5"
        strokeWidth="2"
      />
    </svg>
  );
}

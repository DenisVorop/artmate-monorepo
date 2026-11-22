import { cn } from "./class-names";

export type ContestOrnamentKind =
  | "heart"
  | "egg"
  | "flower"
  | "mimosa"
  | "tulip"
  | "envelope"
  | "open-book"
  | "book"
  | "pencil"
  | "paper"
  | "pumpkin"
  | "ghost"
  | "bat"
  | "web"
  | "butterfly"
  | "sun"
  | "boat"
  | "shell"
  | "leaf"
  | "maple"
  | "snowflake"
  | "fir-tree"
  | "balloon"
  | "confetti";
export type ContestOrnamentTone =
  | "rose"
  | "amber"
  | "violet"
  | "sky"
  | "orange"
  | "emerald";

const ornamentTones = {
  rose: "[--ornament-light:var(--color-rose-200)] [--ornament-main:var(--color-rose-400)] [--ornament-dark:var(--color-rose-700)]",
  amber:
    "[--ornament-light:var(--color-amber-200)] [--ornament-main:var(--color-amber-400)] [--ornament-dark:var(--color-amber-700)]",
  violet:
    "[--ornament-light:var(--color-violet-200)] [--ornament-main:var(--color-violet-400)] [--ornament-dark:var(--color-violet-700)]",
  sky: "[--ornament-light:var(--color-sky-200)] [--ornament-main:var(--color-sky-400)] [--ornament-dark:var(--color-sky-700)]",
  orange:
    "[--ornament-light:var(--color-orange-200)] [--ornament-main:var(--color-orange-400)] [--ornament-dark:var(--color-orange-700)]",
  emerald:
    "[--ornament-light:var(--color-emerald-200)] [--ornament-main:var(--color-emerald-400)] [--ornament-dark:var(--color-emerald-700)]",
} as const;

function Heart({ color }: { color: string }) {
  return (
    <path
      d="M0-5C-9-18-26-6-17 7L0 24 17 7C26-6 9-18 0-5Z"
      fill={color}
      stroke="white"
      strokeWidth="1.5"
    />
  );
}

function Flower({ color, center }: { color: string; center: string }) {
  return (
    <>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cy="-9"
          rx="6"
          ry="10"
          fill={color}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r="5" fill={center} />
      <circle cx="-1.5" cy="-1.5" r="1.5" fill="white" fillOpacity=".7" />
    </>
  );
}

function Egg({ color, pattern }: { color: string; pattern: string }) {
  return (
    <>
      <path
        d="M0 19C-23 19-21-6-11-22-5-32 5-32 11-22 21-6 23 19 0 19Z"
        fill={color}
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="m-15-2 6-4 6 4 6-4 6 4 6-4"
        fill="none"
        stroke={pattern}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {[-8, 0, 8].map((x) => (
        <circle key={x} cx={x} cy="8" r="1.7" fill={pattern} />
      ))}
      <path
        d="M-8-19q-5 6-5 10"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity=".6"
      />
    </>
  );
}

function Snowflake() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <path
          key={angle}
          d="M0 0V-19M-5-14l5 5 5-5"
          transform={`rotate(${angle})`}
        />
      ))}
    </g>
  );
}

function OrnamentDrawing({ kind }: { kind: ContestOrnamentKind }) {
  const color = {
    light: "var(--ornament-light)",
    main: "var(--ornament-main)",
    dark: "var(--ornament-dark)",
  };
  switch (kind) {
    case "heart":
      return (
        <g transform="translate(0 -7) scale(1.5)">
          <Heart color={color.light} />
        </g>
      );
    case "egg":
      return (
        <g transform="scale(1.2)">
          <Egg color={color.light} pattern={color.main} />
        </g>
      );
    case "flower":
      return (
        <g transform="scale(1.65)">
          <Flower color={color.light} center="var(--color-amber-300)" />
        </g>
      );
    case "mimosa":
      return (
        <>
          <path
            d="M-15 39 10-30M-7 16l-21-31M-1-2l29-21"
            fill="none"
            className="stroke-emerald-600/65"
            strokeWidth="2"
          />
          <g className="fill-emerald-300">
            <ellipse
              cx="-16"
              cy="14"
              rx="5"
              ry="14"
              transform="rotate(-45 -16 14)"
            />
            <ellipse
              cx="11"
              cy="10"
              rx="5"
              ry="15"
              transform="rotate(50 11 10)"
            />
          </g>
          <g className="fill-yellow-300">
            {[
              [-29, -16],
              [-23, -24],
              [-17, -13],
              [-11, -20],
              [2, -24],
              [10, -33],
              [15, -20],
              [22, -22],
              [29, -30],
              [32, -15],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" />
            ))}
          </g>
        </>
      );
    case "tulip":
      return (
        <>
          <path d="M0 34V-4" className="stroke-emerald-500" strokeWidth="2.5" />
          <path
            d="M0 27Q-25 15-22 4 0 9 0 27M0 31Q23 14 20 1 2 10 0 31"
            className="fill-emerald-200"
          />
          <path
            d="M-18-31-8-22 0-35 8-22 18-31 16-9Q0 12-16-9Z"
            fill={color.light}
          />
          <path d="M0-32V-2" stroke={color.main} strokeOpacity=".5" />
        </>
      );
    case "envelope":
      return (
        <>
          <path
            d="M-32-8 0-30 32-8V25H-32Z"
            className="fill-rose-100 stroke-rose-300"
            strokeWidth="1.5"
          />
          <rect
            x="-24"
            y="-19"
            width="48"
            height="36"
            rx="2"
            className="fill-orange-50"
          />
          <g transform="translate(0 -10) scale(.45)">
            <Heart color="var(--color-rose-300)" />
          </g>
          <path d="m-32-8 32 22L32-8v33H-32Z" className="fill-rose-200" />
          <path d="m-32 25 24-20M32 25 8 5" className="stroke-rose-300" />
        </>
      );
    case "book":
      return (
        <>
          <rect
            x="-24"
            y="-31"
            width="48"
            height="60"
            rx="4"
            fill={color.main}
          />
          <rect
            x="-19"
            y="-28"
            width="43"
            height="52"
            rx="2"
            fill={color.light}
          />
          <path d="M-18 25h42v7h-42q-5-3 0-7" className="fill-orange-50" />
          <path d="M-17 28h39" className="stroke-stone-300" />
          <path
            d="M-9-12h22M-9-5h16"
            fill="none"
            stroke={color.main}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M9 25v15l5-4 5 4V25Z" fill={color.main} />
        </>
      );
    case "open-book":
      return (
        <>
          <path
            d="M0-21q-17-13-35-5v51q19-7 35 4 16-11 35-4v-51q-18-8-35 5Z"
            fill={color.main}
          />
          <path
            d="M0-25q-16-12-31-5v50q16-5 31 5 15-10 31-5v-50q-15-7-31 5Z"
            className="fill-orange-50"
            stroke={color.light}
            strokeWidth="1.5"
          />
          <path
            d="M0-24v48M-24-17q9-2 17 3m-17 6q9-2 17 3m-17 6q9-2 17 3m14-18q8-5 17-3M7-5q8-5 17-3M7 4q8-5 17-3"
            className="stroke-stone-300"
            fill="none"
            strokeWidth="1.3"
          />
          <path d="M3-22v23l4-3 4 3v-27" fill={color.light} />
        </>
      );
    case "pencil":
      return (
        <>
          <rect
            x="-6"
            y="-34"
            width="12"
            height="54"
            rx="2"
            fill={color.light}
          />
          <path d="M-6-25H6M-2-24v42" stroke={color.main} strokeWidth="2" />
          <path d="m-6 20 6 17 6-17" className="fill-orange-100" />
          <path d="m-2 32 2 5 2-5" className="fill-stone-600" />
        </>
      );
    case "paper":
      return (
        <>
          <path
            d="M-24-32h34l14 14v50h-48Z"
            className="fill-orange-50 stroke-sky-200"
            strokeWidth="1.5"
          />
          <path d="M10-32v14h14" className="fill-sky-100 stroke-sky-200" />
          <path
            d="M-14-9h27M-14 1h27M-14 11h27M-14 21H5"
            className="stroke-sky-300"
            strokeWidth="1.5"
          />
          <path d="M-18-27v54" className="stroke-rose-200" />
        </>
      );
    case "pumpkin":
      return (
        <g transform="scale(1.1)">
          <path
            d="M-1-20q-5-12 3-16l4 3q-7 5-3 14"
            className="fill-stone-600"
          />
          <path d="M5-25q20-10 22 0-15 6-22 0" className="fill-emerald-300" />
          <ellipse
            cx="-15"
            cy="4"
            rx="16"
            ry="23"
            className="fill-orange-200"
          />
          <ellipse cx="15" cy="4" rx="16" ry="23" className="fill-orange-200" />
          <ellipse cy="4" rx="21" ry="25" className="fill-orange-300" />
          <path
            d="M-7-16q-9 21 0 39M7-16q9 21 0 39"
            fill="none"
            className="stroke-orange-400/70"
            strokeWidth="1.5"
          />
          <path
            d="m-13 0 7-6 2 8Zm26 0-7-6-2 8ZM-11 11q11 10 22 0l-3 9H-8Z"
            className="fill-violet-950/80"
          />
        </g>
      );
    case "ghost":
      return (
        <>
          <path
            d="M-21 29v-39a21 21 0 0 1 42 0v39l-10-7-11 8-10-8Z"
            className="fill-orange-50 stroke-violet-400"
            strokeWidth="1.5"
          />
          <ellipse cx="-8" cy="-6" rx="3" ry="5" className="fill-violet-950" />
          <ellipse cx="8" cy="-6" rx="3" ry="5" className="fill-violet-950" />
          <ellipse cy="9" rx="4" ry="6" className="fill-violet-900" />
        </>
      );
    case "bat":
      return (
        <>
          <path
            d="M-5-8-9-23 0-18 9-23 5-8Q23-24 37-20L27 3 18 0 15 14 5 9 0 22-5 9-15 14-18 0-27 3-37-20Q-23-24-5-8Z"
            className="fill-violet-900"
          />
          <circle cx="-3" cy="-7" r="1.5" className="fill-amber-200" />
          <circle cx="3" cy="-7" r="1.5" className="fill-amber-200" />
        </>
      );
    case "web":
      return (
        <g className="stroke-violet-400/65" strokeWidth="1" fill="none">
          <path d="M-36-36v72M-36-36h72M-36-36l72 72M-36-36l72 30M-36-36l30 72" />
          <path d="M-36-15q9 1 15 6 5-6 6-15M-36 6q18 0 31 11 10-13 11-35M-36 29q28 0 47 18 19-21 20-53" />
        </g>
      );
    case "butterfly":
      return (
        <>
          <path
            d="M0 4Q-34-38-34-10q0 20 30 19-29 3-22 18 9 17 26-14 17 31 26 14 7-15-22-18 30 1 30-19Q34-38 0 4Z"
            fill={color.light}
          />
          <path
            d="M0-2v20M0-1q-3-12-10-11M0-1q3-12 10-11"
            stroke={color.dark}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M-7 4q-13-16-20-14M7 4q13-16 20-14"
            stroke="white"
            strokeWidth="2"
            fill="none"
          />
        </>
      );
    case "sun":
      return (
        <g className="text-amber-300">
          <circle r="22" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <path key={angle} d="M0-30v-7" transform={`rotate(${angle})`} />
            ))}
          </g>
        </g>
      );
    case "boat":
      return (
        <>
          <path d="M-35 10h70L18 28h-36Z" className="fill-sky-200" />
          <path d="M0-32v44h-30Z" className="fill-orange-50 stroke-sky-200" />
          <path d="M4-24v34h25Z" className="fill-amber-100" />
          <path
            d="M-39 35q10-5 20 0t20 0 20 0 20 0"
            className="stroke-sky-300"
            strokeWidth="2"
            fill="none"
          />
        </>
      );
    case "shell":
      return (
        <>
          <path
            d="M-10 29-33-2q-8-24 9-23 5-19 19-6 12-16 22-1 22-1 17 20l-22 41Z"
            fill={color.light}
          />
          <path
            d="m0 26-22-42M0 26-7-24M0 26 9-24M0 26l24-39"
            stroke={color.main}
            strokeWidth="1.5"
            fill="none"
          />
        </>
      );
    case "leaf":
      return (
        <g transform="rotate(15)">
          <path
            d="M0-35Q38-17 17 14L0 35-17 14Q-38-17 0-35Z"
            fill={color.light}
          />
          <path
            d="M0 39V-25M0-7l13-10M0 8l-14-12M0 21l13-12"
            stroke={color.dark}
            strokeOpacity=".4"
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      );
    case "maple":
      return (
        <g transform="scale(1.35)">
          <path
            d="M0 23-18 9l8-1-8-14 11 5 7-22 7 22 11-5L10 8l8 1Z"
            fill={color.light}
          />
          <path
            d="M0 30V-11M0 9l-9-8M0 11l9-8"
            stroke={color.dark}
            strokeOpacity=".4"
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      );
    case "fir-tree":
      return (
        <>
          <rect
            x="-4"
            y="23"
            width="8"
            height="13"
            rx="1.5"
            className="fill-stone-400"
          />
          <path
            d="M0-33 15-11H9L25 7H17L34 27H-34L-17 7H-25L-9-11H-15Z"
            fill={color.light}
            stroke={color.main}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="m-12-12 12-19 12 19M-19 6l8-10M-26 24l10-10"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeOpacity=".85"
          />
          <path
            d="m0-42 2.7 5.5 6 .8-4.4 4.2 1.1 6L0-28.3l-5.4 2.8 1.1-6-4.4-4.2 6-.8Z"
            className="fill-amber-300"
          />
          <circle cx="-10" cy="5" r="2.3" className="fill-rose-300" />
          <circle cx="12" cy="15" r="2.3" className="fill-amber-300" />
        </>
      );
    case "snowflake":
      return (
        <g className="text-sky-300" transform="scale(1.6)">
          <Snowflake />
        </g>
      );
    case "balloon":
      return (
        <>
          <path
            d="M-2 8q-19 21-4 33"
            className="stroke-stone-400"
            fill="none"
            strokeWidth="1"
          />
          <ellipse cy="-13" rx="20" ry="26" fill={color.light} />
          <path d="m-3 12 6-1 1 6h-9Z" fill={color.main} />
          <path
            d="M-12-24q-5 6-4 11"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case "confetti":
      return (
        <>
          <path
            d="m-27-18 5 9m28-20-4 7m-14 15 9 3m22 13-6 6M-20 28l-7-1"
            stroke={color.main}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="m23-12 6 3M-12 14l2 7"
            className="stroke-amber-300"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
  }
}

export function ContestOrnamentShape({
  kind,
  tone = "rose",
}: {
  kind: ContestOrnamentKind;
  tone?: ContestOrnamentTone;
}) {
  return (
    <g className={ornamentTones[tone]}>
      <OrnamentDrawing kind={kind} />
    </g>
  );
}

export function ContestOrnament({
  kind,
  tone,
  className,
}: {
  kind: ContestOrnamentKind;
  tone?: ContestOrnamentTone;
  className: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-decoration-item={kind}
      viewBox="-42 -42 84 84"
      className={cn(
        "absolute aspect-square -translate-x-1/2 -translate-y-1/2",
        className,
      )}
    >
      <ContestOrnamentShape kind={kind} tone={tone} />
    </svg>
  );
}

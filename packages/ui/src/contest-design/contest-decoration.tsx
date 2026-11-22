import type { ContestAppearance } from "./appearance";
import { ContestGarland } from "./contest-garland";
import { ContestOrnament as Ornament } from "./contest-ornament";

function DecorationScene({ appearance }: { appearance: ContestAppearance }) {
  switch (appearance) {
    case "new-year":
      return (
        <>
          <ContestGarland />
          <Ornament
            kind="fir-tree"
            tone="sky"
            className="top-[18%] left-[88%] w-20 -rotate-6 @min-[1024px]/contest:top-auto @min-[1024px]/contest:-bottom-2 @min-[1024px]/contest:left-[15%] @min-[1024px]/contest:translate-y-0"
          />
          <Ornament
            kind="fir-tree"
            tone="sky"
            className="top-[48%] left-[6%] w-16 rotate-6 @min-[1024px]/contest:top-auto @min-[1024px]/contest:-bottom-2 @min-[1024px]/contest:left-[66%] @min-[1024px]/contest:translate-y-0"
          />
        </>
      );
    case "easter":
      return (
        <>
          <Ornament
            kind="egg"
            tone="violet"
            className="top-[13%] left-[90%] w-16 -rotate-12 @min-[1024px]/contest:top-[16%] @min-[1024px]/contest:left-[13%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="egg"
            tone="rose"
            className="top-[35%] left-[88%] w-16 rotate-12 @min-[1024px]/contest:top-[27%] @min-[1024px]/contest:left-[48%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="egg"
            tone="amber"
            className="top-[57%] left-[6%] w-14 -rotate-12 @min-[1024px]/contest:top-[60%] @min-[1024px]/contest:left-[64%] @min-[1024px]/contest:w-24 @min-[1024px]/contest:rotate-12"
          />
          <Ornament
            kind="egg"
            tone="sky"
            className="top-[73%] left-[62%] w-12 rotate-[28deg] @min-[1024px]/contest:top-[94%] @min-[1024px]/contest:left-[31%] @min-[1024px]/contest:w-16 @min-[1024px]/contest:-rotate-[22deg]"
          />
          <Ornament
            kind="egg"
            tone="rose"
            className="top-[97%] left-[91%] w-20 rotate-[22deg] @min-[1024px]/contest:top-[95%] @min-[1024px]/contest:left-[84%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="egg"
            tone="amber"
            className="top-[3%] left-[53%] w-12 -rotate-12 @min-[1024px]/contest:top-[10%] @min-[1024px]/contest:left-[96%] @min-[1024px]/contest:w-16"
          />
        </>
      );
    case "knowledge-day":
      return (
        <>
          <Ornament
            kind="open-book"
            tone="sky"
            className="top-[12%] left-[89%] w-20 rotate-12 @min-[1024px]/contest:top-[25%] @min-[1024px]/contest:left-[15%] @min-[1024px]/contest:w-20 @min-[1024px]/contest:-rotate-12"
          />
          <Ornament
            kind="book"
            tone="rose"
            className="top-[36%] left-[87%] w-16 -rotate-[20deg] @min-[1024px]/contest:top-[34%] @min-[1024px]/contest:left-[52%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="open-book"
            tone="amber"
            className="top-[60%] left-[9%] w-16 rotate-[18deg] @min-[1024px]/contest:top-[84%] @min-[1024px]/contest:left-[67%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="paper"
            tone="sky"
            className="top-[98%] left-[86%] w-16 -rotate-12 @min-[1024px]/contest:top-[97%] @min-[1024px]/contest:left-[41%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="book"
            tone="emerald"
            className="top-[74%] left-[60%] w-12 rotate-12 @min-[1024px]/contest:top-[15%] @min-[1024px]/contest:left-[96%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="pencil"
            tone="amber"
            className="top-[5%] left-[63%] w-24 rotate-[58deg] @min-[1024px]/contest:top-[7%] @min-[1024px]/contest:left-[75%] @min-[1024px]/contest:w-28 @min-[1024px]/contest:rotate-[66deg]"
          />
        </>
      );
    case "halloween":
      return (
        <>
          <ContestGarland theme="halloween" />
          <Ornament
            kind="pumpkin"
            className="top-[96%] left-[88%] w-24 -rotate-6 @min-[1024px]/contest:top-[94%] @min-[1024px]/contest:left-[13%] @min-[1024px]/contest:w-28"
          />
          <Ornament
            kind="web"
            className="top-[47%] left-[98%] w-20 @min-[1024px]/contest:top-[11%] @min-[1024px]/contest:left-[17%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="bat"
            className="top-[36%] left-[91%] w-14 rotate-12 @min-[1024px]/contest:top-[61%] @min-[1024px]/contest:left-[61%] @min-[1024px]/contest:w-20 @min-[1024px]/contest:-rotate-12"
          />
          <Ornament
            kind="ghost"
            className="top-[62%] left-[8%] w-12 -rotate-12 @min-[1024px]/contest:top-[91%] @min-[1024px]/contest:left-[96%] @min-[1024px]/contest:w-16 @min-[1024px]/contest:rotate-12"
          />
        </>
      );
    case "valentines":
      return (
        <>
          <Ornament
            kind="heart"
            tone="rose"
            className="top-[11%] left-[88%] w-20 rotate-12 @min-[1024px]/contest:top-[29%] @min-[1024px]/contest:left-[14%] @min-[1024px]/contest:w-16 @min-[1024px]/contest:-rotate-12"
          />
          <Ornament
            kind="heart"
            tone="rose"
            className="top-[34%] left-[90%] w-14 -rotate-12 @min-[1024px]/contest:top-[33%] @min-[1024px]/contest:left-[48%] @min-[1024px]/contest:w-14 @min-[1024px]/contest:rotate-12"
          />
          <Ornament
            kind="envelope"
            className="top-[59%] left-[9%] w-20 rotate-12 @min-[1024px]/contest:top-[82%] @min-[1024px]/contest:left-[61%] @min-[1024px]/contest:w-28 @min-[1024px]/contest:-rotate-12"
          />
          <Ornament
            kind="heart"
            tone="rose"
            className="top-[68%] left-[77%] w-12 rotate-[25deg] @min-[1024px]/contest:top-[49%] @min-[1024px]/contest:left-[67%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="heart"
            tone="rose"
            className="top-[98%] left-[89%] w-14 -rotate-12 @min-[1024px]/contest:top-[12%] @min-[1024px]/contest:left-[94%] @min-[1024px]/contest:w-20"
          />
        </>
      );
    case "womens-day":
      return (
        <>
          <Ornament
            kind="mimosa"
            className="top-[14%] left-[90%] w-28 rotate-12 @min-[1024px]/contest:top-[67%] @min-[1024px]/contest:left-[16%] @min-[1024px]/contest:w-32 @min-[1024px]/contest:rotate-[18deg]"
          />
          <Ornament
            kind="tulip"
            tone="rose"
            className="top-[39%] left-[90%] w-20 rotate-[22deg] @min-[1024px]/contest:top-[85%] @min-[1024px]/contest:left-[65%] @min-[1024px]/contest:w-28 @min-[1024px]/contest:-rotate-[25deg]"
          />
          <Ornament
            kind="flower"
            tone="amber"
            className="top-[62%] left-[6%] w-12 @min-[1024px]/contest:top-[28%] @min-[1024px]/contest:left-[49%] @min-[1024px]/contest:w-14"
          />
          <Ornament
            kind="mimosa"
            className="top-[99%] left-[88%] w-24 -rotate-[28deg] @min-[1024px]/contest:top-[12%] @min-[1024px]/contest:left-[96%] @min-[1024px]/contest:w-28"
          />
          <Ornament
            kind="flower"
            tone="rose"
            className="top-[74%] left-[58%] w-10 rotate-12 @min-[1024px]/contest:top-[97%] @min-[1024px]/contest:left-[32%] @min-[1024px]/contest:w-12"
          />
        </>
      );
    case "mothers-day":
      return (
        <>
          <Ornament
            kind="tulip"
            tone="rose"
            className="top-[16%] left-[89%] w-24 -rotate-[18deg] @min-[1024px]/contest:top-[75%] @min-[1024px]/contest:left-[15%] @min-[1024px]/contest:w-32 @min-[1024px]/contest:rotate-[20deg]"
          />
          <Ornament
            kind="flower"
            tone="rose"
            className="top-[36%] left-[91%] w-16 rotate-12 @min-[1024px]/contest:top-[30%] @min-[1024px]/contest:left-[49%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="tulip"
            tone="orange"
            className="top-[60%] left-[8%] w-20 rotate-[22deg] @min-[1024px]/contest:top-[87%] @min-[1024px]/contest:left-[63%] @min-[1024px]/contest:w-24 @min-[1024px]/contest:-rotate-[25deg]"
          />
          <Ornament
            kind="flower"
            tone="amber"
            className="top-[99%] left-[88%] w-16 @min-[1024px]/contest:top-[13%] @min-[1024px]/contest:left-[95%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="heart"
            tone="rose"
            className="top-[70%] left-[75%] w-10 -rotate-12 @min-[1024px]/contest:top-[47%] @min-[1024px]/contest:left-[70%] @min-[1024px]/contest:w-12"
          />
        </>
      );
    case "artmate-birthday":
      return (
        <>
          <ContestGarland theme="birthday" />
          <Ornament
            kind="balloon"
            tone="rose"
            className="top-[29%] left-[90%] w-24 rotate-12 @min-[1024px]/contest:top-[53%] @min-[1024px]/contest:left-[62%] @min-[1024px]/contest:w-28"
          />
          <Ornament
            kind="balloon"
            tone="amber"
            className="top-[60%] left-[7%] w-20 -rotate-12 @min-[1024px]/contest:top-[66%] @min-[1024px]/contest:left-[67%] @min-[1024px]/contest:w-24 @min-[1024px]/contest:-rotate-[18deg]"
          />
          <Ornament
            kind="confetti"
            tone="rose"
            className="top-[68%] left-[88%] w-16 @min-[1024px]/contest:top-[83%] @min-[1024px]/contest:left-[15%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="confetti"
            tone="violet"
            className="top-[98%] left-[87%] w-20 @min-[1024px]/contest:top-[23%] @min-[1024px]/contest:left-[48%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="confetti"
            tone="amber"
            className="top-[38%] left-[9%] w-12 @min-[1024px]/contest:top-[84%] @min-[1024px]/contest:left-[96%] @min-[1024px]/contest:w-20"
          />
        </>
      );
    case "spring":
      return (
        <>
          <Ornament
            kind="tulip"
            tone="rose"
            className="top-[14%] left-[89%] w-24 rotate-[18deg] @min-[1024px]/contest:top-[75%] @min-[1024px]/contest:left-[15%] @min-[1024px]/contest:w-28 @min-[1024px]/contest:rotate-[25deg]"
          />
          <Ornament
            kind="butterfly"
            tone="violet"
            className="top-[36%] left-[88%] w-16 -rotate-12 @min-[1024px]/contest:top-[28%] @min-[1024px]/contest:left-[53%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="flower"
            tone="rose"
            className="top-[60%] left-[6%] w-12 @min-[1024px]/contest:top-[96%] @min-[1024px]/contest:left-[33%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="butterfly"
            tone="amber"
            className="top-[98%] left-[86%] w-16 rotate-12 @min-[1024px]/contest:top-[96%] @min-[1024px]/contest:left-[86%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="leaf"
            tone="emerald"
            className="top-[69%] left-[77%] w-10 rotate-[45deg] @min-[1024px]/contest:top-[11%] @min-[1024px]/contest:left-[95%] @min-[1024px]/contest:w-16"
          />
        </>
      );
    case "summer":
      return (
        <>
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 1000 35"
            preserveAspectRatio="none"
            className="absolute inset-x-0 -bottom-3 h-10 w-full"
          >
            <path
              d="M0 19q50-12 100 0t100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0M-50 28q50-12 100 0t100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0"
              fill="none"
              className="stroke-sky-300"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <Ornament
            kind="sun"
            className="top-[5%] left-[86%] w-24 @min-[1024px]/contest:top-[8%] @min-[1024px]/contest:left-[55%] @min-[1024px]/contest:w-28"
          />
          <Ornament
            kind="boat"
            className="top-[96%] left-[86%] w-24 -rotate-6 @min-[1024px]/contest:top-[91%] @min-[1024px]/contest:left-[67%] @min-[1024px]/contest:w-28"
          />
          <Ornament
            kind="shell"
            tone="rose"
            className="top-[58%] left-[8%] w-16 rotate-12 @min-[1024px]/contest:top-[94%] @min-[1024px]/contest:left-[15%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="shell"
            tone="amber"
            className="top-[35%] left-[90%] w-14 -rotate-[22deg] @min-[1024px]/contest:top-[25%] @min-[1024px]/contest:left-[94%] @min-[1024px]/contest:w-16"
          />
        </>
      );
    case "autumn":
      return (
        <>
          <Ornament
            kind="maple"
            tone="amber"
            className="top-[13%] left-[91%] w-20 rotate-[20deg] @min-[1024px]/contest:top-[69%] @min-[1024px]/contest:left-[14%] @min-[1024px]/contest:w-20 @min-[1024px]/contest:-rotate-[25deg]"
          />
          <Ornament
            kind="leaf"
            tone="orange"
            className="top-[36%] left-[90%] w-16 -rotate-[30deg] @min-[1024px]/contest:top-[29%] @min-[1024px]/contest:left-[49%] @min-[1024px]/contest:w-16"
          />
          <Ornament
            kind="maple"
            tone="orange"
            className="top-[60%] left-[7%] w-16 rotate-[35deg] @min-[1024px]/contest:top-[80%] @min-[1024px]/contest:left-[65%] @min-[1024px]/contest:w-24"
          />
          <Ornament
            kind="leaf"
            tone="amber"
            className="top-[98%] left-[87%] w-20 rotate-12 @min-[1024px]/contest:top-[11%] @min-[1024px]/contest:left-[94%] @min-[1024px]/contest:w-20 @min-[1024px]/contest:rotate-[45deg]"
          />
          <Ornament
            kind="maple"
            tone="amber"
            className="top-[72%] left-[67%] w-12 -rotate-12 @min-[1024px]/contest:top-[96%] @min-[1024px]/contest:left-[34%] @min-[1024px]/contest:w-16"
          />
        </>
      );
    case "winter":
      return (
        <>
          <Ornament
            kind="snowflake"
            className="top-[11%] left-[88%] w-20 rotate-12 @min-[1024px]/contest:top-[69%] @min-[1024px]/contest:left-[14%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="snowflake"
            className="top-[36%] left-[90%] w-14 @min-[1024px]/contest:top-[23%] @min-[1024px]/contest:left-[51%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="snowflake"
            className="top-[60%] left-[7%] w-12 rotate-[25deg] @min-[1024px]/contest:top-[79%] @min-[1024px]/contest:left-[65%] @min-[1024px]/contest:w-24"
          />
          <Ornament
            kind="snowflake"
            className="top-[98%] left-[88%] w-16 @min-[1024px]/contest:top-[15%] @min-[1024px]/contest:left-[96%] @min-[1024px]/contest:w-20"
          />
          <Ornament
            kind="snowflake"
            className="top-[72%] left-[73%] w-10 @min-[1024px]/contest:top-[96%] @min-[1024px]/contest:left-[34%] @min-[1024px]/contest:w-14"
          />
        </>
      );
    case "none":
      return null;
  }
}

export function ContestDecoration({
  appearance,
}: {
  appearance: ContestAppearance;
}) {
  if (appearance === "none") return null;
  return (
    <div
      aria-hidden="true"
      data-contest-decoration={appearance}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
    >
      <DecorationScene appearance={appearance} />
    </div>
  );
}

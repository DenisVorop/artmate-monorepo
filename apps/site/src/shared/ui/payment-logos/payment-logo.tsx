import Image from "next/image";

import { cn } from "@/shared/lib/utils";

import Dolyame from "./assets/dolyame.svg";
import Mir from "./assets/mir.png";
import OzonBank from "./assets/ozon-bank.svg";
import Sbp from "./assets/sbp.svg";
import TBank from "./assets/tbank.svg";

const logos = {
  dolyame: {
    Component: Dolyame,
    label: "Долями",
    className: { default: "h-[18px] w-[126px]", compact: "h-3 w-[84px]" },
    viewBox: "29.89 30.31 1078.29 155.34",
  },
  sbp: {
    Component: Sbp,
    label: "СБП",
    className: { default: "h-7 w-6", compact: "h-5 w-[17.15px]" },
    viewBox: "0 0 42 49",
  },
  ozonbank: {
    Component: OzonBank,
    label: "Ozon Банк",
    className: { default: "h-5 w-[125.6px]", compact: "h-4 w-[100.48px]" },
    viewBox: "0 0 157 25",
  },
  tbank: {
    Component: TBank,
    label: "Т-Банк",
    className: { default: "h-7 w-[91.78px]", compact: "h-6 w-[78.67px]" },
    viewBox: "0 0 118 36",
  },
};

export function PaymentLogo({
  brand,
  className,
  size = "default",
}: {
  brand: keyof typeof logos | "mir";
  className?: string;
  size?: "default" | "compact";
}) {
  const logo = brand === "mir" ? undefined : logos[brand];

  return (
    <span
      role="img"
      aria-label={logo?.label ?? "Мир"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5",
        size === "compact" && "gap-1",
        className,
      )}
    >
      {logo ? (
        <logo.Component
          aria-hidden="true"
          className={logo.className[size]}
          viewBox={logo.viewBox}
        />
      ) : (
        <span className="relative h-[10.26px] w-9 overflow-hidden">
          <Image
            src={Mir}
            unoptimized
            alt=""
            aria-hidden="true"
            className="absolute -top-[21.87px] -left-[9px] h-[54px] w-[54px] max-w-none"
          />
        </span>
      )}
      {brand === "sbp" && (
        <span
          aria-hidden="true"
          className={cn("text-sm font-medium", size === "compact" && "text-xs")}
        >
          СБП
        </span>
      )}
    </span>
  );
}

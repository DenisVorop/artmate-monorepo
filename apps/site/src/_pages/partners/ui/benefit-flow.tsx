"use client";

import type { LucideIcon } from "lucide-react";
import { BadgePercent, SlidersHorizontal, WalletCards } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/lib";
import { Slider } from "@/shared/ui";

const totalBenefitPercent = 20;
const maxCreatorRewardPercent = 15;
const initialCreatorRewardPercent = 10;

export function BenefitFlow() {
  const [creatorReward, setCreatorReward] = useState(initialCreatorRewardPercent);
  const buyerDiscount = totalBenefitPercent - creatorReward;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-[0_25px_80px_rgba(76,49,64,0.11)] backdrop-blur-xl sm:p-6 lg:p-8">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle_at_center,rgba(120,113,108,0.15)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent)] [background-size:18px_18px] opacity-50"
      />

      <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
        <FlowCard
          icon={WalletCards}
          label="Вам"
          percent={creatorReward}
          title="Вознаграждение креатора"
          className="border-violet-200/80 bg-violet-50/80 text-violet-700"
        />

        <div className="relative flex min-h-16 items-center justify-center sm:w-20">
          <div className="absolute h-px w-full bg-linear-to-r from-violet-300 via-rose-400 to-orange-300 sm:h-full sm:w-px sm:bg-linear-to-b" />
          <span className="relative z-10 flex size-11 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 shadow-lg shadow-rose-100">
            <SlidersHorizontal className="size-5" />
          </span>
        </div>

        <FlowCard
          icon={BadgePercent}
          label="Аудитории"
          percent={buyerDiscount}
          title="Скидка покупателю"
          className="border-orange-200/80 bg-orange-50/80 text-orange-700"
        />
      </div>

      <div className="relative mt-5 rounded-2xl border border-stone-200/80 bg-white/85 px-5 py-4 shadow-sm sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs font-extrabold tracking-wide uppercase">
          <span className="text-violet-700">Вознаграждение</span>
          <span className="text-orange-700">Скидка</span>
        </div>
        <Slider
          aria-label="Распределение доступной выгоды между вознаграждением креатора и скидкой покупателю"
          min={0}
          max={maxCreatorRewardPercent}
          step={1}
          value={[creatorReward]}
          onValueChange={(value) =>
            setCreatorReward(value[0] ?? initialCreatorRewardPercent)
          }
          trackClassName="data-horizontal:h-3 bg-orange-200"
          rangeClassName="bg-linear-to-r from-violet-500 via-rose-500 to-rose-400"
          thumbClassName="size-6 border-4 border-white bg-rose-500 shadow-lg shadow-rose-200 ring-rose-300/40"
          thumbProps={{
            "aria-label":
              "Распределение доступной выгоды между вознаграждением креатора и скидкой покупателю",
            "aria-valuetext":
              creatorReward +
              "% — вознаграждение креатора, " +
              buyerDiscount +
              "% — скидка покупателю",
          }}
        />
        <p className="mt-4 text-center text-xs leading-5 text-stone-500">
          Вознаграждение и скидка всегда составляют 20% вместе.
        </p>
      </div>
    </div>
  );
}

type FlowCardProps = {
  className: string;
  icon: LucideIcon;
  label: string;
  percent: number;
  title: string;
};

function FlowCard({ className, icon: Icon, label, percent, title }: FlowCardProps) {
  return (
    <div className={cn("flex min-h-36 flex-col justify-between rounded-3xl border p-5", className)}>
      <Icon className="size-6" />
      <div>
        <p className="text-[10px] font-extrabold tracking-[0.16em] uppercase opacity-60">{label}</p>
        <p className="mt-1 font-heading text-lg leading-tight font-bold text-stone-900 sm:text-xl">
          {title}
        </p>
        <output className="mt-3 block text-2xl font-black tabular-nums" aria-live="polite">
          {percent}%
        </output>
      </div>
    </div>
  );
}

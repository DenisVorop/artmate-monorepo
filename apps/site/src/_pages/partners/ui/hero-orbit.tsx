"use client";

import type { LucideIcon } from "lucide-react";
import { Aperture, BadgePercent, ShoppingBag, Sparkles, WalletCards } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/shared/lib";

const orbitNodes = [
  {
    className: "left-[2%] top-[9%] sm:left-[6%]",
    icon: Aperture,
    label: "Контент",
    number: "01",
    tone: "border-violet-200/80 bg-violet-50/90 text-violet-700",
  },
  {
    className: "right-[1%] top-[14%] sm:right-[4%]",
    icon: BadgePercent,
    label: "Промокод",
    number: "02",
    tone: "border-rose-200/80 bg-rose-50/90 text-rose-700",
  },
  {
    className: "bottom-[10%] right-[2%] sm:right-[7%]",
    icon: ShoppingBag,
    label: "Заказ",
    number: "03",
    tone: "border-orange-200/80 bg-orange-50/90 text-orange-700",
  },
  {
    className: "bottom-[6%] left-[1%] sm:left-[5%]",
    icon: WalletCards,
    label: "Вознаграждение",
    number: "04",
    tone: "border-amber-200/80 bg-amber-50/90 text-amber-700",
  },
] satisfies Array<{
  className: string;
  icon: LucideIcon;
  label: string;
  number: string;
  tone: string;
}>;

export function HeroOrbit() {
  const shouldReduceMotion = useReducedMotion();
  const isMotionActive = !shouldReduceMotion;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[560px]"
      role="group"
      aria-label="Путь партнёрства: от контента и персонального промокода до заказа и вознаграждения"
    >
      <div className="absolute inset-[8%] rounded-full border border-stone-900/8" />
      <div className="absolute inset-[20%] rounded-full border border-dashed border-rose-300/70" />
      <div className="absolute inset-[31%] rounded-full border border-violet-200/80 bg-white/35 shadow-[0_0_70px_rgba(244,63,94,0.08)] backdrop-blur-sm" />

      <motion.div
        aria-hidden
        className="absolute inset-[13%] rounded-full border-t border-r border-rose-400/60"
        animate={isMotionActive ? { rotate: 360 } : {}}
        transition={
          isMotionActive ? { duration: 4.5, ease: "easeOut" } : { duration: 0 }
        }
      />

      <div className="absolute top-1/2 left-1/2 z-10 w-[47%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/90 bg-white/82 p-4 text-center shadow-[0_28px_80px_rgba(80,47,64,0.16)] backdrop-blur-xl sm:p-6">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 via-rose-400 to-orange-400 text-white shadow-lg shadow-rose-300/40 sm:size-14">
          <Sparkles className="size-5 sm:size-6" />
        </div>
        <p className="mb-1 text-[9px] font-extrabold tracking-[0.18em] text-stone-400 uppercase sm:text-[11px]">
          Персональный промокод
        </p>
        <p className="font-heading text-base font-bold tracking-tight text-stone-900 sm:text-xl">
          ВАШ КОД
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] font-bold text-rose-600 sm:text-[11px]">
          <span className="size-1.5 rounded-full bg-rose-500" />
          Вы управляете выгодой
        </div>
      </div>

      {orbitNodes.map((node, index) => (
        <OrbitNode
          key={node.number}
          {...node}
          delay={index * 0.42}
          isMotionActive={isMotionActive}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
        />
      ))}
    </div>
  );
}

type OrbitNodeProps = (typeof orbitNodes)[number] & {
  delay: number;
  isMotionActive: boolean;
  shouldReduceMotion: boolean;
};

function OrbitNode({
  className,
  delay,
  icon: Icon,
  isMotionActive,
  label,
  number,
  shouldReduceMotion,
  tone,
}: OrbitNodeProps) {
  return (
    <motion.div
      className={cn(
        "absolute z-20 flex min-w-28 items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-[0_14px_40px_rgba(63,45,54,0.11)] backdrop-blur-md sm:min-w-36 sm:gap-3 sm:px-4 sm:py-3",
        className,
        tone,
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92, y: 10 }}
      animate={
        shouldReduceMotion
          ? { opacity: 1 }
          : isMotionActive
            ? {
                opacity: 1,
                scale: 1,
                y: [0, -7, 0],
              }
            : { opacity: 1, scale: 1 }
      }
      transition={{
        opacity: { delay: delay * 0.5, duration: 0.45 },
        scale: { delay: delay * 0.5, duration: 0.45 },
        y: isMotionActive
          ? { delay, duration: 3.8, ease: "easeInOut" }
          : { duration: 0 },
      }}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm sm:size-10">
        <Icon className="size-4 sm:size-5" />
      </span>
      <span className="text-left">
        <span className="block text-[9px] font-extrabold tracking-[0.14em] opacity-55 sm:text-[10px]">
          {number}
        </span>
        <span className="block text-[11px] leading-tight font-bold sm:text-sm">{label}</span>
      </span>
    </motion.div>
  );
}

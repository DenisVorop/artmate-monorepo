"use client";

import { Gift, X } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { getWelcomeOfferAction, getWelcomeOfferCopy, useWelcomeBonus } from "../lib";

export function WelcomeBonus() {
  const { activate, dismiss, isPresented, offer } = useWelcomeBonus();

  if (!isPresented || !offer) {
    return null;
  }

  const copy = getWelcomeOfferCopy(offer);
  const action = getWelcomeOfferAction(offer.action);

  return (
    <aside
      aria-label="Приветственный бонус"
      className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 sm:right-[max(1rem,env(safe-area-inset-right))] sm:left-auto sm:w-[min(24rem,calc(100vw-2rem))]"
    >
      <div className="relative animate-in overflow-hidden rounded-2xl border border-rose-200 bg-white/96 p-4 text-stone-800 shadow-[0_18px_60px_rgb(28_25_23/0.18)] backdrop-blur duration-300 fade-in slide-in-from-bottom-3 motion-reduce:animate-none motion-reduce:transition-none sm:p-5">
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-10 size-32 rounded-full bg-rose-100/80 blur-2xl"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Закрыть приветственный бонус"
          onClick={dismiss}
          className="absolute top-2 right-2 z-10 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
          <X aria-hidden="true" />
        </Button>

        <div className="relative flex items-start gap-3 pr-8">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Gift className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold text-stone-950">Приветственный бонус</p>
            <p className="mt-1 text-lg leading-tight font-extrabold text-rose-600">
              {copy.discount}
            </p>
          </div>
        </div>

        <p className="relative mt-3 text-sm leading-5 text-stone-600">{copy.description}</p>
        {copy.conditions ? (
          <p className="relative mt-1 text-xs leading-4 text-stone-500">{copy.conditions}</p>
        ) : null}

        <div className="relative mt-4 flex flex-col gap-2 min-[360px]:flex-row">
          <Link
            href={action.href}
            onClick={activate}
            className={buttonVariants({
              className:
                "h-9 min-h-9 flex-none bg-rose-500 text-white hover:bg-rose-600 hover:text-white focus-visible:text-white min-[360px]:flex-1",
            })}
          >
            {action.label}
          </Link>
          <Button type="button" variant="ghost" onClick={dismiss} className="h-9">
            Не сейчас
          </Button>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { Heart, LoaderCircle } from "lucide-react";
import type { LikeSubject } from "@/entities/likes";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { useLikeAction } from "../lib/use-like-action";

export function LikeButton({
  subject,
  title,
  appearance = "overlay",
}: {
  subject: LikeSubject;
  title: string;
  appearance?: "overlay" | "surface";
}) {
  const { user, data, unknown, busy, failed, unavailable, liked, count, onClick } =
    useLikeAction(subject);
  const className = cn(
    "min-h-11 items-center rounded-full text-xs font-semibold tabular-nums sm:text-sm",
    appearance === "overlay"
      ? "min-w-11 px-1 text-white hover:bg-white/15 hover:text-white focus-visible:border-white/60 focus-visible:ring-rose-300/70 md:min-w-17 md:px-3"
      : "min-w-17 px-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:border-stone-300 focus-visible:ring-rose-400/40",
    liked &&
      (appearance === "overlay"
        ? "text-rose-300 hover:text-rose-200"
        : "text-rose-600 hover:text-rose-700"),
  );
  const contentClassName = cn(
    "inline-flex items-center",
    appearance === "overlay" ? "translate-y-2 gap-1 md:translate-y-0 md:gap-1.5" : "gap-1.5",
  );
  if (user && data && !data.canLike && !failed) {
    return (
      <span
        className={cn(
          className,
          "inline-flex justify-center",
          appearance === "overlay" && "border border-transparent",
        )}
        aria-label={`Ваша работа. Лайков: ${count}`}
      >
        <span className={contentClassName}>
          <Heart className="size-5" aria-hidden="true" />
          {count > 0 && (
            <span className={appearance === "overlay" ? "leading-none" : undefined}>
              {count.toLocaleString("ru-RU")}
            </span>
          )}
        </span>
      </span>
    );
  }

  const label = unknown
    ? "Загружаем лайки"
    : unavailable
      ? "Лайки этой работы недоступны"
      : failed
        ? "Не удалось загрузить лайки. Нажмите, чтобы повторить"
        : `${liked ? "Убрать лайк" : "Мне нравится"}: ${title}. Лайков: ${count}`;
  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      disabled={unknown || busy || unavailable}
      aria-label={label}
      title={failed || unavailable ? label : undefined}
      aria-pressed={unknown || failed || unavailable ? undefined : Boolean(liked)}
      aria-busy={unknown || busy}
      onClick={onClick}
    >
      <span className={contentClassName}>
        {unknown ? (
          <LoaderCircle
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Heart className={cn("size-5", liked && "fill-current")} aria-hidden="true" />
        )}
        {!unknown && !failed && count > 0 && (
          <span className={appearance === "overlay" ? "leading-none" : undefined}>
            {count.toLocaleString("ru-RU")}
          </span>
        )}
      </span>
    </Button>
  );
}

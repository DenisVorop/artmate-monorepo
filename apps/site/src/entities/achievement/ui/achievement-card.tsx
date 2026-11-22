"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import { Button, Progress } from "@/shared/ui";
import { ResponsiveMediaViewer } from "@/shared/ui/responsive-media-viewer";
import type { Achievement } from "../model/types";

export function AchievementCard({ item }: { item: Achievement }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-full min-w-0 flex-col justify-start gap-0 rounded-2xl p-4 text-center whitespace-normal transition-colors focus-visible:ring-rose-400",
          item.earnedAt ? "border-rose-200 bg-rose-50/50" : "border-stone-200 bg-stone-50/60",
        )}
      >
        <AchievementImage item={item} className="mb-3 size-20 sm:size-24" />
        <span className="text-sm font-semibold break-words">{item.title}</span>
        <span className="mt-2 text-xs leading-5 font-normal text-muted-foreground">
          {item.earnedAt ? "Получено" : item.description}
        </span>
        {!item.earnedAt && (
          <span className="mt-2 text-xs">
            {item.progress} из {item.target}
          </span>
        )}
        {item.rewardPoints > 0 && (
          <span className="mt-3 text-sm font-semibold text-rose-600">
            Награда в клубе: {item.rewardPoints.toLocaleString("ru-RU")} б
          </span>
        )}
      </Button>
      <ResponsiveMediaViewer
        compact
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={triggerRef}
        title={item.title}
        description={item.description}
        toolbar={<span className="font-semibold">Достижение</span>}
      >
        <div className="p-6 text-center sm:p-8 md:overflow-y-auto md:overscroll-contain">
          <AchievementImage item={item} className="mx-auto mb-6 size-40" />
          <h2 className="text-2xl font-semibold break-words">{item.title}</h2>
          <p className="mt-3 leading-relaxed text-stone-600">{item.description}</p>
          {item.rewardPoints > 0 && (
            <p className="mt-5 text-xl font-semibold text-rose-600">
              Награда в клубе: {item.rewardPoints.toLocaleString("ru-RU")} б
            </p>
          )}
          {item.earnedAt ? (
            <p className="mt-5 text-sm text-stone-600">
              Получено{" "}
              {new Date(item.earnedAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Moscow",
              })}
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              <p className="text-sm">
                {item.progress} из {item.target}
              </p>
              <Progress
                value={Math.min(100, (item.progress / item.target) * 100)}
                aria-label={`${item.title}: ${item.progress} из ${item.target}`}
              />
            </div>
          )}
        </div>
      </ResponsiveMediaViewer>
    </>
  );
}

function AchievementImage({ item, className }: { item: Achievement; className: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0",
        className,
        item.earnedAt ? "drop-shadow-[0_4px_10px_rgba(244,63,94,0.2)]" : "opacity-60 grayscale",
      )}
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          fill
          sizes="160px"
          unoptimized={shouldBypassNextImageOptimization(item.imageUrl)}
          className="object-contain"
        />
      ) : (
        <Trophy className="size-full! p-5 text-rose-400" aria-hidden="true" />
      )}
    </span>
  );
}

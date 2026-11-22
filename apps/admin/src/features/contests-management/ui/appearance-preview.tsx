"use client";
import { useEffect, useRef, useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import {
  ContestBanner,
  contestBannerActionClasses,
  contestStagePresentation,
  contestStatusClassName,
} from "@repo/ui/contest-design";
import { Badge, Button, Card } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import type { ContestFormValues } from "../lib/form-values";
import { comfortaa, nunito } from "../lib/preview-fonts";

const bannerWidth = 1288;
export function AppearancePreview({
  control,
}: {
  control: Control<ContestFormValues>;
}) {
  const [
    appearance,
    title,
    description,
    prize,
    winnersCount,
    closesAt,
    drawAt,
    opensAt,
    selectionMode,
  ] = useWatch({
    control,
    name: [
      "appearance",
      "title",
      "description",
      "prize",
      "winnersCount",
      "closesAt",
      "drawAt",
      "opensAt",
      "selectionMode",
    ],
  });
  const frame = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: bannerWidth, height: 260 });
  useEffect(() => {
    const container = frame.current,
      content = canvas.current;
    if (!container || !content) return;
    const measure = () =>
      setSize({ width: container.clientWidth, height: content.offsetHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, size.width / bannerWidth);
  const start = new Date(opensAt + ":00+03:00"),
    end = new Date(closesAt + ":00+03:00");
  const stage =
    Number.isFinite(start.getTime()) && start.getTime() > Date.now()
      ? "upcoming"
      : Number.isFinite(end.getTime()) && end.getTime() <= Date.now()
        ? "review"
        : "open";
  const status = contestStagePresentation[stage];
  return (
    <div aria-label="Предпросмотр оформления" className="overflow-hidden p-1">
      <div ref={frame} style={{ height: size.height * scale }}>
        <div
          ref={canvas}
          inert
          className={`${comfortaa.variable} ${nunito.variable} origin-top-left`}
          style={{ width: bannerWidth, transform: `scale(${scale})` }}
        >
          <ContestBanner
            card={Card}
            contest={{
              appearance,
              title: title || "Название конкурса",
              description,
              prize,
              winnersCount: Number(winnersCount) || 1,
              selectionMode,
              closesAt: closesAt ? closesAt + ":00+03:00" : undefined,
              drawAt: drawAt ? drawAt + ":00+03:00" : undefined,
            }}
            status={
              <Badge className={cn(contestStatusClassName, status.className)}>
                {status.label}
              </Badge>
            }
            actions={
              <>
                {stage === "open" && (
                  <Button
                    asChild
                    size="lg"
                    className={contestBannerActionClasses.primary}
                  >
                    <span>Принять участие</span>
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={contestBannerActionClasses.secondary}
                >
                  <span>Условия и работы</span>
                </Button>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

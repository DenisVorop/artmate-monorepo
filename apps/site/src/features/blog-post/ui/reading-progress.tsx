"use client";

import { useEffect, useState } from "react";

import { Progress } from "@/shared/ui";

type ReadingProgressProps = {
  articleId: string;
};

export function ReadingProgress({ articleId }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        const article = document.getElementById(articleId);

        if (!article) {
          setProgress(0);
          return;
        }

        const { top, height } = article.getBoundingClientRect();
        const scrolled = Math.max(-top, 0);
        const total = Math.max(height - window.innerHeight, 1);
        const nextProgress = Math.min((scrolled / total) * 100, 100);

        setProgress(Number.isFinite(nextProgress) ? nextProgress : 0);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [articleId]);

  return (
    <Progress
      value={progress}
      aria-label="Прогресс чтения статьи"
      className="fixed inset-x-0 top-0 z-50 h-1 rounded-none bg-border/50"
      indicatorClassName="bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400"
    />
  );
}

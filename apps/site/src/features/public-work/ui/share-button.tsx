"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/shared/ui";
import { useAnalytics } from "../lib/analytics";

export function ShareWorkButton({ title, workId }: { title: string; workId: string }) {
  const analytics = useAnalytics();
  const [message, setMessage] = useState<string>();

  async function share() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        analytics.workShared(workId);
        setMessage("Ссылка отправлена");
      } else {
        await navigator.clipboard.writeText(url);
        analytics.linkCopied(workId);
        setMessage("Ссылка скопирована");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Не удалось поделиться ссылкой");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" className="min-h-11" onClick={() => void share()}>
        <Share2 data-icon="inline-start" />
        Поделиться
      </Button>
      {message ? (
        <p role="status" className="text-sm text-stone-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}

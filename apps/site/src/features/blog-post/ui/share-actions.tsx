"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Send } from "lucide-react";

import { Button } from "@/shared/ui";
import { useAnalytics } from "../lib/analytics";

type ShareActionsProps = {
  articleSlug: string;
  title: string;
  url: string;
};

export function ShareActions({ articleSlug, title, url }: ShareActionsProps) {
  const analytics = useAnalytics(articleSlug);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      analytics.linkCopied();
      setCopied(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={handleCopy}>
        <Copy />
        {copied ? "Ссылка скопирована" : "Копировать ссылку"}
      </Button>
      <Button asChild variant="secondary">
        <a href={telegramUrl} target="_blank" rel="noreferrer" onClick={analytics.telegramShareClicked}>
          <Send />
          Telegram
        </a>
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui";

import { cdekTrackingUrl } from "../lib";

type ShipmentTrackingNumberProps = {
  readonly className?: string;
  readonly number: string;
};

export function ShipmentTrackingNumber({
  className,
  number,
}: ShipmentTrackingNumberProps) {
  const [isCopied, setIsCopied] = useState(false);
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
      await navigator.clipboard.writeText(number);
      setIsCopied(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 2200);
    } catch {
      // The number stays selectable even when the Clipboard API is unavailable.
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Popover open={isCopied}>
        <PopoverTrigger asChild>
          <button
            aria-label={`Скопировать номер отправления ${number}`}
            className="rounded-sm font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={handleCopy}
            title="Скопировать номер"
            type="button"
          >
            {number}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[min(18rem,calc(100vw-2rem))] border-emerald-200 p-0"
          side="top"
          sideOffset={8}
        >
          <div
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-3 py-2 text-sm"
            role="status"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 text-emerald-600"
            />
            <span>
              <span className="block font-medium">Номер скопирован</span>
              <span className="mt-0.5 block text-muted-foreground">
                {number}
              </span>
            </span>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        asChild
        className="-my-1 text-muted-foreground hover:text-foreground"
        size="icon-xs"
        variant="ghost"
      >
        <a
          aria-label="Отследить отправление СДЭК"
          href={cdekTrackingUrl}
          rel="noreferrer"
          target="_blank"
          title="Отследить"
        >
          <ExternalLink aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

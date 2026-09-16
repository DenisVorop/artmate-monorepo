"use client";

import { Check, Copy, LoaderCircle, Pause, Pencil, Play } from "lucide-react";

import type { AffiliateCode } from "@/entities/affiliate-code";
import { Badge, Button, Card, CardContent, CardFooter } from "@/shared/ui";

import { useAffiliateCodeCard } from "../lib";
import { CodeForm } from "./code-form";

export function CodeCard({ code }: { readonly code: AffiliateCode }) {
  const {
    copied,
    copyCode,
    error,
    isEditing,
    isPending,
    startEditing,
    stopEditing,
    toggleActive,
  } = useAffiliateCodeCard(code);

  return (
    <Card className={!code.isActive ? "bg-card/65" : undefined}>
      <CardContent>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={code.isActive ? "default" : "outline"}>
                {code.isActive ? "Активен" : "На паузе"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("ru-RU").format(
                  new Date(code.createdAt),
                )}
              </span>
            </div>
            <p className="font-heading mt-4 min-w-0 break-words text-xl font-bold text-ink [overflow-wrap:anywhere] sm:text-2xl">
              {code.code}
            </p>
          </div>
          <Button
            aria-label={`Скопировать промокод ${code.code}`}
            onClick={copyCode}
            size="icon"
            type="button"
            variant="outline"
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-ink px-3 py-3 text-white">
            <p className="text-xs font-bold text-white/55">Вам</p>
            <p className="font-heading mt-1 text-xl font-bold">
              {code.partnerPercent}%
            </p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-3 py-3 text-right text-rose-700">
            <p className="text-xs font-bold text-rose-700/65">Покупателю</p>
            <p className="font-heading mt-1 text-xl font-bold">
              {code.buyerPercent}%
            </p>
          </div>
        </div>

        {code.comment ? (
          <p className="mt-5 min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {code.comment}
          </p>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {copied ? "Промокод скопирован" : ""}
        </p>
        {error ? (
          <p className="mt-4 text-sm font-bold text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>

      {isEditing ? (
        <div className="min-w-0 max-w-full border-t px-5 pt-5">
          <CodeForm
            code={code}
            mode="edit"
            onCancel={stopEditing}
            onComplete={stopEditing}
          />
        </div>
      ) : (
        <CardFooter className="flex-wrap justify-end gap-2">
          <Button
            disabled={isPending}
            onClick={startEditing}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Pencil aria-hidden="true" />
            Настроить
          </Button>
          <Button
            disabled={isPending}
            onClick={toggleActive}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : code.isActive ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {code.isActive ? "Поставить на паузу" : "Возобновить"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

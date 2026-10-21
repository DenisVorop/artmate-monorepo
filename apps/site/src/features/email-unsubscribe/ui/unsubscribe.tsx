"use client";

import { Check, MailMinus } from "lucide-react";
import { routes } from "@/shared/constants";
import { Button, Card, CardContent } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { useUnsubscribeState } from "../lib/use-unsubscribe-state";

export function EmailUnsubscribe({ token }: { token?: string }) {
  const { status, error, isPending, confirm, titleRef } = useUnsubscribeState(token);
  const Icon = status === "unsubscribed" ? Check : MailMinus;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50/60 px-4 py-8">
      <Card className="w-full max-w-md rounded-[22px] border-stone-200 bg-white shadow-xl shadow-stone-900/5">
        <CardContent className="space-y-6 p-6 sm:p-8" aria-busy={isPending}>
          <span className="flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-3">
            <h1
              ref={titleRef}
              tabIndex={-1}
              className="font-heading text-2xl leading-snug font-bold outline-none"
            >
              {status === "unsubscribed"
                ? "Вы отписались"
                : status === "invalid"
                  ? "Ссылка недействительна"
                  : "Отписаться от рекламных писем?"}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {status === "unsubscribed"
                ? "Рекламные письма Artmate отключены."
                : status === "invalid"
                  ? "Откройте ссылку из письма ещё раз или измените подписку в настройках аккаунта."
                  : "Письма о заказах и доступе к аккаунту останутся."}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm leading-6 text-destructive">
              {error}
            </p>
          )}
          {status === "ready" ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={isPending}
              onClick={() => {
                void confirm();
              }}
            >
              {isPending ? "Отключаем письма…" : "Отписаться"}
            </Button>
          ) : (
            <Button asChild className="min-h-11 w-full">
              <Link href={status === "invalid" ? routes.accountSettings : routes.home}>
                {status === "invalid" ? "Настройки аккаунта" : "Перейти на сайт"}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useAnalytics } from "../lib/analytics";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  formatLoyaltyDate,
  LoyaltyPoints,
  getOperationPresentation,
  useLoyaltyOperations,
} from "@/entities/loyalty";
import { cn } from "@/shared/lib/utils";
import { Button, Card, CardContent, DataState } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";

export function Operations({ userId }: { userId: string }) {
  const analytics = useAnalytics();
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const { data, isError, isPending } = useLoyaltyOperations(userId, true, cursors.at(-1));

  return (
    <section className="space-y-5" aria-labelledby="loyalty-operations-title">
      <div>
        <SectionTitle id="loyalty-operations-title">История баллов</SectionTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Начисления, списания и резерв для заказов.
        </p>
      </div>
      {isPending ? (
        <DataState
          title="Загружаем историю"
          description="Скоро здесь появятся операции с баллами."
          className="max-w-none"
        />
      ) : isError ? (
        <DataState
          variant="error"
          title="Не удалось загрузить историю"
          description="Попробуйте открыть клуб немного позже."
          className="max-w-none"
        />
      ) : !data?.items.length ? (
        <DataState
          title="Операций пока нет"
          description="Здесь появится история ваших бонусных баллов."
          className="max-w-none"
        />
      ) : (
        <Card>
          <CardContent className="px-5 py-0">
            <ul className="divide-y">
              {data.items.map((operation) => {
                const display = getOperationPresentation(operation);
                return (
                  <li
                    key={operation.id}
                    className="flex flex-col justify-between gap-3 py-5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium break-words">{operation.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {display.detail}
                        {display.balanceAfter !== undefined ? (
                          <>
                            {" "}
                            <LoyaltyPoints points={display.balanceAfter} />
                          </>
                        ) : null}
                      </p>
                      <time
                        dateTime={operation.occurredAt}
                        className="block text-xs text-muted-foreground"
                      >
                        {formatLoyaltyDate(operation.occurredAt)}
                      </time>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-lg font-semibold tabular-nums",
                        display.tone === "positive" ? "text-emerald-700" : "text-stone-700",
                      )}
                    >
                      <LoyaltyPoints points={display.points} prefix={display.prefix} />
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      {(cursors.length > 1 || data?.nextCursor) && (
        <nav
          aria-label="Страницы истории баллов"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            className="min-h-11"
            disabled={cursors.length <= 1 || isPending}
            onClick={() => {
              analytics.operationsPrevious();
              setCursors((current) => current.slice(0, -1));
            }}
          >
            <ArrowLeft className="size-4" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">Страница {cursors.length}</span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!data?.nextCursor || isPending || isError}
            onClick={() => {
              if (!data?.nextCursor) return;
              analytics.operationsNext();
              setCursors((current) => [...current, data.nextCursor ?? undefined]);
            }}
          >
            Далее
            <ArrowRight className="size-4" />
          </Button>
        </nav>
      )}
    </section>
  );
}

"use client";

import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  TicketPercent,
} from "lucide-react";

import { Button, Card, CardContent, DataState } from "@/shared/ui";

import { formatAffiliateCodeCount, useAffiliateCodeList } from "../lib";

import { CodeCard } from "./code-card";
import { CodeForm } from "./code-form";

export function AffiliateCodes() {
  const {
    data,
    firstPage,
    isError,
    isFetching,
    isPending,
    nextPage,
    page,
    previousPage,
    refetch,
    totalPages,
  } = useAffiliateCodeList();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="create-code-heading">
          <div className="mb-6 max-w-xl">
            <h1 className="font-heading text-3xl leading-tight font-bold text-ink sm:text-4xl">
              Промокоды
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Делитесь кодами с аудиторией и выбирайте размер её скидки.
            </p>
          </div>
          <Card className="shadow-shell">
            <CardContent>
              <div className="mb-6 flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-brand">
                  <TicketPercent aria-hidden="true" />
                </span>
                <div>
                  <h2
                    className="font-heading text-lg font-bold"
                    id="create-code-heading"
                  >
                    Новый промокод
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Код сразу станет активным.
                  </p>
                </div>
              </div>
              <CodeForm mode="create" onComplete={firstPage} />
            </CardContent>
          </Card>
        </section>

        <section className="min-w-0" aria-labelledby="codes-list-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2
                className="font-heading text-xl font-bold text-ink"
                id="codes-list-heading"
              >
                Ваши коды
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data
                  ? formatAffiliateCodeCount(data.total)
                  : "Загрузка списка"}
              </p>
            </div>
            {isFetching && !isPending ? (
              <LoaderCircle
                className="animate-spin text-muted-foreground"
                aria-label="Обновляем список"
              />
            ) : null}
          </div>

          {isPending ? (
            <DataState
              compact
              description="Получаем актуальный список."
              status="loading"
              title="Загружаем промокоды"
            />
          ) : isError || !data ? (
            <DataState
              compact
              description="Проверьте соединение и попробуйте снова."
              status="error"
              title="Не удалось загрузить промокоды"
            >
              <Button onClick={() => void refetch()} variant="outline">
                Повторить
              </Button>
            </DataState>
          ) : data.items.length === 0 ? (
            <Card className="border-dashed bg-card/60">
              <CardContent className="py-8 text-center">
                <TicketPercent
                  className="mx-auto size-8 text-rose-500"
                  aria-hidden="true"
                />
                <p className="font-heading mt-4 font-bold">
                  Пока нет промокодов
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Создайте первый код, настройте доли и поделитесь им с
                  аудиторией.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {data.items.map((code) => (
                <CodeCard code={code} key={code.id} />
              ))}
            </div>
          )}

          {data && totalPages > 1 ? (
            <nav
              className="mt-5 flex items-center justify-between gap-3"
              aria-label="Страницы промокодов"
            >
              <Button
                disabled={page <= 1 || isFetching}
                onClick={previousPage}
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" />
                Назад
              </Button>
              <span className="text-sm font-bold text-muted-foreground">
                {page} из {totalPages}
              </span>
              <Button
                disabled={page >= totalPages || isFetching}
                onClick={nextPage}
                type="button"
                variant="outline"
              >
                Дальше
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
